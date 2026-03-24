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

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Olá, {}! E-Soccer Battle pronto.", name)
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
