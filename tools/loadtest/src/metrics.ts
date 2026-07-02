/**
 * Metric accumulation + aggregation.
 *
 * A {@link MetricsBundle} is a plain, structured-clone-serializable object so a
 * worker thread can post its slice back to the main thread, where bundles are
 * merged before percentiles are computed. Latency/jitter are kept as raw sample
 * arrays (not pre-bucketed) so merged percentiles are exact.
 */
export interface MetricsBundle {
  /** Input→ack round-trip samples, ms. */
  rtt: number[];
  /** State-frame inter-arrival deviation from the expected cadence, |gap − expected| ms. */
  jitter: number[];
  /** Raw state-frame inter-arrival gaps, ms (diagnostic). */
  gaps: number[];
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
  clients: number;
}

export function emptyBundle(): MetricsBundle {
  return {
    rtt: [],
    jitter: [],
    gaps: [],
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
    clients: 0,
  };
}

/** A shared accumulator; every client in a shard records into one recorder. */
export class Recorder {
  readonly bundle: MetricsBundle = emptyBundle();

  rtt(ms: number): void {
    this.bundle.rtt.push(ms);
  }
  frame(gapMs: number | null, expectedMs: number | null): void {
    this.bundle.stateFrames += 1;
    if (gapMs !== null) {
      this.bundle.gaps.push(gapMs);
      if (expectedMs !== null) this.bundle.jitter.push(Math.abs(gapMs - expectedMs));
    }
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
  client(): void {
    this.bundle.clients += 1;
  }
}

export function mergeBundles(bundles: MetricsBundle[]): MetricsBundle {
  const out = emptyBundle();
  for (const b of bundles) {
    for (const v of b.rtt) out.rtt.push(v);
    for (const v of b.jitter) out.jitter.push(v);
    for (const v of b.gaps) out.gaps.push(v);
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
    out.clients += b.clients;
  }
  return out;
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
