import { availableParallelism } from "node:os";
import { isScenarioName, SCENARIO_NAMES, type ScenarioName } from "./scenarios.js";

/** Fully-resolved run configuration (structured-clone-serializable for workers). */
export interface Config {
  scenario: ScenarioName;
  /** Base gateway URL, e.g. "ws://127.0.0.1:8787" (no trailing slash, no path). */
  url: string;
  rooms: number;
  players: number;
  durationMs: number;
  hz: number;
  rampMs: number;
  /** Room id prefix; each run defaults to a unique prefix for a clean room. */
  roomPrefix: string;
  /** Effective worker-thread count (1 = run in the main thread). */
  workers: number;
  /**
   * Optional per-connection `?maxClients=<n>` query override. The server honours
   * it only in DEV_MODE (to raise a demo room's hard-coded seat cap for load
   * tests). Undefined = don't send the query param (default room cap applies).
   */
  maxClients?: number;
  /**
   * Warm-up window discarded from steady-state latency/jitter aggregation, ms.
   * Samples whose timestamp is within the first `discardMs` after steady state
   * begins are dropped. 0 = keep everything (default; preserves prior behavior).
   */
  discardMs: number;
  /** Report output path (JSON). */
  out: string;
}

const DEFAULTS = {
  scenario: "agar" as ScenarioName,
  url: "ws://127.0.0.1:8787",
  rooms: 1,
  players: 8,
  durationSec: 30,
  hz: 20,
  rampSec: 3,
  workers: "auto" as string,
  discardSec: 0,
};

const HELP = `Tikron load-test harness

Usage:
  pnpm --filter @tikron/loadtest start -- [options]

Options:
  --scenario <name>   Scenario: ${SCENARIO_NAMES.join(" | ")}   (default: ${DEFAULTS.scenario})
  --url <base>        Gateway base ws URL                        (default: ${DEFAULTS.url})
  --rooms <n>         Parallel rooms                             (default: ${DEFAULTS.rooms})
  --players <n>       Players per room                           (default: ${DEFAULTS.players})
  --duration <s>      Steady-state duration in seconds           (default: ${DEFAULTS.durationSec})
  --hz <n>            Input rate per client (<=30, room cap)      (default: ${DEFAULTS.hz})
  --ramp <s>          Connection ramp-up window in seconds       (default: ${DEFAULTS.rampSec})
  --workers <n|auto>  worker_threads shards (auto: 1 up to 512)  (default: ${DEFAULTS.workers})
  --max-clients <n>   Append ?maxClients=<n> to the connect URL  (default: unset; DEV_MODE-only server override)
  --discard <s>       Warm-up seconds dropped from steady-state  (default: ${DEFAULTS.discardSec})
                      latency/jitter aggregation
  --room-prefix <s>   Room id prefix                             (default: unique per run)
  --out <path>        JSON report path                           (default: results/<ts>-<scenario>.json)
  --help              Show this help

Example:
  pnpm --filter @tikron/loadtest start -- --scenario agar --rooms 4 --players 32 --duration 30
`;

export class CliError extends Error {}

function num(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0) throw new CliError(`--${name} must be a positive number (got "${raw}")`);
  return v;
}

function nonNegNum(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0) throw new CliError(`--${name} must be a non-negative number (got "${raw}")`);
  return v;
}

/** Parse argv (already sliced past `node script`). Returns null when --help. */
export function parseArgs(argv: string[]): Config | null {
  const raw = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") continue; // pnpm forwards its `--` separator into argv
    if (!a.startsWith("--")) throw new CliError(`unexpected argument "${a}"`);
    const key = a.slice(2);
    if (key === "help") {
      flags.add("help");
      continue;
    }
    const val = argv[i + 1];
    if (val === undefined || val.startsWith("--")) throw new CliError(`--${key} requires a value`);
    raw.set(key, val);
    i++;
  }

  if (flags.has("help")) {
    process.stdout.write(HELP);
    return null;
  }

  const scenarioRaw = raw.get("scenario") ?? DEFAULTS.scenario;
  if (!isScenarioName(scenarioRaw)) {
    throw new CliError(`unknown --scenario "${scenarioRaw}" (expected ${SCENARIO_NAMES.join(", ")})`);
  }

  const rooms = Math.floor(num("rooms", raw.get("rooms"), DEFAULTS.rooms));
  const players = Math.floor(num("players", raw.get("players"), DEFAULTS.players));
  const hz = num("hz", raw.get("hz"), DEFAULTS.hz);
  const durationMs = num("duration", raw.get("duration"), DEFAULTS.durationSec) * 1000;
  const rampMs = num("ramp", raw.get("ramp"), DEFAULTS.rampSec) * 1000;
  const discardMs = nonNegNum("discard", raw.get("discard"), DEFAULTS.discardSec) * 1000;

  const maxClientsRaw = raw.get("max-clients");
  const maxClients =
    maxClientsRaw === undefined ? undefined : Math.floor(num("max-clients", maxClientsRaw, 0));

  const totalConns = rooms * players;
  const workersRaw = raw.get("workers") ?? DEFAULTS.workers;
  const workers = resolveWorkers(workersRaw, totalConns);

  const scenario = scenarioRaw;
  const roomPrefix = raw.get("room-prefix") ?? `lt-${Date.now().toString(36)}`;

  const url = (raw.get("url") ?? DEFAULTS.url).replace(/\/+$/, "");
  const out = raw.get("out") ?? "";

  return { scenario, url, rooms, players, durationMs, hz, rampMs, roomPrefix, workers, maxClients, discardMs, out };
}

function resolveWorkers(raw: string, totalConns: number): number {
  if (raw === "auto") {
    // A single Node event loop comfortably drives ~512 WebSocket clients at 20 Hz
    // (see README self-check). Only shard beyond that, capped at CPU count.
    if (totalConns <= 512) return 1;
    const cpus = Math.max(1, availableParallelism());
    return Math.max(1, Math.min(cpus, Math.ceil(totalConns / 512)));
  }
  const v = Number(raw);
  if (!Number.isInteger(v) || v < 1) throw new CliError(`--workers must be "auto" or a positive integer`);
  return Math.min(v, Math.max(1, totalConns));
}
