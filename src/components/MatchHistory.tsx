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
        className="group flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors duration-200
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/40 rounded-lg px-3 py-1.5 -ml-3
                   hover:bg-bg-card"
      >
        <svg className="w-4 h-4 group-hover:text-accent-green transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <span>Partidas Anteriores</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in-up"
          role="dialog"
          aria-modal="true"
          aria-label="Histórico de partidas"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-bg-card border border-border-subtle rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col shadow-2xl shadow-black/40">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center justify-center text-sm">
                  📋
                </div>
                <h2 className="text-base font-semibold text-white">Histórico de Partidas</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg bg-bg-primary border border-border-subtle flex items-center justify-center
                           text-gray-500 hover:text-white hover:border-border-medium
                           transition-all duration-200
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/40"
                aria-label="Fechar"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-sport">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                  <div className="w-6 h-6 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin mb-3" />
                  <span className="text-sm">Carregando...</span>
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="text-3xl mb-2 opacity-40">📭</div>
                  <p className="text-sm text-gray-600">Nenhuma partida registrada.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {entries.map((match) => (
                    <li
                      key={match.id}
                      className="bg-bg-primary/60 border border-border-subtle rounded-xl p-4 flex items-center justify-between hover:bg-bg-primary/80 hover:border-border-medium transition-all duration-200"
                    >
                      <div>
                        <div className="text-xs text-gray-500 font-mono mb-1">{formatDate(match.date)}</div>
                        <div className="text-sm text-gray-300 font-medium">
                          {match.team_a_name}
                          <span className="text-gray-600 mx-2">vs</span>
                          {match.team_b_name}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {formatDuration(match.duration_secs)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black tabular-nums text-white">
                          <span className="text-accent-green">{match.score_a}</span>
                          <span className="text-gray-700 mx-2">:</span>
                          <span className="text-accent-green">{match.score_b}</span>
                        </div>
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
