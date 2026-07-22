import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// This package's tsconfig only declares @cloudflare/workers-types (production
// code targets Workers, which has no Node builtins), and this monorepo has no
// @types/node dependency anywhere. This on-demand tool runs under vitest/Node,
// where these are real, valid APIs — suppressed here rather than adding a Node
// types dependency/tsconfig split for a single on-demand dev tool.
// @ts-expect-error - no @types/node in this Workers-targeted tsconfig
import { fileURLToPath } from "node:url";
// @ts-expect-error - no @types/node in this Workers-targeted tsconfig
import { mkdirSync, writeFileSync } from "node:fs";
import { createTestRoom, type TestRoomHandle } from "@tikron/server/testing";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";
import { LAG, TICK_MS } from "../src/config.js";
import { ArenaBot, applyIntents } from "../tools/bots/arena-bot.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import type { MapDef } from "../src/map/types.js";
import { walkSeconds } from "../src/map/nav.js";
import type { Vec3 } from "../src/physics.js";

/**
 * On-demand map metrics report tool — NOT part of the always-on gate. Boots a
 * real bot-vs-bot match per map (reusing the M0 bot-battle harness), captures
 * every kill's structured killPos log (see arena-room.ts's onKill), and writes
 * a per-map/mode Markdown report: a kill-location heatmap, per-team kill/score
 * stats, average engagement distance, and the same spawn→cap ETA table the
 * always-on gate (map-timing.test.ts) checks. Regenerate with:
 *   MAP_METRICS=1 pnpm --filter ironsight exec vitest run test/map-metrics.tool.test.ts
 */
class MetricsArena extends ArenaRoomImpl {
  protected override spawnProtectMs = 0;
  protected override respawnMs = 1000;
  protected override killTarget = 500; // unreachable in the budget → phase stays "live"
  protected override matchTimeMs = 60 * 60_000; // 1 h → the clock never ends the round
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
}

const PERCEPTION_DELAY_TICKS = Math.round(LAG.interpolationMs / TICK_MS);
const SEGMENT_MS = 90_000;
const TICKS_PER_SEGMENT = Math.round(SEGMENT_MS / TICK_MS);
const SEGMENT_SEEDS: readonly [number, number][] = [
  [0xa11ce, 0xb0b],
  [0xc0ffee, 0xfeed],
];

const CAP_KEYS = ["a", "b", "c"] as const;
// @ts-expect-error - ImportMeta.url requires @types/node, not present in this tsconfig
const OUT_DIR = fileURLToPath(new URL("../map-metrics/", import.meta.url));

interface MapConfig {
  readonly name: string;
  readonly id: string;
  readonly mode: string;
  readonly map: MapDef;
}

const MAP_CONFIGS: readonly MapConfig[] = [
  { name: "arena1", id: "arena-tdm", mode: "tdm", map: ARENA1 },
  { name: "arena2", id: "arena-dom", mode: "dom", map: ARENA2 },
];

interface KillRecord {
  readonly vx: number;
  readonly vz: number;
  readonly kx: number | null;
  readonly kz: number | null;
  readonly team: "red" | "blue" | "unknown";
}

function liveState(h: TestRoomHandle<ArenaState>): ArenaState {
  return (h.room as unknown as { state: ArenaState }).state;
}

function place(h: TestRoomHandle<ArenaState>, id: string, x: number, z: number): void {
  const p = liveState(h).players[id];
  if (!p) throw new Error(`no player ${id}`);
  p.x = x;
  p.y = 0;
  p.z = z;
  p.alive = true;
  p.prot = false;
}

function capWaypoint(map: MapDef, key: (typeof CAP_KEYS)[number]): { x: number; y: number } {
  const cap = map.caps[key];
  return { x: cap.x, y: cap.z };
}

/**
 * Picks the spawn point closest (in z) to a target z. Used to seed the bot match
 * from whichever spawn row shares cap b's lane: arena-bot.ts's `decide()` steers
 * straight at its next waypoint with no obstacle avoidance, so a patrol route
 * that crosses a lane-divider wall (arena1 has these; arena2 doesn't) just wedges
 * the bot against it and the match never engages.
 */
function spawnNearZ(spawns: readonly Vec3[], z: number): Vec3 {
  return spawns.reduce((best, s) => (Math.abs(s.z - z) < Math.abs(best.z - z) ? s : best));
}

