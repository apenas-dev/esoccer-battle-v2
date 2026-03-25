import { useEffect, useCallback, useState } from "react";
import ScoreBoard from "./components/ScoreBoard";
import VoiceButton from "./components/VoiceButton";
import CommandHistory from "./components/CommandHistory";
import TextCommandInput from "./components/TextCommandInput";
import MatchHistory from "./components/MatchHistory";
import StatusBar from "./components/StatusBar";
import { useVoiceCommands } from "./hooks/useVoiceCommands";
import type { MatchHistoryEntry } from "./types";

export default function App() {
  const {
    voiceState,
    matchState,
    commandLog,
    error,
    toggleRecording,
    isRecording,
    interimTranscript,
    speechError,
    speechSupported,
    sendTextCommand,
    refreshMatch,
    refreshCommandLog,
    clearError,
  } = useVoiceCommands();

  const fetchMatchHistory = useCallback(async (): Promise<MatchHistoryEntry[]> => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<MatchHistoryEntry[]>("get_match_history");
    } catch {
      return [];
    }
  }, []);

  const displayError = error ?? speechError;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="text-center pt-4 pb-2">
        <h1 className="text-2xl font-bold text-blue-400">⚽ E-Soccer Battle</h1>
        <p className="text-xs text-gray-600 mt-0.5">
          Controle por voz • STT: WebSpeech API (pt-BR)
        </p>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center gap-6 px-4 py-4 max-w-xl mx-auto w-full">
        {/* Scoreboard */}
        <ScoreBoard match={matchState} />

        {/* Voice button */}
        <VoiceButton
          state={voiceState}
          isRecording={isRecording}
          interimTranscript={interimTranscript}
          speechSupported={speechSupported}
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
