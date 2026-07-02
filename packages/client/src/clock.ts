/**
 * Client clock synchronization. Estimates the offset between the client's wall
 * clock and the server's, plus round-trip time, by pinging `c:time` and reading
 * the server's `s:time` reply. `serverNow()` then lets the client place authoritative
 * snapshots on a shared timeline so entity interpolation is smooth regardless of
 * network jitter (jitter no longer becomes interpolation jitter).
 *
 * Estimation is NTP-style: with the ping's send time `t0`, the reply's receive
 * time `t1`, and the server's stamped time, `rtt = t1 - t0` and
 * `offset = serverTime + rtt/2 - t1`. Samples are kept in a rolling window and the
 * reported offset/rtt are the medians (robust to occasional jitter spikes).
 */
export interface ClockSyncOptions {
  /** Send a `c:time` ping stamped with `t0` (the caller wires this to the transport). */
  send: (t0: number) => void;
  /** Clock source (default `Date.now`). */
  now?: () => number;
  /** Number of pings in the initial burst on start (default 5). */
  burst?: number;
  /** Spacing between burst pings, ms (default 100). */
  spacingMs?: number;
  /** Periodic resync interval, ms (default 15000). */
  intervalMs?: number;
  /** Rolling sample window size (default 20). */
  maxSamples?: number;
}

interface Sample {
  offset: number;
  rtt: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export class ClockSync {
  /** Estimated (serverClock - clientClock) in ms; 0 until the first reply. */
  offsetMs = 0;
  /** Estimated round-trip time in ms; 0 until the first reply. */
  rttMs = 0;

  private readonly send: (t0: number) => void;
  private readonly now: () => number;
  private readonly burst: number;
  private readonly spacingMs: number;
  private readonly intervalMs: number;
  private readonly maxSamples: number;
  private readonly samples: Sample[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly burstTimers: ReturnType<typeof setTimeout>[] = [];

  constructor(opts: ClockSyncOptions) {
    this.send = opts.send;
    this.now = opts.now ?? (() => Date.now());
    this.burst = opts.burst ?? 5;
    this.spacingMs = opts.spacingMs ?? 100;
    this.intervalMs = opts.intervalMs ?? 15_000;
    this.maxSamples = opts.maxSamples ?? 20;
  }

  /** The server's estimated current time (epoch ms). */
  serverNow(): number {
    return this.now() + this.offsetMs;
  }

  /** Send one clock-sync ping now. */
  ping(): void {
    this.send(this.now());
  }

  /** Feed a `s:time` reply: `t0` echoed from the ping, `serverTime` the server clock. */
  accept(t0: number, serverTime: number): void {
    const t1 = this.now();
    const rtt = Math.max(0, t1 - t0);
    const offset = serverTime + rtt / 2 - t1;
    this.samples.push({ offset, rtt });
    while (this.samples.length > this.maxSamples) this.samples.shift();
    this.rttMs = median(this.samples.map((s) => s.rtt));
    this.offsetMs = median(this.samples.map((s) => s.offset));
  }

  /** Begin syncing: a quick burst for a fast initial estimate, then periodic resync. */
  start(): void {
    this.stop();
    for (let i = 0; i < this.burst; i++) {
      this.burstTimers.push(setTimeout(() => this.ping(), i * this.spacingMs));
    }
    this.interval = setInterval(() => this.ping(), this.intervalMs);
  }

  /** Stop syncing and clear timers. */
  stop(): void {
    for (const timer of this.burstTimers) clearTimeout(timer);
    this.burstTimers.length = 0;
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
