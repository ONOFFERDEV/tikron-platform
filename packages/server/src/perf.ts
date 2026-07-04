/**
 * Lightweight per-room timing instrumentation (F0). A {@link Room} keeps one ring
 * per measured stage (simulation tick, state flush) and reports percentiles over a
 * recent time window when a client asks — the only way to directly observe the
 * "<20 ms tick+flush @100p" target that the FPS work targets.
 *
 * Cost on the hot path is deliberately tiny: two `performance.now()` reads and one
 * `record()` (a couple of array stores) per tick/flush — no per-sample allocation.
 * The percentile math allocates a small temp array, but only on an explicit query
 * (a developer `tk:stats` poll), never during simulation.
 */

/** Percentile summary of one stage's recent durations (all values in ms, float). */
export interface DurationStats {
  p50: number;
  p95: number;
  max: number;
  n: number;
}

/**
 * Per-reason counts of developer inputs the room DROPPED rather than processed
 * (F119). Each reason maps to a silent `return` the core used to take — surfaced
 * here so an AI agent can poll `tk:stats` and see, mechanically, that (say) its
 * message type never had a handler. Cumulative for the room's lifetime.
 */
export interface DropCounts {
  /** Inputs refused by the per-client per-second rate limit. */
  rateLimited: number;
  /** Inputs whose seq was <= the last processed seq (stale / replayed). */
  staleSeq: number;
  /** `c:mbatch` frames rejected whole for exceeding the per-frame message cap. */
  oversizedBatch: number;
  /** Messages whose `type` had no registered handler (usually a typo'd type). */
  unknownType: number;
}

/** The `tk:stats` reply payload — the wire contract the loadtest harness parses. */
export interface PerfSnapshot {
  tick: DurationStats;
  flush: DurationStats;
  windowMs: number;
  /** Cumulative dropped-input counts by reason (F119). */
  drops: DropCounts;
  /** Cumulative count of exceptions routed through {@link Room.onError} (F120). */
  errors: number;
}

/**
 * Fixed-capacity ring of `(timestampMs, durationMs)` samples. Oldest samples are
 * overwritten once full; queries filter to a trailing time window so the reported
 * percentiles track only recent behavior regardless of how long the room has run.
 */
export class DurationRing {
  private readonly times: Float64Array;
  private readonly durs: Float64Array;
  private head = 0;
  private count = 0;

  constructor(private readonly capacity: number) {
    this.times = new Float64Array(capacity);
    this.durs = new Float64Array(capacity);
  }

  /** Record one sample; `nowMs` is a `performance.now()` reading (the sample's clock). */
  record(nowMs: number, durationMs: number): void {
    this.times[this.head] = nowMs;
    this.durs[this.head] = durationMs;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** p50/p95/max/n over the samples recorded within `[nowMs - windowMs, nowMs]`. */
  stats(nowMs: number, windowMs: number): DurationStats {
    const cutoff = nowMs - windowMs;
    const recent: number[] = [];
    for (let i = 0; i < this.count; i++) {
      if (this.times[i]! >= cutoff) recent.push(this.durs[i]!);
    }
    if (recent.length === 0) return { p50: 0, p95: 0, max: 0, n: 0 };
    recent.sort((a, b) => a - b);
    const at = (p: number): number =>
      recent[Math.min(recent.length - 1, Math.floor((p / 100) * recent.length))]!;
    return { p50: at(50), p95: at(95), max: recent[recent.length - 1]!, n: recent.length };
  }
}
