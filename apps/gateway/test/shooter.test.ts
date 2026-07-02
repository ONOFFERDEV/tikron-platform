import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { decodeFull, applyDelta, type Codec } from "@tikron/schema";
import { ShooterSchema, SHOOTER } from "../src/rooms/shooter-schema.js";
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
    move(payload: unknown, seq: number) {
      ws.send(JSON.stringify({ t: "c:msg", type: "move", seq, payload }));
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

const NORTH = -Math.PI / 2; // aim toward decreasing y (a target due north of the shooter)

describe("ShooterRoom (FPS demo: subtick lag compensation + hitscan)", () => {
  it("move validation: an over-budget teleport is rejected and snapped back", async () => {
    const a = await stateClient("shooter-room", "mv", ShooterSchema);
    const id = (await a.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    const spawn = await posOf(a, id); // spread spawn: read wherever the room placed us

    // A small step within the speed budget is accepted.
    a.move({ x: spawn.x + 20, y: spawn.y }, 1);
    await a.waitState((s) => s.players[id].x >= spawn.x + 15);

    // A huge jump exceeds maxSpeed×step and is rejected; the server snaps it back.
    a.move({ x: spawn.x + 1500, y: spawn.y + 1500 }, 2);
    const rej = await a.waitMsg((m) => m.t === "s:msg" && m.type === "rejected");
    expect(rej.type).toBe("rejected");
    const after = await a.waitState((s) => s.players?.[id] !== undefined);
    expect(after.players[id].x).toBeLessThan(spawn.x + 100); // nowhere near the requested jump
    expect(after.players[id].y).toBeLessThan(spawn.y + 100);

    a.ws.close();
  });

  it("hitscan uses lag-comp rewind: a subtick shot hits where the target used to be", async () => {
    const shooter = await stateClient("shooter-room", "lag", ShooterSchema);
    const idS = (await shooter.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    const sp = await posOf(shooter, idS); // the shooter stays put at its spawn
    const target = await stateClient("shooter-room", "lag", ShooterSchema);
    const idT = (await target.waitMsg((m) => m.t === "s:welcome")).connectionId as string;

    // Drive the target 100u due north of the shooter — on its NORTH aim ray and well
    // inside shotRange — no matter where spread-spawn dropped it.
    const rayX = sp.x;
    const rayY = sp.y - 100;
    const seq = { n: 1 };
    await driveTo(target, seq, idT, rayX, rayY);

    // Wait until the shooter sees the target settled on the ray, then let ~300 ms of
    // on-ray history accumulate in the lag buffer. Its retention depth is 250 ms, so
    // its whole span is now "target on ray".
    await shooter.waitState((s) => {
      const t = s.players?.[idT];
      return t !== undefined && Math.abs(t.x - rayX) < 3 && Math.abs(t.y - rayY) < 3;
    });
    await sleep(300);

    // Slide the target off the ray (east), in budget-sized steps, just now.
    target.move({ x: rayX + 25, y: rayY }, seq.n++);
    target.move({ x: rayX + 50, y: rayY }, seq.n++);
    target.move({ x: rayX + 75, y: rayY }, seq.n++);
    target.move({ x: rayX + 85, y: rayY }, seq.n++);
    await shooter.waitState((s) => (s.players?.[idT]?.x ?? 0) >= rayX + 75);

    // Shoot with a stale subtick ts (~the retention horizon): rewind lands on the
    // target's *earlier* on-ray position, where the shooter aimed → HIT. (A high-RTT
    // client's input carries exactly such a past timestamp.)
    shooter.shoot(NORTH, seq.n++, shooter.serverTime() - 240);
    const hitShot = await shooter.waitMsg((m) => m.t === "s:msg" && m.type === "shot");
    expect(hitShot.payload.from).toBe(idS);
    expect(hitShot.payload.hitId).toBe(idT); // rewind found the target where the shooter aimed

    // The same aim against the *current* world (ts=now, target now off the ray) → MISS.
    shooter.shoot(NORTH, seq.n++, shooter.serverTime());
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

    // Put the target on the shooter's NORTH ray, 100u out (inside shotRange).
    const rayX = sp.x;
    const rayY = sp.y - 100;
    const seq = { n: 1 };
    await driveTo(target, seq, idT, rayX, rayY);
    await shooter.waitState((s) => {
      const t = s.players?.[idT];
      return t !== undefined && Math.abs(t.x - rayX) < 3 && Math.abs(t.y - rayY) < 3;
    });
    // Let the sim loop record a few lag snapshots before firing (so rewind has data).
    await sleep(150);

    // The target stays put on the ray; ts=server-now rewinds to the present.
    // 34 dmg × 3 downs it. Re-read serverTime() each shot so it tracks the frames.
    for (let i = 0; i < 3; i++) {
      shooter.shoot(NORTH, seq.n++, shooter.serverTime());
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

    // Surrounding spaces are trimmed and the embedded control char is stripped,
    // so "  Zoe␇Q  " is stored as "ZoeQ".
    shooter.nick("  Zoe" + String.fromCharCode(7) + "Q  ", 1);

    // Down the target on the shooter's ray (same setup as the kill test) so the
    // frag is credited and a leaderboard row is written.
    const rayX = sp.x;
    const rayY = sp.y - 100;
    const seq = { n: 2 };
    await driveTo(target, seq, idT, rayX, rayY);
    await shooter.waitState((s) => {
      const t = s.players?.[idT];
      return t !== undefined && Math.abs(t.x - rayX) < 3 && Math.abs(t.y - rayY) < 3;
    });
    await sleep(150);
    for (let i = 0; i < 3; i++) {
      shooter.shoot(NORTH, seq.n++, shooter.serverTime());
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
