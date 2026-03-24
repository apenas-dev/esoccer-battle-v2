import type { MatchState } from "../types";

interface Props {
  match: MatchState | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const statusLabels: Record<MatchState["status"], string> = {
  waiting: "Aguardando",
  in_progress: "Em Andamento",
  paused: "Pausado",
  finished: "Encerrado",
};

const statusColors: Record<MatchState["status"], string> = {
  waiting: "text-gray-400",
  in_progress: "text-green-400",
  paused: "text-yellow-400",
  finished: "text-red-400",
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

  return (
    <div className="w-full max-w-lg" role="region" aria-label="Placar da partida">
      {/* Status & Timer */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-semibold uppercase tracking-wider ${statusColors[status]}`}>
          {statusLabels[status]}
        </span>
        <span className="text-2xl font-mono font-bold text-white">
          {formatTime(remaining)}
        </span>
      </div>

      {/* Score */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <div className="flex items-center justify-between">
          {/* Team A */}
          <div className="flex-1 text-center">
            <div className="text-sm text-gray-400 mb-1 truncate">{teamA}</div>
            <div className="text-5xl font-bold text-blue-500" aria-label={`Time A: ${scoreA} gols`}>
              {scoreA}
            </div>
          </div>

          {/* Divider */}
          <div className="px-6 text-3xl font-light text-gray-600">×</div>

          {/* Team B */}
          <div className="flex-1 text-center">
            <div className="text-sm text-gray-400 mb-1 truncate">{teamB}</div>
            <div className="text-5xl font-bold text-blue-500" aria-label={`Time B: ${scoreB} gols`}>
              {scoreB}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-1000 rounded-full"
            style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }}
            role="progressbar"
            aria-valuenow={elapsed}
            aria-valuemin={0}
            aria-valuemax={total}
          />
        </div>
      </div>
    </div>
  );
}
