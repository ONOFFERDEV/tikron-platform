import type { Config } from "./cli.js";
import { Recorder, type MetricsBundle } from "./metrics.js";
import { SimClient } from "./client.js";

export interface ClientSpec {
  roomId: string;
  sessionId: string;
  /** Exactly one client per room is the representative that requests `tk:stats`. */
  representative: boolean;
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
/** How long a representative client waits for its `tk:stats` reply before "n/a". */
const STATS_TIMEOUT_MS = 3000;

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

  // Steady state: scope bandwidth to this window only and anchor sample
  // timestamps here so warm-up discard / spike bucketing measure from now.
  const steadyDown = rec.bundle.downlinkBytes;
  const steadyUp = rec.bundle.uplinkBytes;
  rec.steadyStartMs = performance.now();

  const lag = measureLag ? new LagProbe() : null;
  lag?.start();
  await sleep(config.durationMs);
  lag?.stop();

  // Collect server tick/flush stats from each room's representative before we
  // tear the sockets down (the window covers the run we just finished).
  await collectServerStats(rec, specs, clients);

  for (const c of clients) c.stop();
  await sleep(DRAIN_MS);

  rec.bundle.downlinkBytes -= steadyDown;
  rec.bundle.uplinkBytes -= steadyUp;

  return { bundle: rec.bundle, windowMs: config.durationMs, lagMs: lag?.maxLagMs ?? null };
}

/**
 * Ask each room's representative client (those in this shard) for its server-side
 * tick/flush stats and record any replies. Missing replies are simply absent from
 * `roomStats` so the report shows "n/a" — an old server that ignores `tk:stats`
 * never fails the run.
 */
async function collectServerStats(
  rec: Recorder,
  specs: ClientSpec[],
  clients: SimClient[],
): Promise<void> {
  await Promise.all(
    specs.map(async (spec, i) => {
      if (!spec.representative) return;
      const stats = await clients[i]!.requestStats(STATS_TIMEOUT_MS);
      if (stats) rec.roomStat(spec.roomId, stats);
    }),
  );
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
