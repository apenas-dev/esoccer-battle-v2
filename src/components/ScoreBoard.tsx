import { useState, useEffect, useRef } from "react";
import type { MatchState } from "../types";

interface Props {
  match: MatchState | null;
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

export default function ScoreBoard({ match }: Props) {
  const status = match?.status ?? "waiting";
  const scoreA = match?.score_a ?? 0;
  const scoreB = match?.score_b ?? 0;
  const elapsed = match?.time_elapsed ?? 0;
  const total = match?.time_total ?? 360;
  const remaining = Math.max(0, total - elapsed);
  const teamA = match?.team_a_name ?? "Time A";
  const teamB = match?.team_b_name ?? "Time B";
  const progress = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;

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

  return (
    <div className="w-full" role="region" aria-label="Placar da partida">
      {/* Main scoreboard card */}
      <div className="relative overflow-hidden rounded-2xl bg-bg-card border border-border-subtle">
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
                    🏠
                  </div>
                  <span className="text-sm font-medium text-gray-300 truncate">{teamA}</span>
                </div>
                <div
                  className={`text-6xl sm:text-7xl font-black tabular-nums tracking-tight text-accent-green ${popA ? "animate-score-pop" : ""}`}
                  aria-label={`Time A: ${scoreA} gols`}
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
                    ✈️
                  </div>
                  <span className="text-sm font-medium text-gray-300 truncate">{teamB}</span>
                </div>
                <div
                  className={`text-6xl sm:text-7xl font-black tabular-nums tracking-tight text-accent-green ${popB ? "animate-score-pop" : ""}`}
                  aria-label={`Time B: ${scoreB} gols`}
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
            {/* Time markers */}
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
