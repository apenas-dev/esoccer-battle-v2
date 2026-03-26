import { useState, useEffect, useRef, useCallback } from "react";
import type { MatchState } from "../types";

interface Props {
  match: MatchState | null;
  onStartMatch?: (teamA: string, teamB: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const statusConfig: Record<MatchState["status"], { label: string; color: string; dotColor: string }> = {
  waiting: { label: "Aguardando", color: "text-gray-400", dotColor: "bg-gray-500" },
  in_progress: { label: "Em Andamento", color: "text-accent-green", dotColor: "bg-accent-green" },
  paused: { label: "Pausado", color: "text-accent-gold", dotColor: "bg-accent-gold" },
  finished: { label: "Encerrado", color: "text-accent-red", dotColor: "bg-accent-red" },
};

export default function ScoreBoard({ match, onStartMatch }: Props) {
  const status = match?.status ?? "waiting";
  const scoreA = match?.score_a ?? 0;
  const scoreB = match?.score_b ?? 0;
  const elapsed = match?.time_elapsed ?? 0;
  const total = match?.time_total ?? 360;
  const remaining = Math.max(0, total - elapsed);
  const teamA = match?.team_a_name ?? "Time A";
  const teamB = match?.team_b_name ?? "Time B";
  const progress = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;

  // Custom team names for pre-match
  const [inputA, setInputA] = useState("Flamengo");
  const [inputB, setInputB] = useState("Corinthians");

  const cfg = statusConfig[status];

  // Track score changes for pop animation
  const [popA, setPopA] = useState(false);
  const [popB, setPopB] = useState(false);
  const prevA = useRef(scoreA);
  const prevB = useRef(scoreB);

  useEffect(() => {
    if (scoreA !== prevA.current) { setPopA(true); setTimeout(() => setPopA(false), 400); }
    if (scoreB !== prevB.current) { setPopB(true); setTimeout(() => setPopB(false), 400); }
    prevA.current = scoreA;
    prevB.current = scoreB;
  }, [scoreA, scoreB]);

  const isLive = status === "in_progress";
  const isWaiting = status === "waiting";

  const handleStart = useCallback(() => {
    if (onStartMatch && inputA.trim() && inputB.trim()) {
      onStartMatch(inputA.trim(), inputB.trim());
    }
  }, [onStartMatch, inputA, inputB]);

  // ── Pre-match screen ──────────────────────────────
  if (isWaiting) {
    return (
      <div className="w-full" role="region" aria-label="Configurar partida">
        <div className="relative overflow-hidden rounded-2xl bg-bg-card border border-border-subtle">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-green/40 to-transparent" />

          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">⚽</span>
              <h2 className="text-xl font-black tracking-tight text-white">Nova Partida</h2>
            </div>
            <p className="text-sm text-gray-500">Digite os nomes dos times e inicie a narração</p>
          </div>

          <div className="px-6 py-4">
            <div className="bg-bg-primary/60 rounded-xl p-5 border border-border-subtle">
              <div className="flex items-center gap-3 sm:gap-5">
                {/* Team A input */}
                <div className="flex-1 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center text-sm">
                      🛡️
                    </div>
                  </div>
                  <input
                    type="text"
                    value={inputA}
                    onChange={(e) => setInputA(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleStart()}
                    placeholder="Time A"
                    className="w-full text-center text-lg font-bold bg-bg-card border border-border-subtle rounded-lg px-3 py-2
                               text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/30
                               transition-all duration-200"
                    maxLength={30}
                  />
                </div>

                {/* VS divider */}
                <div className="flex flex-col items-center">
                  <span className="text-gray-600 text-xl font-extralight">vs</span>
                </div>

                {/* Team B input */}
                <div className="flex-1 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-red/20 border border-accent-red/30 flex items-center justify-center text-sm">
                      🛡️
                    </div>
                  </div>
                  <input
                    type="text"
                    value={inputB}
                    onChange={(e) => setInputB(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleStart()}
                    placeholder="Time B"
                    className="w-full text-center text-lg font-bold bg-bg-card border border-border-subtle rounded-lg px-3 py-2
                               text-white placeholder-gray-600 focus:outline-none focus:border-accent-red/50 focus:ring-1 focus:ring-accent-red/30
                               transition-all duration-200"
                    maxLength={30}
                  />
                </div>
              </div>

              {/* Start button */}
              <button
                onClick={handleStart}
                disabled={!inputA.trim() || !inputB.trim()}
                className="mt-5 w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider
                           bg-accent-green/10 border border-accent-green/30 text-accent-green
                           hover:bg-accent-green/20 hover:border-accent-green/50
                           disabled:opacity-30 disabled:cursor-not-allowed
                           transition-all duration-200"
              >
                🏟️ Iniciar Partida — 6 minutos
              </button>
            </div>
          </div>

          {/* Hint */}
          <div className="px-6 pb-5">
            <p className="text-xs text-gray-600 text-center">
              Ou diga <span className="text-accent-blue font-mono">"volta seis"</span> pelo microfone para iniciar
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Live scoreboard ───────────────────────────────
  return (
    <div className="w-full" role="region" aria-label="Placar da partida">
      {/* Main scoreboard card */}
      <div className={`relative overflow-hidden rounded-2xl bg-bg-card border transition-all duration-500 ${isLive ? "border-accent-green/20 shadow-lg shadow-accent-green/5" : "border-border-subtle"}`}>
        {/* Subtle gradient top border */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-green/40 to-transparent" />

        {/* Status & Timer row */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${cfg.dotColor} ${isLive ? "animate-live-dot" : ""}`} />
            <span className={`text-xs font-semibold uppercase tracking-widest ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="text-[10px] font-medium text-accent-red bg-accent-red/10 border border-accent-red/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                LIVE
              </span>
            )}
            <span className={`text-3xl font-mono font-bold tabular-nums tracking-wider ${isLive ? "text-white animate-timer-pulse" : "text-white/90"}`}>
              {formatTime(remaining)}
            </span>
          </div>
        </div>

        {/* Score display */}
        <div className="px-6 pb-6">
          <div className="bg-bg-primary/60 rounded-xl p-6 border border-border-subtle">
            <div className="flex items-center justify-between">
              {/* Team A */}
              <div className="flex-1 text-center min-w-0">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center text-sm">
                    ⚽
                  </div>
                  <span className="text-sm font-medium text-gray-300 truncate">{teamA}</span>
                </div>
                <div
                  className={`text-6xl sm:text-7xl font-black tabular-nums tracking-tight text-accent-green ${popA ? "animate-score-pop" : ""}`}
                  aria-label={`${teamA}: ${scoreA} gols`}
                >
                  {scoreA}
                </div>
              </div>

              {/* Center divider */}
              <div className="flex flex-col items-center gap-1 px-4 sm:px-8">
                <div className="text-gray-600 text-2xl font-extralight">vs</div>
                <div className="text-[10px] text-gray-600 uppercase tracking-widest mt-1">
                  {formatTime(total)}
                </div>
              </div>

              {/* Team B */}
              <div className="flex-1 text-center min-w-0">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-red/20 border border-accent-red/30 flex items-center justify-center text-sm">
                    ⚽
                  </div>
                  <span className="text-sm font-medium text-gray-300 truncate">{teamB}</span>
                </div>
                <div
                  className={`text-6xl sm:text-7xl font-black tabular-nums tracking-tight text-accent-green ${popB ? "animate-score-pop" : ""}`}
                  aria-label={`${teamB}: ${scoreB} gols`}
                >
                  {scoreB}
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 relative h-1.5 bg-bg-primary rounded-full overflow-hidden">
            <div
              className="h-full progress-bar-animated transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={elapsed}
              aria-valuemin={0}
              aria-valuemax={total}
            />
            <div className="absolute inset-0 flex justify-between pointer-events-none">
              {[25, 50, 75].map((pct) => (
                <div key={pct} className="w-px h-full bg-white/5" />
              ))}
            </div>
          </div>

          {/* Time elapsed label */}
          <div className="flex items-center justify-between mt-2 text-[10px] text-gray-600 uppercase tracking-wider">
            <span>{formatTime(elapsed)} jogados</span>
            <span>{formatTime(remaining)} restantes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
