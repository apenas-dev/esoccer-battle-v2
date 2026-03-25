import type { CommandLogEntry } from "../types";

interface Props {
  entries: CommandLogEntry[];
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const commandIcons: Record<string, string> = {
  gol: "⚽",
  volta: "🔄",
  intervalo: "⏸️",
  encerrar: "🏁",
  iniciar: "🟢",
  cartão: "🟨",
};

function getCommandIcon(command: string): string {
  const lower = command.toLowerCase();
  for (const [key, icon] of Object.entries(commandIcons)) {
    if (lower.includes(key)) return icon;
  }
  return "💬";
}

export default function CommandHistory({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="text-3xl mb-2 opacity-40">🎙️</div>
        <p className="text-sm text-gray-600">Nenhum comando executado ainda.</p>
        <p className="text-xs text-gray-700 mt-1">Diga &ldquo;gol&rdquo;, &ldquo;iniciar partida&rdquo; ou digite abaixo.</p>
      </div>
    );
  }

  return (
    <ul
      className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-sport"
      role="log"
      aria-label="Histórico de comandos"
    >
      {entries.map((entry, idx) => (
        <li
          key={entry.id}
          className="group bg-bg-card/60 border border-border-subtle rounded-xl p-3 hover:bg-bg-card-hover hover:border-border-medium transition-all duration-200 animate-slide-in"
          style={{ animationDelay: `${idx * 30}ms` }}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-bg-primary border border-border-subtle flex items-center justify-center text-sm group-hover:border-border-medium transition-colors">
              {getCommandIcon(entry.command)}
            </div>

            <div className="flex-1 min-w-0">
              {/* Header row */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] text-gray-600 font-mono tabular-nums">
                  {formatTimestamp(entry.timestamp)}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wider ${
                  entry.command_type === "voice"
                    ? "bg-accent-green/10 text-accent-green/70 border border-accent-green/20"
                    : "bg-bg-primary text-gray-500 border border-border-subtle"
                }`}>
                  {entry.command_type === "voice" ? "Voz" : "Texto"}
                </span>
              </div>

              {/* Command text */}
              <p className="text-sm text-gray-300 truncate">
                {entry.command}
              </p>

              {/* Response */}
              <p className="text-xs text-gray-500 mt-1 truncate">
                <span className="text-accent-green mr-1">→</span>
                {entry.response}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
