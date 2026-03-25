// E-Soccer Battle — Lib entry point Tauri v2
// Backend limpo: match state, timer, command parsing, SQLite persistence.
// STT/TTS/ONNX removidos — o frontend lida com áudio.

pub mod models;
pub mod db;
pub mod match_state;
mod commands;

use std::sync::Mutex;
use tauri::{Manager, Emitter};
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
        .setup(|app| {
            // Spawn the timer task — ticks every second and emits match_state_changed
            let app_handle = app.handle().clone();

            std::thread::spawn(move || {
                use std::time::Duration;
                let state = app_handle.state::<AppState>();

                loop {
                    std::thread::sleep(Duration::from_secs(1));

                    let mut ms = match state.match_state.lock() {
                        Ok(guard) => guard,
                        Err(_) => continue, // poisoned lock, skip tick
                    };

                    let time_ended: bool = match ms.tick(1) {
                        Ok(ended) => ended,
                        Err(_) => continue,
                    };

                    let match_snapshot = ms.match_data.clone();
                    drop(ms); // release lock before DB access

                    // Persist elapsed time
                    if let Ok(db) = state.db.lock() {
                        let _ = db::update_match(&db, &match_snapshot);
                    }

                    // Emit to frontend
                    let _ = app_handle.emit("match_state_changed", match_snapshot);

                    if time_ended {
                        let _ = app_handle.emit("match_time_up", ());
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao inicializar Tauri");
}
