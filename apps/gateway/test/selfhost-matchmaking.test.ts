import { SELF, env, runInDurableObject, abortAllDurableObjects } from "cloudflare:test";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Env } from "../src/index.js";
import { handleApi } from "../src/index.js";
import type { Matchmaker } from "../src/matchmaker.js";
import { _clearKeyCache } from "../src/platform/apikeys.js";
// The party-name + origin parser lives in @tikron/server's define-room, which
// transitively imports `cloudflare:workers` — unloadable in that package's
// node-based vitest run. It is imported from source here, where the tests DO run
// in the Workers runtime.
import { originFrom } from "../../../packages/server/src/define-room.js";

const ORIGIN = "https://example.com";
const INGEST = `${ORIGIN}/api/ingest/occupancy`;
const BASE_URL = "https://my-game.example.workers.dev";

const testEnv = () => env as unknown as Env;

function mmStub(): DurableObjectStub<Matchmaker> {
  const ns = testEnv().Matchmaker;
  return ns.get(ns.idFromName("global"));
}

/** An env with API-key enforcement ON (no DEV_MODE), so `?apiKey=` really resolves. */
const enforcedEnv = (): Env =>
  ({ DB: testEnv().DB, Matchmaker: testEnv().Matchmaker }) as Env;

/** `GET /api/matchmake` as a browser on the customer's domain would call it. */
async function matchmake(query: string): Promise<{ status: number; body: any; cors: string | null }> {
  const url = new URL(`${ORIGIN}/api/matchmake?${query}`);
  const res = await handleApi(new Request(url), url, enforcedEnv());
  return {
    status: res.status,
    body: await res.json(),
    cors: res.headers.get("Access-Control-Allow-Origin"),
  };
}

async function devLogin(login: string): Promise<string> {
  const res = await SELF.fetch(`${ORIGIN}/api/platform/auth/dev`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login }),
  });
  const setCookie = res.headers.get("Set-Cookie");
  if (!setCookie) throw new Error("no session cookie");
  return setCookie.split(";")[0]!;
}

