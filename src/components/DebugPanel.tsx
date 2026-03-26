import { useSyncExternalStore } from "react";
import { getLogs, subscribe, clearLogs, addLog, type LogEntry, type LogLevel } from "../debugLogger";

const levelEmoji: Record<string, string> = {
  info: "ℹ️",
  cmd: "📤",
  match: "⚽",
  voice: "🎤",
  stt: "🗣️",
  error: "❌",
  state: "🔄",
};

const levelColors: Record<string, string> = {
  info: "text-gray-400",
  cmd: "text-blue-400",
  match: "text-green-400",
  voice: "text-purple-400",
  stt: "text-yellow-400",
  error: "text-red-400",
  state: "text-cyan-400",
};

function DebugPanelInner({ visible }: { visible: boolean }) {
  const logs = useSyncExternalStore(subscribe, getLogs);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[420px] max-w-[calc(100vw-2rem)] bg-gray-950/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl shadow-black/50 flex flex-col"
      style={{ maxHeight: "50vh" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">🐛 Debug Log</span>
        <button
          onClick={clearLogs}
          className="text-[10px] text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded border border-gray-800 hover:border-gray-600 transition-colors"
        >
          Limpar
        </button>
      </div>

      {/* Log entries */}
      <div className="overflow-y-auto flex-1 min-h-0 p-2 space-y-0.5 font-mono text-[11px] leading-relaxed">
        {logs.length === 0 && (
          <div className="text-gray-600 text-center py-4">Nenhum log ainda...</div>
        )}
        {logs.map((entry: LogEntry) => (
          <div
            key={entry.id}
            className={`flex items-start gap-1.5 px-1.5 py-0.5 rounded hover:bg-gray-900/50 ${
              entry.level === "error" ? "bg-red-950/30" : ""
            }`}
          >
            <span className="text-gray-600 whitespace-nowrap shrink-0">{entry.timestamp}</span>
            <span className="shrink-0">{levelEmoji[entry.level] ?? "•"}</span>
            <span className={`break-all ${levelColors[entry.level] ?? "text-gray-400"}`}>
              {entry.message}
            </span>
            {entry.details && (
              <span className="text-gray-600 break-all ml-1">{entry.details}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DebugPanel({ visible }: { visible: boolean }) {
  return <DebugPanelInner visible={visible} />;
}

export function DebugToggle({ onClick, active }: { onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all duration-200 ${
        active
          ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse"
          : "bg-gray-800/50 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500"
      }`}
      title="Toggle debug panel"
    >
      🐛 Debug
    </button>
  );
}

// Helper for components that need to log from within React without direct import
export function useDebugLog() {
  return (level: LogLevel, message: string, details?: string) => {
    addLog(level, message, details);
  };
}