/** Parses every console.log call that emitted a `killPos`-tagged JSON line (see
 *  arena-room.ts's onKill); ignores any other console output. */
function collectKillPos(logSpy: ReturnType<typeof vi.spyOn>): {
  head: boolean;
  vx: number;
  vz: number;
  kx: number | null;
  kz: number | null;
}[] {
  const out: { head: boolean; vx: number; vz: number; kx: number | null; kz: number | null }[] = [];
  for (const call of logSpy.mock.calls) {
    const raw = call[0];
    if (typeof raw !== "string") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as { tag?: unknown }).tag === "killPos"
    ) {
      out.push(parsed as { head: boolean; vx: number; vz: number; kx: number | null; kz: number | null });
    }
  }
  return out;
}

function renderHeatmap(map: MapDef, kills: readonly KillRecord[]): string {
  const cellSize = 2;
  const cols = Math.max(1, Math.ceil(map.bounds.width / cellSize));
  const rows = Math.max(1, Math.ceil(map.bounds.depth / cellSize));
  const grid: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0) as number[]);
  for (const k of kills) {
    const col = Math.min(cols - 1, Math.max(0, Math.floor(k.vx / cellSize)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(k.vz / cellSize)));
    grid[row]![col] = (grid[row]![col] ?? 0) + 1;
  }
  return grid
    .map((row) => row.map((n) => (n === 0 ? "." : n >= 10 ? "#" : String(n))).join(""))
    .join("\n");
}

function renderEtaTable(map: MapDef): string {
  const lines = ["| cap | red ETA (s) | blue ETA (s) | Δ (s) |", "|---|---|---|---|"];
  for (const key of CAP_KEYS) {
    const cap = map.caps[key];
    const redEta = Math.min(...map.spawns.red.map((s) => walkSeconds(map, s, cap)));
    const blueEta = Math.min(...map.spawns.blue.map((s) => walkSeconds(map, s, cap)));
    const delta = Math.abs(redEta - blueEta);
    lines.push(`| ${key} | ${redEta.toFixed(2)} | ${blueEta.toFixed(2)} | ${delta.toFixed(2)} |`);
  }
  return lines.join("\n");
}

