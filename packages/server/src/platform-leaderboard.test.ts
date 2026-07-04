import { describe, it, expect, vi, afterEach } from "vitest";
import { platformLeaderboard } from "./platform-leaderboard.js";
import type { LeaderboardSubmit } from "./room.js";

/** The shape the host threads into a submitScore hook (projectId is ignored). */
type Entry = { projectId: string | null } & LeaderboardSubmit;
const entry = (over: Partial<Entry> = {}): Entry => ({
  projectId: null,
  board: "weekly",
  playerId: "p1",
  score: 42,
  ...over,
});

/** Let the fire-and-forget response chain settle (microtasks only). */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("platformLeaderboard", () => {
  it("no key → no-op (never fetches)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformLeaderboard({ apiKey: () => undefined });

    hook({}, entry());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("with a key → POSTs the score + Bearer header to the default endpoint", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformLeaderboard({ apiKey: () => "tk_live_abc" });

    hook({}, entry({ board: "top", playerId: "u9", score: 7, displayName: "Nine", mode: "max" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://tikron.dev/api/ingest/score");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tk_live_abc" });
    expect(JSON.parse(init.body as string)).toEqual({
      board: "top",
      playerId: "u9",
      score: 7,
      displayName: "Nine",
      mode: "max",
    });
  });

  it("uses a custom endpoint when given", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformLeaderboard({ apiKey: () => "tk_live_x", endpoint: "https://ex.test/score" });

    hook({}, entry());

    expect(fetchMock.mock.calls[0]![0]).toBe("https://ex.test/score");
  });

  it("swallows a synchronous fetch throw (never breaks the room)", () => {
    const fetchMock = vi.fn(() => {
      throw new Error("fetch unavailable");
    });
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformLeaderboard({ apiKey: () => "tk_live_x" });

    expect(() => hook({}, entry())).not.toThrow();
  });

  it("swallows a fetch rejection", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformLeaderboard({ apiKey: () => "tk_live_x" });

    expect(() => hook({}, entry())).not.toThrow();
    await flush(); // no unhandled rejection
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("warns ONCE on a 4xx response, then stays quiet (one clue, no spam)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformLeaderboard({ apiKey: () => "tk_pub_wrongscope" });

    hook({}, entry());
    hook({}, entry());
    await flush();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("403");
  });

  it("does not warn on a successful (2xx) response", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformLeaderboard({ apiKey: () => "tk_live_ok" });

    hook({}, entry());
    await flush();

    expect(warn).not.toHaveBeenCalled();
  });
});
