// E-Soccer Battle — Lib entry point Tauri v2
// Backend limpo: match state, timer, command parsing, SQLite persistence.
// STT/TTS/ONNX removidos — o frontend lida com áudio.

pub mod models;
pub mod db;
pub mod match_state;
mod commands;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Manager, Emitter};
use models::Match;
use match_state::MatchState;

/// Holds the timer thread's JoinHandle for graceful shutdown.
pub struct TimerHandle(pub std::sync::Mutex<Option<std::thread::JoinHandle<()>>>);

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
            commands::start_match_with_names,
            commands::set_team_names,
            commands::get_current_match,
            commands::get_match_history,
            commands::process_voice_command,
            commands::process_text_command,
            commands::get_command_log,
        ])
        .setup(|app| {
            // Spawn the timer task — ticks every second and emits match_state_update
            let app_handle = app.handle().clone();
            let stop_flag = Arc::new(AtomicBool::new(false));
            let stop_flag_clone = stop_flag.clone();
            let timer_handle = std::thread::spawn(move || {
                use std::time::Duration;
                let state = app_handle.state::<AppState>();
                let mut last_elapsed: i32 = -1;

                loop {
                    if stop_flag.load(Ordering::Relaxed) {
                        break;
                    }

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
                    let current_elapsed = match_snapshot.elapsed_seconds;
                    drop(ms); // release lock before DB access

                    // Only persist + emit when elapsed_seconds actually changed
                    if current_elapsed != last_elapsed {
                        last_elapsed = current_elapsed;

                        if let Ok(db) = state.db.lock() {
                            let _ = db::update_match(&db, &match_snapshot);
                        }

                        let _ = app_handle.emit("match_state_update", match_snapshot);
                    }

                    if time_ended {
                        let _ = app_handle.emit("match_time_up", ());
                    }
                }
            });

            // Store JoinHandle and stop_flag for graceful shutdown
            app.manage(TimerHandle(std::sync::Mutex::new(Some(timer_handle))));
            app.manage(stop_flag_clone);

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let stop_flag = window.state::<Arc<AtomicBool>>();
                stop_flag.store(true, Ordering::Relaxed);
                let timer_handle = window.state::<TimerHandle>();
                if let Ok(mut handle) = timer_handle.0.lock() {
                    if let Some(h) = handle.take() {
                        let _ = h.join();
                    }
                };
            }
        })
        .run(tauri::generate_context!())
        .expect("erro ao inicializar Tauri");
}
