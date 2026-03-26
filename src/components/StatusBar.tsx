export default function StatusBar() {
  return (
    <footer
      className="w-full py-2 px-6 flex items-center justify-between text-[11px] text-gray-700 border-t border-border-subtle bg-bg-secondary/50"
      role="contentinfo"
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green/50" />
          Offline
        </span>
        <span className="text-gray-800">•</span>
        <span>Whisper ONNX (pt-BR)</span>
      </div>
      <div className="flex items-center gap-3 text-gray-700">
        <span>Tauri v2</span>
        <span className="text-gray-800">•</span>
        <span>React 19</span>
      </div>
    </footer>
  );
}
