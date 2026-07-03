import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { decodeFull, applyDelta, type Codec } from "@tikron/schema";
import { ShooterSchema, SHOOTER } from "../src/rooms/shooter-schema.js";
import { makeCrates, rayCoverDistance, type Crate } from "../src/rooms/shooter-crates.js";
import { topScores } from "../src/platform/db.js";
import type { Env } from "../src/index.js";

type Frame = Record<string, any>;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function stateClient(party: string, room: string, codec: Codec<any>, query = "") {
  const res = await SELF.fetch(`https://example.com/parties/${party}/${room}${query}`, {
    headers: { Upgrade: "websocket" },
  });
  const ws = res.webSocket;
  if (!ws) throw new Error(`expected a WebSocket upgrade, got HTTP ${res.status}`);

  let state: any;
  // Server wall clock (ms) carried in each binary state-frame header (f64 @ offset
  // 5). Lets the test place `shoot` timestamps on the *server* timeline — the Node
  // test clock and the workerd server clock are not the same, so guessing with
  // Date.now() would rewind to the wrong instant.
  let serverTimeMs = 0;
  const msgs: Frame[] = [];
  let msgNotify: (() => void)[] = [];
  let stateNotify: (() => void)[] = [];

  ws.addEventListener("message", (e) => {
    if (typeof e.data === "string") {
      msgs.push(JSON.parse(e.data) as Frame);
      const n = msgNotify;
      msgNotify = [];
      n.forEach((f) => f());
    } else {
      const bytes = new Uint8Array(e.data as ArrayBuffer);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      serverTimeMs = view.getFloat64(5, true);
      state = bytes[0] === 1 ? decodeFull(codec, bytes.subarray(13)) : applyDelta(codec, state, bytes.subarray(13));
      const n = stateNotify;
      stateNotify = [];
      n.forEach((f) => f());
    }
  });
  ws.accept();

  const waitOn = (get: () => (() => void)[], set: (v: (() => void)[]) => void, ms: number) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), ms);
      set([...get(), () => {
        clearTimeout(t);
        resolve();
      }]);
    });

  return {
    ws,
    /** Latest server wall clock (ms) seen on a state frame; 0 until the first. */
    serverTime(): number {
      return serverTimeMs;
    },
    async waitMsg(pred: (m: Frame) => boolean, ms = 3000): Promise<Frame> {
      const deadline = Date.now() + ms;
      for (;;) {
        const i = msgs.findIndex(pred);
        if (i >= 0) return msgs.splice(i, 1)[0]!;
        await waitOn(() => msgNotify, (v) => (msgNotify = v), Math.max(1, deadline - Date.now()));
      }
    },
    async waitState(pred: (s: any) => boolean, ms = 3000): Promise<any> {
      const deadline = Date.now() + ms;
      for (;;) {
        if (state !== undefined && pred(state)) return state;
        await waitOn(() => stateNotify, (v) => (stateNotify = v), Math.max(1, deadline - Date.now()));
      }
    },
    /** Non-consuming scan of every message received so far (waitMsg splices matches out). */
    sawMsg(pred: (m: Frame) => boolean): boolean {
      return msgs.some(pred);
    },
    move(payload: unknown, seq: number, ts?: number) {
      ws.send(JSON.stringify({ t: "c:msg", type: "move", seq, ...(ts !== undefined ? { ts } : {}), payload }));
    },
    shoot(dir: number, seq: number, ts: number) {
      ws.send(JSON.stringify({ t: "c:msg", type: "shoot", seq, ts, payload: { dir } }));
    },
    nick(payload: unknown, seq: number) {
      ws.send(JSON.stringify({ t: "c:msg", type: "nick", seq, payload }));
    },
  };
}

type StateClient = Awaited<ReturnType<typeof stateClient>>;

/** A player's current position from the client's latest state frame. */
async function posOf(c: StateClient, id: string): Promise<{ x: number; y: number }> {
  const s = await c.waitState((st) => st.players?.[id] !== undefined);
  return { x: s.players[id].x, y: s.players[id].y };
}

/**
 * Walk a player to (tx,ty) in speed-legal steps. Spawns are now *spread* (random
 * per room), so the geometry-sensitive tests no longer assume fixed spawn points —
 * they read the real spawn and drive the player onto the position they need. Each
 * move stays under the per-tick budget (maxSpeed·step·tolerance ≈ 28.75u) so the
 * server accepts it; a tick's sleep between moves lets the room process + flush.
 */
