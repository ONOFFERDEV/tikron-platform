import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { decodeFull, applyDelta, type Codec } from "@playedge/schema";
import { MovementSchema } from "../src/rooms/movement-room.js";

type Frame = Record<string, any>;

// --- JSON client (turn-based rooms) ---

interface Inbox {
  next(timeoutMs?: number): Promise<Frame>;
}

function collect(ws: WebSocket): Inbox {
  const queue: Frame[] = [];
  const waiters: ((v: Frame) => void)[] = [];
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data as string) as Frame;
    const waiter = waiters.shift();
    if (waiter) waiter(msg);
    else queue.push(msg);
  });
  return {
    next(timeoutMs = 3000) {
      const queued = queue.shift();
      if (queued) return Promise.resolve(queued);
      return new Promise<Frame>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout waiting for frame")), timeoutMs);
        waiters.push((v) => {
          clearTimeout(timer);
          resolve(v);
        });
      });
    },
  };
}

async function open(party: string, room: string): Promise<{ ws: WebSocket; inbox: Inbox }> {
  const res = await SELF.fetch(`https://example.com/parties/${party}/${room}`, {
    headers: { Upgrade: "websocket" },
  });
  const ws = res.webSocket;
  if (!ws) throw new Error(`expected a WebSocket upgrade, got HTTP ${res.status}`);
  const inbox = collect(ws);
  ws.accept();
  return { ws, inbox };
}

async function waitFor(
  inbox: Inbox,
  predicate: (m: Frame) => boolean,
  timeoutMs = 3000,
): Promise<Frame> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const m = await inbox.next(Math.max(1, deadline - Date.now()));
    if (predicate(m)) return m;
  }
}

function cmsg(type: string, payload: unknown, seq: number): string {
  return JSON.stringify({ t: "c:msg", type, seq, payload });
}

// --- binary state client (realtime rooms, decodes @playedge/schema frames) ---

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
      const body = bytes.subarray(1);
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
      ws.send(cmsg(type, payload, seq));
    },
  };
}

describe("MovementRoom (.io: Simulation + MovementValidation + binary delta sync)", () => {
  it("streams binary state, accepts a valid move, and snaps back a teleport", async () => {
    const c = await stateClient("movement-room", "m1", MovementSchema);
    const welcome = await c.waitMsg((m) => m.t === "s:welcome");
    const id = welcome.connectionId as string;

    // A move within the per-tick speed budget is accepted (decoded from binary).
    c.send("move", { x: 5, y: 0 }, 1);
    const s1 = await c.waitState((s) => s.players?.[id]?.x === 5);
    expect(s1.players[id]).toEqual({ x: 5, y: 0 });

    // A teleport is rejected and the server snaps the player back.
    c.send("move", { x: 999, y: 999 }, 2);
    const rejected = await c.waitMsg((m) => m.t === "s:msg" && m.type === "rejected");
    expect(rejected.payload).toEqual({ x: 5, y: 0 });

    c.ws.close();
  });
});

describe("TicTacToe (turn-based guardrail: genre-agnostic core, no tick, JSON state)", () => {
  it("enforces turn order, rejects illegal moves, and detects a win via mutation sync", async () => {
    const a = await open("tic-tac-toe", "t1"); // seat X (first joiner)
    await waitFor(a.inbox, (m) => m.t === "s:welcome");
    const b = await open("tic-tac-toe", "t1"); // seat O
    await waitFor(b.inbox, (m) => m.t === "s:welcome");

    // O tries to move on X's turn -> illegal.
    b.ws.send(cmsg("place", { cell: 0 }, 1));
    const illegal = await waitFor(b.inbox, (m) => m.t === "s:msg" && m.type === "illegal");
    expect(illegal.payload.reason).toBe("not_your_turn");

    // X takes the top row (0,1,2); O plays 3,4.
    a.ws.send(cmsg("place", { cell: 0 }, 1));
    await waitFor(a.inbox, (m) => m.t === "s:state" && m.state.board[0] === "X");
    b.ws.send(cmsg("place", { cell: 3 }, 2));
    await waitFor(b.inbox, (m) => m.t === "s:state" && m.state.board[3] === "O");
    a.ws.send(cmsg("place", { cell: 1 }, 2));
    await waitFor(a.inbox, (m) => m.t === "s:state" && m.state.board[1] === "X");
    b.ws.send(cmsg("place", { cell: 4 }, 3));
    await waitFor(b.inbox, (m) => m.t === "s:state" && m.state.board[4] === "O");
    a.ws.send(cmsg("place", { cell: 2 }, 3));

    const over = await waitFor(a.inbox, (m) => m.t === "s:msg" && m.type === "gameOver");
    expect(over.payload.winner).toBe("X");

    a.ws.close();
    b.ws.close();
  });
});
