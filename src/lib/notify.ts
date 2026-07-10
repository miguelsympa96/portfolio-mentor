// Lightweight "your result is ready" signal for a wait that can run 1-3
// minutes, so users feel comfortable tabbing away instead of staring at
// the loading screen (same idea as Lovable/Figma Make's completion ping).

let audioContext: AudioContext | null = null;

// Browsers only allow audio to start from a real user gesture. Call this
// from the click handler that kicks off the analysis (synchronously, before
// any await) so the context is unlocked in time for the async completion
// sound to actually play a minute or two later.
export function unlockAudioForCompletionSound(): void {
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!audioContext) audioContext = new Ctx();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
}

// A soft two-note ascending chime, synthesized (no audio asset to ship or
// license), short and quiet enough not to feel jarring after a long wait.
export function playCompletionSound(): void {
  if (!audioContext) return;
  const ctx = audioContext;
  const now = ctx.currentTime;

  const notes: [freq: number, start: number][] = [
    [880, 0],
    [1318.5, 0.12],
  ];

  notes.forEach(([freq, start]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.15, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + 0.4);
  });
}

const ORIGINAL_TITLE = typeof document !== "undefined" ? document.title : "";

// Flashes the tab title so a user who's switched away notices without
// needing OS-level notification permission (which requires its own prompt
// and can be denied/ignored). Reverts automatically once the tab regains
// focus.
export function flashTitleUntilFocused(message: string): void {
  if (typeof document === "undefined") return;
  if (document.visibilityState !== "hidden") return;

  document.title = message;
  const restore = () => {
    document.title = ORIGINAL_TITLE;
    document.removeEventListener("visibilitychange", restore);
  };
  document.addEventListener("visibilitychange", restore);
}
