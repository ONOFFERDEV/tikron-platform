// [config: ironsight] — most of this suite is generic room mechanics and stays
// green through a swap, but it imports `AR`/`WEAPONS` directly from src/config.ts
// (ironsight's fixed array) to compute EXPECTED mag/ammo values, while the real
// room now reads `GAME.weapons` (W3 finding — arena-room.ts was migrated so a
// config swap changes actual combat, not just cosmetics). Confirmed empirically
// (W3): under the NEONSTRIKE swap, 2 of ~20 tests fail exactly where they compare
// live server ammo against `AR.mag`/`AR.reloadMs` — proof the swap is real, not
// that the file is broken. A few other assertions also hardcode ironsight-specific
// numeric relationships (e.g. dom's killTarget=50-default-vs-scoreTarget=200 gap).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestRoomHandle } from "@tikron/server/testing";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";
import { AR, GRENADE, HIT, HYBRID, MODES, PLAYER, TICK_MS, WEAPON, WEAPONS } from "../src/config.js";

const SHOTGUN = WEAPONS.find((w) => w.name === "Shotgun")!;
/** Pitch that drops the eye-height muzzle onto an enemy's chest `dist` m away. */
const pitchFor = (dist: number): number => Math.atan2(1.0 - PLAYER.standEye, dist);
const swapTicks = Math.ceil(WEAPON.swapMs / TICK_MS) + 1;

/**
 * A faster arena for tests: no spawn protection, quick respawns, and a 2-kill
 * match so the win/reset flow is reachable without 50 real frags. Only the
 * match-flow tunables shift — movement, weapons, and geometry are the real thing.
 */
class FastArena extends ArenaRoomImpl {
  protected override killTarget = 2;
  protected override spawnProtectMs = 0;
  protected override respawnMs = 200;
  protected override intermissionMs = 200;
  // These suites script combat directly: no M2 filler bots, no warmup gate.
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  // The post-match reset still runs through warmup → live; make it reachable with a
  // single scripted connection and short enough to reach within a test's tick budget.
  protected override warmupMinPlayers = 1;
  protected override warmupMs = 200;
}

/** Real spawn protection (1.5 s) but no filler bots, so a scripted 2-player duel isn't disturbed. */
class ProtArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
}

/** Fast match flow (mirrors FastArena) but keeps filler bots on, for vote-restart tests
 *  that need real (non-voting) bot seats alongside scripted human connections. */
class VoteArena extends ArenaRoomImpl {
  protected override killTarget = 2;
  protected override intermissionMs = 200;
  protected override respawnMs = 200;
  protected override spawnProtectMs = 0;
  protected override startInWarmup = false;
  protected override warmupMinPlayers = 1;
  protected override warmupMs = 200;
  protected override fillToPlayers = 4;
}

/** Pitch that aims the shooter's eye-height muzzle at an enemy's chest 10 m away. */
const BODY_PITCH = Math.atan2(1.0 - PLAYER.standEye, 10);
/** Pitch that aims at the target's head-sphere centre (standHeight − headRadius,
 *  same derivation hitscan.ts's headCentre uses) instead of the chest. */
const HEAD_PITCH = Math.atan2(PLAYER.standHeight - PLAYER.headRadius - PLAYER.standEye, 10);
/** Pitch that aims at a CROUCHING target's head-sphere centre, using HIT.crouchHeight
 *  (not PLAYER.crouchHeight — see src/config.ts's HIT doc comment) — the hitbox/
 *  visual audit's E2E gate: a shot at where the crouching rig actually renders
 *  its head must land as a headshot post-fix. Shooter's own eye stays standEye
 *  (crouch here is the TARGET's pose, not the shooter's). */
const CROUCH_HEAD_PITCH = Math.atan2(HIT.crouchHeight - HIT.headRadius - PLAYER.standEye, 10);

function liveState(h: TestRoomHandle<ArenaState>): ArenaState {
  return (h.room as unknown as { state: ArenaState }).state;
}

async function tick(h: TestRoomHandle<ArenaState>, n = 1): Promise<void> {
  for (let i = 0; i < n; i++) await h.advance(TICK_MS);
}

/** Place a live, unprotected player at a spot in the clear top lane (z = 11).
 *  Crouch isn't a `place()` option on purpose: `p.crouch` is overwritten by
 *  the room's own `integrate()` from the player's actual move INPUT on the
 *  very next tick, so a direct write here wouldn't stick — send a real
 *  `move({crouch: true})` instead (see the crouching-headshot test below). */
function place(
  h: TestRoomHandle<ArenaState>,
  id: string,
  x: number,
  opts: { yaw?: number; pitch?: number; z?: number } = {},
): void {
  const p = liveState(h).players[id]!;
  p.x = x;
  p.y = 0;
  p.z = opts.z ?? 11;
  p.hp = PLAYER.maxHp;
  p.alive = true;
  p.prot = false;
  if (opts.yaw !== undefined) p.yaw = opts.yaw;
  if (opts.pitch !== undefined) p.pitch = opts.pitch;
}

