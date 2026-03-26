import { useState, useCallback, useEffect, useRef } from "react";
import { useWhisperSTT } from "./useWhisperSTT";
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
        return "idle"; // Will be corrected by the sync effect below
      });
    }
  }, []);

  // Whisper STT — sends transcribed text as voice command
  const whisper = useWhisperSTT({
    chunkDurationMs: 3000,
    sampleRate: 16000,
    onFinalResult: (transcript) => {
      addLog("voice", `Transcrição Whisper: "${transcript}"`);
      processCommand(transcript, "voice");
    },
    onError: (msg) => {
      addLog("voice", `ERRO Whisper: ${msg}`);
      setError(msg);
    },
  });

  // SYNC: Keep voiceState in sync with whisper.isListening when not processing
  useEffect(() => {
    if (processingRef.current) return; // Don't override "processing" state
    if (whisper.isListening) {
      setVoiceState("listening");
    } else if (voiceState === "listening") {
      setVoiceState("idle");
    }
  }, [whisper.isListening]); // intentionally only depends on whisper.isListening

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
    addLog("voice", `toggleRecording: isListening=${whisper.isListening}`);
    whisper.toggle();
  }, [whisper]);

  const sendTextCommand = useCallback((text: string) => {
    addLog("cmd", `Texto enviado pelo input: "${text}"`);
    processCommand(text, "text");
  }, [processCommand]);

  // Listen to match state updates from Tauri
  useEffect(() => {
    addLog("info", "Registrando listener match_state_update...");

    let unlisten: (() => void) | undefined;

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

    return () => {
      unlisten?.();
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
    isRecording: whisper.isListening,
    interimTranscript: whisper.interimTranscript,
    speechSupported: true, // Whisper is always "supported" — just needs models
    sttModelStatus: whisper.modelStatus,
    sendTextCommand,
    refreshMatch,
    refreshCommandLog,
    clearError: () => {
      setError(null);
      addLog("voice", "Error limpo");
    },
  };
}
