// TTS — Text-to-Speech via Kokoro ONNX
// Síntese real com modelo Kokoro-82M, tokenizer IPA e voz pf_dora

use anyhow::{Context, Result};
use ort::value::Tensor;
use ort::session::{builder::SessionBuilder, Session};
use std::collections::HashMap;
use std::sync::Mutex;

// ── Lazy singleton ──────────────────────────────────────────────

static KOKORO: Mutex<Option<KokoroState>> = Mutex::new(None);

struct KokoroState {
    session: Session,
    vocab: HashMap<char, i64>,
    voice_style: Vec<f32>, // [256] — média do voice pack
}

/// Obtém (ou inicializa) o singleton Kokoro.
fn get_kokoro() -> Result<std::sync::MutexGuard<'static, Option<KokoroState>>> {
    let mut guard = KOKORO.lock()
        .map_err(|e| anyhow::anyhow!("poisoned lock no Kokoro singleton: {}", e))?;
    if guard.is_none() {
        *guard = Some(init_kokoro()?);
    }
    Ok(guard)
}

/// Inicializa modelo, vocab e voice style (lazy, só no primeiro uso).
fn init_kokoro() -> Result<KokoroState> {
    // 1. Carregar vocab do tokenizer.json
    let tokenizer_path = crate::audio_utils::get_model_path("models/kokoro/tokenizer.json")?;
    let tokenizer_str = std::fs::read_to_string(&tokenizer_path)
        .with_context(|| format!("falha ao ler tokenizer: {:?}", tokenizer_path))?;
    let tokenizer_json: serde_json::Value = serde_json::from_str(&tokenizer_str)
        .context("falha ao parsear tokenizer.json")?;
    let vocab = load_vocab(&tokenizer_json)?;

    println!("TTS: vocab carregado ({} tokens)", vocab.len());

    // 2. Carregar modelo ONNX
    let model_path = crate::audio_utils::get_model_path("models/kokoro/model.onnx")?;
    let mut builder = SessionBuilder::new()?;
    let session = builder.commit_from_file(&model_path)
        .with_context(|| format!("falha ao carregar modelo Kokoro: {:?}", model_path))?;
    println!("TTS: modelo Kokoro carregado: {:?}", model_path);

    // 3. Carregar voice pack e computar style médio [1, 256]
    let voice_path = crate::audio_utils::get_model_path("models/voices/pf_dora.bin")?;
    let voice_data = crate::audio_utils::read_f32_bin(&voice_path)
        .with_context(|| format!("falha ao ler voice pack: {:?}", voice_path))?;
    let style_dim = 256usize;
    if voice_data.len() % style_dim != 0 {
        anyhow::bail!(
            "voice pack tamanho {} não é múltiplo de style_dim {}",
            voice_data.len(),
            style_dim
        );
    }
    let n_rows = voice_data.len() / style_dim;
    println!("TTS: voice pack carregado ({} x {})", n_rows, style_dim);

    // Média de todas as linhas como style vector representativo
    let mut voice_style = vec![0.0f32; style_dim];
    for row in voice_data.chunks_exact(style_dim) {
        for (i, &v) in row.iter().enumerate() {
            voice_style[i] += v;
        }
    }
    for v in voice_style.iter_mut() {
        *v /= n_rows as f32;
    }

    Ok(KokoroState {
        session,
        vocab,
        voice_style,
    })
}

// ── Vocab ───────────────────────────────────────────────────────

fn load_vocab(json: &serde_json::Value) -> Result<HashMap<char, i64>> {
    let mut vocab = HashMap::new();
    let vocab_obj = json
        .pointer("/model/vocab")
        .and_then(|v| v.as_object())
        .context("tokenizer.json não tem /model/vocab")?;

    for (token, id) in vocab_obj {
        if let Some(id_num) = id.as_i64() {
            // Cada token é um único caractere no vocab do Kokoro
            let chars: Vec<char> = token.chars().collect();
            if chars.len() == 1 {
                vocab.insert(chars[0], id_num);
            }
        }
    }

    if vocab.is_empty() {
        anyhow::bail!("vocab vazio no tokenizer.json");
    }
    Ok(vocab)
}

// ── Tokenização ─────────────────────────────────────────────────