/** A project with both key scopes: `tk_live_` reports usage, `tk_pub_` matchmakes. */
async function project(name: string): Promise<{ id: string; live: string; pub: string }> {
  const cookie = await devLogin(`owner-${name}`);
  const api = (path: string, init: RequestInit = {}) =>
    SELF.fetch(`${ORIGIN}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Cookie: cookie, ...(init.headers ?? {}) },
    });
  const created: any = await (
    await api("/api/platform/projects", { method: "POST", body: JSON.stringify({ name }) })
  ).json();
  const key = async (scope?: string) =>
    (
      (await (
        await api(`/api/platform/projects/${created.id}/keys`, {
          method: "POST",
          ...(scope ? { body: JSON.stringify({ scope }) } : {}),
        })
      ).json()) as any
    ).key as string;
  return { id: created.id as string, live: await key("secret"), pub: await key() };
}

/** POST an occupancy report exactly as `platformReporter` would. */
function ingest(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  return SELF.fetch(INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
}

const fullReport = (over: Record<string, unknown> = {}) => ({
  roomId: "lobby-1",
  count: 1,
  sessions: ["p1"],
  seq: 1,
  messages: 0,
  type: "arena-room",
  maxClients: 2,
  baseUrl: BASE_URL,
  ...over,
});

beforeEach(() => _clearKeyCache());

describe("self-hosted matchmaking (F3)", () => {
  it("a report carrying type + maxClients + baseUrl becomes a matchmakable room", async () => {
    const p = await project("selfhost-a");
    expect((await ingest(p.live, fullReport())).status).toBe(204);

    const m = await matchmake(`type=arena-room&mode=&max=2&apiKey=${p.pub}`);
    expect(m.status).toBe(200);
    // The customer's own room id, with the `ext:{project}:` namespacing stripped.
    expect(m.body.roomId).toBe("lobby-1");
    expect(m.body.roomUrl).toBe(BASE_URL);

    // The seat is a real hold on the namespaced entry (what `report` consumes).
    await runInDurableObject(mmStub(), async (_mm, state) => {
      expect(await state.storage.get(`v:${m.body.sessionId}`)).toMatchObject({
        roomId: `ext:${p.id}:lobby-1`,
      });
    });
  });

  it("mints a NEW room id on the same origin once the registered room is full", async () => {
    const p = await project("selfhost-b");
    await ingest(p.live, fullReport()); // 1 of 2 seats live

    const first = await matchmake(`type=arena-room&mode=&max=2&apiKey=${p.pub}`);
    expect(first.body.roomId).toBe("lobby-1"); // takes the last seat (1 live + 1 held = 2)

    const second = await matchmake(`type=arena-room&mode=&max=2&apiKey=${p.pub}`);
    expect(second.body.roomId).not.toBe("lobby-1"); // full -> a brand-new room
    expect(second.body.roomUrl).toBe(BASE_URL); // ...on the customer's worker
    expect(second.body.roomId).not.toContain("ext:");
    // The minted room is namespaced internally, so it can't collide across projects.
    await runInDurableObject(mmStub(), async (_mm, state) => {
      expect(await state.storage.get(`r:ext:${p.id}:${second.body.roomId}`)).toBeTruthy();
    });
  });

  it("a later report listing the reserved session consumes its hold", async () => {
    const p = await project("selfhost-c");
    await ingest(p.live, fullReport());
    const m = await matchmake(`type=arena-room&mode=&max=2&apiKey=${p.pub}`);

    // The player connected: the room now reports both seats, one of them ours.
    await ingest(p.live, fullReport({ count: 2, sessions: ["p1", m.body.sessionId], seq: 2 }));

    await runInDurableObject(mmStub(), async (_mm, state) => {
      expect(await state.storage.get(`v:${m.body.sessionId}`)).toBeUndefined();
      expect(await state.storage.get(`r:ext:${p.id}:lobby-1`)).toMatchObject({ reported: 2 });
    });
  });

  it("a report WITHOUT the registration fields registers nothing (metering only)", async () => {
    const p = await project("selfhost-d");
    expect(
      (await ingest(p.live, { roomId: "lobby-1", count: 1, sessions: ["p1"], seq: 1 })).status,
    ).toBe(204);

    await runInDurableObject(mmStub(), async (_mm, state) => {
      expect(await state.storage.get(`r:ext:${p.id}:lobby-1`)).toBeUndefined();
      expect(await state.storage.get(`p:${p.id}`)).toBeUndefined();
    });
    // ...so matchmaking still hands out a GATEWAY room (no roomUrl).
    const m = await matchmake(`type=arena-room&mode=&max=2&apiKey=${p.pub}`);
    expect(m.body.roomUrl).toBeUndefined();
    expect(m.body.roomId).not.toBe("lobby-1");
  });

  it("ignores garbage registration fields instead of failing the report", async () => {
    const p = await project("selfhost-e");
    expect(
      (
        await ingest(
          p.live,
          fullReport({ baseUrl: "http://insecure.example.com", maxClients: 0, type: "x".repeat(65) }),
        )
      ).status,
    ).toBe(204); // still 204: usage metering must not break on a bad field

    await runInDurableObject(mmStub(), async (_mm, state) => {
      expect(await state.storage.get(`r:ext:${p.id}:lobby-1`)).toBeUndefined();
    });
  });

  it("never lists self-hosted rooms in the public lobby", async () => {
    const p = await project("selfhost-f");
    await ingest(p.live, fullReport());
    await matchmake(`type=arena-room&mode=&max=2&apiKey=${p.pub}`);

    const rooms: any[] = await (await SELF.fetch(`${ORIGIN}/api/rooms`)).json();
    expect(rooms.some((r) => r.roomId.startsWith("ext:"))).toBe(false);
    expect(rooms.some((r) => r.roomId === "lobby-1")).toBe(false);
  });

  it("answers the browser preflight and stamps CORS on matchmake + release", async () => {
    for (const path of ["/api/matchmake", "/api/release"]) {
      const url = new URL(`${ORIGIN}${path}`);
      const res = await handleApi(
        new Request(url, { method: "OPTIONS" }),
        url,
        enforcedEnv(),
      );
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    }
    const p = await project("selfhost-g");
    const m = await matchmake(`type=arena-room&mode=&max=2&apiKey=${p.pub}`);
    expect(m.cors).toBe("*"); // the real response is readable cross-origin too
  });

  it("refuses a gateway connect that impersonates a self-hosted room key", async () => {
    const victim = await project("selfhost-shadow");
    await ingest(victim.live, fullReport({ seq: 7 }));
    const key = `ext:${victim.id}:lobby-1`;

    // Raw and percent-encoded: the router decodes the segment, so the guard must too.
    for (const name of [key, encodeURIComponent(key)]) {
      const res = await SELF.fetch(`${ORIGIN}/parties/agar-room/${name}`, {
        headers: { Upgrade: "websocket" },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_room" });
    }

    // The victim's registry entry is exactly as its own room left it — a hosted
    // room reporting here would have pushed reportSeq past 7, silently dropping
    // every real report that followed.
    await runInDurableObject(mmStub(), async (_mm, state) => {
      expect(await state.storage.get(`r:${key}`)).toMatchObject({ reportSeq: 7, reported: 1 });
    });
  });

  it("keeps one project's origin and rooms out of another's", async () => {
    const a = await project("selfhost-iso-a");
    await ingest(a.live, fullReport());
    const b = await project("selfhost-iso-b");
    await ingest(b.live, fullReport({ baseUrl: "https://other-game.example.workers.dev" }));

    await runInDurableObject(mmStub(), async (_mm, state) => {
      expect(await state.storage.get(`p:${a.id}`)).toBe(BASE_URL);
      expect(await state.storage.get(`p:${b.id}`)).toBe("https://other-game.example.workers.dev");
      expect(await state.storage.get(`r:ext:${b.id}:lobby-1`)).toBeTruthy();
    });
    // Same room id, different projects: A still matches its OWN room and origin.
    const m = await matchmake(`type=arena-room&mode=&max=2&apiKey=${a.pub}`);
    expect(m.body.roomUrl).toBe(BASE_URL);
  });

  it("stops minting rooms on an origin whose last room went silent", async () => {
    const p = await project("selfhost-retired");
    await ingest(p.live, fullReport());
    await runInDurableObject(mmStub(), async (_mm, state) => {
      expect(await state.storage.get(`p:${p.id}`)).toBe(BASE_URL);
    });

    // Past STALE_MS (90s) with no further report: the deployment is gone.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 120_000);
      const m = await matchmake(`type=arena-room&mode=&max=2&apiKey=${p.pub}`);
      // Pruned, so no ext room to join AND no origin to mint a new one on.
      expect(m.body.roomUrl).toBeUndefined();
      expect(m.body.roomId).not.toBe("lobby-1");
    } finally {
      vi.useRealTimers();
    }
    await runInDurableObject(mmStub(), async (_mm, state) => {
      expect(await state.storage.get(`p:${p.id}`)).toBeUndefined();
      expect(await state.storage.get(`r:ext:${p.id}:lobby-1`)).toBeUndefined();
    });
  });

  it("survives Durable Object eviction: ext rooms and the project's base URL persist", async () => {
    const p = await project("selfhost-h");
    await ingest(p.live, fullReport({ maxClients: 4 }));
    await runInDurableObject(mmStub(), async (_mm, state) => {
      expect(await state.storage.get(`p:${p.id}`)).toBe(BASE_URL);
      expect(await state.storage.get(`r:ext:${p.id}:lobby-1`)).toBeTruthy();
    });
    await abortAllDurableObjects();

    // Cold start: the registered room is still matchable...
    const m = await matchmake(`type=arena-room&mode=&max=4&apiKey=${p.pub}`);
    expect(m.body.roomId).toBe("lobby-1");
    expect(m.body.roomUrl).toBe(BASE_URL);
    // ...and a party too big for it still lands on the customer's worker, which
    // only works if the rehydrated `p:` entry was read back.
    const party = await matchmake(`type=arena-room&mode=&max=4&party=4&apiKey=${p.pub}`);
    expect(party.body.roomId).not.toBe("lobby-1");
    expect(party.body.roomUrl).toBe(BASE_URL);
    expect(party.body.sessionIds).toHaveLength(4);
  });
});

describe("originFrom (what a self-hosted room captures on its first connect)", () => {
  const ctx = (url: string) => ({ request: new Request(url) }) as never;

  it("reads the party name and public origin out of a room URL", () => {
    expect(originFrom(ctx(`${BASE_URL}/parties/arena-room/lobby?_session=x`))).toEqual({
      type: "arena-room",
      baseUrl: BASE_URL,
    });
  });

  it("keeps a non-default port and reports no type off a non-parties path", () => {
    expect(originFrom(ctx("http://localhost:8787/parties/arena-room/lobby"))).toEqual({
      type: "arena-room",
      baseUrl: "http://localhost:8787",
    });
    expect(originFrom(ctx("https://x.dev/ws/lobby"))).toEqual({
      type: undefined,
      baseUrl: "https://x.dev",
    });
  });
});
