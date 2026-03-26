import type { VoiceCmdState } from "../hooks/useVoiceCommands";

interface Props {
  state: VoiceCmdState;
  isRecording: boolean;
  interimTranscript: string;
  speechSupported: boolean;
  onToggle: () => void;
  error: string | null;
  onClearError: () => void;
}

const stateConfig: Record<VoiceCmdState, { label: string; accentColor: string }> = {
  idle: { label: "Toque para narrar", accentColor: "" },
  listening: { label: "Escutando...", accentColor: "animate-glow-green" },
  processing: { label: "Processando...", accentColor: "" },
  error: { label: "Erro na voz", accentColor: "animate-glow-red" },
};

/** Generates 7 wave bar styles with staggered delays and heights */
function WaveBars() {
  const bars = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div className="flex items-center gap-[3px] h-8" aria-hidden="true">
      {bars.map((i) => {
        const delay = i * 0.1;
        const height = 12 + Math.sin(i * 0.9) * 16;
        return (
          <span
            key={i}
            className="wave-bar"
            style={{
              "--wave-delay": `${delay}s`,
              "--wave-height": `${height}px`,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

export default function VoiceButton({
  state,
  isRecording,
  interimTranscript,
  speechSupported,
  onToggle,
  error,
  onClearError,
}: Props) {
  const config = stateConfig[state];
  const canToggle = state === "idle" || isRecording;
  const isActive = state === "listening";

  return (
    <div className="flex flex-col items-center gap-3 flex-shrink-0">
      {/* Unsupported warning */}
      {!speechSupported && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl px-4 py-3 text-sm text-accent-red/80 text-center max-w-xs">
          <span className="text-lg block mb-1">⚠️</span>
          WebSpeech API não disponível. Use a entrada de texto.
        </div>
      )}

      {/* Mic button */}
      <div className="relative">
        {/* Pulse ring when active */}
        {isActive && (
          <div className="absolute inset-0 rounded-full bg-accent-green/20 animate-ping pointer-events-none" />
        )}

        <button
          onClick={() => {
            if (error) onClearError();
            if (canToggle && speechSupported) onToggle();
          }}
          disabled={!canToggle || !speechSupported}
          className={`
            relative w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-300 select-none
            focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-green/40
            ${
              isActive
                ? "bg-accent-green text-bg-primary animate-glow-green"
                : state === "error"
                ? "bg-accent-red/80 text-white animate-glow-red"
                : state === "processing"
                ? "bg-accent-gold/80 text-bg-primary cursor-wait"
                : "bg-bg-card border-2 border-border-medium text-gray-400 hover:border-accent-green/50 hover:text-accent-green hover:bg-bg-card-hover"
            }
            ${canToggle && speechSupported ? "cursor-pointer active:scale-90" : "cursor-wait opacity-60"}
          `}
          aria-label={config.label}
          title={config.label}
        >
          {/* Mic icon */}
          <svg
            className="w-7 h-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={
                isActive
                  ? "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"
                  : "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"
              }
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 10v2a7 7 0 0 1-14 0v-2"
            />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
            {isActive && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"
                fill="currentColor"
                stroke="none"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Label + wave bars */}
      <div className="flex flex-col items-center gap-2">
        <span className={`text-xs font-medium uppercase tracking-wider ${isActive ? "text-accent-green" : state === "processing" ? "text-accent-gold" : "text-gray-500"}`}>
          {config.label}
        </span>
        {isActive && <WaveBars />}
        {state === "processing" && (
          <div className="w-5 h-5 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
        )}
      </div>

      {/* Interim transcript */}
      {interimTranscript && (
        <div className="max-w-[200px] text-center animate-slide-in">
          <p className="text-sm text-accent-green/70 italic leading-snug">
            &ldquo;{interimTranscript}&rdquo;
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-accent-red/80 max-w-[200px] text-center animate-slide-in" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
