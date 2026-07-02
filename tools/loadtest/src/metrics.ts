/**
 * Metric accumulation + aggregation.
 *
 * A {@link MetricsBundle} is a plain, structured-clone-serializable object so a
 * worker thread can post its slice back to the main thread, where bundles are
 * merged before percentiles are computed. Latency/jitter are kept as raw sample
 * arrays (not pre-bucketed) so merged percentiles are exact.
 */
/**
 * One server-side latency histogram block (tick or flush), as reported by the
 * room in response to a `tk:stats` developer message. All fields are optional on
 * the wire — a room that does not track a given block simply omits it.
 */
export interface ServerStatBlock {
  p50: number;
  p95: number;
  max: number;
  n: number;
}

/** Server tick/flush processing stats for one room (`tk:stats` reply payload). */
export interface ServerStats {
  tick: ServerStatBlock | null;
  flush: ServerStatBlock | null;
  /** Window the server histograms cover, ms (null if not reported). */
  windowMs: number | null;
}

function parseBlock(v: unknown): ServerStatBlock | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  // Require at least one of the histogram fields to be a number; otherwise treat
  // the block as absent so old servers that echo `{}` don't fabricate zeros.
  if (
    typeof o.p50 !== "number" &&
    typeof o.p95 !== "number" &&
    typeof o.max !== "number" &&
    typeof o.n !== "number"
  ) {
    return null;
  }
  return { p50: num(o.p50), p95: num(o.p95), max: num(o.max), n: num(o.n) };
}

/**
 * Leniently parse a `tk:stats` reply payload. Returns null when the payload is
 * unusable so the caller can fall back to "n/a" (old-server compatibility).
 */
export function parseServerStats(payload: unknown): ServerStats | null {
  if (typeof payload !== "object" || payload === null) return null;
  const o = payload as Record<string, unknown>;
  const tick = parseBlock(o.tick);
  const flush = parseBlock(o.flush);
  const windowMs = typeof o.windowMs === "number" && Number.isFinite(o.windowMs) ? o.windowMs : null;
  if (tick === null && flush === null && windowMs === null) return null;
  return { tick, flush, windowMs };
}

export interface MetricsBundle {
  /** Input→ack round-trip samples, ms. */
  rtt: number[];
  /** Timestamp of each `rtt` sample, ms since steady-state start (negative during ramp). */
  rttAt: number[];
  /** State-frame inter-arrival deviation from the expected cadence, |gap − expected| ms. */
  jitter: number[];
  /** Timestamp of each `jitter` sample, ms since steady-state start. */
  jitterAt: number[];
  /** Raw state-frame inter-arrival gaps, ms (diagnostic). */
  gaps: number[];
  /** Timestamp of each `gaps` sample, ms since steady-state start. */
  gapsAt: number[];
  /** Server tick/flush stats keyed by room id (one representative client per room). */
  roomStats: Record<string, ServerStats>;
  downlinkBytes: number;
  uplinkBytes: number;
  stateFrames: number;
  connectSuccess: number;
  connectFailure: number;
  unexpectedCloses: number;
  protocolErrors: number;
  decodeErrors: number;
  /** Frames whose decoded state contained this client's own player. */
  ownPresentFrames: number;
  /** Frames (after the first own-present frame) where the own player was missing. */
  ownAbsentFrames: number;
  /** Server-broadcast `shot` events received (fps scenario). */
  shotEvents: number;
  clients: number;
}

export function emptyBundle(): MetricsBundle {
  return {
    rtt: [],
    rttAt: [],
    jitter: [],
    jitterAt: [],
    gaps: [],
    gapsAt: [],
    roomStats: {},
    downlinkBytes: 0,
    uplinkBytes: 0,
    stateFrames: 0,
    connectSuccess: 0,
    connectFailure: 0,
    unexpectedCloses: 0,
    protocolErrors: 0,
    decodeErrors: 0,
    ownPresentFrames: 0,
    ownAbsentFrames: 0,
    shotEvents: 0,
    clients: 0,
  };
}

/** A shared accumulator; every client in a shard records into one recorder. */
export class Recorder {
  readonly bundle: MetricsBundle = emptyBundle();

  /**
   * Steady-state start, `performance.now()` ms. Set by the runner when the ramp
   * ends; sample timestamps are stored relative to it so warm-up discard and
   * spike-time bucketing stay comparable across worker shards.
   */
  steadyStartMs = 0;

