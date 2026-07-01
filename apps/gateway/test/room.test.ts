import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const BASE = "https://example.com/parties/game-room";

interface Inbox {
  next(timeoutMs?: number): Promise<Record<string, unknown>>;
}

/** Buffer inbound frames so awaits never miss a message that arrived earlier. */
function collect(ws: WebSocket): Inbox {
  const queue: Record<string, unknown>[] = [];
  const waiters: ((v: Record<string, unknown>) => void)[] = [];
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data as string) as Record<string, unknown>;
    const waiter = waiters.shift();
    if (waiter) waiter(msg);
    else queue.push(msg);
  });
  return {
    next(timeoutMs = 2000) {
      const queued = queue.shift();
      if (queued) return Promise.resolve(queued);
      return new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout waiting for frame")), timeoutMs);
        waiters.push((v) => {
          clearTimeout(timer);
          resolve(v);
        });
      });
    },
  };
}

async function openRoom(room: string): Promise<{ ws: WebSocket; inbox: Inbox }> {
  const res = await SELF.fetch(`${BASE}/${room}`, { headers: { Upgrade: "websocket" } });
  const ws = res.webSocket;
  if (!ws) throw new Error(`expected a WebSocket upgrade, got HTTP ${res.status}`);
  const inbox = collect(ws);
  ws.accept();
  return { ws, inbox };
}

describe("GameRoom (hello-room)", () => {
  it("greets a new connection with a welcome frame", async () => {
    const { ws, inbox } = await openRoom("welcome");
    const welcome = await inbox.next();
    expect(welcome).toMatchObject({
      t: "s:welcome",
      room: "welcome",
      protocol: 1,
      peers: [],
    });
    expect(typeof welcome.connectionId).toBe("string");
    ws.close();
  });

  it("echoes an echo message back to the sender only", async () => {
    const { ws, inbox } = await openRoom("echo");
    await inbox.next(); // welcome
    ws.send(JSON.stringify({ t: "c:echo", text: "ping" }));
    expect(await inbox.next()).toEqual({ t: "s:echo", text: "ping" });
    ws.close();
  });

  it("relays a broadcast to peers but not back to the sender", async () => {
    const a = await openRoom("bcast");
    await a.inbox.next(); // a welcome

    const b = await openRoom("bcast");
    await b.inbox.next(); // b welcome
    expect(await a.inbox.next()).toMatchObject({ t: "s:peer-joined" }); // a sees b join

    b.ws.send(JSON.stringify({ t: "c:broadcast", text: "hi all" }));
    expect(await a.inbox.next()).toMatchObject({ t: "s:broadcast", text: "hi all" });

    a.ws.close();
    b.ws.close();
  });

  it("returns a protocol error for malformed frames", async () => {
    const { ws, inbox } = await openRoom("bad");
    await inbox.next(); // welcome
    ws.send("{ not json");
    expect(await inbox.next()).toMatchObject({ t: "s:error", code: "bad_message" });
    ws.close();
  });

  it("responds 404 to unknown routes", async () => {
    const res = await SELF.fetch("https://example.com/nope");
    expect(res.status).toBe(404);
  });
});
