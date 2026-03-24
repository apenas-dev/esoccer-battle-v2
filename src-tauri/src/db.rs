// DB — SQLite via rusqlite para persistência das partidas

use anyhow::{Context, Result};
use rusqlite::{Connection, params};

use crate::models::{Match, MatchStatus, CommandExecution};

fn db_path() -> String {
    let base_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let dir = base_dir.join("esoccer-battle");
    std::fs::create_dir_all(&dir).ok();
    dir.join("data.db").to_string_lossy().to_string()
}

fn init_db(conn: &Connection) -> Result<()> {
    conn.pragma_update(None, "journal_mode", "WAL")
        .context("falha ao configurar WAL mode")?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            time_a_name TEXT NOT NULL,
            time_b_name TEXT NOT NULL,
            score_a INTEGER NOT NULL DEFAULT 0,
            score_b INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'Aguardando',
            started_at TEXT,
            duration_seconds INTEGER NOT NULL DEFAULT 360,
            elapsed_seconds INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS command_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER NOT NULL,
            command TEXT NOT NULL,
            response TEXT NOT NULL,
            executed_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (match_id) REFERENCES matches(id)
        );

        CREATE TABLE IF NOT EXISTS doubts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER NOT NULL,
            timestamp INTEGER NOT NULL,
            description TEXT NOT NULL,
            FOREIGN KEY (match_id) REFERENCES matches(id)
        );

        CREATE INDEX IF NOT EXISTS idx_command_log_match ON command_log(match_id);
        CREATE INDEX IF NOT EXISTS idx_doubts_match ON doubts(match_id);"
    ).context("falha ao criar tabelas")?;

    Ok(())
}

/// Opens the DB connection, ensuring schema is initialized.
/// Safe to call multiple times — init_db is idempotent.
pub fn get_connection() -> Result<Connection> {
    let path = db_path();
    let conn = Connection::open(&path)
        .with_context(|| format!("falha ao abrir DB em {}", path))?;
    init_db(&conn)?;
    Ok(conn)
}

pub fn create_match(conn: &Connection, time_a_name: &str, time_b_name: &str) -> Result<Match> {
    let mut m = Match::new(time_a_name, time_b_name);
    conn.execute(
        "INSERT INTO matches (time_a_name, time_b_name, status, duration_seconds, elapsed_seconds)
         VALUES (?1, ?2, 'Aguardando', 360, 0)",
        params![time_a_name, time_b_name],
    )?;
    m.id = Some(conn.last_insert_rowid());
    Ok(m)
}

pub fn get_current_match(conn: &Connection) -> Result<Option<Match>> {
    let mut stmt = conn.prepare(
        "SELECT id, time_a_name, time_b_name, score_a, score_b, status, started_at, duration_seconds, elapsed_seconds
         FROM matches
         WHERE status IN ('Aguardando', 'EmAndamento', 'Pausado')
         ORDER BY id DESC LIMIT 1"
    )?;

    let mut rows = stmt.query([])?;
    match rows.next()? {
        Some(row) => {
            let status_str: String = row.get(5)?;
            let status = MatchStatus::try_from_str(&status_str);
            if status.is_none() {
                eprintln!("Status desconhecido no DB: '{}', usando Aguardando como fallback", status_str);
            }
            let m = Match {
                id: row.get(0)?,
                time_a_name: row.get(1)?,
                time_b_name: row.get(2)?,
                score_a: row.get(3)?,
                score_b: row.get(4)?,
                status: status.unwrap_or(MatchStatus::Aguardando),
                started_at: row.get(6)?,
                duration_seconds: row.get(7)?,
                elapsed_seconds: row.get(8)?,
            };
            Ok(Some(m))
        }
        None => Ok(None),
    }
}

pub fn update_match(conn: &Connection, m: &Match) -> Result<()> {
    conn.execute(
        "UPDATE matches SET time_a_name=?1, time_b_name=?2, score_a=?3, score_b=?4,
         status=?5, started_at=?6, duration_seconds=?7, elapsed_seconds=?8
         WHERE id=?9",
        params![
            m.time_a_name, m.time_b_name, m.score_a, m.score_b,
            m.status.as_str(), m.started_at, m.duration_seconds, m.elapsed_seconds, m.id
        ],
    )?;
    Ok(())
}

pub fn log_command(conn: &Connection, match_id: i64, command: &str, response: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO command_log (match_id, command, response) VALUES (?1, ?2, ?3)",
        params![match_id, command, response],
    )?;
    Ok(())
}

pub fn get_command_log(conn: &Connection, match_id: i64) -> Result<Vec<CommandExecution>> {
    let mut stmt = conn.prepare(
        "SELECT id, match_id, command, response, executed_at FROM command_log WHERE match_id=?1 ORDER BY id"
    )?;

    let rows = stmt.query_map(params![match_id], |row| {
        Ok(CommandExecution {
            id: row.get(0)?,
            match_id: row.get(1)?,
            command: row.get(2)?,
            response: row.get(3)?,
            executed_at: row.get(4)?,
        })
    })?;

    let mut logs = Vec::new();
    for row in rows {
        logs.push(row?);
    }
    Ok(logs)
}

pub fn save_doubt(conn: &Connection, match_id: i64, timestamp: i32, description: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO doubts (match_id, timestamp, description) VALUES (?1, ?2, ?3)",
        params![match_id, timestamp, description],
    )?;
    Ok(())
}

pub fn get_all_matches(conn: &Connection) -> Result<Vec<Match>> {
    let mut stmt = conn.prepare(
        "SELECT id, time_a_name, time_b_name, score_a, score_b, status, started_at, duration_seconds, elapsed_seconds
         FROM matches ORDER BY id DESC"
    )?;

    let rows = stmt.query_map([], |row| {
        let status_str: String = row.get(5)?;
        let status = MatchStatus::try_from_str(&status_str);
        if status.is_none() {
            eprintln!("Status desconhecido no DB: '{}', usando Aguardando como fallback", status_str);
        }
        Ok(Match {
            id: row.get(0)?,
            time_a_name: row.get(1)?,
            time_b_name: row.get(2)?,
            score_a: row.get(3)?,
            score_b: row.get(4)?,
            status: status.unwrap_or(MatchStatus::Aguardando),
            started_at: row.get(6)?,
            duration_seconds: row.get(7)?,
            elapsed_seconds: row.get(8)?,
        })
    })?;

    let mut matches = Vec::new();
    for row in rows {
        matches.push(row?);
    }
    Ok(matches)
}
