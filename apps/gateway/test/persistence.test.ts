import {
  SELF,
  env,
  runInDurableObject,
  runDurableObjectAlarm,
  abortAllDurableObjects,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { decodeFull, applyDelta, type Codec } from "@tikron/schema";
import { AgarSchema } from "../src/rooms/agar-schema.js";
import type { Env } from "../src/index.js";

type Frame = Record<string, any>;
const codec = AgarSchema as Codec<any>;

/** The AgarRoom DO stub for a room name (partyserver derives its id via idFromName). */
function roomStub(roomId: string) {
  const ns = (env as unknown as Env).AgarRoom;
  return ns.get(ns.idFromName(roomId));
}

async function api(path: string): Promise<any> {
  return (await SELF.fetch(`https://example.com${path}`)).json();
}

async function stateClient(room: string, session: string) {
  const res = await SELF.fetch(`https://example.com/parties/agar-room/${room}?_session=${session}`, {
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
      msgNotify.splice(0).forEach((f) => f());
    } else {
      const bytes = new Uint8Array(e.data as ArrayBuffer);
      state = bytes[0] === 1 ? decodeFull(codec, bytes.subarray(1)) : applyDelta(codec, state, bytes.subarray(1));
      stateNotify.splice(0).forEach((f) => f());
    }
  });
  ws.accept();

  const waitOn = (get: () => (() => void)[], set: (v: (() => void)[]) => void, ms: number) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), ms);
      set([...get(), () => { clearTimeout(t); resolve(); }]);
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

/** Read the room's persisted snapshot straight from DO storage. */
function readSnapshot(roomId: string): Promise<any> {
  return runInDurableObject(roomStub(roomId), (_inst, state) => state.storage.get("tk:room"));
}

/** Poll the persisted snapshot until `pred` holds. */
async function waitSnapshot(roomId: string, pred: (snap: any) => boolean, ms = 3000): Promise<any> {
  const deadline = Date.now() + ms;
  for (;;) {
    const snap = await readSnapshot(roomId);
    if (snap && pred(snap)) return snap;
    if (Date.now() > deadline) throw new Error(`timeout; last snapshot: ${JSON.stringify(snap)}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

const seatWithWindow = (session: string) => (snap: any) =>
  snap.seats?.some((s: any) => s.id === session && s.deadline !== null);

// NOTE on the harness: realtime rooms keep a simulation `setInterval` running
// while occupied (a held seat inside a reconnection window still counts), so a
// *graceful* evictDurableObject() never drains — matching production, where such
// a room never idle-evicts. We use abortAllDurableObjects(), a hard teardown
// that resets in-memory state while preserving durable storage, to force the
// cold start the persistence layer is designed to survive.
describe("persist + restore across Durable Object eviction", () => {
  it("restores a seat's score after the room DO is torn down mid-window", async () => {
    const m = await api("/api/matchmake?type=agar-room&mode=&max=8");
    const a = await stateClient(m.roomId, m.sessionId);
    await a.waitMsg((x) => x.t === "s:welcome");

    // Collect an orb so there is a score worth preserving (orb0 sits at 130,100).
    a.send("move", { x: 118, y: 100 }, 1);
    const before = await a.waitState((s) => (s.players?.[m.sessionId]?.score ?? 0) >= 1);
    const score = before.players[m.sessionId].score as number;

    // Drop the transport → onLeave opens + persists a reconnection window; wait
    // for that snapshot to be durable, then hard-reset every DO instance.
    a.ws.close();
    await waitSnapshot(m.roomId, seatWithWindow(m.sessionId));
    await abortAllDurableObjects();

    // Reconnect on a cold-started DO: state is restored from storage, seat reclaimed.
    const b = await stateClient(m.roomId, m.sessionId);
    const welcome = await b.waitMsg((x) => x.t === "s:welcome");
    expect(welcome.reconnected).toBe(true);
    const after = await b.waitState((s) => s.players?.[m.sessionId] !== undefined);
    expect(after.players[m.sessionId].score).toBe(score);
    b.ws.close();
  });

  it("the durable alarm finalizes an expired window after a cold start", async () => {
    const m = await api("/api/matchmake?type=agar-room&mode=&max=8");
    const a = await stateClient(m.roomId, m.sessionId);
    await a.waitMsg((x) => x.t === "s:welcome");

    a.ws.close();
    await waitSnapshot(m.roomId, seatWithWindow(m.sessionId));
    await abortAllDurableObjects();

    // Backdate the persisted window so it reads as elapsed, then fire the alarm
    // on the cold-started DO (the DO alarm survived the teardown).
    await runInDurableObject(roomStub(m.roomId), async (_inst, state) => {
      const snap = (await state.storage.get("tk:room")) as any;
      for (const seat of snap.seats) seat.deadline = Date.now() - 1000;
      await state.storage.put("tk:room", snap);
    });
    const ran = await runDurableObjectAlarm(roomStub(m.roomId));
    expect(ran).toBe(true);

    // The seat was finalized (room emptied), so its durable snapshot is dropped.
    expect(await readSnapshot(m.roomId)).toBeUndefined();
  });
});