// @ts-expect-error - `process` requires @types/node, not present in this tsconfig
describe.skipIf(process.env.MAP_METRICS !== "1")("map metrics report tool", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    vi.spyOn(crypto, "getRandomValues").mockImplementation((arr) => {
      if (arr) new Uint32Array(arr.buffer, arr.byteOffset, 1)[0] = 0x1234_5678;
      return arr;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each(MAP_CONFIGS)(
    "collects bot-match kill data for $name ($mode) and writes a report",
    { timeout: 120_000 },
    async ({ name, id, mode, map }) => {
      mkdirSync(OUT_DIR, { recursive: true });

      const logSpy = vi.spyOn(console, "log");
      const h = await createTestRoom(MetricsArena, { id, codec: ArenaSchema, sync: "throttled" });
      const redConn = await h.connect(); // 1st join → red
      const blueConn = await h.connect(); // 2nd join → blue

      const redTeam = liveState(h).players[redConn.id]!.team;
      const blueTeam = liveState(h).players[blueConn.id]!.team;

      // Seed each side from whichever spawn row shares cap b's lane, and converge
      // both bots on cap b only (see spawnNearZ's doc comment) — arena1's other
      // two caps sit across a lane-divider wall that the bot can't route around.
      const redSpawn = spawnNearZ(map.spawns.red, map.caps.b.z);
      const blueSpawn = spawnNearZ(map.spawns.blue, map.caps.b.z);
      place(h, redConn.id, redSpawn.x, redSpawn.z);
      place(h, blueConn.id, blueSpawn.x, blueSpawn.z);

      const scoreCheckpoints: { redScore: number; blueScore: number }[] = [];

      // Route each bot in two legs — straight along its own (obstacle-free) spawn
      // row until x-aligned with cap b, then straight up/down cap b's own column —
      // instead of one diagonal waypoint. ArenaBot has no obstacle avoidance, and a
      // direct diagonal clips arena2's row-11 flanking cover crates right at their
      // edge; both legs stay clear of every map's boxes (lane dividers, crates,
      // platform) by construction, so this works for both maps' real geometry.
      const bWaypoint = capWaypoint(map, "b");
      const redApproach = { x: bWaypoint.x, y: redSpawn.z };
      const blueApproach = { x: bWaypoint.x, y: blueSpawn.z };

      for (const [redSeed, blueSeed] of SEGMENT_SEEDS) {
        const red = new ArenaBot({
          id: redConn.id,
          seed: redSeed,
          waypoints: [redApproach, bWaypoint],
          boxes: map.boxes,
        });
        const blue = new ArenaBot({
          id: blueConn.id,
          seed: blueSeed,
          waypoints: [blueApproach, bWaypoint],
          boxes: map.boxes,
        });

        const history: ArenaState[] = [];
        for (let i = 0; i < TICKS_PER_SEGMENT; i++) {
          history.push(h.snapshot());
          const seen = history[Math.max(0, history.length - 1 - PERCEPTION_DELAY_TICKS)]!;
          const now = Date.now();
          await applyIntents(redConn, red.decide(seen, now));
          await applyIntents(blueConn, blue.decide(seen, now));
          await h.advance(TICK_MS);
        }

        const s = h.snapshot();
        scoreCheckpoints.push({ redScore: s.redScore, blueScore: s.blueScore });
      }

      // Team attribution: killPos (arena-room.ts's onKill) carries no team info, so
      // zip it by emission order against the "kill" broadcast from the same call
      // site, which does carry killerTeam. Judgment call: this relies on both being
      // emitted once per kill, in the same order — true as of the current onKill.
      const killPosEntries = collectKillPos(logSpy);
      const killBroadcasts = h.broadcastsOf("s:msg").filter((b) => b.data.type === "kill");
      expect(killPosEntries.length).toBe(killBroadcasts.length);

      const kills: KillRecord[] = killPosEntries.map((kp, i) => {
        // BroadcastFrame.data is the raw wire ENVELOPE `{t, type, payload}` (see
        // packages/server/src/room.ts's broadcast()) — the kill fields live under
        // `payload`, unlike conn.frames() which flattens them. Reading them flat
        // here was why team attribution came back 100% "unknown" on both maps.
        const killerTeam = (
          killBroadcasts[i]?.data as { payload?: { killerTeam?: unknown } } | undefined
        )?.payload?.killerTeam;
        const team: KillRecord["team"] =
          killerTeam === redTeam ? "red" : killerTeam === blueTeam ? "blue" : "unknown";
        return { vx: kp.vx, vz: kp.vz, kx: kp.kx, kz: kp.kz, team };
      });

      expect(kills.length).toBeGreaterThan(0);

      const redKills = kills.filter((k) => k.team === "red").length;
      const blueKills = kills.filter((k) => k.team === "blue").length;
      const unknownKills = kills.filter((k) => k.team === "unknown").length;

      const engagementDistances = kills
        .filter((k): k is KillRecord & { kx: number; kz: number } => k.kx !== null && k.kz !== null)
        .map((k) => Math.hypot(k.vx - k.kx, k.vz - k.kz));
      const avgEngagementDistance =
        engagementDistances.length > 0
          ? engagementDistances.reduce((a, b) => a + b, 0) / engagementDistances.length
          : null;

      const heatmap = renderHeatmap(map, kills);
      const etaTable = renderEtaTable(map);

      const report = `# ${name} (${mode}) map metrics

Regenerate with: \`MAP_METRICS=1 pnpm --filter ironsight exec vitest run test/map-metrics.tool.test.ts\`

## Kill heatmap (2 m cells, victim position, \`.\`=0 \`1-9\`=count \`#\`=10+)

\`\`\`
${heatmap}
\`\`\`

## Kills by team

- red: ${redKills}
- blue: ${blueKills}
- unknown (unmatched broadcast): ${unknownKills}
- total: ${kills.length}

## Score checkpoints (cumulative — matchTimeMs is 1 h, so the match never resets
between segments; each row is the running score at the end of that 90 s segment,
not a per-segment delta)

${scoreCheckpoints
  .map((s, i) => `- segment ${i + 1}: red=${s.redScore} blue=${s.blueScore}`)
  .join("\n")}

## Average engagement distance (victim↔killer, m)

${avgEngagementDistance === null ? "n/a (no killer-position kills recorded)" : avgEngagementDistance.toFixed(2)}

## Spawn → capture-point ETA table (walk speed, see src/map/nav.ts)

${etaTable}
`;

      writeFileSync(`${OUT_DIR}${name}-${mode}.md`, report, "utf8");
    },
  );
});
