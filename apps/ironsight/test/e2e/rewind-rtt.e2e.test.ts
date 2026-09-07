// [blueprint] — server-rewind lag-compensation mechanic only (hit-registration rate
// vs simulated RTT); reads PLAYER/LAG/TICK_MS dynamically, no weapon-name or
// balance dependency.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestRoomHandle } from "@tikron/server/testing";
import { ArenaRoomImpl } from "../../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../../src/schema.js";
import { LAG, PLAYER, TICK_MS } from "../../src/config.js";

/**
 * RTT hit-registration measurement (PLAN-IRONSIGHT M0 gate — "RTT 100/200ms 모의
 * 히트레지 실측"). This is the deliverable the plan's risk #1 ("WS 지연 체감") is
 * judged on: does server rewind keep a well-aimed shot landing as latency grows?
 *
 * ## Why an in-process controlled experiment (not a live socket)
 *
 * The `createTestRoom` harness runs the *real* room with fake timers, so time is
 * deterministic and every run is identical (no flake). It cannot inject a network
 * RTT, but it does not need to: the server computes its rewind instant as
 *   `at = now - client.rttMs - lagInterpolationMs`  (arena-room.ts handleFire)
 * and the two subtracted terms are algebraically interchangeable. With the harness
 * pinning `rttMs = 0`, overriding `lagInterpolationMs` injects an *identical* rewind
 * instant to a real client whose `RTT + interp-buffer` equals that value. So the
 * knob below is a faithful stand-in for end-to-end latency, not a mock.
 *
 * ## The setup
 *
 * A stationary shooter at (8, 2.4) fires down a clear corridor (z∈[1.2,3.6], below
 * arena1's platforms) at a target strafing laterally (along z) at x=44. The target
 * moves on a known linear track, so for each shot we can aim exactly where the
 * shooter *saw* the target `D = (RTT + interp)` ago — the world a real client with
 * that latency renders. Then:
 *
 *  - **rewind ON**  (server `lagInterpolationMs = D`): the server rewinds the target
 *    to that same instant, so the reconstructed target sits exactly under the
 *    crosshair → the shot registers regardless of RTT.
 *  - **rewind OFF** (server `lagInterpolationMs = 0`): the server checks against the
 *    present target, which has moved `~D` of travel away → the shot misses by more
 *    and more as RTT (and target speed) grow.
 *
 * Sweeping target speed at each RTT turns "did this one shot hit" into a hit *rate*.
 * The printed table is the gate artifact; the assertions encode its shape: rewind
 * ON stays pinned at 100% while rewind OFF collapses with latency.
 *
 * Note on "rewind off": `lagCompensation = false` is not used because the preset's
 * `rewind()` throws by contract when compensation is disabled. Setting the rewind
 * window to ~present (`lagInterpolationMs = 0`, so `at = now`) is the equivalent
 * "no compensation applied" baseline while keeping the same hit-check code path.
 */

const DT = TICK_MS / 1000; // seconds per tick
const Z0 = 19.8; // corridor start (> player radius from the z=0 wall)
const TRACK_TICKS = 7; // ticks of target history built per shot (≥ max D in ticks + 1)
const SPEEDS = [1, 2, 3, 4, 5, 6, 7, 8] as const; // m/s lateral strafe sweep
const RTTS = [0, 100, 200] as const;

/**
 * A room whose server-side rewind window is fixed (the RTT/interp stand-in).
 *
 * `lagInterpolationMs`/`lagCompensationDepthMs` are inferred as literal types on
 * `ArenaRoomImpl` (they initialise from the `as const` config), so a plain field
 * override to a runtime `number` is a type error. We set them in the constructor —
 * before `onReady` reads them to build the rewind buffers — via a narrow cast,
 * which keeps this entirely within the W-C test lane (no `src/**` edit).
 */
function arenaWithRewind(lagInterpMs: number): typeof ArenaRoomImpl {
  return class extends ArenaRoomImpl {
    protected override fillToPlayers = 0; // no third-party bot damage in the measured cells
    protected override startInWarmup = false;
    protected override spawnProtectMs = 0; // targets must be hittable immediately
    constructor(...args: ConstructorParameters<typeof ArenaRoomImpl>) {
      super(...args);
      const knobs = this as unknown as { lagInterpolationMs: number; lagCompensationDepthMs: number };
      knobs.lagInterpolationMs = lagInterpMs;
      knobs.lagCompensationDepthMs = 800; // cover the deepest rewind (300ms) with margin
    }
  };
}

function live(h: TestRoomHandle<ArenaState>): ArenaState {
  return (h.room as unknown as { state: ArenaState }).state;
}

/**
 * One (RTT, mode) cell: sweep target speed, fire one lag-compensated shot per
 * speed, and count how many registered on the server. Each speed is an isolated
 * linear track so there is no history carryover between samples.
 */
