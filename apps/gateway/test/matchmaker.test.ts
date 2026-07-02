import { SELF, env, runInDurableObject, abortAllDurableObjects } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { Env } from "../src/index.js";

async function api(path: string): Promise<any> {
  const res = await SELF.fetch(`https://example.com${path}`);
  return res.json();
}

/** The single well-known Matchmaker DO stub (mirrors `matchmaker()` in index.ts). */
function mmStub() {
  const ns = (env as unknown as Env).Matchmaker;
  return ns.get(ns.idFromName("global"));
}

describe("Matchmaker REST", () => {
  it("joinOrCreate: fills a room by (type, mode), then creates a new one when full", async () => {
    const a = await api("/api/matchmake?type=t-fill&mode=duo&max=2");
    const b = await api("/api/matchmake?type=t-fill&mode=duo&max=2");
    expect(a.roomId).toBe(b.roomId); // both fit the same room (2 seats)
    expect(a.sessionId).not.toBe(b.sessionId);

    const c = await api("/api/matchmake?type=t-fill&mode=duo&max=2");
    expect(c.roomId).not.toBe(a.roomId); // first room is full -> new room

    const rooms = await api("/api/rooms?type=t-fill");
    const first = rooms.find((r: any) => r.roomId === a.roomId);
    expect(first.count).toBe(2);
    expect(first.locked).toBe(true);
  });

  it("filterBy: different modes never share a room", async () => {
    const solo = await api("/api/matchmake?type=t-filter&mode=solo&max=8");
    const team = await api("/api/matchmake?type=t-filter&mode=team&max=8");
    expect(solo.roomId).not.toBe(team.roomId);
  });

  it("shooter mid-join: 64 players fill one room, the 65th opens a new one", async () => {
    // The 64-player FPS demo connects with type=shooter-room&max=64. reserve() must
    // pack players into the same room until it is full (mid-join is the whole point),
    // then spill to a fresh room — proving max=64 flows through to the room cap.
    const first = await api("/api/matchmake?type=shooter-room&max=64");
    for (let i = 1; i < 64; i++) {
      const next = await api("/api/matchmake?type=shooter-room&max=64");
      expect(next.roomId).toBe(first.roomId); // still space -> same room (mid-join)
    }
    const full = await api("/api/rooms?type=shooter-room");
    const room = full.find((r: any) => r.roomId === first.roomId);
    expect(room.count).toBe(64);
    expect(room.maxClients).toBe(64);
    expect(room.locked).toBe(true);

    const overflow = await api("/api/matchmake?type=shooter-room&max=64");
    expect(overflow.roomId).not.toBe(first.roomId); // room full -> new room
  });

  it("release frees a seat so the room accepts a new player again", async () => {
    const a = await api("/api/matchmake?type=t-release&mode=&max=2");
    const b = await api("/api/matchmake?type=t-release&mode=&max=2");
    expect(a.roomId).toBe(b.roomId); // room is now full (2/2, locked)

    await api(`/api/release?session=${b.sessionId}`);

    const c = await api("/api/matchmake?type=t-release&mode=&max=2");
    expect(c.roomId).toBe(a.roomId); // seat freed -> same room reused, not a new one
  });
});

// The DO's ledger (rooms/reservations/issued) is in-memory; without persistence it
// evaporates on idle eviction, so a room created for one player is gone before the
// next arrives — every user lands in a fresh room. These drive the RPC surface
// directly, then hard-reset every DO instance with abortAllDurableObjects() (resets
// in-memory state, preserves durable storage) to force the cold start the
// persistence layer must survive. See persistence.test.ts for the same pattern.
describe("Matchmaker persistence across Durable Object eviction", () => {
  it("reuses a live room after eviction instead of spinning up a new one", async () => {
    const stub = mmStub();
    const r1 = await runInDurableObject(stub, (mm) => mm.reserve("t-evict", "", 4));
    // Room goes live: the report consumes the reservation and sets reported=1.
    await runInDurableObject(stub, (mm) => mm.report(r1.roomId, 1, [r1.sessionId], 1));
    // The ledger entry must be durable before the hard teardown.
    await runInDurableObject(stub, (_mm, state) =>
      expect(state.storage.get(`r:${r1.roomId}`)).resolves.toBeTruthy(),
    );
    await abortAllDurableObjects();

    // Cold start rehydrates the ledger, so the next player joins the same room.
    const r2 = await runInDurableObject(mmStub(), (mm) => mm.reserve("t-evict", "", 4));
    expect(r2.roomId).toBe(r1.roomId);
  });

  it("keeps a pending (not-yet-connected) reservation's room across eviction", async () => {
    const stub = mmStub();
    const r1 = await runInDurableObject(stub, (mm) => mm.reserve("t-evict-res", "", 4));
    await runInDurableObject(stub, (_mm, state) =>
      expect(state.storage.get(`v:${r1.sessionId}`)).resolves.toBeTruthy(),
    );
    await abortAllDurableObjects();

    const r2 = await runInDurableObject(mmStub(), (mm) => mm.reserve("t-evict-res", "", 4));
    expect(r2.roomId).toBe(r1.roomId); // held seat survived -> same room, not a new one
  });

  it("still validates an issued session after eviction", async () => {
    const stub = mmStub();
    const r1 = await runInDurableObject(stub, (mm) => mm.reserve("t-evict-iss", "", 4));
    await runInDurableObject(stub, (_mm, state) =>
      expect(state.storage.get(`i:${r1.sessionId}`)).resolves.toBeTruthy(),
    );
    await abortAllDurableObjects();

    const ok = await runInDurableObject(mmStub(), (mm) => mm.isIssued(r1.roomId, r1.sessionId));
    expect(ok).toBe(true);
  });
});
