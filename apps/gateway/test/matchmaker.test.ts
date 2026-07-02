import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

async function api(path: string): Promise<any> {
  const res = await SELF.fetch(`https://example.com${path}`);
  return res.json();
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
