import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "./cli.js";
import { isScenarioName, type ScenarioName } from "./scenarios.js";
import { buildSpecs, runLoad } from "./run.js";
import type { Report } from "./report.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Sweep runner: run the FPS load matrix (players × repeats) back-to-back against
 * one gateway, preserve each run's JSON report, and emit a comparison table both
 * to stdout and as `<out-dir>/summary.md`. Reuses {@link runLoad} in-process so
 * there is no per-run node spawn.
 */

interface SweepConfig {
  url: string;
  outDir: string;
  scenario: ScenarioName;
  rooms: number;
  players: number[];
  durationSec: number;
  hz: number;
  rampSec: number;
  repeat: number;
  maxClients: number;
  discardSec: number;
  cooldownSec: number;
}

const DEFAULTS = {
  scenario: "agar" as ScenarioName,
  rooms: 1,
  players: [20, 50, 100],
  durationSec: 30,
  hz: 20,
  rampSec: 3,
  repeat: 2,
  maxClients: 120,
  discardSec: 5,
  cooldownSec: 5,
};

const HELP = `Tikron load-test sweep

Usage:
  pnpm --filter @tikron/loadtest sweep -- --url <base> --out-dir <dir> [options]

Runs players∈{${DEFAULTS.players.join(",")}} × ${DEFAULTS.repeat} repeats of the
${DEFAULTS.scenario} scenario (${DEFAULTS.durationSec}s each, --max-clients ${DEFAULTS.maxClients},
--discard ${DEFAULTS.discardSec}), with a ${DEFAULTS.cooldownSec}s cooldown between runs.

Options:
  --url <base>        Gateway base ws URL                (default: ws://127.0.0.1:8787)
  --out-dir <dir>     Output directory for JSON+summary  (default: results/sweep-<ts>)
  --scenario <name>   Scenario                           (default: ${DEFAULTS.scenario})
  --rooms <n>         Rooms per run                       (default: ${DEFAULTS.rooms})
  --players <csv>     Player counts to sweep             (default: ${DEFAULTS.players.join(",")})
  --duration <s>      Steady-state seconds per run       (default: ${DEFAULTS.durationSec})
  --hz <n>            Input rate per client              (default: ${DEFAULTS.hz})
  --ramp <s>          Ramp-up window per run             (default: ${DEFAULTS.rampSec})
  --repeat <n>        Repeats per player count           (default: ${DEFAULTS.repeat})
  --max-clients <n>   ?maxClients override per run       (default: ${DEFAULTS.maxClients})
  --discard <s>       Warm-up seconds discarded          (default: ${DEFAULTS.discardSec})
  --cooldown <s>      Idle seconds between runs          (default: ${DEFAULTS.cooldownSec})
  --help              Show this help
`;

class SweepError extends Error {}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function parse(argv: string[]): SweepConfig | null {
  const raw = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") continue;
    if (a === "--help") return null;
    if (!a.startsWith("--")) throw new SweepError(`unexpected argument "${a}"`);
    const val = argv[i + 1];
    if (val === undefined || val.startsWith("--")) throw new SweepError(`${a} requires a value`);
    raw.set(a.slice(2), val);
    i++;
  }

  const posInt = (name: string, fallback: number): number => {
    const v = raw.get(name);
    if (v === undefined) return fallback;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw new SweepError(`--${name} must be a positive integer`);
    return n;
  };
  const nonNeg = (name: string, fallback: number): number => {
    const v = raw.get(name);
    if (v === undefined) return fallback;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new SweepError(`--${name} must be >= 0`);
    return n;
  };

  const scenario = raw.get("scenario") ?? DEFAULTS.scenario;
  if (!isScenarioName(scenario)) throw new SweepError(`unknown --scenario "${scenario}"`);

  const playersCsv = raw.get("players");
  const players = playersCsv
    ? playersCsv.split(",").map((s) => {
        const n = Number(s.trim());
        if (!Number.isInteger(n) || n <= 0) throw new SweepError(`--players must be positive integers`);
        return n;
      })
    : DEFAULTS.players;

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = raw.get("out-dir") ?? resolve(__dirname, "..", "results", `sweep-${ts}`);

  return {
    url: (raw.get("url") ?? "ws://127.0.0.1:8787").replace(/\/+$/, ""),
    outDir,
    scenario,
    rooms: posInt("rooms", DEFAULTS.rooms),
    players,
    durationSec: nonNeg("duration", DEFAULTS.durationSec),
    hz: nonNeg("hz", DEFAULTS.hz),
    rampSec: nonNeg("ramp", DEFAULTS.rampSec),
    repeat: posInt("repeat", DEFAULTS.repeat),
    maxClients: posInt("max-clients", DEFAULTS.maxClients),
    discardSec: nonNeg("discard", DEFAULTS.discardSec),
    cooldownSec: nonNeg("cooldown", DEFAULTS.cooldownSec),
  };
}

interface RunRow {
  label: string;
  players: number;
  repeat: number;
  report: Report;
  jsonPath: string;
}

