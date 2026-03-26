import { useState, useCallback, useMemo } from "react";
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

interface TeamStats {
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function computeStats(entries: MatchHistoryEntry[]): TeamStats[] {
  const map = new Map<string, TeamStats>();

  for (const m of entries) {
    const getOrCreate = (name: string): TeamStats =>
      map.get(name) ?? { name, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };

    const a = getOrCreate(m.team_a_name);
    const b = getOrCreate(m.team_b_name);

    a.played++;
    b.played++;
    a.goalsFor += m.score_a;
    a.goalsAgainst += m.score_b;
    b.goalsFor += m.score_b;
    b.goalsAgainst += m.score_a;

    if (m.score_a > m.score_b) {
      a.wins++; a.points += 3; b.losses++;
    } else if (m.score_b > m.score_a) {
      b.wins++; b.points += 3; a.losses++;
    } else {
      a.draws++; b.draws++; a.points++; b.points++;
    }

    map.set(m.team_a_name, a);
    map.set(m.team_b_name, b);
  }

  return Array.from(map.values()).sort((x, y) => y.points - x.points || (y.goalsFor - y.goalsAgainst) - (x.goalsFor - x.goalsAgainst));
}

export default function MatchHistory({ fetchHistory }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => computeStats(entries), [entries]);

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
        {entries.length > 0 && !open && (
          <span className="text-xs text-gray-600 bg-bg-primary px-1.5 py-0.5 rounded border border-border-subtle">
            {entries.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in-up"
          role="dialog"
          aria-modal="true"
          aria-label="Histórico de partidas"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-bg-card border border-border-subtle rounded-2xl w-full max-w-xl mx-4 max-h-[85vh] flex flex-col shadow-2xl shadow-black/40">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center justify-center text-sm">
                  📊
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Histórico de Partidas</h2>
                  {entries.length > 0 && (
                    <p className="text-xs text-gray-500">{entries.length} partida{entries.length !== 1 ? "s" : ""} registrada{entries.length !== 1 ? "s" : ""}</p>
                  )}
                </div>
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
            <div className="flex-1 overflow-y-auto scrollbar-sport">
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
                <div className="p-5 space-y-5">
                  {/* ── Team Stats Table ──────────── */}
                  {stats.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">🏆</span>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Classificação</h3>
                      </div>
                      <div className="bg-bg-primary/60 rounded-xl border border-border-subtle overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border-subtle text-gray-500 text-xs uppercase tracking-wider">
                              <th className="text-left py-2.5 px-3 font-medium">#</th>
                              <th className="text-left py-2.5 px-3 font-medium">Time</th>
                              <th className="text-center py-2.5 px-2 font-medium">J</th>
                              <th className="text-center py-2.5 px-2 font-medium">V</th>
                              <th className="text-center py-2.5 px-2 font-medium">E</th>
                              <th className="text-center py-2.5 px-2 font-medium">D</th>
                              <th className="text-center py-2.5 px-2 font-medium">GP</th>
                              <th className="text-center py-2.5 px-2 font-medium">GC</th>
                              <th className="text-center py-2.5 px-3 font-medium text-accent-green">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.map((t, i) => (
                              <tr key={t.name} className="border-b border-border-subtle/50 last:border-0 hover:bg-bg-card/50 transition-colors">
                                <td className="py-2.5 px-3 text-gray-600 font-mono text-xs">{i + 1}</td>
                                <td className="py-2.5 px-3 font-medium text-white truncate max-w-[120px]">{t.name}</td>
                                <td className="py-2.5 px-2 text-center text-gray-400 font-mono">{t.played}</td>
                                <td className="py-2.5 px-2 text-center text-accent-green font-mono font-semibold">{t.wins}</td>
                                <td className="py-2.5 px-2 text-center text-accent-gold font-mono">{t.draws}</td>
                                <td className="py-2.5 px-2 text-center text-accent-red font-mono">{t.losses}</td>
                                <td className="py-2.5 px-2 text-center text-gray-400 font-mono">{t.goalsFor}</td>
                                <td className="py-2.5 px-2 text-center text-gray-400 font-mono">{t.goalsAgainst}</td>
                                <td className="py-2.5 px-3 text-center text-accent-green font-black font-mono">{t.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Match List ──────────────────── */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm">📋</span>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Partidas</h3>
                    </div>
                    <ul className="space-y-2">
                      {[...entries].reverse().map((match) => {
                        const isDraw = match.score_a === match.score_b;
                        const aWins = match.score_a > match.score_b;
                        return (
                          <li
                            key={match.id}
                            className="bg-bg-primary/60 border border-border-subtle rounded-xl p-4 flex items-center justify-between hover:bg-bg-primary/80 hover:border-border-medium transition-all duration-200"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-500 font-mono mb-1.5">🏟️ {formatDate(match.date)}</div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium truncate ${aWins ? "text-white" : "text-gray-400"}`}>
                                  {match.team_a_name}
                                </span>
                                <span className="text-gray-700 text-xs">×</span>
                                <span className={`text-sm font-medium truncate ${!aWins && !isDraw ? "text-white" : isDraw ? "text-gray-400" : "text-gray-400"}`}>
                                  {match.team_b_name}
                                </span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">⏱ {formatDuration(match.duration_secs)}</div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-2xl font-black tabular-nums">
                                <span className={aWins ? "text-accent-green" : "text-white"}>{match.score_a}</span>
                                <span className="text-gray-700 mx-1.5">:</span>
                                <span className={!aWins && !isDraw ? "text-accent-green" : "text-white"}>{match.score_b}</span>
                              </div>
                              {isDraw && (
                                <div className="text-[10px] text-accent-gold uppercase tracking-wider mt-0.5">Empate</div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
