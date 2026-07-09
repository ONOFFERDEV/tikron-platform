import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestRoomHandle } from "@tikron/server/testing";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";
import { AR, GRENADE, PLAYER, TICK_MS, WEAPON, WEAPONS } from "../src/config.js";

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
}

/** Pitch that aims the shooter's eye-height muzzle at an enemy's chest 10 m away. */
const BODY_PITCH = Math.atan2(1.0 - PLAYER.standEye, 10);

function liveState(h: TestRoomHandle<ArenaState>): ArenaState {
  return (h.room as unknown as { state: ArenaState }).state;
}

async function tick(h: TestRoomHandle<ArenaState>, n = 1): Promise<void> {
  for (let i = 0; i < n; i++) await h.advance(TICK_MS);
}

/** Place a live, unprotected player at a spot in the clear top lane (z = 6). */
function place(
  h: TestRoomHandle<ArenaState>,
  id: string,
  x: number,
  opts: { yaw?: number; pitch?: number; z?: number } = {},
): void {
  const p = liveState(h).players[id]!;
  p.x = x;
  p.y = 0;
  p.z = opts.z ?? 6;
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
    const h = await createTestRoom(ArenaRoomImpl, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect();
    const b = await h.connect();
    const c = await h.connect();
    const s = h.snapshot();
    expect(s.players[a.id]!.team).toBe(0); // red
    expect(s.players[b.id]!.team).toBe(1); // blue
    expect(s.players[c.id]!.team).toBe(0); // red (tie → red)
  });

  it("integrates WASD forward; sprint is faster, crouch is slower and lowers the stance", async () => {
    const h = await createTestRoom(ArenaRoomImpl, { codec: ArenaSchema, sync: "throttled" });
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
    const h = await createTestRoom(ArenaRoomImpl, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect();
    await a.send("move", { jump: true });
    await tick(h, 3);
    expect(h.snapshot().players[a.id]!.y).toBeGreaterThan(0.3); // airborne
    await tick(h, 40); // ~2 s later
    expect(h.snapshot().players[a.id]!.y).toBeLessThan(0.05); // landed
  });

  it("map cover blocks horizontal movement (no tunnelling through a box)", async () => {
    const h = await createTestRoom(ArenaRoomImpl, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect(); // red spawn (4,·,6), facing +x toward the platform at x≈27
    await a.send("move", { mz: 1 });
    await tick(h, 100);
    const p = h.snapshot().players[a.id]!;
    expect(p.x).toBeGreaterThanOrEqual(26);
    expect(p.x).toBeLessThanOrEqual(27); // stopped at the platform face, did not pass through
  });

  it("look wraps yaw into [0,2π) and clamps pitch to the vertical limit", async () => {
    const h = await createTestRoom(ArenaRoomImpl, { codec: ArenaSchema, sync: "throttled" });
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
    const h = await createTestRoom(ArenaRoomImpl, { codec: ArenaSchema, sync: "throttled" });
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
    const h = await createTestRoom(ArenaRoomImpl, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect();
    for (let i = 0; i < 3; i++) {
      await a.send("fire");
      await tick(h, 3); // space past the fire-rate cap
    }
    const last = ammoFrames(a).at(-1)!.payload as { mag: number; reserve: number };
    expect(last.mag).toBe(AR.mag - 3); // 27

    await a.send("reload");
    await tick(h, Math.ceil(AR.reloadMs / TICK_MS) + 2); // wait out the reload
    const refilled = ammoFrames(a).at(-1)!.payload as { mag: number; reserve: number };
    expect(refilled.mag).toBe(AR.mag); // topped back to 30
    expect(refilled.reserve).toBe(AR.reserve - 3); // 3 rounds came from the reserve
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
    expect(h.broadcastsOf("s:msg").some((f) => (f.data as { type?: string }).type === "kill")).toBe(true);

    await tick(h, 8); // > respawnMs (200 ms)
    const s2 = h.snapshot();
    expect(s2.players[target.id]!.alive).toBe(true);
    expect(s2.players[target.id]!.hp).toBe(PLAYER.maxHp);
  });

  it("spawn protection makes an enemy untargetable until it expires", async () => {
    const h = await createTestRoom(ArenaRoomImpl, { codec: ArenaSchema, sync: "throttled" });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    // Aim at the (still-protected) target and fire — no damage lands.
    const p = liveState(h).players[shooter.id]!;
    p.x = 10;
    p.z = 6;
    p.y = 0;
    p.yaw = Math.PI / 2;
    p.pitch = BODY_PITCH;
    p.prot = false;
    const t = liveState(h).players[target.id]!;
    t.x = 20;
    t.z = 6;
    t.y = 0; // leave t.prot = true (spawn-protected)
    await tick(h, 3);
    await shooter.send("fire");
    await tick(h, 2);
    expect(h.snapshot().players[target.id]!.hp).toBe(PLAYER.maxHp); // shielded

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
    place(h, target.id, 20, { z: 6 });

    // Hold the target on the shooter's ray (z = 6) long enough to fill the buffer,
    // then slide it off (z = 7) just one tick before firing. The rewind instant
    // (~100 ms back) still finds it on the ray → HIT, even though it is off it now.
    for (let i = 0; i < 5; i++) {
      liveState(h).players[target.id]!.z = 6;
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

    await tick(h, 6); // > intermissionMs (200 ms)
    const s = h.snapshot();
    expect(s.phase).toBe("live");
    expect(s.redScore).toBe(0);
    expect(s.blueScore).toBe(0);
  });
});

describe("arena room — weapons: switch, per-weapon ammo, pellets, grenades", () => {
  it("a switch changes the held weapon but the swap delay gates the next shot", async () => {
    const h = await createTestRoom(ArenaRoomImpl, { codec: ArenaSchema, sync: "throttled" });
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
    const h = await createTestRoom(ArenaRoomImpl, { codec: ArenaSchema, sync: "throttled" });
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
    place(h, target.id, 20); // 5 m ahead in the clear z = 6 lane

    await shooter.send("switch", { slot: 3 }); // shotgun
    await tick(h, swapTicks); // wait out the swap (also fills the lag buffer)

    await shooter.send("fire");
    await tick(h, 2);
    expect(h.snapshot().players[target.id]!.alive).toBe(false); // all 8 pellets connected
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
  });

  it("a grenade behind cover does not damage a shielded player (line-of-sight AoE)", async () => {
    const h = await createTestRoom(FastArena, { codec: ArenaSchema, sync: "throttled" });
    const a = await h.connect(); // red
    const b = await h.connect(); // blue
    await tick(h, 2);

    // Throw the grenade straight down at the central 2.2 m cover stack (28.5–31.5),
    // and stand the enemy on the far side of that wall — the LoS check spares them.
    place(h, a.id, 30, { yaw: Math.PI / 2, pitch: -1.56, z: 17.5 });
    place(h, b.id, 30, { z: 23 }); // opposite face of the box at (28.5,·,18.5)-(31.5,·,21.5)
    await tick(h, 2);

    await a.send("nade");
    await tick(h, Math.ceil(GRENADE.fuseMs / TICK_MS) + 2);
    expect(h.snapshot().players[b.id]!.hp).toBe(PLAYER.maxHp); // wall between them absorbed it
  });
});