async function driveTo(
  c: StateClient,
  seq: { n: number },
  id: string,
  tx: number,
  ty: number,
): Promise<void> {
  const STEP = 20;
  for (let i = 0; i < 300; i++) {
    const p = await posOf(c, id);
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= 3) return;
    const s = Math.min(d, STEP) / d;
    c.move({ x: p.x + dx * s, y: p.y + dy * s }, seq.n++);
    await sleep(SHOOTER.stepMs + 20);
  }
  throw new Error(`driveTo(${id}) failed to reach (${tx}, ${ty})`);
}

/** Distance from a point to a crate's AABB (0 when inside). */
function crateClearance(c: Crate, x: number, y: number): number {
  const h = c.size / 2;
  const dx = Math.max(c.x - h - x, 0, x - (c.x + h));
  const dy = Math.max(c.y - h - y, 0, y - (c.y + h));
  return Math.hypot(dx, dy);
}

/**
 * Crates are authoritative cover now (they block shots AND movement), and each
 * room's layout is seed-random — so the geometry tests can't just aim NORTH and
 * hope. This reads the room's `state.seed`, rebuilds the same layout the server
 * uses, and picks a firing direction whose 100u ray, target point, and 90u
 * perpendicular slide lane are all clear of crates (with pushout margin).
 */
function clearRay(
  seed: number,
  sp: { x: number; y: number },
): { dir: number; x: number; y: number; px: number; py: number } {
  const crates = makeCrates(seed, SHOOTER.world);
  const MARGIN = SHOOTER.playerRadius + 8; // pushout radius + settle tolerance
  const clearPoint = (x: number, y: number) =>
    x > 40 && y > 40 && x < SHOOTER.world - 40 && y < SHOOTER.world - 40 &&
    crates.every((c) => crateClearance(c, x, y) >= MARGIN);
  for (let k = 0; k < 8; k++) {
    const dir = (k / 8) * Math.PI * 2;
    const tx = sp.x + Math.cos(dir) * 100;
    const ty = sp.y + Math.sin(dir) * 100;
    if (!clearPoint(tx, ty)) continue;
    if (rayCoverDistance(crates, sp.x, sp.y, Math.cos(dir), Math.sin(dir), 110) !== Infinity) continue;
    for (const side of [1, -1]) {
      const pd = dir + (Math.PI / 2) * side;
      const px = Math.cos(pd);
      const py = Math.sin(pd);
      // The slide lane: mid + end points of the 90u sidestep must be clear too.
      if (!clearPoint(tx + px * 45, ty + py * 45) || !clearPoint(tx + px * 95, ty + py * 95)) continue;
      return { dir, x: tx, y: ty, px, py };
    }
  }
  throw new Error("no clear firing lane from this spawn (extremely unlucky seed)");
}

