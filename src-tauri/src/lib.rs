// E-Soccer Battle — Lib entry point Tauri v2
// Fase F2: models + structs + SQLite + match state + commands

pub mod models;
pub mod db;
pub mod match_state;
mod commands;
mod stt;
mod tts;
mod audio_utils;

use std::sync::Mutex;
use models::Match;
use match_state::MatchState;

/// Estado gerenciado pelo Tauri — accessível via `tauri::State<AppState>`
pub struct AppState {
    pub match_state: Mutex<MatchState>,
    pub db: Mutex<rusqlite::Connection>,
}

#[derive(Debug, serde::Serialize)]
pub struct ModelsStatus {
    pub ready: bool,
    pub missing: Vec<String>,
    pub found: Vec<String>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Olá, {}! E-Soccer Battle pronto.", name)
}

/// Verifica se todos os arquivos de modelo necessários existem.
/// Retorna status com lista de arquivos encontrados e ausentes.
#[tauri::command]
fn check_models_ready() -> ModelsStatus {
    let models_dir = crate::audio_utils::get_models_dir();

    let required = [
        ("whisper/encoder_model.onnx", "Whisper Encoder"),
        ("whisper/decoder_model_merged.onnx", "Whisper Decoder"),
        ("whisper/tokenizer.json", "Whisper Tokenizer"),
        ("kokoro/model.onnx", "Kokoro Model"),
        ("kokoro/tokenizer.json", "Kokoro Tokenizer"),
        ("voices/pf_dora.bin", "Voz pf_dora"),
    ];

    let mut found = Vec::new();
    let mut missing = Vec::new();

    for (rel, label) in &required {
        let path = models_dir.join(rel);
        if path.exists() {
            found.push(label.to_string());
        } else {
            missing.push(format!("{} ({})", label, rel));
        }
    }

    ModelsStatus {
        ready: missing.is_empty(),
        missing,
        found,
    }
}

pub fn run() {
    let conn = db::get_connection().expect("falha ao inicializar banco de dados");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            match_state: Mutex::new(MatchState::new(Match::new("Time A", "Time B"))),
            db: Mutex::new(conn),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            check_models_ready,
            commands::start_match,
            commands::get_current_match,
            commands::get_match_history,
            commands::process_voice_command,
            commands::process_text_command,
            commands::get_command_log,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao inicializar Tauri");
}
