import type { CommandLogEntry } from "../types";

interface Props {
  entries: CommandLogEntry[];
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function CommandHistory({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-gray-600 text-sm py-4">
        Nenhum comando executado ainda.
      </div>
    );
  }

  return (
    <ul
      className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin"
      role="log"
      aria-label="Histórico de comandos"
    >
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="bg-gray-900/80 border border-gray-800 rounded-lg p-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500 font-mono">{formatTimestamp(entry.timestamp)}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              entry.command_type === "voice"
                ? "bg-blue-900/50 text-blue-400"
                : "bg-gray-700 text-gray-300"
            }`}>
              {entry.command_type === "voice" ? "🎤" : "⌨️"}
            </span>
          </div>
          <p className="text-sm text-gray-300">
            <span className="text-gray-500 mr-1">›</span>
            {entry.command}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            <span className="text-green-500 mr-1">✓</span>
            {entry.response}
          </p>
        </li>
      ))}
    </ul>
  );
}
