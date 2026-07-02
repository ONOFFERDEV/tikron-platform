import { SELF, env, runInDurableObject } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { Env } from "../src/index.js";

const mm = () => (env as unknown as Env).Matchmaker;

async function api(path: string): Promise<any> {
  const res = await SELF.fetch(`https://example.com${path}`);
  return res.json();
}

/** Minimal WebSocket client that captures JSON frames + the close code. */
async function openWs(party: string, room: string, session?: string) {
  const qs = session ? `?_session=${encodeURIComponent(session)}` : "";
  const res = await SELF.fetch(`https://example.com/parties/${party}/${room}${qs}`, {
    headers: { Upgrade: "websocket" },
  });
  const ws = res.webSocket;
  if (!ws) throw new Error(`expected a WebSocket upgrade, got HTTP ${res.status}`);

  const frames: Record<string, any>[] = [];
  const waiters: (() => void)[] = [];
  let closeCode: number | undefined;

  ws.addEventListener("message", (e) => {
    if (typeof e.data === "string") frames.push(JSON.parse(e.data));
    waiters.splice(0).forEach((f) => f());
  });
  ws.addEventListener("close", (e) => {
    closeCode = e.code;
    waiters.splice(0).forEach((f) => f());
  });
  ws.accept();

  return {
    ws,
    closeCode: () => closeCode,
    async waitFrame(pred: (f: any) => boolean, ms = 3000): Promise<Record<string, any>> {
      const deadline = Date.now() + ms;
      for (;;) {
        const i = frames.findIndex(pred);
        if (i >= 0) return frames.splice(i, 1)[0]!;
        if (Date.now() > deadline) throw new Error("timeout waiting for frame");
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, Math.max(1, deadline - Date.now()));
          waiters.push(() => {
            clearTimeout(t);
            resolve();
          });
        });
      }
    },
  };
}

describe("session validation (matchmaker-issued keys)", () => {
  it("accepts a connection carrying the session the matchmaker issued", async () => {
    const m = await api("/api/matchmake?type=agar-room&mode=&max=8");
    const c = await openWs("agar-room", m.roomId, m.sessionId);
    const welcome = await c.waitFrame((f) => f.t === "s:welcome");
    expect(welcome.connectionId).toBe(m.sessionId);
    c.ws.close();
  });

  it("rejects an unissued session for a matchmaker-managed room", async () => {
    // Reserve so the matchmaker knows the room, then connect with a forged key.
    const m = await api("/api/matchmake?type=agar-room&mode=&max=8");
    const c = await openWs("agar-room", m.roomId, "forged-session-not-issued");
    const err = await c.waitFrame((f) => f.t === "s:error");
    expect(err.code).toBe("invalid_session");
    c.ws.close();
  });

  it("remembers an issued session after its reservation is consumed by a report", async () => {
    const stub = mm().get(mm().idFromName("issued-test"));
    const { roomId, sessionId } = await stub.reserve("t-issued", "", 8);
    expect(await stub.isIssued(roomId, sessionId)).toBe(true);

    // A live report consumes the reservation; the issued session must stay valid
    // so a reconnecting client still passes validation.
    await stub.report(roomId, 1, [sessionId], 1);
    expect(await stub.isIssued(roomId, sessionId)).toBe(true);

    expect(await stub.isIssued(roomId, "never-issued")).toBe(false);
    expect(await stub.isIssued("other-room", sessionId)).toBe(false);
  });

  it("validateSession enforces known rooms but waves through direct-join rooms", async () => {
    const stub = mm().get(mm().idFromName("validate-test"));
    const { roomId, sessionId } = await stub.reserve("t-validate", "", 8);
    expect(await stub.validateSession(roomId, sessionId)).toBe(true); // known + issued
    expect(await stub.validateSession(roomId, "forged")).toBe(false); // known + unissued
    // A room the matchmaker never created (demos/starter self-host their UUIDs).
    expect(await stub.validateSession("unmanaged-room", "anything")).toBe(true);
  });
});

describe("occupancy staleness pruning (phantom rooms)", () => {
  it("prunes a reported room whose heartbeat went stale", async () => {
    const stub = mm().get(mm().idFromName("stale-test"));
    const { roomId } = await stub.reserve("t-stale", "", 8);
    await stub.report(roomId, 1, [], 1); // now a live (reported) room
    expect((await stub.list("t-stale")).some((r) => r.roomId === roomId)).toBe(true);

    // Backdate the last report to simulate three missed 30s heartbeats.
    await runInDurableObject(stub, (inst: any) => {
      inst.rooms.get(roomId).lastReportAt = Date.now() - 91_000;
    });

    // list() prunes first — the phantom room is gone from the lobby.
    expect((await stub.list("t-stale")).some((r) => r.roomId === roomId)).toBe(false);
  });

  it("keeps a reservation-only room even when its (unused) timestamp is old", async () => {
    const stub = mm().get(mm().idFromName("resonly-test"));
    const { roomId } = await stub.reserve("t-resonly", "", 8);
    await runInDurableObject(stub, (inst: any) => {
      inst.rooms.get(roomId).lastReportAt = Date.now() - 91_000;
    });
    // Never reported (reported === null): staleness doesn't apply — the 15s
    // reservation TTL still governs, so the room is still listed.
    expect((await stub.list("t-resonly")).some((r) => r.roomId === roomId)).toBe(true);
  });
});
