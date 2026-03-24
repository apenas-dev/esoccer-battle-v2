// Match State — lógica de transição de estados e timer da partida

use crate::models::{Match, MatchStatus};
use anyhow::{bail, Result};
use chrono::Utc;

/// Gerencia o estado de uma partida com transições válidas e timer.
pub struct MatchState {
    pub match_data: Match,
}

impl MatchState {
    pub fn new(m: Match) -> Self {
        Self { match_data: m }
    }

    pub fn status(&self) -> &MatchStatus {
        &self.match_data.status
    }

    /// Iniciar partida: Aguardando → EmAndamento
    pub fn start(&mut self) -> Result<()> {
        if self.match_data.status != MatchStatus::Aguardando {
            bail!("Não é possível iniciar: partida está em {:?}", self.match_data.status);
        }
        self.match_data.status = MatchStatus::EmAndamento;
        self.match_data.started_at = Some(now_iso());
        Ok(())
    }

    /// Pausar partida: EmAndamento → Pausado
    pub fn pause(&mut self) -> Result<()> {
        if self.match_data.status != MatchStatus::EmAndamento {
            bail!("Não é possível pausar: partida não está em andamento (está em {:?})", self.match_data.status);
        }
        self.match_data.status = MatchStatus::Pausado;
        Ok(())
    }

    /// Retomar partida: Pausado → EmAndamento
    pub fn resume(&mut self) -> Result<()> {
        if self.match_data.status != MatchStatus::Pausado {
            bail!("Não é possível retomar: partida não está pausada (está em {:?})", self.match_data.status);
        }
        self.match_data.status = MatchStatus::EmAndamento;
        Ok(())
    }

    /// Encerrar partida: EmAndamento → Encerrado
    pub fn finish(&mut self) -> Result<()> {
        if self.match_data.status != MatchStatus::EmAndamento && self.match_data.status != MatchStatus::Pausado {
            bail!("Não é possível encerrar: partida não está ativa (está em {:?})", self.match_data.status);
        }
        self.match_data.status = MatchStatus::Encerrado;
        Ok(())
    }

    /// Atualiza timer. Só avança se estiver EmAndamento.
    /// Retorna true se o tempo acabou (auto-encerra).
    pub fn tick(&mut self, delta_seconds: i32) -> Result<bool> {
        if self.match_data.status != MatchStatus::EmAndamento {
            return Ok(false);
        }
        self.match_data.elapsed_seconds += delta_seconds;
        if self.match_data.elapsed_seconds >= self.match_data.duration_seconds {
            self.match_data.elapsed_seconds = self.match_data.duration_seconds;
            self.match_data.status = MatchStatus::Encerrado;
            return Ok(true);
        }
        Ok(false)
    }

    /// Atualiza placar
    pub fn update_score(&mut self, score_a: i32, score_b: i32) {
        self.match_data.score_a = score_a;
        self.match_data.score_b = score_b;
    }
}

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}