  private at(): number {
    return performance.now() - this.steadyStartMs;
  }

  rtt(ms: number): void {
    this.bundle.rtt.push(ms);
    this.bundle.rttAt.push(this.at());
  }
  frame(gapMs: number | null, expectedMs: number | null): void {
    this.bundle.stateFrames += 1;
    if (gapMs !== null) {
      const t = this.at();
      this.bundle.gaps.push(gapMs);
      this.bundle.gapsAt.push(t);
      if (expectedMs !== null) {
        this.bundle.jitter.push(Math.abs(gapMs - expectedMs));
        this.bundle.jitterAt.push(t);
      }
    }
  }
  roomStat(roomId: string, stats: ServerStats): void {
    this.bundle.roomStats[roomId] = stats;
  }
  downlink(bytes: number): void {
    this.bundle.downlinkBytes += bytes;
  }
  uplink(bytes: number): void {
    this.bundle.uplinkBytes += bytes;
  }
  connectSuccess(): void {
    this.bundle.connectSuccess += 1;
  }
  connectFailure(): void {
    this.bundle.connectFailure += 1;
  }
  unexpectedClose(): void {
    this.bundle.unexpectedCloses += 1;
  }
  protocolError(): void {
    this.bundle.protocolErrors += 1;
  }
  decodeError(): void {
    this.bundle.decodeErrors += 1;
  }
  ownPresent(): void {
    this.bundle.ownPresentFrames += 1;
  }
  ownAbsent(): void {
    this.bundle.ownAbsentFrames += 1;
  }
  shot(): void {
    this.bundle.shotEvents += 1;
  }
  client(): void {
    this.bundle.clients += 1;
  }
}

export function mergeBundles(bundles: MetricsBundle[]): MetricsBundle {
  const out = emptyBundle();
  for (const b of bundles) {
    for (const v of b.rtt) out.rtt.push(v);
    for (const v of b.rttAt) out.rttAt.push(v);
    for (const v of b.jitter) out.jitter.push(v);
    for (const v of b.jitterAt) out.jitterAt.push(v);
    for (const v of b.gaps) out.gaps.push(v);
    for (const v of b.gapsAt) out.gapsAt.push(v);
    Object.assign(out.roomStats, b.roomStats);
    out.downlinkBytes += b.downlinkBytes;
    out.uplinkBytes += b.uplinkBytes;
    out.stateFrames += b.stateFrames;
    out.connectSuccess += b.connectSuccess;
    out.connectFailure += b.connectFailure;
    out.unexpectedCloses += b.unexpectedCloses;
    out.protocolErrors += b.protocolErrors;
    out.decodeErrors += b.decodeErrors;
    out.ownPresentFrames += b.ownPresentFrames;
    out.ownAbsentFrames += b.ownAbsentFrames;
    out.shotEvents += b.shotEvents;
    out.clients += b.clients;
  }
  return out;
}

/**
 * Drop samples whose timestamp falls in the warm-up window. `discardMs <= 0`
 * returns the input untouched (default path — includes ramp-phase samples, so
 * percentiles match the pre-discard behavior exactly).
 */
export function filterByDiscard(values: number[], ats: number[], discardMs: number): number[] {
  if (discardMs <= 0) return values;
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if ((ats[i] as number) >= discardMs) out.push(values[i] as number);
  }
  return out;
}

/**
 * Bucket latency spikes (samples over `thresholdMs`) by whole-second offset from
 * steady-state start, so a caller can tell warm-up-concentrated spikes apart from
 * periodic (GC-suspect) ones. Ramp-phase spikes (negative offset) bucket to -1.
 */
export function spikeHistogram(
  values: number[],
  ats: number[],
  thresholdMs: number,
): { count: number; bySecond: Record<number, number> } {
  const bySecond: Record<number, number> = {};
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    if ((values[i] as number) <= thresholdMs) continue;
    count++;
    const at = ats[i] as number;
    const sec = at < 0 ? -1 : Math.floor(at / 1000);
    bySecond[sec] = (bySecond[sec] ?? 0) + 1;
  }
  return { count, bySecond };
}

export interface Percentiles {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

export function percentiles(samples: number[]): Percentiles {
  if (samples.length === 0) {
    return { count: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p: number): number => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx] as number;
  };
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    p50: at(50),
    p95: at(95),
    p99: at(99),
    max: sorted[sorted.length - 1] as number,
    mean: sum / sorted.length,
  };
}