function ammoFrames(conn: { frames(): Record<string, unknown>[] }): Record<string, unknown>[] {
  return conn.frames().filter((f) => f.t === "s:msg" && f.type === "ammo");
}

function shotFrames(conn: { frames(): Record<string, unknown>[] }): Record<string, unknown>[] {
  return conn.frames().filter((f) => f.t === "s:msg" && f.type === "shot");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("arena room — teams & movement", () => {
  it("auto-balances teams on join (red, then blue, then red)", async () => {
    const h = await createTestRoom(ProtArena, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect();
    const b = await h.connect();
    const c = await h.connect();
    const s = h.snapshot();
    expect(s.players[a.id]!.team).toBe(0); // red
    expect(s.players[b.id]!.team).toBe(1); // blue
    expect(s.players[c.id]!.team).toBe(0); // red (tie → red)
  });

  it("integrates WASD forward; sprint is faster, crouch is slower and lowers the stance", async () => {
    const h = await createTestRoom(ProtArena, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect(); // red, spawns facing +x (yaw π/2)

    await a.send("move", { mz: 1 });
    await tick(h, 2);
    const x1 = h.snapshot().players[a.id]!.x;
    await tick(h, 2);
    const walkStep = (h.snapshot().players[a.id]!.x - x1) / 2;
    expect(walkStep).toBeGreaterThan(0.2); // ~0.30 = walk 6 m/s × 50 ms

    await a.send("move", { mz: 1, sprint: true });
    await tick(h, 1);
    const x3 = h.snapshot().players[a.id]!.x;
    await tick(h, 2);
    const sprintStep = (h.snapshot().players[a.id]!.x - x3) / 2;
    expect(sprintStep).toBeGreaterThan(walkStep * 1.3);

    await a.send("move", { mz: 1, crouch: true });
    await tick(h, 1);
    expect(h.snapshot().players[a.id]!.crouch).toBe(true);
    const x5 = h.snapshot().players[a.id]!.x;
    await tick(h, 2);
    const crouchStep = (h.snapshot().players[a.id]!.x - x5) / 2;
    expect(crouchStep).toBeLessThan(walkStep);
  });

  it("jump rises off the ground and gravity returns the player to it", async () => {
    const h = await createTestRoom(ProtArena, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect();
    await a.send("move", { jump: true });
    await tick(h, 3);
    expect(h.snapshot().players[a.id]!.y).toBeGreaterThan(0.3); // airborne
    await tick(h, 40); // ~2 s later
    expect(h.snapshot().players[a.id]!.y).toBeLessThan(0.05); // landed
  });

  it("map cover blocks horizontal movement (no tunnelling through a box)", async () => {
    const h = await createTestRoom(ProtArena, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect();
    // Walk into Relay's west service screen (x=14..16, z=34..66).
    place(h, a.id, 12, { z: 45 });
    await a.send("move", { mz: 1 });
    await tick(h, 100);
    const p = h.snapshot().players[a.id]!;
    expect(p.x).toBeCloseTo(14 - PLAYER.radius, 2);
    expect(p.y).toBe(0); // no tunnelling or phantom climb
  });

  it("look wraps yaw into [0,2π) and clamps pitch to the vertical limit", async () => {
    const h = await createTestRoom(ProtArena, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect();
    await a.send("look", { yaw: 10, pitch: 5 });
    await tick(h, 1);
    const p = h.snapshot().players[a.id]!;
    expect(p.yaw).toBeCloseTo(10 - 2 * Math.PI, 4);
    expect(p.pitch).toBeCloseTo(Math.PI / 2 - 0.01, 4);
  });
});

describe("arena room — weapon (server-authoritative)", () => {
  it("enforces the fire-rate cap: a second shot inside the interval is ignored", async () => {
    const h = await createTestRoom(ProtArena, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect();
    await a.send("fire");
    await a.send("fire"); // same tick / same clock instant — inside the 100 ms interval
    await tick(h, 1);
    expect(ammoFrames(a).length).toBe(1); // exactly one shot registered

    await tick(h, 3); // > 100 ms
    await a.send("fire");
    await tick(h, 1);
    expect(ammoFrames(a).length).toBe(2); // the next shot is allowed again
  });

  it("decrements the magazine per shot and a manual reload refills from the reserve", async () => {
    const h = await createTestRoom(ProtArena, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect();
    for (let i = 0; i < 3; i++) {
      await a.send("fire");
      await tick(h, 3); // space past the fire-rate cap
    }
    const last = ammoFrames(a).at(-1)!.payload as { mag: number; reserve: number };
    expect(last.mag).toBe(AR.mag - 3); // 27

    await a.send("reload");
    await tick(h);
    expect(liveState(h).players[a.id]!.reloadEnd).toBeGreaterThan(Date.now());
    await tick(h, Math.ceil(AR.reloadMs / TICK_MS) + 2); // wait out the reload
    const refilled = ammoFrames(a).at(-1)!.payload as { mag: number; reserve: number };
    expect(liveState(h).players[a.id]!.reloadEnd).toBe(0);
    expect(refilled.mag).toBe(AR.mag); // topped back to 30
    expect(refilled.reserve).toBe(AR.reserve - 3); // 3 rounds came from the reserve
  });
});

describe("arena room — shot event's per-victim hits (remote hit-reaction trigger)", () => {
  it("a body hit reports the victim id with head=false", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: BODY_PITCH });
    place(h, target.id, 20);
    await tick(h, 3);

    await shooter.send("fire");
    await tick(h, 1);

    const payload = shotFrames(shooter).at(-1)!.payload as { hit: boolean; hits: { id: string; head: boolean }[] };
    expect(payload.hit).toBe(true);
    expect(payload.hits).toEqual([{ id: target.id, head: false }]);
    const hurt = target.frames().filter(f => f.type === 'hurt');
    expect(hurt).toHaveLength(1);
    expect(hurt[0]!.payload).toEqual({ bearing: -Math.PI / 2 });
    expect(shooter.frames().filter(f => f.type === 'hurt')).toHaveLength(0);
  });

  it("a headshot reports head=true", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: HEAD_PITCH });
    place(h, target.id, 20);
    await tick(h, 3);

    await shooter.send("fire");
    await tick(h, 1);

    const payload = shotFrames(shooter).at(-1)!.payload as { hits: { id: string; head: boolean }[] };
    expect(payload.hits).toEqual([{ id: target.id, head: true }]);
  });

  // Hitbox/visual audit E2E gate (is-anim): a shot at where a CROUCHING
  // target's rig actually renders its head lands as a headshot — pre-fix
  // (HIT.crouchHeight === PLAYER.crouchHeight === 1.1) this exact shot would
  // have missed entirely (the assumed head sphere sat ~45cm below the
  // animated rig's real head — see src/config.ts's HIT doc comment).
  it("a headshot on a CROUCHING target reports head=true (hitbox/visual audit fix)", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: CROUCH_HEAD_PITCH });
    place(h, target.id, 20);
    // integrate()'s own crouch transition reads the target's INPUT each tick
    // (place()'s direct p.crouch write would just be overwritten back to
    // false by the next tick) — a real "move" intent is what actually sticks.
    await target.send("move", { crouch: true });
    await tick(h, 3);

    await shooter.send("fire");
    await tick(h, 1);

    const payload = shotFrames(shooter).at(-1)!.payload as { hits: { id: string; head: boolean }[] };
    expect(payload.hits).toEqual([{ id: target.id, head: true }]);
  });

  it("a miss reports an empty hits array", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    await tick(h, 2);
    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: BODY_PITCH }); // nothing downrange

    await shooter.send("fire");
    await tick(h, 1);

    const payload = shotFrames(shooter).at(-1)!.payload as { hit: boolean; hits: unknown[] };
    expect(payload.hit).toBe(false);
    expect(payload.hits).toEqual([]);
  });
});