/// Converte texto PT-BR para fonemas IPA compatíveis com o vocab.
/// Abordagem simplificada: mapeamento character-based para frases curtas.
fn phonemize(text: &str) -> String {
    let mut out = String::with_capacity(text.len() * 2);
    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        let c = chars[i].to_ascii_lowercase();

        match c {
            // Vogais
            // Nasais: 'ã' e 'õ' não estão no vocab — aproximamos com a + n / o + n
            'a' if i + 1 < len && chars[i + 1] == '̃' => {
                out.push_str("an");
                i += 2;
                continue;
            }
            'a' if i + 1 < len && (chars[i + 1] == 'o' || chars[i + 1] == 'ô') => {
                out.push_str("aw");
                i += 2;
                continue;
            }
            'a' if i + 1 < len && chars[i + 1] == 'u' => {
                out.push_str("aw");
                i += 2;
                continue;
            }
            'á' | 'à' | 'â' | 'a' => {
                out.push('a');
            }
            'ã' => {
                out.push_str("an");
            }
            'e' if i + 1 < len && chars[i + 1] == 'i' => {
                out.push_str("ej");
                i += 2;
                continue;
            }
            'é' | 'ê' | 'e' => {
                out.push('e');
            }
            'i' if i + 1 < len && chars[i + 1] == 'a' => {
                out.push('i');
                out.push('a');
                i += 2;
                continue;
            }
            'í' | 'i' => {
                out.push('i');
            }
            'o' if i + 1 < len && chars[i + 1] == '̃' => {
                out.push_str("on");
                i += 2;
                continue;
            }
            'ó' | 'õ' | 'ô' | 'o' => {
                out.push('o');
            }
            'u' if i + 1 < len && chars[i + 1] == 'i' => {
                out.push_str("uj");
                i += 2;
                continue;
            }
            'ú' | 'u' => {
                out.push('u');
            }

            // Consoantes
            'b' => out.push('b'),
            'c' if i + 1 < len && (chars[i + 1] == 'e' || chars[i + 1] == 'i') => {
                out.push('s');
                i += 1;
                continue;
            }
            'c' if i + 1 < len && chars[i + 1] == 'h' => {
                out.push('ʃ');
                i += 2;
                continue;
            }
            'c' => out.push('k'),
            'd' if i + 1 < len && chars[i + 1] == 'j' => {
                out.push_str("dʒ");
                i += 2;
                continue;
            }
            'd' => out.push('d'),
            'f' => out.push('f'),
            'g' if i + 1 < len && (chars[i + 1] == 'e' || chars[i + 1] == 'i') => {
                out.push('ʒ');
                i += 1;
                continue;
            }
            'g' if i + 1 < len && chars[i + 1] == 'u' => {
                out.push_str("ɡw");
                i += 2;
                continue;
            }
            'g' => out.push('ɡ'),
            'h' => { /* silencioso em PT-BR */ }
            'j' => out.push('ʒ'),
            'k' => out.push('k'),
            'l' if i + 1 < len && chars[i + 1] == 'h' => {
                out.push_str("ʎ");
                i += 2;
                continue;
            }
            'l' => out.push('l'),
            'm' => out.push('m'),
            'n' if i + 1 < len && chars[i + 1] == 'h' => {
                out.push('ɲ');
                i += 2;
                continue;
            }
            'n' => out.push('n'),
            'p' => out.push('p'),
            'q' if i + 1 < len && chars[i + 1] == 'u' => {
                out.push('k');
                i += 1; // consome 'u', mas deixa a próxima vogal
                continue;
            }
            'q' => out.push('k'),
            'r' if i + 1 < len && chars[i + 1] == 'r' => {
                out.push('ʁ');
                i += 2;
                continue;
            }
            'r' => out.push('ɾ'),
            's' if i + 1 < len && chars[i + 1] == 's' => {
                out.push('s');
                i += 2;
                continue;
            }
            's' => out.push('s'),
            't' if i + 1 < len && chars[i + 1] == 'c' => {
                out.push_str("tʃ");
                i += 2;
                continue;
            }
            't' => out.push('t'),
            'v' => out.push('v'),
            'w' => out.push('w'),
            'x' if i + 1 < len && chars[i + 1] == 's' => {
                out.push('s');
                i += 2;
                continue;
            }
            'x' => out.push('ʃ'),
            'y' => out.push('i'),
            'z' => out.push('z'),

            // Espaço e pontuação
            ' ' => out.push(' '),
            '.' => out.push('.'),
            '!' => out.push('!'),
            '?' => out.push('?'),
            ',' => out.push(','),
            ':' => out.push(':'),
            ';' => out.push(';'),
            '-' => out.push(' '),

            // Caracteres IPA que já estão no vocab — passar direto
            'ɑ' | 'ɐ' | 'ɒ' | 'æ' | 'β' | 'ɔ' | 'ɕ' | 'ç' | 'ɖ' | 'ð' | 'ʤ'
            | 'ə' | 'ɚ' | 'ɛ' | 'ɜ' | 'ɟ' | 'ɡ' | 'ɥ' | 'ɨ' | 'ɪ' | 'ʝ'
            | 'ɯ' | 'ɰ' | 'ŋ' | 'ɳ' | 'ɲ' | 'ɴ' | 'ø' | 'ɸ' | 'θ' | 'œ'
            | 'ɹ' | 'ɾ' | 'ɻ' | 'ʁ' | 'ɽ' | 'ʂ' | 'ʃ' | 'ʈ' | 'ʧ' | 'ʊ'
            | 'ʋ' | 'ʌ' | 'ɣ' | 'ɤ' | 'χ' | 'ʎ' | 'ʒ' | 'ʔ' | 'ˈ' | 'ˌ'
            | 'ː' | 'ʰ' | 'ʲ' | '↓' | '→' | '↗' | '↘' | 'ᵻ' | '̃'
            | 'ʣ' | 'ʥ' | 'ʦ' | 'ʨ' | 'ᵝ' | 'ꭧ' | 'ᵊ'
            | 'A' | 'I' | 'O' | 'Q' | 'S' | 'T' | 'W' | 'Y'
            | '—' | '…' | '"' | '(' | ')' | '\u{201c}' | '\u{201d}' => {
                out.push(c);
            }

            // Qualquer outro: ignorar (o normalizer faria o mesmo)
            _ => {}
        }

        i += 1;
    }

    // Remover espaços duplicados
    let result: String = out.split(' ')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    result
}

