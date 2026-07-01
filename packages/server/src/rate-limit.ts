interface RateWindow {
  start: number;
  count: number;
}

/**
 * Fixed-window per-key rate limiter (core; genre-agnostic). Deterministic given
 * an explicit `now`, which keeps it unit-testable without timers.
 */
export class RateLimiter {
  private readonly windows = new Map<string, RateWindow>();

  allow(key: string, now: number, maxPerWindow: number, windowMs = 1000): boolean {
    const w = this.windows.get(key);
    if (!w || now - w.start >= windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      return true;
    }
    if (w.count < maxPerWindow) {
      w.count += 1;
      return true;
    }
    return false;
  }

  forget(key: string): void {
    this.windows.delete(key);
  }
}
