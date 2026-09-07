import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { decodeFull, applyDelta, type Codec } from "@tikron/schema";
import { FixtureSchema } from "../src/fixture-room.js";
import { topScores } from "../src/platform/db.js";
import type { Env } from "../src/index.js";

type Frame = Record<string, any>;

// --- binary state client (realtime rooms, decodes @tikron/schema frames) ---

async function stateClient(party: string, room: string, codec: Codec<any>) {
  const res = await SELF.fetch(`https://example.com/parties/${party}/${room}`, {
    headers: { Upgrade: "websocket" },
  });
  const ws = res.webSocket;
  if (!ws) throw new Error(`expected a WebSocket upgrade, got HTTP ${res.status}`);

  let state: any;
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
      const tag = bytes[0];
      const body = bytes.subarray(13);
      state = tag === 1 ? decodeFull(codec, body) : applyDelta(codec, state, body);
      const n = stateNotify;
      stateNotify = [];
      n.forEach((f) => f());
    }
  });
  ws.accept();

  const wait = (list: () => (() => void)[], set: (v: (() => void)[]) => void, timeoutMs: number) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      set([...list(), () => {
        clearTimeout(t);
        resolve();
      }]);
    });

  return {
    ws,
    state: () => state,
    async waitMsg(pred: (m: Frame) => boolean, timeoutMs = 3000): Promise<Frame> {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const i = msgs.findIndex(pred);
        if (i >= 0) return msgs.splice(i, 1)[0]!;
        await wait(() => msgNotify, (v) => (msgNotify = v), Math.max(1, deadline - Date.now()));
      }
    },
    async waitState(pred: (s: any) => boolean, timeoutMs = 3000): Promise<any> {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        if (state !== undefined && pred(state)) return state;
        await wait(() => stateNotify, (v) => (stateNotify = v), Math.max(1, deadline - Date.now()));
      }
    },
    send(type: string, payload: unknown, seq: number) {
      ws.send(JSON.stringify({ t: "c:msg", type, seq, payload }));
    },
  };
}

describe("FixtureRoom (Simulation + MovementValidation + binary delta sync)", () => {
  it("streams binary state, accepts a valid move, and snaps back a teleport", async () => {
    const c = await stateClient("fixture-room", "m1", FixtureSchema);
    const welcome = await c.waitMsg((m) => m.t === "s:welcome");
    const id = welcome.connectionId as string;

    // A move within the per-tick speed budget is accepted (decoded from binary).
    c.send("move", { x: 5, y: 0 }, 1);
    const s1 = await c.waitState((s) => s.players?.[id]?.x === 5);
    expect(s1.players[id]).toEqual({ x: 5, y: 0, score: 1 });

    // A teleport is rejected and the server snaps the player back.
    c.send("move", { x: 999, y: 999 }, 2);
    const rejected = await c.waitMsg((m) => m.t === "s:msg" && m.type === "rejected");
    expect(rejected.payload).toEqual({ x: 5, y: 0 });

    c.ws.close();
  });

  // The room-side half of the leaderboard: a room calling services.leaderboard.submit
  // must reach D1 through the gateway's submitScore service wiring (roomOptions in
  // src/index.ts). The HTTP read path is covered separately in leaderboard.test.ts.
  it("writes a server-authoritative score to D1 via the leaderboard service", async () => {
    const c = await stateClient("fixture-room", "lb1", FixtureSchema);
    const id = (await c.waitMsg((m) => m.t === "s:welcome")).connectionId as string;

    c.send("move", { x: 5, y: 0 }, 1);
    await c.waitState((s) => (s.players?.[id]?.score ?? 0) >= 1);

    // Writes are fire-and-forget to D1 (the "dev" scope in DEV_MODE), so poll.
    const db = (env as unknown as Env).DB!;
    let entry: { player_id: string; display_name: string | null; score: number } | undefined;
    for (let i = 0; i < 40 && !entry; i++) {
      const rows = await topScores(db, "dev", "fixture-top", 100);
      entry = rows.find((r) => r.player_id === id);
      if (!entry) await new Promise((r) => setTimeout(r, 50));
    }
    expect(entry).toBeDefined();
    expect(entry!.score).toBe(1);
    expect(entry!.display_name).toBe(id.slice(0, 6));

    c.ws.close();
  });
});
