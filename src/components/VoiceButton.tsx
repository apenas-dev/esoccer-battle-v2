import type { VoiceCmdState } from "../hooks/useVoiceCommands";

interface Props {
  state: VoiceCmdState;
  isRecording: boolean;
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
  recording: {
    label: "Gravando...",
    bg: "bg-red-600 hover:bg-red-500",
    ring: "ring-4 ring-red-400/50 animate-pulse",
    icon: "🔴",
  },
  processing: {
    label: "Processando...",
    bg: "bg-yellow-600 cursor-wait",
    ring: "ring-4 ring-yellow-400/30",
    icon: "⏳",
  },
  responding: {
    label: "Respondendo...",
    bg: "bg-green-600 cursor-wait",
    ring: "ring-4 ring-green-400/30",
    icon: "🔊",
  },
};

export default function VoiceButton({ state, isRecording, onToggle, error, onClearError }: Props) {
  const config = stateConfig[state];
  const canToggle = state === "idle" || isRecording;

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => {
          if (error) onClearError();
          if (canToggle) onToggle();
        }}
        disabled={!canToggle}
        className={`
          w-24 h-24 rounded-full flex items-center justify-center text-3xl
          transition-all duration-200 select-none
          ${config.bg} ${config.ring}
          ${canToggle ? "cursor-pointer active:scale-95" : "cursor-wait"}
          focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400
        `}
        aria-label={config.label}
        title={config.label}
      >
        {config.icon}
      </button>

      <span className="text-sm text-gray-400">{config.label}</span>

      {error && (
        <p className="text-xs text-red-400 max-w-xs text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
