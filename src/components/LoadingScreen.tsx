export default function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center gap-6"
      role="status"
      aria-label="Carregando"
    >
      {/* Animated soccer ball */}
      <div className="text-6xl animate-bounce">⚽</div>

      <div className="text-center">
        <h2 className="text-xl font-semibold text-white mb-2">E-Soccer Battle</h2>
        <p className="text-gray-400 text-sm">Carregando modelos de IA...</p>
      </div>

      {/* Progress bar (indeterminate) */}
      <div className="w-48 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 rounded-full animate-[loading_1.5s_ease-in-out_infinite]"
             style={{ width: "60%" }} />
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}
