import { describe, it, expect, vi, afterEach } from "vitest";
import { iceServersHandler } from "./worker.js";

const STUN_ONLY = { iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] };
const MINTED = [{ urls: "turn:turn.example:3478", username: "u", credential: "c" }];

const get = () => new Request("https://game.example/api/ice");

// Each test uses its own key id: the mint cache is module-scoped (per isolate),
// exactly as it is in a Worker, so a shared id would leak across tests.
describe("iceServersHandler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks every response no-store, credentialed or not", async () => {
    const minting = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ iceServers: MINTED })),
      )) as unknown as typeof fetch;

    const withKey = await iceServersHandler({
      keyId: "k-headers",
      apiToken: "t",
      fetchImpl: minting,
    })(get());
    const withoutKey = await iceServersHandler({})(get());
    const rejected = await iceServersHandler({})(
      new Request("https://game.example/api/ice", { method: "POST" }),
    );

    expect(withKey.headers.get("Cache-Control")).toBe("no-store");
    expect(withoutKey.headers.get("Cache-Control")).toBe("no-store");
    expect(rejected.headers.get("Cache-Control")).toBe("no-store");
  });

  it("never caches a credential past half its own TTL", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetchImpl = (() => {
      calls++;
      return Promise.resolve(new Response(JSON.stringify({ iceServers: MINTED })));
    }) as unknown as typeof fetch;
    const opts = { keyId: "k-ttl", apiToken: "t", ttlSec: 10, cacheMs: 30 * 60 * 1000, fetchImpl };

    await iceServersHandler(opts)(get());
    expect(calls).toBe(1);

    // cacheMs says hold for 30 min; the 10s credential says 5s. The credential wins.
    vi.advanceTimersByTime(6000);
    await iceServersHandler(opts)(get());
    expect(calls).toBe(2);
  });

  it("mints from the TURN key and serves the next request from cache", async () => {
    let calls = 0;
    const fetchImpl = (() => {
      calls++;
      return Promise.resolve(new Response(JSON.stringify({ iceServers: MINTED })));
    }) as unknown as typeof fetch;

    const first = await iceServersHandler({ keyId: "k-mint", apiToken: "t", fetchImpl })(get());
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ iceServers: MINTED });
    expect(calls).toBe(1);

    // The documented recipe builds a fresh handler per request; the cache still holds.
    const second = await iceServersHandler({ keyId: "k-mint", apiToken: "t", fetchImpl })(get());
    expect(await second.json()).toEqual({ iceServers: MINTED });
    expect(calls).toBe(1);
  });

  it("degrades to STUN-only with a 200 when the mint API fails", async () => {
    const fetchImpl = (() =>
      Promise.resolve(new Response("upstream boom", { status: 500 }))) as unknown as typeof fetch;

    const res = await iceServersHandler({ keyId: "k-500", apiToken: "t", fetchImpl })(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(STUN_ONLY);
  });

  it("degrades to STUN-only with a 200 when the mint request throws", async () => {
    const fetchImpl = (() => Promise.reject(new Error("network"))) as unknown as typeof fetch;

    const res = await iceServersHandler({ keyId: "k-throw", apiToken: "t", fetchImpl })(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(STUN_ONLY);
  });

  it("serves STUN-only without calling the mint API when no key is configured", async () => {
    let calls = 0;
    const fetchImpl = (() => {
      calls++;
      return Promise.resolve(new Response("{}"));
    }) as unknown as typeof fetch;

    const res = await iceServersHandler({ fetchImpl })(get());
    expect(await res.json()).toEqual(STUN_ONLY);
    expect(calls).toBe(0);
  });

  it("rejects non-GET requests", async () => {
    const res = await iceServersHandler({})(
      new Request("https://game.example/api/ice", { method: "POST" }),
    );
    expect(res.status).toBe(405);
  });
});
