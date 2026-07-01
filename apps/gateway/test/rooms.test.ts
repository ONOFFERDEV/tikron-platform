import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

type Frame = Record<string, any>;

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
    next(timeoutMs = 2000) {
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

describe("MovementRoom (.io: Simulation + MovementValidation modules)", () => {
  it("accepts a valid move and snaps back a teleport", async () => {
    const { ws, inbox } = await open("movement-room", "m1");
    const welcome = await waitFor(inbox, (m) => m.t === "s:welcome");
    const id = welcome.connectionId as string;

    // A move within the per-tick speed budget is accepted.
    ws.send(cmsg("move", { x: 5, y: 0 }, 1));
    const s1 = await waitFor(inbox, (m) => m.t === "s:state" && m.state?.players?.[id]?.x === 5);
    expect(s1.state.players[id]).toEqual({ x: 5, y: 0 });

    // A teleport is rejected and the server snaps the player back.
    ws.send(cmsg("move", { x: 999, y: 999 }, 2));
    const rejected = await waitFor(inbox, (m) => m.t === "s:msg" && m.type === "rejected");
    expect(rejected.payload).toEqual({ x: 5, y: 0 });

    ws.close();
  });
});

describe("TicTacToe (turn-based guardrail: genre-agnostic core, no tick)", () => {
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
