// STT — Speech-to-Text via Whisper ONNX (encoder + decoder como caixa preta)
// Black-box ONNX inference: sem atenção manual, sem KV-cache.
// Compatível com whisper-tiny (hidden_dim=384) exportado via optimum.

use anyhow::{Context, Result};
use ort::value::Tensor;
use rustfft::FftPlanner;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

// ─── Constantes Whisper ────────────────────────────────────────────────

const SAMPLE_RATE: usize = 16000;
const N_FFT: usize = 400;
const HOP_LENGTH: usize = 160;
const N_MELS: usize = 80;
const N_FRAMES: usize = 3000; // 30s
const FMIN: f32 = 0.0;
const FMAX: f32 = 8000.0;
const MAX_TOKENS: usize = 224;
const VOCAB_SIZE: usize = 51865;

// Tokens especiais Whisper
const TOKEN_SOT: i64 = 50258;
const TOKEN_NOTIMESTAMPS: i64 = 50362;
const TOKEN_EOT: i64 = 50257;

// ─── WhisperSession ────────────────────────────────────────────────────

pub struct WhisperSession {
    encoder: ort::session::Session,
    decoder: ort::session::Session,
    vocab: HashMap<i64, String>,
}

impl WhisperSession {
    pub fn new() -> Result<Self> {
        let models_dir = find_models_dir()?;
        let encoder_path = models_dir.join("whisper/encoder_model.onnx");
        let decoder_path = models_dir.join("whisper/decoder_model_merged.onnx");
        let tokenizer_path = models_dir.join("whisper/tokenizer.json");

        for (name, path) in [
            ("encoder", encoder_path.as_path()),
            ("decoder", decoder_path.as_path()),
            ("tokenizer", tokenizer_path.as_path()),
        ] {
            if !path.exists() {
                anyhow::bail!("{} não encontrado: {:?}", name, path);
            }
        }

        println!("Carregando encoder Whisper...");
        let encoder = ort::session::builder::SessionBuilder::new()?
            .commit_from_file(&encoder_path)
            .context("falha ao carregar encoder Whisper")?;

        println!("Carregando decoder Whisper...");
        let decoder = ort::session::builder::SessionBuilder::new()?
            .commit_from_file(&decoder_path)
            .context("falha ao carregar decoder Whisper")?;

        let vocab = load_vocab(&tokenizer_path)?;
        println!("Whisper carregado: vocab={}", vocab.len());

        Ok(Self {
            encoder,
            decoder,
            vocab,
        })
    }

    /// Transcreve samples f32 16kHz mono para texto
    pub fn transcribe(&mut self, samples: &[f32]) -> Result<String> {
        if samples.is_empty() {
            return Ok(String::new());
        }

        println!(
            "STT: {} samples ({}s)",
            samples.len(),
            samples.len() as f32 / 16000.0
        );

        let mel = compute_mel_spectrogram(samples)
            .context("falha ao calcular mel spectrogram")?;

        // 1. Encoder: [1, 80, 3000] → [1, 1500, 384]
        let mel_tensor =
            Tensor::from_array(([1i64, N_MELS as i64, N_FRAMES as i64], mel.clone()))
                .context("falha ao criar tensor mel")?;

        let enc_outputs = self
            .encoder
            .run(ort::inputs!["input_features" => mel_tensor])?;
        let enc_hidden = enc_outputs
            .get("last_hidden_state")
            .context("encoder não produziu last_hidden_state")?;

        let (enc_shape, enc_data) = enc_hidden
            .try_extract_tensor::<f32>()
            .context("falha ao extrair encoder output como f32")?;
        println!(
            "Encoder output: shape={:?}",
            enc_shape
        );

        // Precisamos manter encoder_hidden_states como tensor reutilizável
        let enc_seq_len = enc_shape[1] as i64;
        let hidden_dim = enc_shape[2] as i64;
        let enc_tensor = Tensor::from_array((
            [1i64, enc_seq_len, hidden_dim],
            enc_data.to_vec(),
        ))
        .context("falha ao criar tensor encoder_hidden_states")?;

        // 2. Greedy decode sem cache — passamos todos os tokens a cada step
        let mut input_ids: Vec<i64> = vec![TOKEN_SOT, TOKEN_NOTIMESTAMPS];

        for _step in 0..MAX_TOKENS {
            let seq_len = input_ids.len() as i64;
            let ids_tensor = Tensor::from_array(([1i64, seq_len], input_ids.clone()))?;

            let dec_outputs = self.decoder.run(ort::inputs![
                "input_ids" => ids_tensor,
                "encoder_hidden_states" => enc_tensor.clone()
            ])?;

            let logits_val = dec_outputs
                .get("logits")
                .context("decoder não produziu logits")?;
            let (_logits_shape, logits_data) = logits_val
                .try_extract_tensor::<f32>()
                .context("falha ao extrair logits como f32")?;

            // Pegar logits do último token (última linha da dimensão seq)
            let last_token_offset = (input_ids.len() - 1) * VOCAB_SIZE;
            let next_token =
                argmax(&logits_data[last_token_offset..last_token_offset + VOCAB_SIZE]) as i64;

            if next_token == TOKEN_EOT {
                break;
            }

            input_ids.push(next_token);
        }

        // 3. Converter tokens para texto
        let text: String = input_ids
            .iter()
            .skip(1) // pular SOT
            .take_while(|&&t| t != TOKEN_EOT && t != TOKEN_NOTIMESTAMPS)
            .filter_map(|&t| self.vocab.get(&t).cloned())
            .collect::<Vec<_>>()
            .join("")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .trim()
            .to_lowercase();

        println!("STT: '{}'", text);
        Ok(text)
    }
}