describe("arena room — combat, respawn, lag compensation, match flow", () => {
  it("downs an enemy with body shots, scores the frag, then respawns it", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect(); // red
    const target = await h.connect(); // blue
    await tick(h, 2); // clear the (zeroed) spawn protection

    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: BODY_PITCH });
    place(h, target.id, 20);
    await tick(h, 3); // build lag history at these positions

    for (let i = 0; i < 4; i++) {
      await shooter.send("fire");
      await tick(h, 3);
    }
    const s = h.snapshot();
    expect(s.players[target.id]!.alive).toBe(false);
    expect(s.players[target.id]!.d).toBe(1);
    expect(s.players[shooter.id]!.k).toBe(1);
    expect(s.redScore).toBe(1);
    expect(h.broadcastsOf("s:msg").find((f) => (f.data as { type?: string }).type === "kill")?.data).toMatchObject({
      type: 'kill', payload: { killer: shooter.id, victim: target.id, weapon: 1, part: 'body' },
    });

    await tick(h, 8); // > respawnMs (200 ms)
    const s2 = h.snapshot();
    expect(s2.players[target.id]!.alive).toBe(true);
    expect(s2.players[target.id]!.hp).toBe(PLAYER.maxHp);
  });

  it("spawn protection makes an enemy untargetable until it expires", async () => {
    const h = await createTestRoom(ProtArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    // Aim at the (still-protected) target and fire — no damage lands.
    const p = liveState(h).players[shooter.id]!;
    p.x = 10;
    p.z = 11;
    p.y = 0;
    p.yaw = Math.PI / 2;
    p.pitch = BODY_PITCH;
    p.prot = false;
    const t = liveState(h).players[target.id]!;
    t.x = 20;
    t.z = 11;
    t.y = 0; // leave t.prot = true (spawn-protected)
    await tick(h, 3);
    await shooter.send("fire");
    await tick(h, 2);
    expect(h.snapshot().players[target.id]!.hp).toBe(PLAYER.maxHp); // shielded
    expect(target.frames().filter(f => f.type === 'hurt')).toHaveLength(0);

    // After protection lapses (1.5 s) the same shot connects.
    await tick(h, 32);
    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: BODY_PITCH });
    place(h, target.id, 20);
    await tick(h, 3);
    await shooter.send("fire");
    await tick(h, 2);
    expect(h.snapshot().players[target.id]!.hp).toBeLessThan(PLAYER.maxHp);
  });

  it("lag-comp rewind: a shot hits where the target was, and misses once it has left", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: BODY_PITCH });
    place(h, target.id, 20, { z: 11 });

    // Hold the target on the shooter's ray (z = 11) long enough to fill the buffer,
    // then slide it off (z = 7) just one tick before firing. The rewind instant
    // (~100 ms back) still finds it on the ray → HIT, even though it is off it now.
    for (let i = 0; i < 5; i++) {
      liveState(h).players[target.id]!.z = 11;
      await tick(h, 1);
    }
    liveState(h).players[target.id]!.z = 7; // off the ray, this tick
    await tick(h, 1);
    await shooter.send("fire");
    await tick(h, 1);
    const hpAfterHit = h.snapshot().players[target.id]!.hp;
    expect(hpAfterHit).toBeLessThan(PLAYER.maxHp); // rewound onto the old on-ray position

    // Keep it off the ray past the rewind horizon, then fire again → the rewind now
    // also lands off-ray → MISS (hp unchanged).
    for (let i = 0; i < 5; i++) {
      liveState(h).players[target.id]!.z = 7;
      await tick(h, 1);
    }
    await shooter.send("fire");
    await tick(h, 1);
    expect(h.snapshot().players[target.id]!.hp).toBe(hpAfterHit);
  });

  it("reaching the kill target ends the match, then the arena resets to live", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    await h.connect();
    await tick(h, 1);

    liveState(h).redScore = 2; // hit the 2-kill target
    await tick(h, 1);
    expect(h.snapshot().phase).toBe("ended");
    expect(h.broadcastsOf("s:msg").some((f) => (f.data as { type?: string }).type === "matchEnd")).toBe(true);

    await tick(h, 12); // intermission (4 ticks) + warmup arm (1) + warmup countdown (4) + buffer
    const s = h.snapshot();
    expect(s.phase).toBe("live");
    expect(s.redScore).toBe(0);
    expect(s.blueScore).toBe(0);
  });

  it("resetMatch: capture gauges return to neutral and killstreak counters clear", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    await tick(h, 1);

    // Dirty state that must not survive into the next match.
    liveState(h).capA = 200;
    liveState(h).capB = 0;
    liveState(h).capC = 150;
    (h.room as unknown as { streaks: Map<string, number> }).streaks.set(shooter.id, 4);

    liveState(h).redScore = 2; // hits FastArena's killTarget=2 → endMatch → warmup → resetMatch
    await tick(h, 12); // intermission + warmup arm + warmup countdown + buffer (same budget as above)

    const s = h.snapshot();
    expect(s.phase).toBe("live");
    expect(s.capA).toBe(100);
    expect(s.capB).toBe(100);
    expect(s.capC).toBe(100);
    expect((h.room as unknown as { streaks: Map<string, number> }).streaks.size).toBe(0);
  });
});

