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

// Tracks an in-flight background evaluation job (see /api/evaluate/route.ts)
// so a reload or a closed-and-reopened tab can resume polling instead of
// silently losing it: the job keeps running server-side regardless of what
// the client does, so without this the user would just land back on an
// earlier screen while their evaluation finishes for nobody.
const PENDING_JOB_KEY = "portfolio-mentor-pending-job";
// Slightly beyond the job store's own 15min TTL (src/lib/jobStore.ts), so a
// stale entry left over from a very old tab gets discarded client-side
// rather than attempting to resume a job that's already expired server-side.
const PENDING_JOB_MAX_AGE_MS = 20 * 60 * 1000;

export interface PendingJob {
  jobId: string;
  startedAt: number;
  kind: "submit" | "rescan";
}

export function savePendingJob(job: PendingJob) {
  try {
    window.localStorage.setItem(PENDING_JOB_KEY, JSON.stringify(job));
  } catch {
    // Losing the ability to resume on reload is not worth surfacing an error for.
  }
}

export function loadPendingJob(): PendingJob | null {
  try {
    const raw = window.localStorage.getItem(PENDING_JOB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingJob>;
    if (!parsed.jobId || typeof parsed.startedAt !== "number") return null;
    if (Date.now() - parsed.startedAt > PENDING_JOB_MAX_AGE_MS) return null;
    return parsed as PendingJob;
  } catch {
    return null;
  }
}

export function clearPendingJob() {
  try {
    window.localStorage.removeItem(PENDING_JOB_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