/// Converte fonemas para token IDs usando o vocab do tokenizer.
/// Formato de saída: [$] [tokens...] [$] (delimitadores de início/fim).
fn tokenize(phonemes: &str, vocab: &HashMap<char, i64>) -> Result<Vec<i64>> {
    let delimiter = '$';
    let delim_id = vocab
        .get(&delimiter)
        .copied()
        .context("delimitador '$' não encontrado no vocab")?;

    let mut ids = vec![delim_id];
    for c in phonemes.chars() {
        if let Some(&id) = vocab.get(&c) {
            ids.push(id);
        }
        // chars não no vocab são ignorados (como o normalizer faz)
    }
    ids.push(delim_id);
    Ok(ids)
}

// ── API pública ─────────────────────────────────────────────────

/// Sintetiza texto para áudio WAV (session-less, usa singleton interno).
/// Auto-inicializa o modelo Kokoro no primeiro uso.
pub fn speak(text: &str) -> Result<Vec<u8>> {
    synthesize(&get_kokoro()?.as_ref()
        .context("Kokoro não inicializado")?
        .session, text)
}

// ── API compat (com session param) ────────────────────────────

/// Carrega o modelo Kokoro ONNX (lazy, só quando necessário).
/// Na prática, o modelo é carregado no primeiro synthesize().
pub fn load_kokoro_model() -> Result<()> {
    drop(get_kokoro()?); // MutexGuard dropped intentionally after init
    println!("TTS: modelo Kokoro pronto para uso");
    Ok(())
}

/// Sintetiza texto para áudio WAV.
/// Input: texto em PT-BR (frases curtas).
/// Output: bytes WAV 16-bit PCM 24kHz.
pub fn synthesize(_session: &Session, text: &str) -> Result<Vec<u8>> {
    if text.is_empty() {
        let silence = vec![0.0f32; 12000];
        return crate::audio_utils::write_wav(&silence, 24000);
    }

    let mut guard = get_kokoro()?;
    let state = guard.as_mut()
        .context("Kokoro não inicializado")?;

    let sample_rate = 24000u32;

    // 1. Texto → fonemas → tokens
    let phonemes = phonemize(text);
    println!("TTS: input=\"{}\" phonemes=\"{}\"", text, phonemes);

    let input_ids = tokenize(&phonemes, &state.vocab)?;
    if input_ids.len() < 3 {
        // Só delimitadores, sem conteúdo
        let silence = vec![0.0f32; 12000];
        return crate::audio_utils::write_wav(&silence, sample_rate);
    }

    println!("TTS: {} tokens", input_ids.len());

    // 2. Preparar tensors de input
    let seq_len = input_ids.len() as i64;

    let input_ids_tensor = Tensor::from_array(
        ([1i64, seq_len], input_ids.clone())
    )?;

    let style_tensor = Tensor::from_array(
        ([1i64, 256i64], state.voice_style.clone())
    )?;

    let speed_tensor = Tensor::from_array(([1i64], vec![1.0f32]))?;

    // 3. Rodar inference
    let inputs: Vec<(&str, ort::value::Value)> = vec![
        ("input_ids", input_ids_tensor.into()),
        ("style", style_tensor.into()),
        ("speed", speed_tensor.into()),
    ];
    let outputs = state
        .session
        .run(inputs)
        .context("falha na inference do Kokoro")?;

    // 4. Extrair waveform do output
    let waveform_val = outputs
        .get("waveform")
        .context("output 'waveform' não encontrado na inference")?;

    let tensor_ref = waveform_val
        .downcast_ref::<ort::value::DynTensorValueType>()
        .context("output waveform não é tensor")?;
    let (_, waveform_data) = tensor_ref
        .try_extract_tensor::<f32>()
        .context("falha ao extrair dados do tensor waveform como f32")?;

    // waveform shape: [1, num_samples]
    let samples: Vec<f32> = waveform_data.iter().copied().collect();

    println!(
        "TTS: gerados {} samples ({:.2}s)",
        samples.len(),
        samples.len() as f32 / sample_rate as f32
    );

    // 5. Converter para WAV
    crate::audio_utils::write_wav(&samples, sample_rate)
        .context("falha ao gerar WAV do TTS")
}
