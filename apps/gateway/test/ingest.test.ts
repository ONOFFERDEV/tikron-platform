import { SELF, env, runInDurableObject, runDurableObjectAlarm } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { Env } from "../src/index.js";
import type { Matchmaker } from "../src/matchmaker.js";
import { _resetScoreCaches } from "../src/platform/ingest.js";
import { topScores } from "../src/platform/db.js";

const ORIGIN = "https://example.com";
const INGEST = `${ORIGIN}/api/ingest/occupancy`;
const SCORE_INGEST = `${ORIGIN}/api/ingest/score`;

const testEnv = () => env as unknown as Env;

/** The single well-known Matchmaker DO stub (mirrors `matchmaker()` in index.ts). */
function globalMatchmaker(): DurableObjectStub<Matchmaker> {
  const ns = testEnv().Matchmaker;
  return ns.get(ns.idFromName("global"));
}

/** Dev login → returns the `tk_session=...` cookie pair (platform.test.ts style). */
async function devLogin(login: string): Promise<string> {
  const res = await SELF.fetch(`${ORIGIN}/api/platform/auth/dev`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login }),
  });
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("Set-Cookie");
  if (!setCookie) throw new Error("no session cookie");
  return setCookie.split(";")[0]!;
}

function client(cookie: string) {
  return (path: string, init: RequestInit = {}) =>
    SELF.fetch(`${ORIGIN}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Cookie: cookie, ...(init.headers ?? {}) },
    });
}

/** Create a project (owned by the cookie) and mint an API key for it. `scope`
 *  defaults to the route default (publishable, tk_pub_); pass "secret" for a
 *  tk_live_ key usable on server-side ingest routes. */
async function projectWithKey(
  cookie: string,
  name: string,
  scope?: "public" | "secret",
): Promise<{ projectId: string; apiKey: string }> {
  const api = client(cookie);
  const project = await (
    await api("/api/platform/projects", { method: "POST", body: JSON.stringify({ name }) })
  ).json();
  const key = await (
    await api(`/api/platform/projects/${project.id}/keys`, {
      method: "POST",
      ...(scope ? { body: JSON.stringify({ scope }) } : {}),
    })
  ).json();
  return { projectId: project.id as string, apiKey: key.key as string };
}

function ingestScore(apiKey: string | null, body: unknown): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return SELF.fetch(SCORE_INGEST, { method: "POST", headers, body: JSON.stringify(body) });
}

function ingest(apiKey: string | null, body: unknown): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return SELF.fetch(INGEST, { method: "POST", headers, body: JSON.stringify(body) });
}

describe("self-hosted occupancy ingest", () => {
  it("valid key → 204, and usage accrues to the dashboard after a flush", async () => {
    const cookie = await devLogin("ext-owner");
    const { projectId, apiKey } = await projectWithKey(cookie, "SelfHosted");

    const res = await ingest(apiKey, {
      roomId: "lobby-1",
      count: 3,
      sessions: ["a", "b", "c"],
      seq: 1,
      messages: 5,
    });
    expect(res.status).toBe(204);

    // Drive the metering flush the way the matchmaker metering test does: backdate
    // the room's accrual by an hour so the alarm records ~1.0 room-hour, then fire it.
    const mm = globalMatchmaker();
    const roomKey = `ext:${projectId}:lobby-1`;
    await runInDurableObject(mm, (inst: any) => {
      inst.metered.get(roomKey).accrualAt = Date.now() - 3_600_000;
    });
    expect(await runDurableObjectAlarm(mm)).toBe(true);

    // Usage is now visible via the existing cookie-authed dashboard endpoint —
    // self-hosted reports flow through the same metering path, zero dashboard changes.
    const usage = await (await client(cookie)(`/api/platform/projects/${projectId}/usage?days=30`)).json();
    expect(usage.length).toBeGreaterThan(0);
    expect(usage[0].messages).toBe(5);
    expect(usage[0].peakCcu).toBe(3);
    expect(usage[0].roomHours).toBeGreaterThan(0.9);
    expect(usage[0].roomHours).toBeLessThan(1.1);
  });

  it("missing key → 401 missing_api_key", async () => {
    const res = await ingest(null, { roomId: "r", count: 1, seq: 1 });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "missing_api_key" });
  });

  it("invalid key → 401 invalid_api_key", async () => {
    const res = await ingest("tk_live_nope", { roomId: "r", count: 1, seq: 1 });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_api_key" });
  });

  it("malformed bodies → 400", async () => {
    const cookie = await devLogin("ext-bad");
    const { apiKey } = await projectWithKey(cookie, "BadBodies");

    const cases: unknown[] = [
      { count: 1, seq: 1 }, // missing roomId
      { roomId: "", count: 1, seq: 1 }, // empty roomId
      { roomId: "x".repeat(129), count: 1, seq: 1 }, // roomId too long
      { roomId: "r", seq: 1 }, // missing count
      { roomId: "r", count: -1, seq: 1 }, // negative count
      { roomId: "r", count: 1.5, seq: 1 }, // non-integer count
      { roomId: "r", count: 1 }, // missing seq
      { roomId: "r", count: 1, seq: -1 }, // negative seq
      { roomId: "r", count: 1, seq: 1, messages: -2 }, // negative messages
      { roomId: "r", count: 1, seq: 1, sessions: "nope" }, // sessions not an array
    ];
    for (const body of cases) {
      const res = await ingest(apiKey, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("rejects count over the abuse cap (>1024) with 400", async () => {
    const cookie = await devLogin("ext-abuse");
    const { apiKey } = await projectWithKey(cookie, "Abuse");
    const res = await ingest(apiKey, { roomId: "r", count: 1025, seq: 1 });
    expect(res.status).toBe(400);
  });

  it("does NOT pollute the /api/rooms lobby or matchmaking", async () => {
    const cookie = await devLogin("ext-lobby");
    const { projectId, apiKey } = await projectWithKey(cookie, "Lobby");

    const res = await ingest(apiKey, { roomId: "solo-1", count: 2, seq: 1 });
    expect(res.status).toBe(204);

    // The self-hosted room is metered but never a matchmakable room, so it appears
    // in neither the lobby list nor the type-filtered lobby.
    const all = await (await SELF.fetch(`${ORIGIN}/api/rooms`)).json();
    const roomKey = `ext:${projectId}:solo-1`;
    expect(all.some((r: any) => r.roomId === roomKey || r.roomId === "solo-1")).toBe(false);

    const byType = await (await SELF.fetch(`${ORIGIN}/api/rooms?type=solo-1`)).json();
    expect(byType).toEqual([]);
  });

  it("answers the CORS preflight (OPTIONS) with permissive headers", async () => {
    const res = await SELF.fetch(INGEST, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

describe("self-hosted leaderboard score ingest (POST /api/ingest/score)", () => {
  it("tk_live_ key → 204 and the row is upserted, read back highest-first", async () => {
    _resetScoreCaches();
    const cookie = await devLogin("score-owner");
    const { projectId, apiKey } = await projectWithKey(cookie, "Scores", "secret");
    expect(apiKey).toMatch(/^tk_live_/);

    const board = `arcade-${crypto.randomUUID().slice(0, 8)}`;
    const a = await ingestScore(apiKey, { board, playerId: "p1", score: 10, displayName: "Ada" });
    expect(a.status).toBe(204);
    // A higher score for the same player (mode defaults to "max") replaces it.
    const b = await ingestScore(apiKey, { board, playerId: "p1", score: 42, displayName: "Ada" });
    expect(b.status).toBe(204);

    const rows = await topScores(testEnv().DB!, projectId, board, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ player_id: "p1", display_name: "Ada", score: 42 });
  });

  it("tk_pub_ (publishable) key → 403 key_scope_forbidden with an actionable message", async () => {
    _resetScoreCaches();
    const cookie = await devLogin("score-pub");
    const { apiKey } = await projectWithKey(cookie, "PubScores"); // default = publishable
    expect(apiKey).toMatch(/^tk_pub_/);

    const res = await ingestScore(apiKey, { board: "b", playerId: "p", score: 1 });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; message?: string };
    expect(body.error).toBe("key_scope_forbidden");
    // The message must be present and actionable (names tk_live_ + the fix route).
    expect(body.message).toContain("tk_live_");
    expect(body.message).toContain("scope");
  });

  it("missing key → 401 missing_api_key; invalid key → 401 invalid_api_key", async () => {
    const miss = await ingestScore(null, { board: "b", playerId: "p", score: 1 });
    expect(miss.status).toBe(401);
    expect(await miss.json()).toEqual({ error: "missing_api_key" });

    // A well-formed but unknown tk_live_ key never resolves → 401 (not 403).
    const bad = await ingestScore("tk_live_nope", { board: "b", playerId: "p", score: 1 });
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ error: "invalid_api_key" });
  });

  it("malformed bodies → 400 bad_request", async () => {
    _resetScoreCaches();
    const cookie = await devLogin("score-bad");
    const { apiKey } = await projectWithKey(cookie, "BadScores", "secret");
    const cases: unknown[] = [
      { playerId: "p", score: 1 }, // missing board
      { board: "", playerId: "p", score: 1 }, // empty board
      { board: "x".repeat(65), playerId: "p", score: 1 }, // board too long
      { board: "b", score: 1 }, // missing playerId
      { board: "b", playerId: "", score: 1 }, // empty playerId
      { board: "b", playerId: "p" }, // missing score
      { board: "b", playerId: "p", score: "10" }, // score not a number
      { board: "b", playerId: "p", score: Infinity }, // non-finite score
      { board: "b", playerId: "p", score: 1, mode: "avg" }, // invalid mode
      { board: "b", playerId: "p", score: 1, displayName: 5 }, // displayName wrong type
    ];
    for (const body of cases) {
      const res = await ingestScore(apiKey, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("board cap → 403 cap_leaderboard_boards for a NEW board past the limit", async () => {
    _resetScoreCaches();
    const db = testEnv().DB!;
    await db.prepare(`UPDATE config SET v = '2' WHERE k = 'free_leaderboard_boards'`).run();
    try {
      const cookie = await devLogin("score-cap");
      const { apiKey } = await projectWithKey(cookie, "CapScores", "secret");

      // Two distinct boards are under the cap of 2.
      expect((await ingestScore(apiKey, { board: "b1", playerId: "p", score: 1 })).status).toBe(204);
      expect((await ingestScore(apiKey, { board: "b2", playerId: "p", score: 1 })).status).toBe(204);
      // Writing again to an EXISTING board stays allowed (doesn't grow the count).
      expect((await ingestScore(apiKey, { board: "b1", playerId: "q", score: 2 })).status).toBe(204);
      // A third, NEW board is over the cap → rejected with an actionable message.
      const over = await ingestScore(apiKey, { board: "b3", playerId: "p", score: 1 });
      expect(over.status).toBe(403);
      const body = (await over.json()) as { error: string; message?: string };
      expect(body.error).toBe("cap_leaderboard_boards");
      expect(body.message).toBeTruthy();
    } finally {
      await db.prepare(`UPDATE config SET v = '50' WHERE k = 'free_leaderboard_boards'`).run();
    }
  });

  it("rate bucket → 429 cap_leaderboard_rate under a burst past the per-project limit", async () => {
    _resetScoreCaches();
    const cookie = await devLogin("score-rate");
    const { apiKey } = await projectWithKey(cookie, "RateScores", "secret");
    const board = "rate-board";
    // Warm the key + board caches so the burst clusters on the token bucket.
    expect((await ingestScore(apiKey, { board, playerId: "p", score: 1 })).status).toBe(204);

    // Burst well past the burst size (60) so at least one request is throttled
    // even with steady refill (30/s) over the batch's wall-clock duration.
    const results = await Promise.all(
      Array.from({ length: 120 }, () => ingestScore(apiKey, { board, playerId: "p", score: 1 })),
    );
    const statuses = results.map((r) => r.status);
    const throttled = results.filter((r) => r.status === 429);
    expect(statuses).toContain(204); // some got through
    expect(throttled.length).toBeGreaterThan(0); // and the limiter fired
    const body = (await throttled[0]!.json()) as { error: string; message?: string };
    expect(body.error).toBe("cap_leaderboard_rate");
    expect(body.message).toBeTruthy();
  });

  it("answers the CORS preflight (OPTIONS) with permissive headers", async () => {
    const res = await SELF.fetch(SCORE_INGEST, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
