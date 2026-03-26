import { useState, useCallback, useEffect, useRef } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { invokeCommand } from "../tauriBridge";
import { addLog } from "../debugLogger";
import type { TextCommandResponse, CommandLogEntry, MatchState } from "../types";

export type VoiceCmdState = "idle" | "listening" | "processing" | "error";

export function useVoiceCommands() {
  const [voiceState, setVoiceState] = useState<VoiceCmdState>("idle");
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [commandLog, setCommandLog] = useState<CommandLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const matchStateRef = useRef<MatchState | null>(null);
  const processingRef = useRef(false);

  // Keep ref in sync via useEffect (not on every render)
  useEffect(() => {
    matchStateRef.current = matchState;
  }, [matchState]);

  // Process a command (text or voice) via backend IPC
  const processCommand = useCallback(async (text: string, commandType: "voice" | "text") => {
    if (!text.trim()) return;
    if (processingRef.current) {
      addLog("cmd", `Ignorado (já processando): "${text}"`);
      console.warn("[processCommand] Already processing a command, skipping:", text);
      return;
    }
    processingRef.current = true;
    setVoiceState("processing");
    setError(null);

    addLog("cmd", `Enviando (${commandType}): "${text.trim()}"`);

    try {
      const response = await invokeCommand<TextCommandResponse>("process_text_command", { text: text.trim() });

      addLog("cmd", `Resposta: "${response.response_text}" [id=${response.command_id}]`);

      const entry: CommandLogEntry = {
        id: response.command_id,
        timestamp: new Date().toISOString(),
        command: text.trim(),
        response: response.response_text,
        command_type: commandType,
      };
      setCommandLog((prev) => [entry, ...prev].slice(0, 50));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao processar comando";
      addLog("error", `processCommand ERRO: ${msg}`);
      setError(msg);
      console.error("[processCommand] Error:", msg, err);
    } finally {
      processingRef.current = false;
      setVoiceState((prev) => {
        // If speech is still listening, go to "listening"; otherwise "idle"
        // We check speechRef below since we don't have direct access here
        return "idle"; // Will be corrected by the sync effect below
      });
    }
  }, []);

  // Speech recognition — sends final transcript as text command
  const speech = useSpeechRecognition({
    lang: "pt-BR",
    continuous: true,
    interimResults: true,
    maxRetries: 3,
    onFinalResult: (transcript) => {
      addLog("voice", `Transcrição final recebida: "${transcript}"`);
      processCommand(transcript, "voice");
    },
    onError: (msg) => {
      addLog("voice", `ERRO: ${msg}`);
      setError(msg);
    },
  });

  // SYNC: Keep voiceState in sync with speech.isListening when not processing
  // This fixes the bug where voiceState never becomes "listening"
  const isRecording = speech.isListening;

  useEffect(() => {
    if (processingRef.current) return; // Don't override "processing" state
    if (speech.isListening) {
      setVoiceState("listening");
    } else if (voiceState === "listening") {
      setVoiceState("idle");
    }
  }, [speech.isListening]); // intentionally only depends on speech.isListening

  // Log voiceState changes
  useEffect(() => {
    addLog("state", `voiceState: ${voiceState}`);
  }, [voiceState]);

  // Log matchState changes
  useEffect(() => {
    if (matchState) {
      addLog("match", `Estado: status=${matchState.status} score=${matchState.score_a}x${matchState.score_b} time=${matchState.time_elapsed}s`);
    } else {
      addLog("match", "Estado: null (sem partida)");
    }
  }, [matchState]);

  const toggleRecording = useCallback(() => {
    addLog("voice", `toggleRecording: isListening=${speech.isListening}`);
    if (speech.isListening) {
      speech.stop();
    } else {
      speech.start();
    }
  }, [speech]);

  const sendTextCommand = useCallback((text: string) => {
    addLog("cmd", `Texto enviado pelo input: "${text}"`);
    processCommand(text, "text");
  }, [processCommand]);

  // Listen to match state updates (Tauri events OR mock custom events)
  useEffect(() => {
    addLog("info", "Registrando listener match_state_update...");

    let unlisten: (() => void) | undefined;

    // Listen for mock events (always, for browser dev)
    const mockHandler = ((e: CustomEvent) => {
      addLog("match", `Evento Mock: status=${e.detail.status} score=${e.detail.score_a}x${e.detail.score_b}`);
      setMatchState(e.detail);
    }) as EventListener;
    window.addEventListener("mock-match-state-update", mockHandler);

    // If Tauri is available, also listen to real Tauri events
    if (typeof window !== "undefined" && "__TAURI__" in window) {
      addLog("info", "Tauri detectado — registrando listener match_state_update...");
      import("@tauri-apps/api/event")
        .then(({ listen }) =>
          listen<MatchState>("match_state_update", (event) => {
            addLog("match", `Evento Tauri: status=${event.payload.status} score=${event.payload.score_a}x${event.payload.score_b}`);
            setMatchState(event.payload);
          })
        )
        .then((fn) => {
          unlisten = () => fn();
          addLog("info", "Listener Tauri match_state_update registrado ✓");
        })
        .catch((err) => {
          addLog("error", `Falha listener Tauri: ${err}`);
        });
    } else {
      addLog("info", "Usando mock events (sem Tauri)");
    }

    return () => {
      unlisten?.();
      window.removeEventListener("mock-match-state-update", mockHandler);
    };
  }, []);

  // Initial fetch of match state
  const refreshMatch = useCallback(async () => {
    addLog("info", "Buscando estado atual da partida...");
    try {
      const match = await invokeCommand<MatchState>("get_current_match");
      if (match) {
        addLog("info", `Partida encontrada: status=${match.status}`);
      } else {
        addLog("info", "Nenhuma partida ativa encontrada");
      }
      setMatchState(match);
    } catch (err) {
      addLog("error", `Falha ao buscar partida: ${err}`);
    }
  }, []);

  const refreshCommandLog = useCallback(async () => {
    try {
      const matchId = matchStateRef.current?.id ?? 0;
      if (matchId === 0) {
        addLog("info", "Sem matchId para buscar command log");
        return;
      }
      const log = await invokeCommand<CommandLogEntry[]>("get_command_log", { matchId });
      if (Array.isArray(log)) {
        setCommandLog(log);
        addLog("info", `Command log carregado: ${log.length} entradas`);
      }
    } catch (err) {
      addLog("error", `Falha ao buscar command log: ${err}`);
    }
  }, []);

  // Fetch match state once on mount
  useEffect(() => {
    refreshMatch();
    refreshCommandLog();
  }, [refreshMatch, refreshCommandLog]);

  return {
    voiceState,
    matchState,
    commandLog,
    error,
    toggleRecording,
    isRecording,
    interimTranscript: speech.interimTranscript,
    speechError: speech.error,
    speechSupported: speech.supported,
    sendTextCommand,
    refreshMatch,
    refreshCommandLog,
    clearError: () => {
      setError(null);
      addLog("voice", "Error limpo");
    },
  };
}
