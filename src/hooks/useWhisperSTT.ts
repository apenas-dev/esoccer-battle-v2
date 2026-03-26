import { useState, useRef, useCallback, useEffect } from "react";
import { invokeCommand } from "../tauriBridge";
import { addLog } from "../debugLogger";

export type WhisperSTTState = "idle" | "listening" | "processing" | "loading" | "error";

interface UseWhisperSTTOptions {
  lang?: string;
  chunkDurationMs?: number; // how long to record before sending a chunk (ms)
  sampleRate?: number;
  onFinalResult?: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function useWhisperSTT(options: UseWhisperSTTOptions = {}) {
  const {
    chunkDurationMs = 3000, // send 3s chunks for continuous mode
    sampleRate = 16000,
    onFinalResult,
    onInterimResult,
    onError,
  } = options;

  const [sttState, setSttState] = useState<WhisperSTTState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<string>("not_loaded");

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const isListeningRef = useRef(false);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalResultRef = useRef(onFinalResult);
  const onInterimResultRef = useRef(onInterimResult);
  const onErrorRef = useRef(onError);

  useEffect(() => { onFinalResultRef.current = onFinalResult; }, [onFinalResult]);
  useEffect(() => { onInterimResultRef.current = onInterimResult; }, [onInterimResult]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Check model status on mount
  const checkModelStatus = useCallback(async () => {
    try {
      const status = await invokeCommand<string>("get_stt_status");
      setModelStatus(status);
    } catch {
      setModelStatus("error");
    }
  }, []);

  useEffect(() => {
    checkModelStatus();
    const interval = setInterval(checkModelStatus, 5000);
    return () => clearInterval(interval);
  }, [checkModelStatus]);

  // Convert Float32 PCM to bytes (f32 LE)
  const pcmToBytes = useCallback((samples: Float32Array): Uint8Array => {
    const bytes = new Uint8Array(samples.length * 4);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++) {
      view.setFloat32(i * 4, samples[i], true); // little-endian
    }
    return bytes;
  }, []);

  // Send accumulated audio chunk to backend for transcription
  const transcribeChunk = useCallback(async (samples: Float32Array) => {
    if (samples.length < 800) { // less than 50ms — too short
      addLog("stt", `Chunk ignorado: ${samples.length} samples (muito curto)`);
      return;
    }

    addLog("stt", `Enviando chunk: ${samples.length} samples (${(samples.length / 16000).toFixed(1)}s)`);
    setSttState("processing");

    try {
      const bytes = pcmToBytes(samples);
      const transcript = await invokeCommand<string>("transcribe_audio", {
        audioData: Array.from(bytes), // Tauri expects Vec<u8>
      });

      addLog("stt", `Transcrição: "${transcript}"`);

      if (transcript.trim()) {
        setInterimTranscript(transcript.trim());
        onInterimResultRef.current?.(transcript.trim());

        // Use a heuristic: if the chunk ends with sentence-like pause, treat as final
        // For simplicity, every chunk result is treated as final
        addLog("stt", `Resultado final: "${transcript.trim()}"`);
        setInterimTranscript("");
        onFinalResultRef.current?.(transcript.trim());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("stt", `ERRO transcrição: ${msg}`);
      onErrorRef.current?.(msg);
      // Don't set error state permanently — just log and continue listening
    } finally {
      if (isListeningRef.current) {
        setSttState("listening");
      } else {
        setSttState("idle");
      }
    }
  }, [pcmToBytes]);

  // Process accumulated chunks and send
  const processChunks = useCallback(() => {
    if (chunksRef.current.length === 0) return;

    // Concatenate all accumulated chunks
    const totalLength = chunksRef.current.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunksRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    chunksRef.current = [];

    // Fire and forget — don't await
    transcribeChunk(merged);
  }, [transcribeChunk]);

  const start = useCallback(async () => {
    addLog("stt", "Iniciando Whisper STT...");
    setError(null);
    setInterimTranscript("");

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Create AudioContext with target sample rate
      const audioCtx = new AudioContext({ sampleRate });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      // ScriptProcessorNode for raw PCM capture (deprecated but widely supported)
      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isListeningRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Copy the data
        const chunk = new Float32Array(inputData);
        chunksRef.current.push(chunk);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      isListeningRef.current = true;
      setSttState("listening");
      addLog("stt", "Microfone ativo, capturando áudio");

      // Set up periodic chunk processing
      const sendChunk = () => {
        if (isListeningRef.current) {
          processChunks();
          chunkTimerRef.current = setTimeout(sendChunk, chunkDurationMs);
        }
      };
      chunkTimerRef.current = setTimeout(sendChunk, chunkDurationMs);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao acessar microfone";
      addLog("stt", `ERRO: ${msg}`);
      setError(msg);
      setSttState("error");
      onErrorRef.current?.(msg);
    }
  }, [chunkDurationMs, processChunks]);

  const stop = useCallback(() => {
    addLog("stt", "Parando Whisper STT...");

    isListeningRef.current = false;

    // Process any remaining chunks
    if (chunksRef.current.length > 0) {
      processChunks();
    }

    // Clear timer
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    // Stop processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setSttState("idle");
    addLog("stt", "Microfone desligado");
  }, [processChunks]);

  const toggle = useCallback(() => {
    if (isListeningRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (chunkTimerRef.current) {
        clearTimeout(chunkTimerRef.current);
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    sttState,
    modelStatus,
    interimTranscript,
    error,
    isListening: sttState === "listening",
    isProcessing: sttState === "processing",
    isLoading: sttState === "loading",
    start,
    stop,
    toggle,
  };
}
