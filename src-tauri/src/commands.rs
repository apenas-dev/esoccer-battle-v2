// commands.rs — F3 + F6: Parsing + execução + orquestração STT/TTS
// Tauri commands (public) + handlers internos (private)

use regex::Regex;
use serde::Serialize;
use tauri::State;

use crate::models::{Match, MatchStatus, CommandExecution, numero_por_extenso};
use crate::db;
use crate::match_state::MatchState;
use crate::AppState;

// ─── Response types (serializáveis pro JS) ────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct VoiceCommandResult {
    pub response_text: String,
    pub audio_bytes: Vec<u8>,
    pub command_id: String,
    pub transcription: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TextCommandResult {
    pub response_text: String,
    pub audio_bytes: Vec<u8>,
    pub command_id: String,
}

// ─── Comandos suportados ─────────────────────────────────────────────

#[derive(Debug, Clone)]
pub enum VoiceCommand {
    VoltaSeis,
    Resultado,
    Intervalo,
    DuvidaAgora,
    Encerrar,
    ComandosVoz,
    GolTimeA,
    GolTimeB,
    Desconhecido(String),
}

// ─── Parse ───────────────────────────────────────────────────────────

pub fn parse_command(text: &str) -> VoiceCommand {
    let lower = text.to_lowercase().trim().to_string();

    lazy_static::lazy_static! {
        static ref RE_VOLTA: Regex = Regex::new(
            r"(volta\s+seis|volta\s+6|começar\s+jogo|iniciar\s+partida|comecar\s+jogo|voltei)"
        ).unwrap();
        static ref RE_RESULTADO: Regex = Regex::new(
            r"(resultado|placar|quanto\s+t[aá]|quanto\s+esta|quantos\s+gols)"
        ).unwrap();
        static ref RE_INTERVALO: Regex = Regex::new(
            r"(intervalo|pausar|parar|pausa)"
        ).unwrap();
        static ref RE_DUVIDA: Regex = Regex::new(
            r"(dúvida\s+agora|duvida\s+agora|duvida|dúvida|marcou\s+dúvida|marcou\s+duvida)"
        ).unwrap();
        static ref RE_ENCERRAR: Regex = Regex::new(
            r"(encerrar|finalizar|terminar|acabar)"
        ).unwrap();
        static ref RE_COMANDOS: Regex = Regex::new(
            r"(comandos|ajuda|o\s+que\s+posso\s+dizer|help)"
        ).unwrap();
        static ref RE_GOL_A: Regex = Regex::new(
            r"(gol\s+(do\s+|pro\s+|para\s+)?time\s*a|ponto\s+(pro\s+|do\s+)?a|gol\s+pro\s+a|gol\s+a)"
        ).unwrap();
        static ref RE_GOL_B: Regex = Regex::new(
            r"(gol\s+(do\s+|pro\s+|para\s+)?time\s*b|ponto\s+(pro\s+|do\s+)?b|gol\s+pro\s+b|gol\s+b)"
        ).unwrap();
    }

    if RE_GOL_A.is_match(&lower) { return VoiceCommand::GolTimeA; }
    if RE_GOL_B.is_match(&lower) { return VoiceCommand::GolTimeB; }
    if RE_VOLTA.is_match(&lower) { return VoiceCommand::VoltaSeis; }
    if RE_RESULTADO.is_match(&lower) { return VoiceCommand::Resultado; }
    if RE_INTERVALO.is_match(&lower) { return VoiceCommand::Intervalo; }
    if RE_DUVIDA.is_match(&lower) { return VoiceCommand::DuvidaAgora; }
    if RE_ENCERRAR.is_match(&lower) { return VoiceCommand::Encerrar; }
    if RE_COMANDOS.is_match(&lower) { return VoiceCommand::ComandosVoz; }

    VoiceCommand::Desconhecido(text.to_string())
}

// ─── Tauri Commands (public, invocáveis pelo frontend) ──────────────

#[tauri::command]
pub fn start_match(state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut ms = state.match_state.lock().map_err(|e| e.to_string())?;

    let response = cmd_volta_seis(&mut ms, &db);
    Ok(response)
}

