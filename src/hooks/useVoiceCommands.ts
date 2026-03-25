import { useState, useCallback, useRef } from "react";
import { useMicrophone } from "./useMicrophone";
import type { VoiceResponse, CommandLogEntry, MatchState } from "../types";

export type VoiceCmdState = "idle" | "recording" | "processing" | "responding";

async function invokeOrMock<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Try real Tauri invoke, fallback to mock for dev without Tauri
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(cmd, args);
  } catch {
    // Mock responses for development
    return mockResponse(cmd, args) as T;
  }
}

function mockResponse(cmd: string, _args?: Record<string, unknown>): unknown {
  if (cmd === "process_voice_command" || cmd === "process_text_command") {
    return {
      response_text: "Comando recebido! (modo demo)",
      audio_bytes: [],
      command_id: crypto.randomUUID(),
      transcription: cmd === "process_text_command" ? (_args?.text as string) ?? "" : "(transcrição demo)",
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
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playTts = useCallback(async (audioBytes: number[]) => {
    if (!audioBytes.length) return;
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const arrayBuffer = new Uint8Array(audioBytes).buffer;
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    } catch {
      // ignore TTS playback errors
    }
  }, []);

  const handleAudioReady = useCallback(async (blob: Blob) => {
    setVoiceState("processing");
    setError(null);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const response = await invokeOrMock<VoiceResponse>("process_voice_command", {
        audioBytes: Array.from(uint8Array),
      });

      setVoiceState("responding");

      const entry: CommandLogEntry = {
        id: response.command_id,
        timestamp: new Date().toISOString(),
        command: response.transcription,
        response: response.response_text,
        command_type: "voice",
      };
      setCommandLog((prev) => [entry, ...prev].slice(0, 50));

      await playTts(response.audio_bytes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar comando");
    } finally {
      setVoiceState("idle");
    }
  }, [playTts]);

  const sendTextCommand = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setVoiceState("processing");
    setError(null);
    try {
      const response = await invokeOrMock<VoiceResponse>("process_text_command", { text: text.trim() });

      const entry: CommandLogEntry = {
        id: response.command_id,
        timestamp: new Date().toISOString(),
        command: text.trim(),
        response: response.response_text,
        command_type: "text",
      };
      setCommandLog((prev) => [entry, ...prev].slice(0, 50));

      await playTts(response.audio_bytes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar comando de texto");
    } finally {
      setVoiceState("idle");
    }
  }, [playTts]);

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
      // get_command_log needs match_id from current match state
      const matchId = matchState?.id ?? 0;
      const log = await invokeOrMock<CommandLogEntry[]>("get_command_log", { matchId });
      if (Array.isArray(log)) setCommandLog(log);
    } catch {
      // ignore
    }
  }, [matchState]);

  const mic = useMicrophone(handleAudioReady);

  const isRecording = voiceState === "recording" || mic.state === "recording";

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      mic.stop();
    } else {
      setVoiceState("recording");
      await mic.start();
    }
  }, [isRecording, mic]);

  return {
    voiceState,
    matchState,
    commandLog,
    error,
    toggleRecording,
    isRecording,
    micState: mic.state,
    micError: mic.error,
    sendTextCommand,
    refreshMatch,
    refreshCommandLog,
    clearError: () => setError(null),
  };
}
