import { SELF, env, runInDurableObject, runDurableObjectAlarm } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { Env } from "../src/index.js";
import type { Matchmaker } from "../src/matchmaker.js";

const ORIGIN = "https://example.com";
const INGEST = `${ORIGIN}/api/ingest/occupancy`;

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

/** Create a project (owned by the cookie) and mint an API key for it. */
async function projectWithKey(cookie: string, name: string): Promise<{ projectId: string; apiKey: string }> {
  const api = client(cookie);
  const project = await (
    await api("/api/platform/projects", { method: "POST", body: JSON.stringify({ name }) })
  ).json();
  const key = await (await api(`/api/platform/projects/${project.id}/keys`, { method: "POST" })).json();
  return { projectId: project.id as string, apiKey: key.key as string };
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