#[tauri::command]
pub fn get_current_match(state: State<'_, AppState>) -> Result<Option<Match>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_current_match(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_match_history(state: State<'_, AppState>) -> Result<Vec<Match>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_all_matches(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_command_log(state: State<'_, AppState>, match_id: i64) -> Result<Vec<CommandExecution>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_command_log(&db, match_id).map_err(|e| e.to_string())
}

/// Fluxo completo de comando de voz: STT → parse → execute → TTS
#[tauri::command]
pub async fn process_voice_command(
    state: State<'_, AppState>,
    audio_bytes: Vec<u8>,
) -> Result<VoiceCommandResult, String> {
    if audio_bytes.is_empty() {
        return Err("Áudio vazio — nada para transcrever.".to_string());
    }

    // 1. STT — CPU-bound, spawn_blocking
    let audio_clone = audio_bytes.clone();
    let transcription = tauri::async_runtime::spawn_blocking(move || {
        crate::stt::transcribe_bytes(&audio_clone)
            .map_err(|e| format!("falha no STT: {}", e))
    })
    .await
    .map_err(|e| format!("erro na thread de STT: {}", e))??;

    if transcription.trim().is_empty() {
        return Err("Não foi possível transcrever o áudio. Tente falar mais perto do microfone.".to_string());
    }

    println!("process_voice_command: transcrição='{}'", transcription);

    // 2. Parse + Execute — rápido, sync, precisa do Mutex
    let (response_text, command_id) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let mut ms = state.match_state.lock().map_err(|e| e.to_string())?;

        let cmd = parse_command(&transcription);
        let command_id = format!("{:?}", cmd);
        let response = execute_command(&mut ms, &db, cmd);
        (response, command_id)
    };

    // 3. TTS — CPU-bound, spawn_blocking
    let tts_text = response_text.clone();
    let audio_result = tauri::async_runtime::spawn_blocking(move || {
        crate::tts::speak(&tts_text)
            .map_err(|e| format!("falha no TTS: {}", e))
    })
    .await
    .map_err(|e| format!("erro na thread de TTS: {}", e))??;

    Ok(VoiceCommandResult {
        response_text,
        audio_bytes: audio_result,
        command_id,
        transcription,
    })
}

/// Fluxo de comando por texto: parse → execute → TTS (sem STT)
#[tauri::command]
pub async fn process_text_command(
    state: State<'_, AppState>,
    text: String,
) -> Result<TextCommandResult, String> {
    if text.trim().is_empty() {
        return Err("Texto vazio — nada para processar.".to_string());
    }

    // 1. Parse + Execute — rápido, sync
    let (response_text, command_id) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let mut ms = state.match_state.lock().map_err(|e| e.to_string())?;

        let cmd = parse_command(&text);
        let command_id = format!("{:?}", cmd);
        let response = execute_command(&mut ms, &db, cmd);
        (response, command_id)
    };

    // 2. TTS — CPU-bound, spawn_blocking
    let tts_text = response_text.clone();
    let audio_result = tauri::async_runtime::spawn_blocking(move || {
        crate::tts::speak(&tts_text)
            .map_err(|e| format!("falha no TTS: {}", e))
    })
    .await
    .map_err(|e| format!("erro na thread de TTS: {}", e))??;

    Ok(TextCommandResult {
        response_text,
        audio_bytes: audio_result,
        command_id,
    })
}

// ─── Execução centralizada (log único aqui) ────────────────────────

