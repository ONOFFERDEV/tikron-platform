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

  it("release frees a seat so the room accepts a new player again", async () => {
    const a = await api("/api/matchmake?type=t-release&mode=&max=2");
    const b = await api("/api/matchmake?type=t-release&mode=&max=2");
    expect(a.roomId).toBe(b.roomId); // room is now full (2/2, locked)

    await api(`/api/release?session=${b.sessionId}`);

    const c = await api("/api/matchmake?type=t-release&mode=&max=2");
    expect(c.roomId).toBe(a.roomId); // seat freed -> same room reused, not a new one
  });
});
