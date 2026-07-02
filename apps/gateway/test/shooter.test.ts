import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { decodeFull, applyDelta, type Codec } from "@tikron/schema";
import { ShooterSchema } from "../src/rooms/shooter-schema.js";

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
  };
}

const NORTH = -Math.PI / 2; // aim from (x,1000) toward (x, <1000)

describe("ShooterRoom (FPS demo: subtick lag compensation + hitscan)", () => {
  it("move validation: an over-budget teleport is rejected and snapped back", async () => {
    const a = await stateClient("shooter-room", "mv", ShooterSchema); // player 0 @ (1000,1000)
    const id = (await a.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    await a.waitState((s) => s.players?.[id] !== undefined);

    // A small step within the speed budget is accepted.
    a.move({ x: 1020, y: 1000 }, 1);
    await a.waitState((s) => Math.round(s.players[id].x) >= 1015);

    // A huge jump exceeds maxSpeed×step and is rejected; the server snaps it back.
    a.move({ x: 2000, y: 2000 }, 2);
    const rej = await a.waitMsg((m) => m.t === "s:msg" && m.type === "rejected");
    expect(rej.type).toBe("rejected");
    const after = await a.waitState((s) => s.players?.[id] !== undefined);
    expect(after.players[id].x).toBeLessThan(1100); // nowhere near the requested 2000
    expect(after.players[id].y).toBeLessThan(1100);

    a.ws.close();
  });

  it("hitscan uses lag-comp rewind: a subtick shot hits where the target used to be", async () => {
    const shooter = await stateClient("shooter-room", "lag", ShooterSchema); // player 0 @ (1000,1000)
    const idS = (await shooter.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    const target = await stateClient("shooter-room", "lag", ShooterSchema); // player 1 @ (1000,900)
    const idT = (await target.waitMsg((m) => m.t === "s:welcome")).connectionId as string;

    // Wait until the shooter sees the target at its spawn on the aim ray, then let
    // ~300 ms of on-ray history accumulate in the lag buffer (several ticks). The
    // buffer's retention depth is 250 ms, so its whole span is now "target on ray".
    await shooter.waitState((s) => {
      const t = s.players?.[idT];
      return t !== undefined && Math.round(t.y) === 900 && Math.round(t.x) === 1000;
    });
    await sleep(300);

    // Slide the target off the ray (east), in budget-sized steps, just now.
    target.move({ x: 1025, y: 900 }, 1);
    target.move({ x: 1050, y: 900 }, 2);
    target.move({ x: 1075, y: 900 }, 3);
    target.move({ x: 1085, y: 900 }, 4);
    await shooter.waitState((s) => Math.round(s.players?.[idT]?.x ?? 0) >= 1075);

    // Shoot with a stale subtick ts (~the retention horizon): rewind lands on the
    // target's *earlier* on-ray position, where the shooter aimed → HIT. (A high-RTT
    // client's input carries exactly such a past timestamp.)
    shooter.shoot(NORTH, 1, shooter.serverTime() - 240);
    const hitShot = await shooter.waitMsg((m) => m.t === "s:msg" && m.type === "shot");
    expect(hitShot.payload.from).toBe(idS);
    expect(hitShot.payload.hitId).toBe(idT); // rewind found the target where the shooter aimed

    // The same aim against the *current* world (ts=now, target now off the ray) → MISS.
    shooter.shoot(NORTH, 2, shooter.serverTime());
    const missShot = await shooter.waitMsg((m) => m.t === "s:msg" && m.type === "shot");
    expect(missShot.payload.from).toBe(idS);
    expect(missShot.payload.hitId).toBeUndefined();

    shooter.ws.close();
    target.ws.close();
  }, 15000);

  it("downs a target after enough hits, then respawns it at full hp", async () => {
    const shooter = await stateClient("shooter-room", "kill", ShooterSchema); // player 0 @ (1000,1000)
    const idS = (await shooter.waitMsg((m) => m.t === "s:welcome")).connectionId as string;
    const target = await stateClient("shooter-room", "kill", ShooterSchema); // player 1 @ (1000,900)
    const idT = (await target.waitMsg((m) => m.t === "s:welcome")).connectionId as string;

    await shooter.waitState((s) => s.players?.[idT] !== undefined && Math.round(s.players[idT].y) === 900);
    // Let the sim loop record a few lag snapshots before firing (so rewind has data).
    await sleep(150);

    // The target stays put on the ray; ts=server-now rewinds to the present.
    // 34 dmg × 3 downs it. Re-read serverTime() each shot so it tracks the frames.
    for (let seq = 1; seq <= 3; seq++) {
      shooter.shoot(NORTH, seq, shooter.serverTime());
      await shooter.waitMsg((m) => m.t === "s:msg" && m.type === "shot");
    }

    const downed = await shooter.waitState((s) => s.players?.[idT]?.alive === false, 5000);
    expect(downed.players[idT].alive).toBe(false);
    expect(downed.players[idS].score).toBeGreaterThanOrEqual(1); // shooter credited the frag

    // After the respawn window (30 ticks × 50 ms = 1.5 s) the target is back at full hp.
    const respawned = await shooter.waitState(
      (s) => s.players?.[idT]?.alive === true && s.players[idT].hp === 100,
      6000,
    );
    expect(respawned.players[idT].alive).toBe(true);
    expect(respawned.players[idT].hp).toBe(100);

    shooter.ws.close();
    target.ws.close();
  }, 20000);
});
