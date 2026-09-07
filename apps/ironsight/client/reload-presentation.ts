/** Cosmetic timeline driven only by server ammo acknowledgements. */
export class ReloadPresentation {
  private started = 0;
  private until = 0;
  private duration = 0;
  sync(remainingMs: number, durationMs: number, now: number): void {
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) { this.until = 0; return; }
    this.duration = Math.max(1, durationMs, remainingMs);
    this.until = now + remainingMs;
    this.started = this.until - this.duration;
  }
  progress(now: number): number | null {
    return this.until > now ? Math.max(0, Math.min(1, (now - this.started) / this.duration)) : null;
  }
}
const smooth = (p: number, a: number, b: number): number => {
  const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t);
};
/** Magazine out -> insert -> charging handle -> return; normalized to the
 * authoritative weapon duration, never changes ammo or enables firing. */
export function reloadPose(progress: number | null) {
  const p = progress ?? 1;
  return {
    tilt: smooth(p, 0, 0.14) * (1 - smooth(p, 0.82, 1)),
    magazine: smooth(p, 0.18, 0.34) * (1 - smooth(p, 0.48, 0.64)),
    reach: smooth(p, 0.08, 0.18) * (1 - smooth(p, 0.65, 0.76)),
    bolt: smooth(p, 0.72, 0.78) * (1 - smooth(p, 0.80, 0.86)),
    phase: progress === null ? 'idle' : p < 0.18 ? 'reach' : p < 0.48 ? 'mag-out' : p < 0.70 ? 'mag-in' : p < 0.86 ? 'bolt' : 'return',
  };
}
