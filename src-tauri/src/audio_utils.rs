// Audio Utils — funções auxiliares para processamento de áudio
// Decodifica WebM/WAV, resample, escreve headers WAV

use anyhow::{Context, Result};
use std::io::Cursor;
use symphonia::core::audio::AudioBufferRef;
use symphonia::core::audio::Signal;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::probe::Hint;

/// Decodifica arquivo WAV para samples f32 mono
pub fn decode_wav_to_samples(wav_bytes: &[u8]) -> Result<Vec<f32>> {
    let cursor = Cursor::new(wav_bytes.to_vec());
    let reader = hound::WavReader::new(cursor)
        .context("falha ao ler WAV — formato inválido")?;

    let spec = reader.spec();
    if spec.sample_format != hound::SampleFormat::Int {
        anyhow::bail!("formato de amostra não suportado: {:?}", spec.sample_format);
    }

    let channels = spec.channels as usize;
    let mut samples = Vec::new();

    if spec.bits_per_sample == 16 {
        for sample in reader.into_samples::<i16>() {
            let s = sample.context("erro ao ler sample")?;
            samples.push(s as f32 / i16::MAX as f32);
        }
    } else if spec.bits_per_sample == 32 {
        for sample in reader.into_samples::<i32>() {
            let s = sample.context("erro ao ler sample")?;
            samples.push(s as f32 / i32::MAX as f32);
        }
    } else {
        anyhow::bail!("bits per sample não suportado: {}", spec.bits_per_sample);
    }

    if channels > 1 {
        let mut mono = Vec::with_capacity(samples.len() / channels);
        for chunk in samples.chunks(channels) {
            mono.push(chunk.iter().sum::<f32>() / channels as f32);
        }
        Ok(mono)
    } else {
        Ok(samples)
    }
}

/// Decodifica WebM/Opus para samples f32 mono 16kHz
pub fn decode_webm_to_samples(webm_bytes: &[u8]) -> Result<Vec<f32>> {
    let cursor = Cursor::new(webm_bytes.to_vec());
    let mss = MediaSourceStream::new(Box::new(cursor), Default::default());

    let mut hint = Hint::new();
    hint.with_extension("webm");

    let probe_result = symphonia::default::get_probe().format(
        &hint, mss, &Default::default(), &Default::default(),
    ).context("falha ao reconhecer formato WebM — dados inválidos")?;

    let mut format_reader = probe_result.format;

    let track = format_reader
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .context("nenhuma faixa de áudio encontrada no WebM")?;

    let source_rate = track.codec_params.sample_rate
        .context("taxa de amostragem desconhecida no WebM")?;
    let n_channels = track.codec_params.channels
        .map(|c| c.count())
        .unwrap_or(1);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .context("codec de áudio não suportado — esperado Opus")?;

    let mut all_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format_reader.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::ResetRequired) => continue,
            Err(symphonia::core::errors::Error::IoError(e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(e) => return Err(e).context("erro ao ler pacote WebM"),
        };

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(e) => return Err(e).context("erro ao decodificar pacote"),
        };

        extract_samples_f32(&decoded, n_channels, &mut all_samples);
    }

    if all_samples.is_empty() {
        anyhow::bail!("WebM decodificado sem samples — arquivo vazio ou silencioso");
    }

    if source_rate != 16000 {
        all_samples = resample(&all_samples, source_rate, 16000);
    }

    println!(
        "WebM/Opus: {} samples ({}s em 16kHz)",
        all_samples.len(),
        all_samples.len() as f32 / 16000.0
    );

    Ok(all_samples)
}

/// Extrai samples f32 de um AudioBufferRef genérico, convertendo para mono
fn extract_samples_f32(buf_ref: &AudioBufferRef, n_channels: usize, output: &mut Vec<f32>) {
    // Converter para f32 equivalente
    let f32_buf = buf_ref.make_equivalent::<f32>();

    let n_frames = f32_buf.frames();
    let planes_ref = f32_buf.planes();
    let planes = planes_ref.planes();
    if n_channels == 1 {
        // Mono — copiar canal 0 diretamente
        if let Some(ch0) = planes.first() {
            output.extend_from_slice(ch0);
        }
    } else {
        // Multi-channel — média dos canais (planar)
        for i in 0..n_frames {
            let mut sum = 0.0f32;
            for ch in 0..n_channels.min(planes.len()) {
                if i < planes[ch].len() {
                    sum += planes[ch][i];
                }
            }
            output.push(sum / n_channels.max(1) as f32);
        }
    }
}

/// Resample de um sample rate para outro usando interpolação linear
pub fn resample(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate {
        return samples.to_vec();
    }

    let ratio = from_rate as f64 / to_rate as f64;
    let output_len = ((samples.len() as f64) / ratio).ceil() as usize;
    let mut output = Vec::with_capacity(output_len);

    for i in 0..output_len {
        let src_idx = i as f64 * ratio;
        let idx_floor = src_idx.floor() as usize;
        let idx_ceil = (idx_floor + 1).min(samples.len() - 1);
        let frac = src_idx - idx_floor as f64;
        output.push((samples[idx_floor] as f64 * (1.0 - frac) + samples[idx_ceil] as f64 * frac) as f32);
    }

    output
}

/// Escreve buffer de samples f32 como WAV 16-bit PCM mono
pub fn write_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>> {
    let mut cursor = Cursor::new(Vec::new());
    {
        let spec = hound::WavSpec {
            channels: 1, sample_rate, bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::new(&mut cursor, spec)
            .context("falha ao criar WAV writer")?;
        for &sample in samples {
            writer.write_sample((sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
                .context("falha ao escrever sample")?;
        }
        writer.finalize().context("falha ao finalizar WAV")?;
    }
    Ok(cursor.into_inner())
}

/// Normaliza samples para amplitude máxima
pub fn normalize(samples: &mut [f32]) {
    let max = samples.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
    if max > 0.0 {
        for s in samples.iter_mut() {
            *s /= max;
        }
    }
}

/// Procura arquivo relativo ao diretório de modelos ou executável
pub fn get_model_path(relative: &str) -> Result<std::path::PathBuf> {
    let exe_dir = std::env::current_exe()
        .context("não conseguiu determinar diretório do executável")?
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .to_path_buf();

    let candidates = [
        exe_dir.join(relative),
        exe_dir.join("..").join(relative),
        std::env::current_dir().unwrap_or_default().join(relative),
        std::env::current_dir().unwrap_or_default().join("..").join(relative),
        std::path::Path::new("/tmp/esoccer-battle-v2/src-tauri").join(relative),
    ];

    for c in &candidates {
        if c.exists() {
            return Ok(c.clone());
        }
    }

    anyhow::bail!("arquivo de modelo não encontrado: {}", relative)
}

/// Lê arquivo binário de floats f32
pub fn read_f32_bin(path: &std::path::Path) -> Result<Vec<f32>> {
    let data = std::fs::read(path)
        .with_context(|| format!("falha ao ler {:?}", path))?;
    if data.len() % 4 != 0 {
        anyhow::bail!("arquivo binário f32 inválido em {:?}", path);
    }
    let mut samples = Vec::with_capacity(data.len() / 4);
    for chunk in data.chunks_exact(4) {
        samples.push(f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]));
    }
    Ok(samples)
}