describe("arena room — vote-restart excludes filler-bot seats", () => {
  it("need is computed from human seats only, so bots can't inflate (or satisfy) quorum", async () => {
    const h = await createTestRoom(VoteArena, { codec: ArenaSchema, sync: "throttled" });
    const h1 = await h.connect();
    const h2 = await h.connect();
    await tick(h, 1); // reconcileBots fills to fillToPlayers=4 with 2 filler bots
    expect(Object.keys(h.snapshot().players).length).toBe(12);

    liveState(h).phase = "ended";
    await tick(h, 1);

    await h1.send("voteRestart");
    await tick(h, 1);
    const voteFrame = h
      .broadcastsOf("s:msg")
      .find((f) => (f.data as { type?: string }).type === "vote");
    // 2 humans → need = floor(2/2)+1 = 2, NOT floor(4/2)+1 = 3 (the pre-fix bug).
    expect((voteFrame!.data as { payload?: { need?: number } }).payload?.need).toBe(2);
    expect(h.snapshot().phase).toBe("ended"); // 1/2 human votes — not enough yet

    await h2.send("voteRestart");
    await tick(h, 1);
    expect(h.snapshot().phase).toBe("warmup"); // 2/2 human votes → restart triggers
  });
});

describe("arena room — ffa (teamless) mode: no false-positive friendly fire", () => {
  it("hitscan connects between two players despite both sharing team=0", async () => {
    const h = await createTestRoom(ProtArena, { id: "arena-ffa", codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);
    expect(liveState(h).players[shooter.id]!.team).toBe(0);
    expect(liveState(h).players[target.id]!.team).toBe(0); // ffa: everyone is team 0

    // z=23: an open east-west corridor on ARENA3 (ffa's map since the crossyard
    // shipped) — the old default z=6 line now runs into arena3's north diagonal
    // wall (x16-32 at z6-8), which would occlude the shot and fail this test
    // for a reason that has nothing to do with team filtering.
    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: BODY_PITCH, z: 23 });
    place(h, target.id, 20, { z: 23 });
    await tick(h, 3);

    await shooter.send("fire");
    await tick(h, 2);
    expect(h.snapshot().players[target.id]!.hp).toBeLessThan(PLAYER.maxHp);
  });

  it("a grenade damages a non-owner target despite both sharing team=0", async () => {
    const h = await createTestRoom(ProtArena, { id: "arena-ffa", codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect();
    const b = await h.connect();
    await tick(h, 2);

    place(h, a.id, 20, { yaw: Math.PI / 2, pitch: -1.56 }); // look straight down → nade drops at the feet
    place(h, b.id, 22); // 2 m away in the same clear lane
    await tick(h, 2);

    await a.send("nade");
    await tick(h, Math.ceil(GRENADE.fuseMs / TICK_MS) + 2);
    expect(h.snapshot().players[b.id]!.hp).toBeLessThan(PLAYER.maxHp);
  });
});

describe("arena room — dom mode: score win reaches gameMode.winCheck, not the killTarget fallback", () => {
  it("stays live past the (TDM-only) killTarget threshold, then ends via dom's real scoreTarget", async () => {
    const h = await createTestRoom(ProtArena, { id: "arena-dom", codec: ArenaSchema, sync: "throttled" });
    await h.connect();
    await tick(h, 1);

    // Between the room's killTarget=50 default and dom's real scoreTarget=200: the
    // pre-fix bug ended the match here via the TDM-shaped fallback.
    liveState(h).redScore = 60;
    await tick(h, 1);
    expect(h.snapshot().phase).toBe("live");

    liveState(h).redScore = MODES.dom.scoreTarget;
    await tick(h, 1);
    expect(h.snapshot().phase).toBe("ended");
    const matchEnd = h
      .broadcastsOf("s:msg")
      .find((f) => (f.data as { type?: string }).type === "matchEnd");
    expect((matchEnd!.data as { payload?: { winner?: string } }).payload?.winner).toBe("red");
  });
});

describe("arena room — weapons: switch, per-weapon ammo, pellets, grenades", () => {
  it("a switch changes the held weapon but the swap delay gates the next shot", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect();

    await a.send("switch", { slot: 3 }); // shotgun (index 2)
    await tick(h, 1);
    expect(liveState(h).players[a.id]!.weapon).toBe(2);

    const before = shotFrames(a).length;
    await a.send("fire"); // still mid-swap
    await tick(h, 1);
    expect(shotFrames(a).length).toBe(before); // blocked by the swap delay

    await tick(h, swapTicks); // wait out the swap
    await a.send("fire");
    await tick(h, 1);
    expect(shotFrames(a).length).toBe(before + 1); // now it fires
  });

  it("each weapon keeps its own magazine; the ammo event names the held slot", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect();

    for (let i = 0; i < 3; i++) {
      await a.send("fire"); // AR
      await tick(h, 3);
    }
    const arAmmo = ammoFrames(a).at(-1)!.payload as { mag: number; weapon: number };
    expect(arAmmo.mag).toBe(AR.mag - 3);
    expect(arAmmo.weapon).toBe(1); // AR is slot 1

    await a.send("switch", { slot: 3 }); // shotgun
    await tick(h, 1);
    const swAmmo = ammoFrames(a).at(-1)!.payload as { mag: number; weapon: number };
    expect(swAmmo.weapon).toBe(3);
    expect(swAmmo.mag).toBe(SHOTGUN.mag); // full — independent of the AR's spent mag

    await a.send("switch", { slot: 1 }); // back to AR
    await tick(h, 1);
    const backAmmo = ammoFrames(a).at(-1)!.payload as { mag: number; weapon: number };
    expect(backAmmo.weapon).toBe(1);
    expect(backAmmo.mag).toBe(AR.mag - 3); // the AR remembers the three spent rounds
  });

  it("a point-blank shotgun blast stacks its pellets into a one-shot kill", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect(); // red
    const target = await h.connect(); // blue
    await tick(h, 2);

    place(h, shooter.id, 15, { yaw: Math.PI / 2, pitch: pitchFor(5) });
    place(h, target.id, 20); // 5 m ahead in the clear z = 11 lane

    await shooter.send("switch", { slot: 3 }); // shotgun
    await tick(h, swapTicks); // wait out the swap (also fills the lag buffer)

    await shooter.send("fire");
    await tick(h, 2);
    expect(h.snapshot().players[target.id]!.alive).toBe(false); // all 8 pellets connected
    expect(h.broadcastsOf('s:msg').find(f => (f.data as { type?: string }).type === 'kill')?.data).toMatchObject({
      type: 'kill', payload: { killer: shooter.id, victim: target.id, weapon: 3 },
    });
  });

  it("a thrown grenade decrements the count, detonates on its fuse, and blasts nearby players (self too)", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect(); // red
    const b = await h.connect(); // blue
    await tick(h, 2);

    place(h, a.id, 20, { yaw: Math.PI / 2, pitch: -1.56 }); // look straight down → nade drops at the feet
    place(h, b.id, 22); // 2 m away in the same clear lane
    await tick(h, 2);

    expect(liveState(h).players[a.id]!.nades).toBe(GRENADE.count);
    await a.send("nade");
    await tick(h, 1);
    expect(liveState(h).players[a.id]!.nades).toBe(GRENADE.count - 1); // spent one
    expect(a.frames().some((f) => f.t === "s:msg" && f.type === "nadeSpawn")).toBe(true);

    await tick(h, Math.ceil(GRENADE.fuseMs / TICK_MS) + 2); // run out the fuse
    // nadeBoom fans out via sendNear (per-client), so it lands in the client's frames.
    expect(a.frames().some((f) => f.t === "s:msg" && f.type === "nadeBoom")).toBe(true);

    const s = h.snapshot();
    expect(s.players[b.id]!.hp).toBeLessThan(PLAYER.maxHp); // enemy caught in the blast
    expect(s.players[a.id]!.hp).toBeLessThan(PLAYER.maxHp); // self-damage included
    const boom = a.frames().find(f => f.type === 'nadeBoom')!.payload as { x: number; z: number };
    for (const conn of [a, b]) {
      const p = s.players[conn.id]!;
      const hurt = conn.frames().filter(f => f.type === 'hurt');
      expect(hurt).toHaveLength(1);
      expect(hurt[0]!.payload).toEqual({ bearing: Math.atan2(boom.x - p.x, boom.z - p.z) });
    }
  });

  it("a grenade behind cover does not damage a shielded player (line-of-sight AoE)", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect(); // red
    const b = await h.connect(); // blue
    await tick(h, 2);

    // Drop the grenade just north of the north lane divider (a 2.5 m wall at
    // z 12–14) and stand the enemy just south of it: 3.5 m apart — well inside
    // GRENADE.radius (5), so without the wall the blast WOULD hurt them (the
    // old placement was 5.5 m apart, past the radius, which made this test
    // vacuously pass with or without cover) — but the wall blocks LoS.
    place(h, a.id, 17, { yaw: Math.PI / 2, pitch: -1.56, z: 11 });
    place(h, b.id, 30, { z: 14.5 }); // opposite face of the divider (14,·,12)-(46,·,14)
    await tick(h, 2);

    await a.send("nade");
    await tick(h, Math.ceil(GRENADE.fuseMs / TICK_MS) + 2);
    expect(h.snapshot().players[b.id]!.hp).toBe(PLAYER.maxHp); // wall between them absorbed it
    expect(b.frames().filter(f => f.type === 'hurt')).toHaveLength(0);
  });
});

