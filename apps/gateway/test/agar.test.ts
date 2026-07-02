import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { decodeFull, applyDelta, type Codec } from "@tikron/schema";
import { AgarSchema } from "../src/rooms/agar-schema.js";

type Frame = Record<string, any>;

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
      state = bytes[0] === 1 ? decodeFull(codec, bytes.subarray(1)) : applyDelta(codec, state, bytes.subarray(1));
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
    send(type: string, payload: unknown, seq: number) {
      ws.send(JSON.stringify({ t: "c:msg", type, seq, payload }));
    },
  };
}

describe("AgarRoom (.io demo: AOI security boundary + gameplay)", () => {
  it("AOI: a distant player never appears in another player's packets", async () => {
    const a = await stateClient("agar-room", "g1", AgarSchema); // player 0 spawns @ (100,100)
    const idA = ((await a.waitMsg((m) => m.t === "s:welcome")).connectionId as string);
    const b = await stateClient("agar-room", "g1", AgarSchema); // player 1 spawns far away
    const idB = ((await b.waitMsg((m) => m.t === "s:welcome")).connectionId as string);

    // Force a fresh frame to A after B has joined, then assert B is filtered out.
    a.send("move", { x: 105, y: 100 }, 1);
    const sa = await a.waitState((s) => s.players?.[idA] !== undefined);
    expect(idA in sa.players).toBe(true);
    expect(idB in sa.players).toBe(false); // B is on the server but outside A's view

    b.send("move", { x: 1005, y: 1017 }, 1);
    const sb = await b.waitState((s) => s.players?.[idB] !== undefined);
    expect(idA in sb.players).toBe(false);

    a.ws.close();
    b.ws.close();
  });

  it("gameplay: moving onto an orb increases score", async () => {
    const a = await stateClient("agar-room", "g2", AgarSchema); // player 0 @ (100,100); orb0 @ (130,100)
    const id = ((await a.waitMsg((m) => m.t === "s:welcome")).connectionId as string);
    await a.waitState((s) => s.players?.[id] !== undefined);

    // Step toward orb0; (118,100) is within the speed budget and the collect radius.
    a.send("move", { x: 118, y: 100 }, 1);
    const scored = await a.waitState((s) => (s.players?.[id]?.score ?? 0) >= 1);
    expect(scored.players[id].score).toBeGreaterThanOrEqual(1);

    a.ws.close();
  });
});
