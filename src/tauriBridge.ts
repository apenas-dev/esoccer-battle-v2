/**
 * Tauri bridge — wraps @tauri-apps/api/core invoke with error logging.
 * Requires Tauri runtime. Will throw if __TAURI__ is not available.
 */

import { addLog } from "./debugLogger";

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let _invoke: InvokeFn | null = null;

async function getTauriInvoke(): Promise<InvokeFn> {
  if (_invoke) return _invoke;

  if (typeof window !== "undefined" && "__TAURI__" in window) {
    try {
      const mod = await import("@tauri-apps/api/core");
      if (mod?.invoke) {
        _invoke = mod.invoke as InvokeFn;
        addLog("info", "🔗 Tauri bridge conectada");
        return _invoke;
      }
    } catch (err) {
      addLog("error", `Tauri import falhou: ${err}`);
    }
  }

  throw new Error(
    "Tauri não está disponível. Este app requer o runtime Tauri. Use 'npm run dev' (não 'npm run dev:web')."
  );
}

export async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauriInvoke = await getTauriInvoke();
  try {
    addLog("info", `[CMD] ${cmd}(${args ? JSON.stringify(args) : ""})`);
    const result = await tauriInvoke<T>(cmd, args);
    addLog("info", `[CMD] ${cmd} ✓`);
    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    addLog("error", `Tauri invoke "${cmd}" falhou: ${errMsg}`);
    throw new Error(`Tauri invoke "${cmd}" failed: ${errMsg}`);
  }
}

export function isTauriAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}
