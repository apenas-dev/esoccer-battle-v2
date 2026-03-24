// Models — structs principais do E-Soccer Battle

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MatchStatus {
    Aguardando,
    EmAndamento,
    Pausado,
    Encerrado,
}

impl MatchStatus {
    pub fn as_str(&self) -> &str {
        match self {
            MatchStatus::Aguardando => "Aguardando",
            MatchStatus::EmAndamento => "EmAndamento",
            MatchStatus::Pausado => "Pausado",
            MatchStatus::Encerrado => "Encerrado",
        }
    }

    /// Tenta converter string em MatchStatus. Retorna None para valores desconhecidos.
    pub fn try_from_str(s: &str) -> Option<Self> {
        match s {
            "Aguardando" => Some(MatchStatus::Aguardando),
            "EmAndamento" => Some(MatchStatus::EmAndamento),
            "Pausado" => Some(MatchStatus::Pausado),
            "Encerrado" => Some(MatchStatus::Encerrado),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Match {
    pub id: Option<i64>,
    pub time_a_name: String,
    pub time_b_name: String,
    pub score_a: i32,
    pub score_b: i32,
    pub status: MatchStatus,
    pub started_at: Option<String>,
    pub duration_seconds: i32,
    pub elapsed_seconds: i32,
}

impl Match {
    pub fn new(time_a_name: &str, time_b_name: &str) -> Self {
        Self {
            id: None,
            time_a_name: time_a_name.to_string(),
            time_b_name: time_b_name.to_string(),
            score_a: 0,
            score_b: 0,
            status: MatchStatus::Aguardando,
            started_at: None,
            duration_seconds: 360,
            elapsed_seconds: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandExecution {
    pub id: Option<i64>,
    pub match_id: i64,
    pub command: String,
    pub response: String,
    pub executed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Doubt {
    pub id: Option<i64>,
    pub match_id: i64,
    pub timestamp: i32,
    pub description: String,
}

/// Converte número (0-15) para português, usado na narração por voz.
pub fn numero_por_extenso(n: i32) -> &'static str {
    match n {
        0 => "zero",
        1 => "um",
        2 => "dois",
        3 => "três",
        4 => "quatro",
        5 => "cinco",
        6 => "seis",
        7 => "sete",
        8 => "oito",
        9 => "nove",
        10 => "dez",
        11 => "onze",
        12 => "doze",
        13 => "treze",
        14 => "quatorze",
        15 => "quinze",
        _ => "quinze mais",
    }
}
