import { useEffect, useCallback, useState } from "react";
import ScoreBoard from "./components/ScoreBoard";
import VoiceButton from "./components/VoiceButton";
import CommandHistory from "./components/CommandHistory";
import TextCommandInput from "./components/TextCommandInput";
import MatchHistory from "./components/MatchHistory";
import StatusBar from "./components/StatusBar";
import LoadingScreen from "./components/LoadingScreen";
import { useVoiceCommands } from "./hooks/useVoiceCommands";
import type { MatchHistoryEntry } from "./types";

export default function App() {
  const [ready, setReady] = useState(false);

  // Simulate initial loading (ONNX models)
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const {
    voiceState,
    matchState,
    commandLog,
    error,
    toggleRecording,
    isRecording,
    micState,
    micError,
    sendTextCommand,
    refreshMatch,
    refreshCommandLog,
    clearError,
  } = useVoiceCommands();

  // Poll match state every 1s
  useEffect(() => {
    refreshMatch();
    const interval = setInterval(refreshMatch, 1000);
    return () => clearInterval(interval);
  }, [refreshMatch]);

  // Poll command log every 2s
  useEffect(() => {
    refreshCommandLog();
    const interval = setInterval(refreshCommandLog, 2000);
    return () => clearInterval(interval);
  }, [refreshCommandLog]);

  const fetchMatchHistory = useCallback(async (): Promise<MatchHistoryEntry[]> => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<MatchHistoryEntry[]>("get_match_history");
    } catch {
      return [];
    }
  }, []);

  if (!ready) return <LoadingScreen />;

  const displayError = error ?? micError;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="text-center pt-4 pb-2">
        <h1 className="text-2xl font-bold text-blue-400">⚽ E-Soccer Battle</h1>
        <p className="text-xs text-gray-600 mt-0.5">Controle por voz • STT: Whisper ONNX • TTS: Kokoro ONNX</p>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center gap-6 px-4 py-4 max-w-xl mx-auto w-full">
        {/* Scoreboard */}
        <ScoreBoard match={matchState} />

        {/* Voice button */}
        <VoiceButton
          state={voiceState}
          isRecording={isRecording}
          onToggle={toggleRecording}
          error={displayError}
          onClearError={clearError}
        />

        {/* Text input */}
        <TextCommandInput onSend={sendTextCommand} disabled={voiceState !== "idle"} />

        {/* Command history */}
        <section className="w-full" aria-label="Histórico de comandos">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Comandos Recentes
          </h2>
          <CommandHistory entries={commandLog} />
        </section>

        {/* Match history link */}
        <MatchHistory fetchHistory={fetchMatchHistory} />
      </main>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
