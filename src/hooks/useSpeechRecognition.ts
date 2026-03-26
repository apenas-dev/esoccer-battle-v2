import { useState, useRef, useCallback, useEffect } from "react";
import { addLog } from "../debugLogger";

type SpeechRecognitionState = "idle" | "listening" | "error";

interface SpeechRecognitionResult {
  interimTranscript: string;
  finalTranscript: string;
}

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxRetries?: number;
  onFinalResult?: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as Record<string, unknown>).SpeechRecognition as (new () => SpeechRecognitionLike) | null ??
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition as (new () => SpeechRecognitionLike) | null ??
    null
  );
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    lang = "pt-BR",
    continuous = true,
    interimResults = true,
    maxRetries = 3,
    onFinalResult,
    onInterimResult,
    onError,
  } = options;

  const [state, setState] = useState<SpeechRecognitionState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const retryCountRef = useRef(0);
  const shouldListenRef = useRef(false);
  const onFinalResultRef = useRef(onFinalResult);
  const onInterimResultRef = useRef(onInterimResult);
  const onErrorRef = useRef(onError);

  // Keep callback refs updated
  useEffect(() => { onFinalResultRef.current = onFinalResult; }, [onFinalResult]);
  useEffect(() => { onInterimResultRef.current = onInterimResult; }, [onInterimResult]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const createRecognition = useCallback((): SpeechRecognitionLike | null => {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setSupported(false);
      const msg = "WebSpeech API não suportada neste navegador";
      setError(msg);
      addLog("stt", `ERRO: ${msg}`);
      onErrorRef.current?.(msg);
      return null;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) {
        setInterimTranscript(interim);
        addLog("stt", `Interim: "${interim}"`);
        onInterimResultRef.current?.(interim);
      }

      if (final) {
        addLog("stt", `FINAL: "${final.trim()}"`);
        console.log("[speechRecognition] Final result:", final.trim());
        setInterimTranscript("");
        onFinalResultRef.current?.(final.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" and "aborted" are not real errors
      if (event.error === "no-speech" || event.error === "aborted") {
        addLog("stt", `Evento ignorado: ${event.error}`);
        return;
      }

      const msg = `SpeechRecognition: ${event.error}`;
      addLog("stt", `ERRO: ${msg}`);
      setError(msg);
      onErrorRef.current?.(msg);
      setState("error");
    };

    recognition.onend = () => {
      addLog("stt", "Parado (onend disparado)");

      // Auto-restart if we should still be listening
      if (shouldListenRef.current && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        addLog("stt", `Auto-restart (tentativa ${retryCountRef.current}/${maxRetries})`);
        try {
          recognition.start();
        } catch (err) {
          addLog("stt", `ERRO no auto-restart: ${err}`);
          setState("error");
        }
      } else {
        shouldListenRef.current = false;
        setState("idle");
        addLog("voice", "Estado: idle (parou de escutar)");
      }
    };

    return recognition;
  }, [lang, continuous, interimResults, maxRetries]);

  const start = useCallback(() => {
    addLog("stt", "Iniciando reconhecimento...");
    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    retryCountRef.current = 0;
    shouldListenRef.current = true;
    setError(null);
    setInterimTranscript("");
    setState("listening");
    addLog("voice", "Estado: listening");

    try {
      recognition.start();
      addLog("stt", "Reconhecimento startado com sucesso");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao iniciar reconhecimento";
      addLog("stt", `ERRO ao startar: ${msg}`);
      setError(msg);
      setState("error");
    }
  }, [createRecognition]);

  const stop = useCallback(() => {
    addLog("stt", "Parando reconhecimento...");
    shouldListenRef.current = false;
    retryCountRef.current = maxRetries; // prevent auto-restart
    setInterimTranscript("");

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setState("idle");
    addLog("voice", "Estado: idle");
  }, [maxRetries]);

  const toggle = useCallback(() => {
    if (state === "listening") {
      stop();
    } else {
      start();
    }
  }, [state, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    state,
    supported,
    interimTranscript,
    error,
    start,
    stop,
    toggle,
    isListening: state === "listening",
  };
}
