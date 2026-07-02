import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import type { Config } from "./cli.js";
import { mergeBundles, type MetricsBundle } from "./metrics.js";
import { buildReport, type Report } from "./report.js";
import { runShard, type ClientSpec, type ShardResult } from "./runner.js";

/** Build one ClientSpec per (room, player); a fresh UUID session per player. */
export function buildSpecs(config: Config): ClientSpec[] {
  const specs: ClientSpec[] = [];
  for (let r = 0; r < config.rooms; r++) {
    const roomId = `${config.roomPrefix}-r${r}`;
    for (let p = 0; p < config.players; p++) {
      // The first player in each room speaks for it when requesting server stats.
      specs.push({ roomId, sessionId: randomUUID(), representative: p === 0 });
    }
  }
  return specs;
}

/**
 * Drive one full load run (single-thread or sharded) and return its report.
 * Pure with respect to I/O — no stdout, no file writes, no process.exit — so both
 * the CLI entry and the sweep runner can call it.
 */
export async function runLoad(config: Config, specs = buildSpecs(config)): Promise<Report> {
  const started = performance.now();
  const { bundles, lagMs } =
    config.workers <= 1 ? await runSingle(config, specs) : await runSharded(config, specs);
  const wallMs = performance.now() - started;

  const merged = mergeBundles(bundles);
  return buildReport(config, merged, config.durationMs, lagMs, wallMs);
}

async function runSingle(
  config: Config,
  specs: ClientSpec[],
): Promise<{ bundles: MetricsBundle[]; lagMs: number | null }> {
  const result = await runShard(config, specs, true);
  return { bundles: [result.bundle], lagMs: result.lagMs };
}

async function runSharded(
  config: Config,
  specs: ClientSpec[],
): Promise<{ bundles: MetricsBundle[]; lagMs: number | null }> {
  const shards: ClientSpec[][] = Array.from({ length: config.workers }, () => []);
  specs.forEach((spec, i) => shards[i % config.workers]!.push(spec));

  const workerUrl = new URL("./worker.ts", import.meta.url);
  const execArgv = process.execArgv.length ? process.execArgv : ["--import", "tsx"];

  const results = await Promise.all(
    shards.map(
      (shardSpecs) =>
        new Promise<ShardResult>((resolvePromise, rejectPromise) => {
          const worker = new Worker(workerUrl, {
            workerData: { config, specs: shardSpecs },
            execArgv,
          });
          worker.once("message", (result: ShardResult) => {
            resolvePromise(result);
            void worker.terminate();
          });
          worker.once("error", rejectPromise);
        }),
    ),
  );

  return { bundles: results.map((r) => r.bundle), lagMs: null };
}