// Hybrid hit registration (PLAN "모양 100%", is-anim): the client's own raycast
// against its rendered scene (client/scene.ts's raycastHitClaim) is sent as a
// `claim` on the `fire` payload; arena-room.ts's `validateClaim` plausibility-
// gates it before trusting it for damage, falling back to the existing
// analytic `resolveHitscan` on any failure. These tests exercise that gate at
// the room level — a real client's mesh raycast can't be reproduced here, but
// every claim these tests send is exactly what `readClaim` would parse off the
// wire, and `validateClaim` doesn't care where the claim came from.
describe("arena room — hybrid hit registration (claim + server plausibility gate)", () => {
  afterEach(() => {
    // The "safety switch" test below flips this at runtime — always restore it
    // so a failure mid-test can't leak into later tests/files.
    (HYBRID as { enabled: boolean }).enabled = true;
  });

  it("an accepted claim registers damage per the claim's part — including a shot the analytic ray alone would miss (outstretched-limb gate case)", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    // Aim 0.6 m to the side of the target's true centre at 10 m range: inside
    // HYBRID's cone tolerance (atan2(HIT.radius + coneMarginM, 10) ≈ 4.0°,
    // i.e. ~0.7 m of slack at this range) but outside HIT.radius (0.4 m) — the
    // analytic cylinder test alone misses this exact ray (see the very next
    // test), the same kind of gap the real animated rig's outstretched-limb
    // geometry opens up against the analytic capsule (the original hitbox/
    // visual audit finding this whole feature answers).
    const offZ = 0.6;
    const neckY = HIT.standHeight - 2 * HIT.headRadius;
    const bodyCenterY = neckY / 2; // feetY = 0
    const yaw = Math.atan2(10, offZ);
    const pitch = Math.atan2(bodyCenterY - PLAYER.standEye, Math.hypot(10, offZ));
    place(h, shooter.id, 10, { yaw, pitch, z: 11 });
    place(h, target.id, 20, { z: 11 });
    await tick(h, 3);

    await shooter.send("fire", { claim: { id: target.id, part: "body" } });
    await tick(h, 1);

    const payload = shotFrames(shooter).at(-1)!.payload as { hit: boolean; hits: { id: string; head: boolean }[] };
    expect(payload.hit).toBe(true);
    expect(payload.hits).toEqual([{ id: target.id, head: false }]);
  });

  it("the identical shot with no claim misses via the analytic path alone (confirms the gate case above is real, not a fluke)", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    const offZ = 0.6;
    const neckY = HIT.standHeight - 2 * HIT.headRadius;
    const bodyCenterY = neckY / 2;
    const yaw = Math.atan2(10, offZ);
    const pitch = Math.atan2(bodyCenterY - PLAYER.standEye, Math.hypot(10, offZ));
    place(h, shooter.id, 10, { yaw, pitch, z: 11 });
    place(h, target.id, 20, { z: 11 });
    await tick(h, 3);

    await shooter.send("fire"); // no claim — old client / hybrid-off behavior
    await tick(h, 1);

    const payload = shotFrames(shooter).at(-1)!.payload as { hit: boolean };
    expect(payload.hit).toBe(false);
  });

  it("a null claim (client raycast found nothing) is trusted as a miss and does NOT fall back to the analytic hitscan (gap-between-limbs gate case)", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    // Dead-on body aim — the analytic path alone would definitely hit here
    // (same setup as the plain "a body hit..." test above); the explicit
    // `claim: null` must still win over it.
    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: BODY_PITCH });
    place(h, target.id, 20);
    await tick(h, 3);

    await shooter.send("fire", { claim: null });
    await tick(h, 1);

    const payload = shotFrames(shooter).at(-1)!.payload as { hit: boolean; hits: unknown[] };
    expect(payload.hit).toBe(false);
    expect(payload.hits).toEqual([]);
  });

  it("a claim whose reported aim points nowhere near the claimed victim is rejected (forged aim) and falls back to the analytic hitscan", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    // Actually facing +z (yaw 0, nothing downrange) while claiming a hit on
    // `target`, which sits 10 m away along +x (yaw π/2 would be dead-on) — a
    // real client's claim always matches its own reported aim; this simulates
    // a forged/corrupted one.
    place(h, shooter.id, 10, { yaw: 0, pitch: 0 });
    place(h, target.id, 20);
    await tick(h, 3);

    await shooter.send("fire", { claim: { id: target.id, part: "body" } });
    await tick(h, 1);

    const payload = shotFrames(shooter).at(-1)!.payload as { hit: boolean };
    expect(payload.hit).toBe(false);
  });

  it("a claim for a target behind map cover is rejected (occlusion) and falls back to the analytic hitscan", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    // Relay service screen spans x=14..16, z=34..66. Both players are
    // on clear ground, with the opaque screen strictly between their eyes.
    place(h, shooter.id, 12, { yaw: Math.PI / 2, pitch: Math.atan2(1.0 - PLAYER.standEye, 6), z: 45 });
    place(h, target.id, 18, { z: 45 });
    await tick(h, 3);

    await shooter.send("fire", { claim: { id: target.id, part: "body" } });
    await tick(h, 1);

    const payload = shotFrames(shooter).at(-1)!.payload as { hit: boolean };
    expect(payload.hit).toBe(false);
  });

  it("a claim referencing a nonexistent victim is rejected and falls back to the analytic hitscan", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    await tick(h, 2);
    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: BODY_PITCH }); // nothing downrange

    await shooter.send("fire", { claim: { id: "ghost", part: "body" } });
    await tick(h, 1);

    const payload = shotFrames(shooter).at(-1)!.payload as { hit: boolean };
    expect(payload.hit).toBe(false);
  });

  it("a claim for a target beyond weapon range is rejected and falls back to the analytic hitscan", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);
    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: 0 });
    // Direct state write bypasses the normal arena/wire bounds — every
    // single-pellet weapon's range (80-100 m) already exceeds the arena's own
    // diagonal (~72 m), so an out-of-range target can't be reached by placing
    // one inside real map bounds at all.
    place(h, target.id, 10, { z: 5000 });
    await tick(h, 3);

    await shooter.send("fire", { claim: { id: target.id, part: "body" } });
    await tick(h, 1);

    const payload = shotFrames(shooter).at(-1)!.payload as { hit: boolean };
    expect(payload.hit).toBe(false);
  });

  it("HYBRID.enabled=false ignores every claim unconditionally, matching today's analytic-only behavior", async () => {
    (HYBRID as { enabled: boolean }).enabled = false;
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);
    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: BODY_PITCH });
    place(h, target.id, 20);
    await tick(h, 3);

    // A claim with the WRONG part on purpose — if honored this would read
    // head:true; with the flag off it must be ignored outright and the
    // analytic path (a real body-height aim) reports the true body hit.
    await shooter.send("fire", { claim: { id: target.id, part: "head" } });
    await tick(h, 1);

    const payload = shotFrames(shooter).at(-1)!.payload as { hits: { id: string; head: boolean }[] };
    expect(payload.hits).toEqual([{ id: target.id, head: false }]);
  });
});