// ─── API pública (session-less, usa singleton interno) ─────────────────

/// Transcreve bytes de áudio (WAV ou WebM/Opus) para texto.
/// Auto-inicializa o modelo Whisper no primeiro uso.
pub fn transcribe_bytes(audio_bytes: &[u8]) -> Result<String> {
    let mut guard = WHISPER.lock().unwrap();
    if guard.is_none() {
        *guard = Some(WhisperSession::new().context("falha ao inicializar Whisper")?);
    }
    let session = guard.as_mut().unwrap();

    let samples = if crate::audio_utils::decode_wav_to_samples(audio_bytes).is_ok() {
        crate::audio_utils::decode_wav_to_samples(audio_bytes)?
    } else {
        crate::audio_utils::decode_webm_to_samples(audio_bytes)?
    };
    session.transcribe(&samples)
}

// ─── Singleton ─────────────────────────────────────────────────────────

static WHISPER: Mutex<Option<WhisperSession>> = Mutex::new(None);

pub fn load_whisper_model() -> Result<ort::session::Session> {
    let session = WhisperSession::new().context("falha ao carregar Whisper")?;
    *WHISPER.lock().unwrap() = Some(session);
    let models_dir = find_models_dir()?;
    ort::session::builder::SessionBuilder::new()?
        .commit_from_file(models_dir.join("whisper/encoder_model.onnx"))
        .context("falha ao carregar encoder (dummy)")
}

pub fn transcribe(_session: &ort::session::Session, samples: &[f32]) -> Result<String> {
    let mut guard = WHISPER.lock().unwrap();
    if guard.is_none() {
        *guard = Some(WhisperSession::new()?);
    }
    guard.as_mut().unwrap().transcribe(samples)
}

pub fn transcribe_audio_bytes(
    session: &ort::session::Session,
    audio_bytes: &[u8],
) -> Result<String> {
    let samples = if crate::audio_utils::decode_wav_to_samples(audio_bytes).is_ok() {
        crate::audio_utils::decode_wav_to_samples(audio_bytes)?
    } else {
        crate::audio_utils::decode_webm_to_samples(audio_bytes)?
    };

    transcribe(session, &samples)
}

// ─── Encontrar diretório de modelos ────────────────────────────────────

fn find_models_dir() -> Result<std::path::PathBuf> {
    let exe_dir = std::env::current_exe()
        .context("não conseguiu determinar diretório do executável")?
        .parent()
        .unwrap_or(Path::new("."))
        .to_path_buf();

    let candidates = [
        exe_dir.join("models"),
        exe_dir.join("../models"),
        std::env::current_dir().unwrap_or_default().join("models"),
        std::env::current_dir().unwrap_or_default().join("../models"),
        Path::new("/tmp/esoccer-battle-v2/src-tauri/models").to_path_buf(),
    ];

    for c in &candidates {
        if c.join("whisper/encoder_model.onnx").exists() {
            return Ok(c.clone());
        }
    }

    anyhow::bail!("diretório de modelos Whisper não encontrado")
}

// ─── Tokenizer ─────────────────────────────────────────────────────────

