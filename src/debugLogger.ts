// Global debug log system — shared across all hooks and components

export type LogLevel = "info" | "cmd" | "match" | "voice" | "stt" | "error" | "state";

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
}

let logIdCounter = 0;
const MAX_LOGS = 200;

// Global log store — components subscribe via getLogs / onLog
const listeners: Set<() => void> = new Set();
let logs: LogEntry[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export function addLog(level: LogLevel, message: string, details?: string) {
  const entry: LogEntry = {
    id: ++logIdCounter,
    timestamp: new Date().toLocaleTimeString("pt-BR", { hour12: false }),
    level,
    message,
    details,
  };
  logs = [entry, ...logs].slice(0, MAX_LOGS);
  console.log(`[${level.toUpperCase()}] ${message}`, details ?? "");
  notify();
}

export function getLogs(): LogEntry[] {
  return logs;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function clearLogs() {
  logs = [];
  logIdCounter = 0;
  notify();
}