describe("M4 recovery", () => {
  it("disconnect stops held movement and preserves the seat on reconnect", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema });
    const a = await h.connect('recover-seat');
    place(h, a.id, 8, { yaw: Math.PI / 2 });
    await a.send('move', { mx: 0, mz: 1, jump: false, crouch: false, sprint: false });
    await tick(h, 3);
    const leaving = a.close();
    await h.flush();
    const stopped = { ...liveState(h).players[a.id]! };
    await tick(h, 10);
    expect(liveState(h).players[a.id]!.x).toBe(stopped.x);
    const b = await h.connect('recover-seat');
    await leaving;
    expect(b.id).toBe(a.id);
    expect(liveState(h).players[b.id]!.k).toBe(stopped.k);
  });

  it("resync returns actual owner ammo and remaining reload without granting ammunition", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema });
    const a = await h.connect();
    await a.send("fire", {}); await tick(h);
    await a.send("reload"); await tick(h);
    await h.advance(300);
    await a.send("syncView", { mag: 999, weapon: 5 }); await tick(h);
    const ammo = ammoFrames(a).at(-1)!.payload as { mag: number; reloadMs: number; weapon: number };
    expect(ammo.mag).toBe(AR.mag - 1);
    expect(ammo.weapon).toBe(1);
    expect(ammo.reloadMs).toBeGreaterThan(0);
    expect(ammo.reloadMs).toBeLessThan(AR.reloadMs);
    const deadline = liveState(h).players[a.id]!.reloadEnd;
    expect(deadline).toBeGreaterThan(Date.now());
    await a.send("reload", { reloadEnd: 9999999999999 }); await tick(h);
    expect(liveState(h).players[a.id]!.reloadEnd).toBe(deadline);
    await a.send("switch", { slot: 2 }); await tick(h);
    expect(liveState(h).players[a.id]!.reloadEnd).toBe(0);
  });

  it("a late subscriber receives the authoritative ended result and vote quorum", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema });
    const a = await h.connect();
    liveState(h).redScore = 2; await tick(h);
    const b = await h.connect();
    await b.send("syncView"); await tick(h);
    const result = b.frames().find(f => f.t === 's:msg' && f.type === 'matchEnd');
    expect(result?.payload).toEqual({ winner: 'red', red: 2, blue: 0 });
    const vote = b.frames().find(f => f.t === 's:msg' && f.type === 'vote');
    expect(vote?.payload).toEqual({ count: 0, need: 2 });
    expect(liveState(h).players[a.id]).toBeDefined();
  });

  it("cold snapshots rebuild a safe new round and remove unowned bot records", async () => {
    class RestoreArena extends FastArena { restoreForTest() { this.onRestore(); } }
    const h = await createTestRoom(RestoreArena, { codec: ArenaSchema });
    const a = await h.connect();
    const s = liveState(h);
    s.phase = 'ended'; s.redScore = 10;
    Object.assign(s.players[a.id]!, { alive: false, hp: 0, k: 10, prot: true, x: 30, z: 20 });
    s.players['bot-stale'] = { ...s.players[a.id]! };
    (h.room as RestoreArena).restoreForTest();
    expect(s.phase).toBe('warmup');
    expect(s.redScore).toBe(0);
    expect(s.players['bot-stale']).toBeUndefined();
    expect(s.players[a.id]).toMatchObject({ alive: true, hp: 100, k: 0 });
    await a.send('syncView'); await tick(h);
    expect((ammoFrames(a).at(-1)!.payload as { mag: number }).mag).toBe(AR.mag);
    await tick(h, 10);
    expect(s.phase).toBe('live');
  });
});
