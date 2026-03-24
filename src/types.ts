// Match state from backend
export interface MatchState {
  status: "waiting" | "in_progress" | "paused" | "finished";
  score_a: number;
  score_b: number;
  time_elapsed: number; // seconds
  time_total: number; // seconds (default 360 = 6min)
  team_a_name: string;
  team_b_name: string;
}

export interface CommandLogEntry {
  id: string;
  timestamp: string;
  command: string;
  response: string;
  command_type: "voice" | "text";
}

export interface MatchHistoryEntry {
  id: string;
  date: string;
  score_a: number;
  score_b: number;
  duration_secs: number;
  team_a_name: string;
  team_b_name: string;
}

export interface VoiceResponse {
  response_text: string;
  audio_bytes: number[];
  command_id: string;
  transcription: string;
}
