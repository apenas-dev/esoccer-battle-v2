/**
 * Tauri bridge abstraction — works in Tauri desktop AND browser dev (Vite only).
 * When Tauri is available (`__TAURI__` in window), uses real invoke.
 * Otherwise, uses mock implementations for dev/testing.
 */

import { addLog } from "./debugLogger";

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let _invoke: InvokeFn | null = null;
let _tauriAvailable: boolean | null = null;

async function getTauriInvoke(): Promise<InvokeFn | null> {
  if (_tauriAvailable !== null) {
    return _tauriAvailable ? _invoke : null;
  }

  try {
    // Check if running inside Tauri
    if (typeof window !== "undefined" && "__TAURI__" in window) {
      const mod = await import("@tauri-apps/api/core");
      if (mod?.invoke) {
        _invoke = mod.invoke as InvokeFn;
        _tauriAvailable = true;
        addLog("info", "🔗 Tauri bridge conectada");
        return _invoke;
      }
    }
  } catch (err) {
    addLog("info", `⚠️ Tauri import falhou: ${err}`);
  }

  _tauriAvailable = false;
  addLog("info", "⚠️ Tauri NÃO disponível — usando mock (rode 'npm run dev' para Tauri)");
  return null;
}

// ─── Mock implementations for browser dev ────────────────────────

let mockMatchId = 1;
const mockMatches = new Map<number, import("./types").MatchState>();
const mockCommandLog: import("./types").CommandLogEntry[] = [];

function numeroPorExtenso(n: number): string {
  const nums = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];
  return n >= 0 && n < nums.length ? nums[n] : String(n);
}

function createMockMatch(teamA: string, teamB: string): import("./types").MatchState {
  const id = mockMatchId++;
  const match: import("./types").MatchState = {
    id,
    status: "in_progress",
    score_a: 0,
    score_b: 0,
    time_elapsed: 0,
    time_total: 360,
    team_a_name: teamA,
    team_b_name: teamB,
  };
  mockMatches.set(id, match);
  return match;
}

