// [blueprint] — the in-process boot smoke: two ArenaBots fight a full match via
// generic room mechanics (hits/kills/respawns/phase), no weapon-name assertions.
// ArenaBot's own ammo/cadence model reads GAME.weapons[GAME.weaponMeta.defaultIndex]
// (tools/bots/arena-bot.ts), so it stays in sync with whichever theme is loaded.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestConnection, type TestRoomHandle } from "@tikron/server/testing";
import { ArenaRoomImpl } from "../../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../../src/schema.js";
import { LAG, TICK_MS } from "../../src/config.js";
import { ArenaBot, applyIntents } from "../../tools/bots/arena-bot.js";
import { ARENA1 } from "../../src/map/arena1.js";
import { GroundNavigator } from "../../src/map/navigation.js";

/**
 * M0 fate-gate E2E: two bots (red + blue) fight a full match in-process and we
 * assert the loop closes — shots register, both teams frag, the downed respawn and
 * re-engage, and the match stays live. It is the "does WebSocket FPS actually play"
 * check from the plan, run deterministically: fixed aim-noise seeds, a fixed tick
 * budget, no wall-clock waits, no retries.
 *
 * The one piece of realism that has to be modelled by hand: the harness has no
 * network, so the server always rewinds by `lagInterpolationMs` (RTT is 0). A real
 * client renders remote players that far in the past and aims *there*; a bot reading
 * the live authoritative state would instead aim at the present and the server's
 * rewind would land behind every strafing target. So each bot perceives the world
 * delayed by that same interpolation window — then aim instant and rewind instant
 * line up and moving targets are hittable, exactly as on a real link.
 */
class BattleArena extends ArenaRoomImpl {
  protected override spawnProtectMs = 0; // straight into the fight, no shield to wait out
  protected override respawnMs = 1000; // quick turnaround so 90 s holds many duels
  protected override killTarget = 500; // unreachable in the budget → phase stays "live"
  protected override matchTimeMs = 60 * 60_000; // 1 h → the clock never ends the round
  // This E2E scripts exactly two bots and asserts redScore+blueScore === kills, so the
  // M2 match flow must not interfere: no filler bots (would add kills off-script) and no
  // warmup gate (a resetMatch would wipe the running score mid-run).
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
}

/** Interpolation delay in whole ticks — how far back the bot's perception sits. */
const PERCEPTION_DELAY_TICKS = Math.round(LAG.interpolationMs / TICK_MS); // 2

function liveState(h: TestRoomHandle<ArenaState>): ArenaState {
  return (h.room as unknown as { state: ArenaState }).state;
}

/** Drop a live, unprotected bot into the open mid corridor (z ≈ 11, box-free). */
function place(h: TestRoomHandle<ArenaState>, id: string, x: number, z: number): void {
  const p = liveState(h).players[id];
  if (!p) throw new Error(`no player ${id}`);
  p.x = x;
  p.y = 0;
  p.z = z;
  p.alive = true;
  p.prot = false;
}

function countMsg(conn: TestConnection, type: string): number {
  return conn.frames().filter((f) => f.t === "s:msg" && f.type === type).length;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  // The room seeds its shot-spread PRNG from crypto in onReady; pin it so the whole
  // 90 s run is reproducible (fixed spread + fixed bot aim noise → no flake).
  vi.spyOn(crypto, "getRandomValues").mockImplementation((arr) => {
    if (arr) new Uint32Array(arr.buffer, arr.byteOffset, 1)[0] = 0x1234_5678;
    return arr;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("bot auto-battle E2E (M0 gate)", () => {
  it(
    "two bots fight 90 s: shots land, both teams frag, downed bots respawn and re-engage",
    { timeout: 120_000 },
    async () => {
      const h = await createTestRoom(BattleArena, { codec: ArenaSchema, sync: "throttled" });
      const redConn = await h.connect(); // 1st join → red
      const blueConn = await h.connect(); // 2nd join → blue

      // Expanded Relay's north connector: a 20 m duel, with real spawn returns
      // routed around the active collision map. No post-death teleport or weaker
      // combat threshold; the scripted clients still send ordinary movement intents.
      const nav = new GroundNavigator(ARENA1);
      const navigate = (from: { x: number; z: number }, target: { x: number; z: number }) => nav.next(from, target);
      place(h, redConn.id, 65, 27);
      place(h, blueConn.id, 85, 27);

      const red = new ArenaBot({
        id: redConn.id,
        seed: 0xa11ce,
        navigate,
        strafeZ: 27,
        waypoints: [
          { x: 65, y: 27 },
        ],
      });
      const blue = new ArenaBot({
        id: blueConn.id,
        seed: 0xb0b,
        navigate,
        strafeZ: 27,
        waypoints: [
          { x: 85, y: 27 },
        ],
      });

      const TICKS = Math.round(90_000 / TICK_MS); // 1800
      const history: ArenaState[] = [];
      for (let i = 0; i < TICKS; i++) {
        history.push(h.snapshot());
        const seen = history[Math.max(0, history.length - 1 - PERCEPTION_DELAY_TICKS)]!;
        const now = Date.now();
        await applyIntents(redConn, red.decide(seen, now));
        await applyIntents(blueConn, blue.decide(seen, now));
        await h.advance(TICK_MS);
      }

      const s = h.snapshot();
      const hits = countMsg(redConn, "hit") + countMsg(blueConn, "hit");
      const kills = h.broadcastsOf("s:msg").filter((b) => b.data.type === "kill").length;
      const respawns = h.broadcastsOf("s:msg").filter((b) => b.data.type === "respawn").length;

      // Combat actually happened, on both sides.
      expect(hits).toBeGreaterThanOrEqual(20);
      expect(kills).toBeGreaterThanOrEqual(2);
      expect(s.redScore).toBeGreaterThanOrEqual(1);
      expect(s.blueScore).toBeGreaterThanOrEqual(1);

      // Death → respawn → re-engage: bots came back and kept fragging (kills keep
      // accruing past the first death that triggered a respawn).
      expect(respawns).toBeGreaterThanOrEqual(1);

      // Match state stayed sane the whole time.
      expect(s.phase).toBe("live");
      expect(s.redScore + s.blueScore).toBe(kills);
    },
  );
});
