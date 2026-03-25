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

const stateConfig: Record<VoiceCmdState, { label: string; bg: string; ring: string; icon: string }> = {
  idle: {
    label: "Toque para falar",
    bg: "bg-gray-700 hover:bg-gray-600",
    ring: "",
    icon: "🎤",
  },
  listening: {
    label: "Escutando...",
    bg: "bg-blue-600 hover:bg-blue-500",
    ring: "ring-4 ring-blue-400/50 animate-pulse",
    icon: "🟢",
  },
  processing: {
    label: "Processando...",
    bg: "bg-yellow-600 cursor-wait",
    ring: "ring-4 ring-yellow-400/30",
    icon: "⏳",
  },
  error: {
    label: "Erro",
    bg: "bg-red-600 hover:bg-red-500",
    ring: "",
    icon: "⚠️",
  },
};

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

  return (
    <div className="flex flex-col items-center gap-3">
      {!speechSupported && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-2 text-sm text-red-300 text-center max-w-xs">
          WebSpeech API não disponível neste navegador. Use a entrada de texto abaixo.
        </div>
      )}

      <button
        onClick={() => {
          if (error) onClearError();
          if (canToggle && speechSupported) onToggle();
        }}
        disabled={!canToggle || !speechSupported}
        className={`
          w-24 h-24 rounded-full flex items-center justify-center text-3xl
          transition-all duration-200 select-none
          ${config.bg} ${config.ring}
          ${canToggle && speechSupported ? "cursor-pointer active:scale-95" : "cursor-wait opacity-60"}
          focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400
        `}
        aria-label={config.label}
        title={config.label}
      >
        {config.icon}
      </button>

      <span className="text-sm text-gray-400">{config.label}</span>

      {/* Interim transcript feedback */}
      {interimTranscript && (
        <div className="max-w-xs text-center">
          <p className="text-sm text-blue-300 italic animate-pulse">
            "{interimTranscript}"
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 max-w-xs text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
