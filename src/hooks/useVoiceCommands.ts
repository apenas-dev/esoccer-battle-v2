import { useState, useCallback, useEffect, useRef } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { TextCommandResponse, CommandLogEntry, MatchState } from "../types";

export type VoiceCmdState = "idle" | "listening" | "processing" | "error";

async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.error(`[invokeCommand] Failed to invoke "${cmd}":`, err);
    throw new Error(`Tauri invoke "${cmd}" failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

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
      console.warn("[processCommand] Already processing a command, skipping:", text);
      return;
    }
    processingRef.current = true;
    setVoiceState("processing");
    setError(null);
    try {
      const response = await invokeCommand<TextCommandResponse>("process_text_command", { text: text.trim() });

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
      setError(msg);
      console.error("[processCommand] Error:", msg, err);
    } finally {
      processingRef.current = false;
      setVoiceState("idle");
    }
  }, []);

  // Speech recognition — sends final transcript as text command
  const speech = useSpeechRecognition({
    lang: "pt-BR",
    continuous: true,
    interimResults: true,
    maxRetries: 3,
    onFinalResult: (transcript) => {
      console.log("[voiceCommands] Final transcript received:", transcript);
      processCommand(transcript, "voice");
    },
    onError: (msg) => {
      setError(msg);
    },
  });

  const toggleRecording = useCallback(() => {
    if (speech.isListening) {
      speech.stop();
    } else {
      speech.start();
    }
  }, [speech]);

  // NO effect syncing voiceState with speech.isListening —
  // voiceState is now fully managed by processCommand and toggleRecording.
  // Use isRecording (speech.isListening) directly for listening feedback.

  const sendTextCommand = useCallback((text: string) => {
    processCommand(text, "text");
  }, [processCommand]);

  // Listen to Tauri events for match state updates (no polling!)
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<MatchState>("match_state_update", (event) => {
      setMatchState(event.payload);
    }).then((fn) => { unlisten = fn; }).catch(() => {
      // Tauri not available (dev mode)
    });
    return () => { unlisten?.(); };
  }, []);

  // Initial fetch of match state
  const refreshMatch = useCallback(async () => {
    try {
      const match = await invokeCommand<MatchState>("get_current_match");
      setMatchState(match);
    } catch {
      // ignore
    }
  }, []);

  const refreshCommandLog = useCallback(async () => {
    try {
      const matchId = matchStateRef.current?.id ?? 0;
      const log = await invokeCommand<CommandLogEntry[]>("get_command_log", { matchId });
      if (Array.isArray(log)) setCommandLog(log);
    } catch {
      // ignore
    }
  }, []);

  // Fetch match state once on mount
  useEffect(() => {
    refreshMatch();
    refreshCommandLog();
  }, [refreshMatch, refreshCommandLog]);

  const isRecording = speech.isListening;

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
    clearError: () => setError(null),
  };
}