async function measure(rttMs: number, mode: "on" | "off"): Promise<{ hits: number; total: number }> {
  const dTicks = (rttMs + LAG.interpolationMs) / TICK_MS; // client staleness in ticks (2 / 4 / 6)
  const Room = arenaWithRewind(mode === "on" ? dTicks * TICK_MS : 0);
  const h = await createTestRoom(Room, { codec: ArenaSchema, sync: "throttled" });
  const shooter = await h.connect(); // team red (first join)
  const target = await h.connect(); // team blue
  await h.advance(TICK_MS); // settle + drop spawn protection
  await h.advance(TICK_MS);

  const st = live(h);
  const sp = st.players[shooter.id]!;
  const tp = st.players[target.id]!;

  let hits = 0;
  for (const v of SPEEDS) {
    // Fresh shooter each sample (stationary, unprotected, on the floor).
    Object.assign(sp, { x: 5, y: 0, z: 21, alive: true, hp: 100, prot: false, crouch: false });

    // Walk the target along a linear z-track; fire on the last tick, aiming where a
    // client `dTicks` behind would have rendered it.
    for (let j = 0; j < TRACK_TICKS; j++) {
      Object.assign(tp, { x: 15, y: 0, z: Z0 + j * v * DT, team: 1, alive: true, hp: 100, prot: false, crouch: false });
      if (j === TRACK_TICKS - 1) {
        const aimZ = Z0 + (TRACK_TICKS - 1 - dTicks) * v * DT;
        const from = { x: 5, y: 0 + PLAYER.standEye, z: 21 };
        const to = { x: 15, y: 1.0, z: aimZ }; // aim at chest (body band)
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const dy = to.y - from.y;
        await shooter.send("look", { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) });
        await shooter.send("fire");
      }
      await h.advance(TICK_MS);
    }

    if (live(h).players[target.id]!.hp < 100) hits += 1; // any damage = the shot registered
  }
  return { hits, total: SPEEDS.length };
}

const rate: Record<number, { on: number; off: number }> = {};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(3_000_000);
  // Fake timers alone do not seed the weapon spread stream. Each RTT cell must
  // use the same spread sequence for a controlled ON/OFF comparison.
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => {
    if (array) new Uint32Array(array.buffer, array.byteOffset, 1)[0] = 0x12345678;
    return array;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ironsight M0 gate — RTT hit-registration (server rewind)", () => {
  for (const rtt of RTTS) {
    it(`RTT ${rtt}ms — rewind ON registers the aimed shot at every target speed`, async () => {
      const r = await measure(rtt, "on");
      (rate[rtt] ??= { on: 0, off: 0 }).on = r.hits / r.total;
      // Rewind reconstructs the exact instant the shooter aimed → every shot lands.
      expect(r.hits).toBe(r.total);
    }, 20000);

    it(`RTT ${rtt}ms — rewind OFF baseline`, async () => {
      const r = await measure(rtt, "off");
      (rate[rtt] ??= { on: 0, off: 0 }).off = r.hits / r.total;
    }, 20000);
  }

  it("hit-reg table + gate assertions", () => {
    const pct = (x: number) => `${(x * 100).toFixed(0)}%`.padStart(4);
    const lines = [
      "",
      "  ironsight M0 — RTT hit-registration (moving strafe target, AR hitscan)",
      "  ┌────────────┬────────────┬─────────────┐",
      "  │  RTT (ms)  │ rewind ON  │ rewind OFF  │",
      "  ├────────────┼────────────┼─────────────┤",
      ...RTTS.map(
        (rtt) => `  │ ${String(rtt).padStart(6)}     │   ${pct(rate[rtt]!.on)}     │   ${pct(rate[rtt]!.off)}      │`,
      ),
      "  └────────────┴────────────┴─────────────┘",
      "  (RTT = simulated end-to-end latency = network RTT + client interp buffer)",
      "",
    ];
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));

    // Rewind ON: hit-registration is latency-independent — pinned at 100%.
    for (const rtt of RTTS) expect(rate[rtt]!.on).toBe(1);

    // Rewind OFF degrades monotonically as latency grows (the shot lands where the
    // target *was*, and the gap widens with RTT).
    expect(rate[100]!.off).toBeLessThanOrEqual(rate[0]!.off);
    expect(rate[200]!.off).toBeLessThanOrEqual(rate[100]!.off);
    expect(rate[200]!.off).toBeLessThan(0.5); // clearly broken hit-reg without compensation

    // The whole point: compensation recovers the shots RTT would otherwise eat.
    expect(rate[100]!.on - rate[100]!.off).toBeGreaterThanOrEqual(0.5);
    expect(rate[200]!.on - rate[200]!.off).toBeGreaterThanOrEqual(0.5);
  });
});
