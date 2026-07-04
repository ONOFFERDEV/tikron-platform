import { describe, it, expect } from "vitest";
import { createTestRoom } from "@tikron/server/testing";
import { ArenaRoomImpl } from "./arena-room.js";

/**
 * In-process room tests — no Durable Object, no WebSocket, no network. The
 * harness connects fake clients, sends intents, and lets you assert on the
 * server's authoritative state. `createTestRoom` defaults to "immediate" flush
 * mode, so `await h.flush()` drains the coalesced state update — no fake timers.
 */
describe("ArenaRoom", () => {
  it("moves a player to the clamped cursor target", async () => {
    const h = await createTestRoom(ArenaRoomImpl);
    const alice = await h.connect("alice"); // the session key becomes the client id
    await alice.send("move", { x: 0.3, y: 0.7 });
    await h.flush();
    expect(h.snapshot().players["alice"]).toMatchObject({ x: 0.3, y: 0.7 });
  });

  it("splats at the server-owned position, not a client claim", async () => {
    const h = await createTestRoom(ArenaRoomImpl);
    const alice = await h.connect("alice");
    await alice.send("move", { x: 0.5, y: 0.5 });
    await alice.send("splat"); // no coordinates — the server splats where it says alice is
    await h.flush();
    const s = h.snapshot();
    expect(s.splats).toHaveLength(1);
    expect(s.splats[0]).toMatchObject({ x: 0.5, y: 0.5 });
  });
});