async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  addLog("info", `[MOCK] ${cmd}(${args ? JSON.stringify(args) : ""})`);

  switch (cmd) {
    case "greet":
      return "Hello from mock!" as T;

    case "start_match": {
      const m = createMockMatch("Time A", "Time B");
      window.dispatchEvent(new CustomEvent("mock-match-state-update", { detail: m }));
      addLog("info", `[MOCK] Partida iniciada: Time A vs Time B`);
      return "Partida iniciada! Time A versus Time B. 6 minutos no relógio." as T;
    }

    case "start_match_with_names": {
      const teamA = (args?.teamA as string) || "Time A";
      const teamB = (args?.teamB as string) || "Time B";
      const m = createMockMatch(teamA, teamB);
      window.dispatchEvent(new CustomEvent("mock-match-state-update", { detail: m }));
      addLog("info", `[MOCK] Partida iniciada: ${teamA} vs ${teamB}`);
      return `Partida iniciada! ${teamA} versus ${teamB}. 6 minutos no relógio.` as T;
    }

    case "get_current_match": {
      // Return last match or null
      const last = Array.from(mockMatches.values()).pop() ?? null;
      return last as T;
    }

    case "process_text_command":
    case "process_voice_command": {
      const text = (args?.text as string) || (args?.transcription as string) || "";
      const lower = text.toLowerCase().trim();
      const lastMatch = Array.from(mockMatches.values()).pop();

      let response = "";

      if (/volta\s+seis|volta\s+6|começar|iniciar/.test(lower)) {
        const m = createMockMatch("Time A", "Time B");
        window.dispatchEvent(new CustomEvent("mock-match-state-update", { detail: m }));
        response = "Partida iniciada! Time A versus Time B. 6 minutos no relógio.";
      } else if (/resultado|placar|quanto/.test(lower)) {
        if (lastMatch) {
          response = `O placar está ${numeroPorExtenso(lastMatch.score_a)} a ${numeroPorExtenso(lastMatch.score_b)}.`;
        } else {
          response = "Nenhuma partida em andamento.";
        }
      } else if (/intervalo|pausar|parar/.test(lower)) {
        if (lastMatch && lastMatch.status === "in_progress") {
          lastMatch.status = "paused";
          response = "Partida pausada.";
        } else if (lastMatch?.status === "paused") {
          lastMatch.status = "in_progress";
          response = "Partida retomada!";
        } else {
          response = "Não há partida em andamento para pausar.";
        }
      } else if (/gol\s+(do\s+|pro\s+)?time\s*a|gol\s+a/.test(lower)) {
        if (lastMatch && lastMatch.status === "in_progress") {
          lastMatch.score_a++;
          response = `Gol do Time A! Placar: ${numeroPorExtenso(lastMatch.score_a)} a ${numeroPorExtenso(lastMatch.score_b)}.`;
        } else {
          response = "A partida não está em andamento.";
        }
      } else if (/gol\s+(do\s+|pro\s+)?time\s*b|gol\s+b/.test(lower)) {
        if (lastMatch && lastMatch.status === "in_progress") {
          lastMatch.score_b++;
          response = `Gol do Time B! Placar: ${numeroPorExtenso(lastMatch.score_a)} a ${numeroPorExtenso(lastMatch.score_b)}.`;
        } else {
          response = "A partida não está em andamento.";
        }
      } else if (/encerrar|finalizar|terminar/.test(lower)) {
        if (lastMatch) {
          lastMatch.status = "finished";
          response = "Partida encerrada!";
        } else {
          response = "Nenhuma partida em andamento.";
        }
      } else if (/comandos|ajuda|help/.test(lower)) {
        response = "Você pode dizer:\n1. Volta seis\n2. Resultado\n3. Intervalo\n4. Gol time A\n5. Gol time B\n6. Encerrar\n7. Comandos";
      } else if (/dúvida|duvida/.test(lower)) {
        response = "Dúvida marcada!";
      } else {
        response = "Comando não reconhecido. Diga 'comandos' para ver as opções.";
      }

      addLog("info", `[MOCK] Resposta: "${response}"`);

      // Return match state update via the response structure
      const currentMatch = Array.from(mockMatches.values()).pop();
      // Emit mock match_state_update event for the listener
      if (currentMatch) {
        window.dispatchEvent(new CustomEvent("mock-match-state-update", { detail: currentMatch }));
      }

      return {
        response_text: response,
        command_id: crypto.randomUUID(),
        transcription: text,
      } as T;
    }

    case "get_match_history":
      return Array.from(mockMatches.values()).map((m) => ({
        id: String(m.id),
        date: new Date().toISOString(),
        score_a: m.score_a,
        score_b: m.score_b,
        duration_secs: m.time_elapsed,
        team_a_name: m.team_a_name,
        team_b_name: m.team_b_name,
      })) as T;

    case "get_command_log":
      return mockCommandLog as T;

    case "set_team_names": {
      const teamA = (args?.teamA as string) || "Time A";
      const teamB = (args?.teamB as string) || "Time B";
      const last = Array.from(mockMatches.values()).pop();
      if (last) {
        last.team_a_name = teamA;
        last.team_b_name = teamB;
        window.dispatchEvent(new CustomEvent("mock-match-state-update", { detail: last }));
      }
      return `Nomes atualizados: ${teamA} versus ${teamB}.` as T;
    }

    default:
      addLog("info", `[MOCK] Comando desconhecido: ${cmd}`);
      throw new Error(`Mock: comando "${cmd}" não implementado`);
  }
}

// ─── Public API ──────────────────────────────────────────────────

export async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauriInvoke = await getTauriInvoke();

  if (tauriInvoke) {
    try {
      return await tauriInvoke<T>(cmd, args);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      addLog("error", `Tauri invoke "${cmd}" falhou: ${errMsg}`);
      throw new Error(`Tauri invoke "${cmd}" failed: ${errMsg}`);
    }
  }

  // Fallback to mock
  return mockInvoke<T>(cmd, args);
}

export function isTauriAvailable(): boolean {
  return _tauriAvailable === true;
}
