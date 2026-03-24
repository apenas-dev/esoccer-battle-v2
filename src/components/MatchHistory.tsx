import { useState, useCallback } from "react";
import type { MatchHistoryEntry } from "../types";

interface Props {
  fetchHistory: () => Promise<MatchHistoryEntry[]>;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MatchHistory({ fetchHistory }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const openModal = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    try {
      const history = await fetchHistory();
      setEntries(Array.isArray(history) ? history : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [fetchHistory]);

  return (
    <>
      <button
        onClick={openModal}
        className="text-sm text-gray-500 hover:text-gray-300 underline underline-offset-2
                   transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        📋 Histórico de Partidas
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Histórico de partidas"
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">📋 Histórico de Partidas</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white text-xl leading-none p-1
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="text-center text-gray-500 py-8">Carregando...</div>
              ) : entries.length === 0 ? (
                <div className="text-center text-gray-600 py-8">
                  Nenhuma partida registrada.
                </div>
              ) : (
                <ul className="space-y-2">
                  {entries.map((match) => (
                    <li
                      key={match.id}
                      className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm text-gray-400">{formatDate(match.date)}</div>
                        <div className="text-xs text-gray-500">
                          {match.team_a_name} vs {match.team_b_name} • {formatDuration(match.duration_secs)}
                        </div>
                      </div>
                      <div className="text-lg font-bold text-white">
                        <span className="text-blue-400">{match.score_a}</span>
                        <span className="text-gray-600 mx-1">×</span>
                        <span className="text-blue-400">{match.score_b}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
