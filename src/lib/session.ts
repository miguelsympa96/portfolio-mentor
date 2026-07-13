import type { EvaluationResult } from "./types";

const STORAGE_KEY = "portfolio-mentor-session";
const VERSION = 1;

export interface PersistedSession {
  version: number;
  view: "result" | "improve";
  seniority: string;
  url: string;
  jobDescription: string;
  result: EvaluationResult;
  previousResult?: EvaluationResult | null;
  resolvedActions: string[];
  improveStartStep: number;
}

export function saveSession(session: Omit<PersistedSession, "version">) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: VERSION, ...session })
    );
  } catch {
    // Storage full or unavailable (private browsing) — losing the ability
    // to recover a session on reload is not worth surfacing an error for.
  }
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== VERSION || !parsed.result) return null;
    return parsed as PersistedSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
