import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { decodeFull, applyDelta, type Codec } from "@tikron/schema";
import { AgarSchema } from "../src/rooms/agar-schema.js";
import { MovementSchema } from "../src/rooms/movement-room.js";

type Frame = Record<string, any>;

async function stateClient(party: string, room: string, codec: Codec<any>, session?: string) {
  const qs = session ? `?_session=${session}` : "";
  const res = await SELF.fetch(`https://example.com/parties/${party}/${room}${qs}`, {
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

async function api(path: string): Promise<any> {
  const res = await SELF.fetch(`https://example.com${path}`);
  return res.json();
}

async function pollRooms(type: string, pred: (rooms: any[]) => boolean, ms = 3000): Promise<any[]> {
  const deadline = Date.now() + ms;
  for (;;) {
    const rooms = (await api(`/api/rooms?type=${type}`)) as any[];
    if (pred(rooms)) return rooms;
    if (Date.now() > deadline) throw new Error(`timeout; last: ${JSON.stringify(rooms)}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe("state-preserving reconnection (session-keyed seats)", () => {
  it("a session-keyed client keeps id, score, and position across a reconnect", async () => {
    const a = await stateClient("agar-room", "rc1", AgarSchema, "sess-alpha");
    const welcome = await a.waitMsg((m) => m.t === "s:welcome");
    expect(welcome.connectionId).toBe("sess-alpha"); // session key, not conn id

    // Score once so there is state worth preserving (orb0 sits at (130,100)).
    a.send("move", { x: 118, y: 100 }, 1);
    const before = await a.waitState((s) => (s.players?.["sess-alpha"]?.score ?? 0) >= 1);
    const score = before.players["sess-alpha"].score as number;

    a.ws.close();

    // Reconnect with the same session key on a brand-new transport.
    const b = await stateClient("agar-room", "rc1", AgarSchema, "sess-alpha");
    const wb = await b.waitMsg((m) => m.t === "s:welcome");
    expect(wb.connectionId).toBe("sess-alpha");
    expect(wb.reconnected).toBe(true);

    // Full snapshot arrives with the seat's preserved score; inputs still work
    // (seq restarted at 1 — the replay floor was reset on reattach).
    const after = await b.waitState((s) => s.players?.["sess-alpha"] !== undefined);
    expect(after.players["sess-alpha"].score).toBe(score);
    b.send("move", { x: 118, y: 115 }, 1);
    await b.waitState((s) => (s.players?.["sess-alpha"]?.y ?? 0) > 100);

    b.ws.close();
  });

  it("a duplicate session connection takes over the seat without a rejoin", async () => {
    const a = await stateClient("agar-room", "rc2", AgarSchema, "sess-dup");
    await a.waitMsg((m) => m.t === "s:welcome");

    const b = await stateClient("agar-room", "rc2", AgarSchema, "sess-dup"); // a still open
    const wb = await b.waitMsg((m) => m.t === "s:welcome");
    expect(wb.reconnected).toBe(true);
    expect(wb.peers).toEqual([]); // one seat, not two

    b.ws.close();
    a.ws.close();
  });
});

describe("live room-count reporting (rooms -> matchmaker)", () => {
  it("consumes the reservation on connect: no double-count, then live count", async () => {
    const m = await api("/api/matchmake?type=agar-room&mode=live&max=8");

    // Before connecting, the pending reservation holds the seat.
    let rooms = await pollRooms("agar-room", (r) => r.some((x) => x.roomId === m.roomId));
    expect(rooms.find((x) => x.roomId === m.roomId).count).toBe(1);

    const c = await stateClient("agar-room", m.roomId, AgarSchema, m.sessionId);
    await c.waitMsg((x) => x.t === "s:welcome");

    // After connecting, the live report replaces the reservation — still 1, not 2.
    rooms = await pollRooms("agar-room", (r) =>
      r.some((x) => x.roomId === m.roomId && x.count === 1),
    );
    expect(rooms.find((x) => x.roomId === m.roomId).count).toBe(1);

    c.ws.close();
  });

  it("drops the room from the lobby when its last player leaves (no TTL wait)", async () => {
    const m = await api("/api/matchmake?type=movement-room&mode=live&max=8");
    const c = await stateClient("movement-room", m.roomId, MovementSchema, m.sessionId);
    await c.waitMsg((x) => x.t === "s:welcome");
    await pollRooms("movement-room", (r) => r.some((x) => x.roomId === m.roomId && x.count === 1));

    // MovementRoom has no reconnection window: closing finalizes immediately and
    // the room reports 0 — the lobby entry disappears well before the 15s TTL.
    c.ws.close();
    await pollRooms("movement-room", (r) => !r.some((x) => x.roomId === m.roomId));
  });
});
