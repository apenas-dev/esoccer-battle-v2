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
    <div className="min-h-screen bg-bg-primary text-white flex flex-col">
      {/* ── Header Bar ──────────────────────────────── */}
      <header className="relative border-b border-border-subtle bg-bg-secondary/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Live badge */}
            {matchState?.status === "in_progress" && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-red/20 border border-accent-red/40 rounded-full text-xs font-bold text-accent-red uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-live-dot" />
                Ao Vivo
              </span>
            )}
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-white">E-Soccer</span>
              <span className="text-accent-green ml-1">Battle</span>
            </h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="hidden sm:inline">Narração por voz</span>
            <span className="px-2 py-0.5 bg-bg-card rounded border border-border-subtle text-gray-400">
              STT: WebSpeech
            </span>
          </div>
        </div>
        {/* Accent gradient line */}
        <div className="h-px bg-gradient-to-r from-transparent via-accent-green/30 to-transparent" />
      </header>

      {/* ── Main Content ────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-5xl mx-auto w-full gap-8">
        {/* Scoreboard */}
        <div className="w-full animate-fade-in-up">
          <ScoreBoard match={matchState} />
        </div>

        {/* Voice + Text controls row */}
        <div className="w-full max-w-2xl flex flex-col sm:flex-row items-center gap-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <VoiceButton
            state={voiceState}
            isRecording={isRecording}
            interimTranscript={interimTranscript}
            speechSupported={speechSupported}
            onToggle={toggleRecording}
            error={displayError}
            onClearError={clearError}
          />
          <div className="flex-1 w-full">
            <TextCommandInput onSend={sendTextCommand} disabled={voiceState !== "idle"} />
          </div>
        </div>

        {/* Command history */}
        <section className="w-full max-w-2xl animate-fade-in-up" style={{ animationDelay: "0.2s" }} aria-label="Histórico de comandos">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-accent-green rounded-full" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Comandos Recentes
            </h2>
            <span className="text-xs text-gray-600 ml-auto">{commandLog.length} registrados</span>
          </div>
          <CommandHistory entries={commandLog} />
        </section>

        {/* Match history link */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <MatchHistory fetchHistory={fetchMatchHistory} />
        </div>
      </main>

      {/* ── Status Bar ─────────────────────────────── */}
      <StatusBar />
    </div>
  );
}
