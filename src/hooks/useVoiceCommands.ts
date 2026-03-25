import { useState, useCallback, useEffect, useRef } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { CommandResponse, CommandLogEntry, MatchState } from "../types";

export type VoiceCmdState = "idle" | "listening" | "processing" | "error";

async function invokeOrMock<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(cmd, args);
  } catch {
    return mockResponse(cmd, args) as T;
  }
}

function mockResponse(cmd: string, _args?: Record<string, unknown>): unknown {
  if (cmd === "process_text_command") {
    return {
      response_text: "Comando recebido! (modo demo)",
      command_id: crypto.randomUUID(),
      transcription: (_args?.text as string) ?? "",
    };
  }
  if (cmd === "get_current_match") {
    return {
      status: "waiting",
      score_a: 0,
      score_b: 0,
      time_elapsed: 0,
      time_total: 360,
      team_a_name: "Time A",
      team_b_name: "Time B",
    };
  }
  if (cmd === "get_command_log") {
    return [];
  }
  if (cmd === "get_match_history") {
    return [];
  }
  return null;
}

export function useVoiceCommands() {
  const [voiceState, setVoiceState] = useState<VoiceCmdState>("idle");
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [commandLog, setCommandLog] = useState<CommandLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const matchStateRef = useRef<MatchState | null>(null);

  // Keep ref in sync
  matchStateRef.current = matchState;

  // Process a command (text or voice) via backend IPC
  const processCommand = useCallback(async (text: string, commandType: "voice" | "text") => {
    if (!text.trim()) return;
    setVoiceState("processing");
    setError(null);
    try {
      const response = await invokeOrMock<CommandResponse>("process_text_command", { text: text.trim() });

      const entry: CommandLogEntry = {
        id: response.command_id,
        timestamp: new Date().toISOString(),
        command: text.trim(),
        response: response.response_text,
        command_type: commandType,
      };
      setCommandLog((prev) => [entry, ...prev].slice(0, 50));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar comando");
    } finally {
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
      setVoiceState("listening");
      speech.start();
    }
  }, [speech]);

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
      const match = await invokeOrMock<MatchState>("get_current_match");
      setMatchState(match);
    } catch {
      // ignore
    }
  }, []);

  const refreshCommandLog = useCallback(async () => {
    try {
      const matchId = matchStateRef.current?.id ?? 0;
      const log = await invokeOrMock<CommandLogEntry[]>("get_command_log", { matchId });
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