fn load_vocab(path: &Path) -> Result<HashMap<i64, String>> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("falha ao ler {:?}", path))?;

    let json: serde_json::Value =
        serde_json::from_str(&content).context("falha ao parsear tokenizer.json")?;

    let mut vocab = HashMap::new();

    if let Some(model) = json.get("model").and_then(|m| m.get("vocab")) {
        if let Some(obj) = model.as_object() {
            for (token, id) in obj {
                if let Some(id_num) = id.as_i64() {
                    vocab.insert(id_num, token.clone());
                }
            }
        }
    }

    if let Some(added) = json.get("added_tokens").and_then(|a| a.as_array()) {
        for item in added {
            if let (Some(c), Some(id)) = (
                item.get("content").and_then(|c| c.as_str()),
                item.get("id").and_then(|i| i.as_i64()),
            ) {
                vocab.insert(id, c.to_string());
            }
        }
    }

    if vocab.is_empty() {
        anyhow::bail!("vocabulário vazio em {:?}", path);
    }

    Ok(vocab)
}

// ─── Mel Spectrogram ───────────────────────────────────────────────────

fn compute_mel_spectrogram(samples: &[f32]) -> Result<Vec<f32>> {
    let max_samples = N_FRAMES * HOP_LENGTH;
    let padded = if samples.len() < max_samples {
        let mut v = samples.to_vec();
        v.resize(max_samples, 0.0);
        v
    } else {
        samples[..max_samples].to_vec()
    };

    // Janela Hann
    let window: Vec<f32> = (0..N_FFT)
        .map(|i| {
            0.5
                * (1.0
                    - (2.0 * std::f32::consts::PI * i as f32 / (N_FFT - 1) as f32).cos())
        })
        .collect();

    let mel_fb = create_mel_filterbank();
    let half = N_FFT / 2 + 1; // 201 bins

    let mut mel_spec = vec![0.0f32; N_MELS * N_FRAMES];
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(N_FFT);
    let mut buf = vec![rustfft::num_complex::Complex32::new(0.0, 0.0); N_FFT];

    for frame in 0..N_FRAMES {
        let start = frame * HOP_LENGTH;
        for i in 0..N_FFT {
            let s = if start + i < padded.len() {
                padded[start + i]
            } else {
                0.0
            };
            buf[i] = rustfft::num_complex::Complex32::new(s * window[i], 0.0);
        }
        fft.process(&mut buf);

        let power: Vec<f32> = (0..half)
            .map(|k| {
                let mag = buf[k].norm().max(1e-10);
                mag * mag
            })
            .collect();

        for m in 0..N_MELS {
            let mut energy = 0.0f32;
            for k in 0..half.min(mel_fb[m].len()) {
                energy += power[k] * mel_fb[m][k];
            }
            mel_spec[m * N_FRAMES + frame] = energy.ln().max(-10.0);
        }
    }

    // Normalização Whisper: (x + 4) / 4, clamped [-1, 1]
    for v in mel_spec.iter_mut() {
        *v = ((*v + 4.0) / 4.0).clamp(-1.0, 1.0);
    }

    Ok(mel_spec)
}

fn create_mel_filterbank() -> Vec<Vec<f32>> {
    let half = N_FFT / 2 + 1;
    let mel_low = hz_to_mel(FMIN);
    let mel_high = hz_to_mel(FMAX);

    let fft_bins: Vec<f32> = (0..=N_MELS + 1)
        .map(|i| {
            let m = mel_low + (mel_high - mel_low) * i as f32 / (N_MELS + 1) as f32;
            let hz = mel_to_hz(m);
            ((N_FFT + 1) as f32 * hz / SAMPLE_RATE as f32).floor()
        })
        .collect();

    let mut fb = vec![vec![0.0f32; half]; N_MELS];
    for m in 0..N_MELS {
        let fl = fft_bins[m] as usize;
        let fc = fft_bins[m + 1] as usize;
        let fr = fft_bins[m + 2] as usize;
        for k in fl..fc.min(half) {
            if fc != fl {
                fb[m][k] = (k as f32 - fl as f32) / (fc as f32 - fl as f32);
            }
        }
        for k in fc..fr.min(half) {
            if fr != fc {
                fb[m][k] = (fr as f32 - k as f32) / (fr as f32 - fc as f32);
            }
        }
    }
    fb
}

fn hz_to_mel(hz: f32) -> f32 {
    2595.0 * (1.0 + hz / 700.0).ln()
}
fn mel_to_hz(mel: f32) -> f32 {
    700.0 * (mel / 2595.0).exp() - 700.0
}

fn argmax(data: &[f32]) -> usize {
    data.iter()
        .enumerate()
        .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, _)| i)
        .unwrap_or(0)
}
