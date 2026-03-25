export default function StatusBar() {
  return (
    <footer
      className="w-full py-2 px-4 flex items-center justify-between text-xs text-gray-600"
      role="contentinfo"
    >
      <span>🔋 Offline — STT via WebSpeech API</span>
      <span>Tauri v2 + React 19</span>
    </footer>
  );
}