function toConfig(sweep: SweepConfig, players: number, repeat: number): Config {
  const totalConns = sweep.rooms * players;
  const workers = totalConns <= 512 ? 1 : Math.ceil(totalConns / 512);
  return {
    scenario: sweep.scenario,
    url: sweep.url,
    rooms: sweep.rooms,
    players,
    durationMs: sweep.durationSec * 1000,
    hz: sweep.hz,
    rampMs: sweep.rampSec * 1000,
    roomPrefix: `sweep-p${players}-r${repeat}-${Date.now().toString(36)}`,
    workers,
    maxClients: sweep.maxClients,
    discardMs: sweep.discardSec * 1000,
    out: "",
  };
}

function fixed(v: number, d = 1): string {
  return v.toFixed(d);
}

function tickCell(r: Report, pick: (b: { p50: number; p95: number }) => number): string {
  const t = r.serverProcessing.summary?.tick;
  return t ? fixed(pick(t)) : "n/a";
}

function summaryTable(rows: RunRow[]): string {
  const header =
    "| run | players | ack p50 | ack p95 | gap p50 | tick p50 | tick p95 | down/client (KiB/s) | closes |";
  const sep = "|---|---|---|---|---|---|---|---|---|";
  const body = rows.map((row) => {
    const r = row.report;
    const downKiB = r.bandwidth.downlinkBytesPerSecPerClient / 1024;
    return (
      `| ${row.label} | ${row.players} | ${fixed(r.latencyMs.inputToAckRtt.p50)} | ` +
      `${fixed(r.latencyMs.inputToAckRtt.p95)} | ${fixed(r.jitterMs.rawGaps.p50)} | ` +
      `${tickCell(r, (b) => b.p50)} | ${tickCell(r, (b) => b.p95)} | ` +
      `${fixed(downKiB, 2)} | ${r.stability.unexpectedCloses} |`
    );
  });
  return [header, sep, ...body].join("\n");
}

async function main(): Promise<void> {
  let sweep: SweepConfig | null;
  try {
    sweep = parse(process.argv.slice(2));
  } catch (err) {
    if (err instanceof SweepError) {
      process.stderr.write(`error: ${err.message}\n\nRun with --help for usage.\n`);
      process.exit(2);
    }
    throw err;
  }
  if (!sweep) {
    process.stdout.write(HELP);
    return;
  }

  await mkdir(sweep.outDir, { recursive: true });

  const cells: Array<{ players: number; repeat: number }> = [];
  for (const players of sweep.players) {
    for (let rep = 1; rep <= sweep.repeat; rep++) cells.push({ players, repeat: rep });
  }

  process.stdout.write(
    `Sweep: ${cells.length} runs · ${sweep.scenario} · players ${sweep.players.join("/")} ×${sweep.repeat} · ` +
      `${sweep.durationSec}s @ ${sweep.hz}Hz · maxClients ${sweep.maxClients} · discard ${sweep.discardSec}s → ${sweep.url}\n` +
      `Output: ${sweep.outDir}\n\n`,
  );

  const rows: RunRow[] = [];
  for (let i = 0; i < cells.length; i++) {
    const { players, repeat } = cells[i]!;
    const label = `p${players}-run${repeat}`;
    process.stdout.write(`[${i + 1}/${cells.length}] ${label} (${players} players)…\n`);

    const config = toConfig(sweep, players, repeat);
    const report = await runLoad(config, buildSpecs(config));

    const jsonPath = resolve(sweep.outDir, `${label}.json`);
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    rows.push({ label, players, repeat, report, jsonPath });

    const ack = report.latencyMs.inputToAckRtt;
    const tick = report.serverProcessing.summary?.tick;
    process.stdout.write(
      `      ack p50 ${fixed(ack.p50)} / p95 ${fixed(ack.p95)} ms · ` +
        `gap p50 ${fixed(report.jitterMs.rawGaps.p50)} ms · ` +
        `tick p50 ${tick ? fixed(tick.p50) : "n/a"} ms · closes ${report.stability.unexpectedCloses}\n`,
    );

    if (i < cells.length - 1 && sweep.cooldownSec > 0) await sleep(sweep.cooldownSec * 1000);
  }

  const table = summaryTable(rows);
  const md =
    `# Load sweep — ${sweep.scenario}\n\n` +
    `- gateway: \`${sweep.url}\`\n` +
    `- matrix: players ${sweep.players.join("/")} × ${sweep.repeat} repeats, ${sweep.durationSec}s @ ${sweep.hz}Hz\n` +
    `- maxClients ${sweep.maxClients}, discard first ${sweep.discardSec}s (ack/jitter only)\n` +
    `- generated: ${new Date().toISOString()}\n\n` +
    `${table}\n`;

  const summaryPath = resolve(sweep.outDir, "summary.md");
  await writeFile(summaryPath, md, "utf8");

  process.stdout.write(`\n${table}\n\nSummary written: ${summaryPath}\n`);
  process.exit(0);
}

void main();
