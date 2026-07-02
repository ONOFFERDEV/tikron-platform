import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

/** Open a WebSocket to a room via the worker (DEV_MODE bypasses key enforcement). */
async function connect(party: string, room: string): Promise<WebSocket> {
  const res = await SELF.fetch(
    `https://example.com/parties/${party}/${room}?_session=s-${crypto.randomUUID()}`,
    { headers: { Upgrade: "websocket" } },
  );
  const ws = res.webSocket;
  if (!ws) throw new Error(`expected a WebSocket upgrade, got HTTP ${res.status}`);
  ws.accept();
  return ws;
}

describe("time synchronization wire format (workerd)", () => {
  it("binary state frames carry a 13-byte tick/serverTime header", async () => {
    const ws = await connect("agar-room", `ts-${crypto.randomUUID()}`);
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no binary state frame")), 5000);
      ws.addEventListener("message", (e) => {
        if (typeof e.data !== "string") {
          clearTimeout(timer);
          resolve(new Uint8Array(e.data as ArrayBuffer));
        }
      });
    });

    expect(bytes.length).toBeGreaterThanOrEqual(13);
    const tag = bytes[0];
    expect(tag === 0x01 || tag === 0x02).toBe(true); // full or delta
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tick = view.getUint32(1, true);
    const serverTime = view.getFloat64(5, true);
    expect(Number.isInteger(tick)).toBe(true);
    expect(tick).toBeGreaterThanOrEqual(0);
    expect(serverTime).toBeGreaterThan(1_700_000_000_000); // a plausible epoch-ms clock
    ws.close();
  });

  it("answers a c:time ping with s:time echoing t0 plus the server time", async () => {
    const ws = await connect("agar-room", `ts-${crypto.randomUUID()}`);
    const reply = await new Promise<{ t: string; t0: number; serverTime: number }>(
      (resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("no s:time reply")), 5000);
        ws.addEventListener("message", (e) => {
          if (typeof e.data !== "string") return;
          const msg = JSON.parse(e.data) as { t: string; t0: number; serverTime: number };
          if (msg.t === "s:time") {
            clearTimeout(timer);
            resolve(msg);
          }
        });
        ws.send(JSON.stringify({ t: "c:time", t0: 4242 }));
      },
    );

    expect(reply.t0).toBe(4242);
    expect(typeof reply.serverTime).toBe("number");
    expect(reply.serverTime).toBeGreaterThan(1_700_000_000_000);
    ws.close();
  });
});
