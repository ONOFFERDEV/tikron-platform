import type { Config } from "./cli.js";
import { Recorder, type MetricsBundle } from "./metrics.js";
import { SimClient } from "./client.js";

export interface ClientSpec {
  roomId: string;
  sessionId: string;
}

export interface ShardResult {
  bundle: MetricsBundle;
  /** Steady-state window the reported bandwidth is averaged over, ms. */
  windowMs: number;
  /** Max observed event-loop delay during steady state, ms (main-thread self-check only). */
  lagMs: number | null;
}

const DRAIN_MS = 250;
const LAG_TICK_MS = 200;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Drive one shard's clients end-to-end: ramp connections up over `rampMs`, hold
 * a steady-state `durationMs`, then stop and drain. Bandwidth counters are scoped
 * to the steady-state window (ramp-phase bytes are excluded) so bytes/sec is a
 * clean average; latency/jitter samples span the whole run.
 */
export async function runShard(
  config: Config,
  specs: ClientSpec[],
  measureLag: boolean,
): Promise<ShardResult> {
  const rec = new Recorder();
  const clients = specs.map(
    (s) => new SimClient(config, s.roomId, s.sessionId, rec, Math.random),
  );

  // Ramp connections across the window to avoid a thundering herd on connect.
  const rampMs = specs.length > 1 ? config.rampMs : 0;
  const connects: Promise<void>[] = [];
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i]!;
    const delay = clients.length > 1 ? Math.floor((i / clients.length) * rampMs) : 0;
    connects.push(
      sleep(delay).then(async () => {
        await client.connect();
        client.start();
      }),
    );
  }
  await Promise.allSettled(connects);

  // Steady state: scope bandwidth to this window only.
  const steadyDown = rec.bundle.downlinkBytes;
  const steadyUp = rec.bundle.uplinkBytes;

  const lag = measureLag ? new LagProbe() : null;
  lag?.start();
  await sleep(config.durationMs);
  lag?.stop();

  for (const c of clients) c.stop();
  await sleep(DRAIN_MS);

  rec.bundle.downlinkBytes -= steadyDown;
  rec.bundle.uplinkBytes -= steadyUp;

  return { bundle: rec.bundle, windowMs: config.durationMs, lagMs: lag?.maxLagMs ?? null };
}

/** Samples timer drift to detect event-loop saturation. */
class LagProbe {
  private timer?: ReturnType<typeof setInterval>;
  private last = 0;
  maxLagMs = 0;

  start(): void {
    this.last = performance.now();
    this.timer = setInterval(() => {
      const t = performance.now();
      const drift = t - this.last - LAG_TICK_MS;
      if (drift > this.maxLagMs) this.maxLagMs = drift;
      this.last = t;
    }, LAG_TICK_MS);
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