describe("ShooterRoom (FPS demo: subtick lag compensation + hitscan)", () => {
  it("move validation: an over-budget teleport is rejected and snapped back", async () => {
    const a = await stateClient("shooter-room", "mv", ShooterSchema);
    const id = (await a.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    const spawn = await posOf(a, id); // spread spawn: read wherever the room placed us

    // A small step within the speed budget is accepted (the first move's seed
    // budget is one stepMs — 500 u/s × 33 ms × 1.15 ≈ 19u — so step 15).
    a.move({ x: spawn.x + 15, y: spawn.y }, 1);
    await a.waitState((s) => s.players[id].x >= spawn.x + 12);

    // A huge jump exceeds the speed budget and is rejected; the server clamps the
    // player onto the budget circle toward the request (it advances at most
    // maxSpeed × Δt — never near the requested teleport) and reports that
    // authoritative position in the `rejected` reply.
    a.move({ x: spawn.x + 1500, y: spawn.y + 1500 }, 2);
    const rej = await a.waitMsg((m) => m.t === "s:msg" && m.type === "rejected");
    expect(rej.type).toBe("rejected");
    const rejPos = rej.payload as { x: number; y: number };
    const after = await a.waitState((s) => s.players?.[id] !== undefined);
    expect(after.players[id].x).toBeLessThan(spawn.x + 100); // nowhere near the requested jump
    expect(after.players[id].y).toBeLessThan(spawn.y + 100);

    // No rejection cascade: the next speed-legal move, based on the authoritative
    // position the rejection reported, is accepted normally (no second `rejected`).
    await sleep(SHOOTER.stepMs + 20);
    a.move({ x: rejPos.x + 18, y: rejPos.y }, 3);
    await a.waitState((s) => s.players[id].x >= rejPos.x + 14);
    expect(a.sawMsg((m) => m.t === "s:msg" && m.type === "rejected")).toBe(false);

    a.ws.close();
  });

  it("timer jitter: full-speed moves arriving ~70 ms apart are all accepted", async () => {
    // Reproduces the rubber-band trigger: a browser send timer firing late delivers
    // moves carrying MORE than one 50 ms tick of distance (30u > the fixed-step budget
    // of 28.75u). The elapsed-time-aware budget must accept them without a single
    // rejection because the measured spacing (~70 ms) covers the distance.
    const a = await stateClient("shooter-room", "jitter", ShooterSchema);
    const id = (await a.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    const spawn = await posOf(a, id);

    // Head toward the map centre so the walk cannot clip the world clamp.
    const dir = spawn.x < SHOOTER.world / 2 ? 1 : -1;
    let x = spawn.x;
    // Prime the elapsed-time reference: the very first move has no previous move to
    // measure from and gets the default one-tick budget, so it must stay in-place.
    a.move({ x, y: spawn.y }, 1);
    for (let i = 2; i <= 6; i++) {
      await sleep(SHOOTER.stepMs + 40); // late timer: ~73 ms between sends (> 2 ticks)
      x += 30 * dir;
      a.move({ x, y: spawn.y }, i);
    }
    // All five moves accepted: the player covered the full 150u with zero rejections.
    await a.waitState((s) => Math.abs((s.players?.[id]?.x ?? spawn.x) - spawn.x) >= 145, 5000);
    expect(a.sawMsg((m) => m.t === "s:msg" && m.type === "rejected")).toBe(false);

    a.ws.close();
  });

  it("speed hack: sustained 2× speed is rejected and capped at maxSpeed", async () => {
    // Four moves whose subtick timestamps claim 50 ms spacing but whose positions
    // advance 50u each — 1000 u/s, twice maxSpeed. Every move must be rejected and the
    // authoritative advance capped at maxSpeed × claimed time (≈ 25u per move), i.e.
    // about HALF the requested 200u — never the full distance, and never frozen at the
    // spawn either (the clamp advances, it does not snap back).
    const a = await stateClient("shooter-room", "hack", ShooterSchema);
    const id = (await a.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    const spawn = await posOf(a, id);

    const st = a.serverTime(); // fresh: a state frame just delivered the spawn
    for (let i = 1; i <= 4; i++) {
      a.move({ x: spawn.x + 50 * i, y: spawn.y }, i, st - 200 + 50 * i);
    }
    await a.waitMsg((m) => m.t === "s:msg" && m.type === "rejected");

    // Let the last move flush, then measure the capped displacement.
    await sleep(SHOOTER.stepMs * 3);
    const s = await a.waitState((st2) => st2.players?.[id] !== undefined);
    const advanced = s.players[id].x - spawn.x;
    expect(advanced).toBeGreaterThanOrEqual(40); // clamped forward, not frozen at spawn
    expect(advanced).toBeLessThanOrEqual(120); // ≈ maxSpeed-capped — far short of the 200u ask

    a.ws.close();
  });

  it("fire-rate cap: a second shot inside the cooldown window is ignored", async () => {
    // The shared 60 msg/s input limit exists for the move stream; without a per-type
    // cooldown a scripted client could fire ~40 shots/s. Two back-to-back shots must
    // produce exactly one `shot` broadcast.
    const a = await stateClient("shooter-room", "cooldown", ShooterSchema);
    const id = (await a.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    await posOf(a, id); // wait for a state frame so serverTime() is populated

    a.shoot(0, 1, a.serverTime());
    a.shoot(0, 2, a.serverTime());
    await a.waitMsg((m) => m.t === "s:msg" && m.type === "shot"); // the first lands
    // Give a (wrongly) accepted second shot ample time to surface, then assert silence.
    await sleep(SHOOTER.shotCooldownMs + 50);
    expect(a.sawMsg((m) => m.t === "s:msg" && m.type === "shot")).toBe(false);

    // Past the cooldown the next shot is accepted again.
    a.shoot(0, 3, a.serverTime());
    await a.waitMsg((m) => m.t === "s:msg" && m.type === "shot");

    a.ws.close();
  });

  it("hitscan uses lag-comp rewind: a subtick shot hits where the target used to be", async () => {
    const shooter = await stateClient("shooter-room", "lag", ShooterSchema);
    const idS = (await shooter.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    const sp = await posOf(shooter, idS); // the shooter stays put at its spawn
    const target = await stateClient("shooter-room", "lag", ShooterSchema);
    const idT = (await target.waitMsg((m) => m.t === "s:welcome")).connectionId as string;

    // Spawn protection makes a fresh joiner hitscan-transparent for 2 s — wait it
    // out so the rewound shot below can actually connect.
    await target.waitState((s) => s.players?.[idT]?.sp === false, 6000);

    // Drive the target 100u out along a crate-free firing lane (crates block
    // shots now, so the lane is chosen from the room's own seed-derived layout).
    const seed = (await shooter.waitState((s) => typeof s.seed === "number")).seed as number;
    const ray = clearRay(seed, sp);
    const rayX = ray.x;
    const rayY = ray.y;
    const seq = { n: 1 };
    await driveTo(target, seq, idT, rayX, rayY);

    // Wait until the shooter sees the target settled on the ray, then let ~300 ms of
    // on-ray history accumulate in the lag buffer. Its retention depth is 200 ms, so
    // its whole span is now "target on ray".
    await shooter.waitState((s) => {
      const t = s.players?.[idT];
      return t !== undefined && Math.abs(t.x - rayX) < 3 && Math.abs(t.y - rayY) < 3;
    });
    await sleep(300);

    // Slide the target off the ray (perpendicular, along the pre-checked clear
    // lane), just now — in tick-paced, budget-sized steps.
    target.move({ x: rayX + ray.px * 30, y: rayY + ray.py * 30 }, seq.n++);
    await sleep(SHOOTER.stepMs + 20);
    target.move({ x: rayX + ray.px * 60, y: rayY + ray.py * 60 }, seq.n++);
    await sleep(SHOOTER.stepMs + 20);
    target.move({ x: rayX + ray.px * 85, y: rayY + ray.py * 85 }, seq.n++);
    await shooter.waitState((s) => {
      const t = s.players?.[idT];
      return t !== undefined && Math.hypot(t.x - rayX, t.y - rayY) >= 75;
    });

    // Shoot with a stale subtick ts (~the retention horizon): rewind lands on the
    // target's *earlier* on-ray position, where the shooter aimed → HIT. (A high-RTT
    // client's input carries exactly such a past timestamp.)
    shooter.shoot(ray.dir, seq.n++, shooter.serverTime() - 190);
    const hitShot = await shooter.waitMsg((m) => m.t === "s:msg" && m.type === "shot");
    expect(hitShot.payload.from).toBe(idS);
    expect(hitShot.payload.hitId).toBe(idT); // rewind found the target where the shooter aimed

    // The same aim against the *current* world (ts=now, target now off the ray) → MISS.
    await sleep(SHOOTER.shotCooldownMs + 20); // clear the server fire-rate cooldown
    shooter.shoot(ray.dir, seq.n++, shooter.serverTime());
    const missShot = await shooter.waitMsg((m) => m.t === "s:msg" && m.type === "shot");
    expect(missShot.payload.from).toBe(idS);
    expect(missShot.payload.hitId).toBeUndefined();

    shooter.ws.close();
    target.ws.close();
  }, 20000);

  it("downs a target after enough hits, then respawns it at full hp", async () => {
    const shooter = await stateClient("shooter-room", "kill", ShooterSchema);
    const idS = (await shooter.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    const sp = await posOf(shooter, idS);
    const target = await stateClient("shooter-room", "kill", ShooterSchema);
    const idT = (await target.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    // Wait out the victim's spawn protection or the shots below pass through it.
    await target.waitState((s) => s.players?.[idT]?.sp === false, 6000);

    // Put the target 100u out along a crate-free firing lane (seed-derived).
    const seed = (await shooter.waitState((s) => typeof s.seed === "number")).seed as number;
    const ray = clearRay(seed, sp);
    const rayX = ray.x;
    const rayY = ray.y;
    const seq = { n: 1 };
    await driveTo(target, seq, idT, rayX, rayY);
    await shooter.waitState((s) => {
      const t = s.players?.[idT];
      return t !== undefined && Math.abs(t.x - rayX) < 3 && Math.abs(t.y - rayY) < 3;
    });
    // Let the sim loop record a few lag snapshots before firing (so rewind has data).
    await sleep(150);

    // The target stays put on the ray; ts=server-now rewinds to the present.
    // 34 dmg × 3 downs it. Re-read serverTime() each shot so it tracks the frames,
    // and space the shots past the server's fire-rate cooldown.
    for (let i = 0; i < 3; i++) {
      if (i > 0) await sleep(SHOOTER.shotCooldownMs + 20);
      shooter.shoot(ray.dir, seq.n++, shooter.serverTime());
      await shooter.waitMsg((m) => m.t === "s:msg" && m.type === "shot");
    }

    // The target sees itself go down (AOI always includes the viewer's own entity).
    const downed = await target.waitState((s) => s.players?.[idT]?.alive === false, 5000);
    expect(downed.players[idT].alive).toBe(false);
    const scored = await shooter.waitState((s) => (s.players?.[idS]?.score ?? 0) >= 1, 5000);
    expect(scored.players[idS].score).toBeGreaterThanOrEqual(1); // shooter credited the frag

    // After the respawn window (30 ticks × 50 ms = 1.5 s) the target is back at full
    // hp. Read it from the target's OWN state — spread respawn may drop it outside
    // the shooter's view radius.
    const respawned = await target.waitState(
      (s) => s.players?.[idT]?.alive === true && s.players[idT].hp === 100,
      6000,
    );
    expect(respawned.players[idT].alive).toBe(true);
    expect(respawned.players[idT].hp).toBe(100);

    shooter.ws.close();
    target.ws.close();
  }, 25000);

  it("nickname is sanitized and used as the leaderboard display name", async () => {
    const shooter = await stateClient("shooter-room", "nick", ShooterSchema);
    const idS = (await shooter.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    const sp = await posOf(shooter, idS);
    const target = await stateClient("shooter-room", "nick", ShooterSchema);
    const idT = (await target.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    // Wait out the victim's spawn protection or the kill below can't land.
    await target.waitState((s) => s.players?.[idT]?.sp === false, 6000);

    // Surrounding spaces are trimmed and the embedded control char is stripped,
    // so "  Zoe␇Q  " is stored as "ZoeQ".
    shooter.nick("  Zoe" + String.fromCharCode(7) + "Q  ", 1);

    // Down the target on a crate-free lane (same setup as the kill test) so the
    // frag is credited and a leaderboard row is written.
    const seed = (await shooter.waitState((s) => typeof s.seed === "number")).seed as number;
    const ray = clearRay(seed, sp);
    const rayX = ray.x;
    const rayY = ray.y;
    const seq = { n: 2 };
    await driveTo(target, seq, idT, rayX, rayY);
    await shooter.waitState((s) => {
      const t = s.players?.[idT];
      return t !== undefined && Math.abs(t.x - rayX) < 3 && Math.abs(t.y - rayY) < 3;
    });
    await sleep(150);
    for (let i = 0; i < 3; i++) {
      if (i > 0) await sleep(SHOOTER.shotCooldownMs + 20); // clear the fire-rate cooldown
      shooter.shoot(ray.dir, seq.n++, shooter.serverTime());
      await shooter.waitMsg((m) => m.t === "s:msg" && m.type === "shot");
    }
    await target.waitState((s) => s.players?.[idT]?.alive === false, 5000);

    // Leaderboard writes are fire-and-forget to D1 (the "dev" scope in DEV_MODE), so
    // poll until the shooter's row lands, then assert it carries the sanitized nick.
    const db = (env as unknown as Env).DB!;
    let entry: { player_id: string; display_name: string | null } | undefined;
    for (let i = 0; i < 40 && !entry; i++) {
      const rows = await topScores(db, "dev", "shooter-top", 1000);
      entry = rows.find((r) => r.player_id === idS);
      if (!entry) await sleep(50);
    }
    expect(entry).toBeDefined();
    expect(entry!.display_name).toBe("ZoeQ");

    shooter.ws.close();
    target.ws.close();
  }, 25000);
});