pub fn execute_command(
    match_state: &mut MatchState,
    conn: &rusqlite::Connection,
    cmd: VoiceCommand,
) -> String {
    let response = match cmd {
        VoiceCommand::VoltaSeis => cmd_volta_seis(match_state, conn),
        VoiceCommand::Resultado => cmd_resultado(match_state),
        VoiceCommand::Intervalo => cmd_intervalo(match_state, conn),
        VoiceCommand::DuvidaAgora => cmd_duvida_agora(match_state, conn),
        VoiceCommand::Encerrar => cmd_encerrar(match_state, conn),
        VoiceCommand::ComandosVoz => cmd_comandos_voz(),
        VoiceCommand::GolTimeA => cmd_gol(match_state, conn, true),
        VoiceCommand::GolTimeB => cmd_gol(match_state, conn, false),
        VoiceCommand::Desconhecido(_) => {
            "Comando não reconhecido. Diga 'comandos' para ver as opções.".to_string()
        }
    };

    // Log centralizado — única fonte de verdade
    let m = &match_state.match_data;
    if let Some(id) = m.id {
        let cmd_name = match &cmd {
            VoiceCommand::Desconhecido(t) => format!("desconhecido: {}", t),
            other => format!("{:?}", other),
        };
        let _ = db::log_command(conn, id, &cmd_name, &response);
    }

    response
}

// ─── Handlers privados (sem log — delegado a execute_command) ───────

fn cmd_volta_seis(match_state: &mut MatchState, conn: &rusqlite::Connection) -> String {
    let m = db::create_match(conn, "Time A", "Time B").unwrap_or_else(|_| Match::new("Time A", "Time B"));

    // Substitui o estado PRIMEIRO para ter o ID correto
    match_state.match_data = m;
    let _ = match_state.start();

    "Partida iniciada! Time A versus Time B. 6 minutos no relógio.".to_string()
}

fn cmd_resultado(match_state: &MatchState) -> String {
    let m = &match_state.match_data;
    format!(
        "O placar está {} a {}.",
        numero_por_extenso(m.score_a),
        numero_por_extenso(m.score_b),
    )
}

fn cmd_intervalo(match_state: &mut MatchState, _conn: &rusqlite::Connection) -> String {
    match match_state.status() {
        MatchStatus::EmAndamento => {
            let _ = match_state.pause();
            "Partida pausada.".to_string()
        }
        MatchStatus::Pausado => {
            let _ = match_state.resume();
            "Partida retomada!".to_string()
        }
        _ => "Não há partida em andamento para pausar.".to_string(),
    }
}

fn cmd_duvida_agora(match_state: &mut MatchState, conn: &rusqlite::Connection) -> String {
    let m = &match_state.match_data;
    if let Some(id) = m.id {
        let minuto = m.elapsed_seconds / 60;
        let desc = format!("Dúvida no minuto {}", minuto);
        let _ = db::save_doubt(conn, id, m.elapsed_seconds, &desc);
        format!("Dúvida marcada no minuto {}.", numero_por_extenso(minuto))
    } else {
        "Nenhuma partida em andamento.".to_string()
    }
}

fn cmd_encerrar(match_state: &mut MatchState, conn: &rusqlite::Connection) -> String {
    match match_state.finish() {
        Ok(()) => {
            if let Some(_id) = match_state.match_data.id {
                let _ = db::update_match(conn, &match_state.match_data);
            }
            "Partida encerrada!".to_string()
        }
        Err(e) => format!("{}", e),
    }
}

fn cmd_comandos_voz() -> String {
    "Você pode dizer:\n\
     1. Volta seis — iniciar partida\n\
     2. Resultado — ver o placar\n\
     3. Intervalo — pausar ou retomar\n\
     4. Dúvida agora — marcar dúvida\n\
     5. Encerrar — finalizar partida\n\
     6. Comandos — ver esta lista\n\
     7. Gol time A — marcar gol do time A\n\
     8. Gol time B — marcar gol do time B"
        .to_string()
}

fn cmd_gol(match_state: &mut MatchState, conn: &rusqlite::Connection, time_a: bool) -> String {
    if *match_state.status() != MatchStatus::EmAndamento {
        return "A partida não está em andamento.".to_string();
    }

    if time_a {
        match_state.match_data.score_a += 1;
    } else {
        match_state.match_data.score_b += 1;
    }

    let response = format!(
        "Gol do {}! Placar: {} a {}.",
        if time_a { "Time A" } else { "Time B" },
        numero_por_extenso(match_state.match_data.score_a),
        numero_por_extenso(match_state.match_data.score_b),
    );

    if let Some(_id) = match_state.match_data.id {
        let _ = db::update_match(conn, &match_state.match_data);
    }

    response
}
