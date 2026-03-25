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

interface ModelsStatus {
  ready: boolean;
  missing: string[];
  found: string[];
}

async function checkModels(): Promise<ModelsStatus> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<ModelsStatus>("check_models_ready");
  } catch {
    // Tauri not available (dev mode in browser) — pretend ready
    return { ready: true, missing: [], found: [] };
  }
}

type LoadingPhase = "checking" | "missing" | "loading" | "ready";

export default function App() {
  const [phase, setPhase] = useState<LoadingPhase>("checking");
  const [modelsStatus, setModelsStatus] = useState<ModelsStatus | null>(null);

  // Check models on mount
  useEffect(() => {
    checkModels().then((status) => {
      setModelsStatus(status);
      if (status.ready) {
        setPhase("ready");
      } else {
        setPhase("missing");
      }
    });
  }, []);

  const handleRetryCheck = useCallback(() => {
    setPhase("loading");
    checkModels().then((status) => {
      setModelsStatus(status);
      setPhase(status.ready ? "ready" : "missing");
    });
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

  if (phase === "checking" || phase === "loading") return <LoadingScreen />;

  if (phase === "missing" && modelsStatus) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl">📦</div>
          <h1 className="text-2xl font-bold text-red-400">Modelos Não Encontrados</h1>
          <p className="text-gray-400">
            Os seguintes arquivos de modelo estão faltando:
          </p>
          <ul className="text-left text-sm text-gray-300 space-y-1 bg-gray-900 rounded-lg p-4">
            {modelsStatus.missing.map((m) => (
              <li key={m} className="flex items-center gap-2">
                <span className="text-red-400">✗</span> {m}
              </li>
            ))}
          </ul>
          {modelsStatus.found.length > 0 && (
            <>
              <p className="text-gray-500 text-sm">Já encontrados:</p>
              <ul className="text-left text-sm text-gray-500 space-y-1">
                {modelsStatus.found.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> {f}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300">
            <p className="font-semibold mb-1">Para resolver:</p>
            <code className="block text-xs text-blue-300 bg-gray-800 p-2 rounded">
              ./scripts/download-models.sh
            </code>
          </div>
          <button
            onClick={handleRetryCheck}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Verificar Novamente
          </button>
        </div>
      </div>
    );
  }

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
