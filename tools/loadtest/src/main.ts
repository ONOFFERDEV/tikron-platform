import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { CliError, parseArgs, type Config } from "./cli.js";
import { mergeBundles, type MetricsBundle } from "./metrics.js";
import { buildReport, formatSummary } from "./report.js";
import { runShard, type ClientSpec, type ShardResult } from "./runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  let config: Config | null;
  try {
    config = parseArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof CliError) {
      process.stderr.write(`error: ${err.message}\n\nRun with --help for usage.\n`);
      process.exit(2);
    }
    throw err;
  }
  if (!config) return; // --help printed

  if (config.hz > 30) {
    process.stderr.write(
      `warning: --hz ${config.hz} exceeds the room input cap (30/s); excess inputs will be dropped and never acked.\n`,
    );
  }

  const specs = buildSpecs(config);
  process.stdout.write(
    `Starting: ${config.scenario} · ${specs.length} connections · ${config.workers} worker(s) · ` +
      `${(config.durationMs / 1000).toFixed(0)}s @ ${config.hz}Hz → ${config.url}\n`,
  );

  const started = performance.now();
  const { bundles, lagMs } =
    config.workers <= 1 ? await runSingle(config, specs) : await runSharded(config, specs);
  const wallMs = performance.now() - started;

  const merged = mergeBundles(bundles);
  const report = buildReport(config, merged, config.durationMs, lagMs, wallMs);
  process.stdout.write(formatSummary(report));

  const outPath = await writeReport(config, report);
  process.stdout.write(`Report written: ${outPath}\n`);

  // Sockets and timers are closed; exit explicitly so a lingering handle can't hang.
  process.exit(0);
}

/** Build one ClientSpec per (room, player); a fresh UUID session per player. */
function buildSpecs(config: Config): ClientSpec[] {
  const specs: ClientSpec[] = [];
  for (let r = 0; r < config.rooms; r++) {
    const roomId = `${config.roomPrefix}-r${r}`;
    for (let p = 0; p < config.players; p++) {
      specs.push({ roomId, sessionId: randomUUID() });
    }
  }
  return specs;
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

async function writeReport(config: Config, report: unknown): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultPath = resolve(__dirname, "..", "results", `${ts}-${config.scenario}.json`);
  const outPath = config.out ? resolve(config.out) : defaultPath;
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return outPath;
}

void main();
