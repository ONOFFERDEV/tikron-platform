import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { platformReporter } from "./platform-reporter.js";
import type { OccupancyReport } from "./define-room.js";

const report = (over: Partial<OccupancyReport> = {}): OccupancyReport => ({
  roomId: "r1",
  count: 1,
  sessions: [],
  seq: 1,
  ...over,
});

describe("platformReporter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("no key → no-op (never fetches)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformReporter({ apiKey: () => undefined });

    hook({}, report({ count: 5 }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throttles to one POST per 10s per room, except first + count===0", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformReporter({ apiKey: () => "tk_live_key" });

    hook({}, report({ seq: 1, count: 2 })); // first report → send
    expect(fetchMock).toHaveBeenCalledTimes(1);

    hook({}, report({ seq: 2, count: 3 })); // within 10s → throttled
    hook({}, report({ seq: 3, count: 4 })); // still within 10s → throttled
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_000);
    hook({}, report({ seq: 4, count: 5 })); // 10s elapsed → send
    expect(fetchMock).toHaveBeenCalledTimes(2);

    hook({}, report({ seq: 5, count: 0 })); // final leave (count 0) → always send
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("always sends the first report for each distinct room", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformReporter({ apiKey: () => "tk_live_key" });

    hook({}, report({ roomId: "a", seq: 1, count: 1 }));
    hook({}, report({ roomId: "b", seq: 1, count: 1 })); // different room → not throttled
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends the report JSON body + Bearer header to the given endpoint", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformReporter({ apiKey: () => "tk_live_abc", endpoint: "https://ex.test/ingest" });

    hook({}, report({ roomId: "room-9", count: 5, sessions: ["a", "b"], seq: 7, messages: 3 }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://ex.test/ingest");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tk_live_abc" });
    expect(JSON.parse(init.body as string)).toEqual({
      roomId: "room-9",
      count: 5,
      sessions: ["a", "b"],
      seq: 7,
      messages: 3,
    });
  });

  it("defaults the endpoint to the hosted dashboard", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformReporter({ apiKey: () => "tk_live_key" });

    hook({}, report());

    expect(fetchMock.mock.calls[0]![0]).toBe("https://tikron.dev/api/ingest/occupancy");
  });

  it("swallows fetch rejections (reporting never throws)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformReporter({ apiKey: () => "tk_live_key" });

    expect(() => hook({}, report())).not.toThrow();
    await Promise.resolve(); // let the rejected promise settle (no unhandled rejection)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("swallows a synchronous fetch throw", () => {
    const fetchMock = vi.fn(() => {
      throw new Error("fetch unavailable");
    });
    vi.stubGlobal("fetch", fetchMock);
    const hook = platformReporter({ apiKey: () => "tk_live_key" });

    expect(() => hook({}, report())).not.toThrow();
  });
});
