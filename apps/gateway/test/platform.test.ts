import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { Env } from "../src/index.js";
import { resolveProject } from "../src/platform/api.js";
import { _clearKeyCache } from "../src/platform/apikeys.js";
import { createProject } from "../src/platform/db.js";

const ORIGIN = "https://example.com";

const testEnv = () => env as unknown as Env;
/** An env with API-key enforcement ON (DEV_MODE unset) but the real test D1. */
const enforcedEnv = (): Env => ({ DB: testEnv().DB } as Env);

/** Dev login → returns the `tk_session=...` cookie pair. */
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

describe("platform dashboard API", () => {
  it("requires a session for /me and returns the dev user once logged in", async () => {
    const anon = await SELF.fetch(`${ORIGIN}/api/platform/me`);
    expect(anon.status).toBe(401);

    const cookie = await devLogin("ada");
    const me = await client(cookie)("/api/platform/me");
    expect(me.status).toBe(200);
    expect((await me.json()).login).toBe("ada");
  });

  it("creates + lists projects and issues an API key shown once", async () => {
    const cookie = await devLogin("grace");
    const api = client(cookie);

    const created = await (
      await api("/api/platform/projects", { method: "POST", body: JSON.stringify({ name: "Arena" }) })
    ).json();
    expect(created.name).toBe("Arena");
    // Dashboard contract: wire timestamps are ISO-8601 STRINGS (its runtime
    // guards reject epoch numbers — this exact drift broke the deployed UI once).
    expect(typeof created.createdAt).toBe("string");
    expect(new Date(created.createdAt).getTime()).toBeGreaterThan(0);
    const projectId = created.id as string;

    const list = await (await api("/api/platform/projects")).json();
    expect(list.some((p: any) => p.id === projectId)).toBe(true);

    // Create a key: the full secret is returned exactly once. The default class
    // is PUBLISHABLE (tk_pub_) — the safe class to hand to a browser.
    const key = await (
      await api(`/api/platform/projects/${projectId}/keys`, { method: "POST" })
    ).json();
    expect(key.key).toMatch(/^tk_pub_/);
    expect(key.scope).toBe("public");
    expect(key.prefix).toBe(key.key.slice(0, 12));

    // Listing keys never returns the full secret, only the prefix + derived scope.
    const keys = await (await api(`/api/platform/projects/${projectId}/keys`)).json();
    expect(keys).toHaveLength(1);
    expect(keys[0].prefix).toBe(key.prefix);
    expect(keys[0].scope).toBe("public");
    expect(keys[0].key).toBeUndefined();

    // Revoke it.
    const del = await api(`/api/platform/projects/${projectId}/keys/${key.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    const afterRevoke = await (await api(`/api/platform/projects/${projectId}/keys`)).json();
    expect(afterRevoke[0].revokedAt).not.toBeNull();
  });

  it("mints a secret (tk_live_) key on scope=secret; both classes resolve for connect/read", async () => {
    const cookie = await devLogin("scoped-keys");
    const api = client(cookie);
    const project = await (
      await api("/api/platform/projects", { method: "POST", body: JSON.stringify({ name: "Scoped" }) })
    ).json();
    const projectId = project.id as string;

    // Explicit secret scope → tk_live_.
    const secret = await (
      await api(`/api/platform/projects/${projectId}/keys`, {
        method: "POST",
        body: JSON.stringify({ scope: "secret" }),
      })
    ).json();
    expect(secret.key).toMatch(/^tk_live_/);
    expect(secret.scope).toBe("secret");

    // Default → publishable tk_pub_.
    const pub = await (
      await api(`/api/platform/projects/${projectId}/keys`, { method: "POST" })
    ).json();
    expect(pub.key).toMatch(/^tk_pub_/);
    expect(pub.scope).toBe("public");

    // The listing derives scope from the stored prefix (no scope column).
    const keys = await (await api(`/api/platform/projects/${projectId}/keys`)).json();
    expect(new Set(keys.map((k: { scope: string }) => k.scope))).toEqual(new Set(["secret", "public"]));

    // Regression: BOTH classes resolve on the connect/read path (no scope gate
    // there) — only server-side ingest is secret-only.
    for (const k of [secret.key, pub.key]) {
      _clearKeyCache();
      const resolved = await resolveProject(
        enforcedEnv(),
        new URL(`https://x/parties/agar-room/r?apiKey=${encodeURIComponent(k)}`),
      );
      expect(resolved).toEqual({ ok: true, projectId });
    }
  });

  it("reports empty usage, limits, and rooms for a fresh project", async () => {
    const cookie = await devLogin("lin");
    const api = client(cookie);
    const project = await (
      await api("/api/platform/projects", { method: "POST", body: JSON.stringify({ name: "Fresh" }) })
    ).json();

    expect(await (await api(`/api/platform/projects/${project.id}/usage?days=30`)).json()).toEqual([]);
    expect(await (await api(`/api/platform/projects/${project.id}/rooms`)).json()).toEqual([]);
    const limits = await (await api(`/api/platform/projects/${project.id}/limits`)).json();
    expect(limits.monthRoomHours).toBe(0);
    expect(limits.liveRooms).toBe(0);
    // Wire shape follows the dashboard contract (caps.monthRoomHours).
    expect(limits.caps.monthRoomHours).toBe(1000);
    expect(limits.caps.concurrentRooms).toBe(20);
    expect(limits.caps.playersPerRoom).toBe(20);
  });

  it("issues a player token (JWT) for a project", async () => {
    const cookie = await devLogin("tim");
    const api = client(cookie);
    const project = await (
      await api("/api/platform/projects", { method: "POST", body: JSON.stringify({ name: "Tok" }) })
    ).json();

    const res = await api(`/api/platform/projects/${project.id}/player-token`, {
      method: "POST",
      body: JSON.stringify({ playerId: "player-1" }),
    });
    expect(res.status).toBe(200);
    const { token } = await res.json();
    expect(token.split(".")).toHaveLength(3); // header.payload.signature
  });

  it("enforces owner-only access to projects", async () => {
    const ownerCookie = await devLogin("owner");
    const project = await (
      await client(ownerCookie)("/api/platform/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Private" }),
      })
    ).json();

    const intruder = client(await devLogin("intruder"));
    const get = await intruder(`/api/platform/projects/${project.id}`);
    expect(get.status).toBe(403);
    const keys = await intruder(`/api/platform/projects/${project.id}/keys`);
    expect(keys.status).toBe(403);
    // The intruder's own project list does not include the owner's project.
    const list = await (await intruder("/api/platform/projects")).json();
    expect(list.some((p: any) => p.id === project.id)).toBe(false);
  });

  it("deletes an owned project: it vanishes from the list and its key stops connecting", async () => {
    const cookie = await devLogin("del-owner");
    const api = client(cookie);
    const project = await (
      await api("/api/platform/projects", { method: "POST", body: JSON.stringify({ name: "Doomed" }) })
    ).json();
    const projectId = project.id as string;

    // Mint a key so we can prove it stops resolving after the delete.
    const key = await (
      await api(`/api/platform/projects/${projectId}/keys`, { method: "POST" })
    ).json();

    // While it's live, the key resolves to the project (enforcement path).
    _clearKeyCache();
    const before = await resolveProject(
      enforcedEnv(),
      new URL(`https://x/parties/agar-room/r?apiKey=${encodeURIComponent(key.key)}`),
    );
    expect(before).toEqual({ ok: true, projectId });

    const del = await api(`/api/platform/projects/${projectId}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ ok: true });

    // Gone from the owner's list.
    const list = await (await api("/api/platform/projects")).json();
    expect(list.some((p: any) => p.id === projectId)).toBe(false);

    // The key rows are gone, so a new /parties connect is rejected as invalid.
    _clearKeyCache();
    const after = await resolveProject(
      enforcedEnv(),
      new URL(`https://x/parties/agar-room/r?apiKey=${encodeURIComponent(key.key)}`),
    );
    expect(after).toEqual({ ok: false, status: 401, code: "invalid_api_key" });
  });

  it("returns 404 (not 403) when deleting a project owned by someone else", async () => {
    const ownerCookie = await devLogin("del-victim");
    const project = await (
      await client(ownerCookie)("/api/platform/projects", {
        method: "POST",
        body: JSON.stringify({ name: "NotYours" }),
      })
    ).json();

    const intruder = client(await devLogin("del-intruder"));
    const res = await intruder(`/api/platform/projects/${project.id}`, { method: "DELETE" });
    expect(res.status).toBe(404); // existence is not revealed to non-owners
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("refuses to delete the protected demo project (DEMO_PROJECT_ID) with 403", async () => {
    // DEMO_PROJECT_ID is "demo" in the test env; seed a matching project owned
    // by our dev user so the guard (not ownership) is what rejects the delete.
    const demoId = testEnv().DEMO_PROJECT_ID!;
    expect(demoId).toBe("demo");
    await createProject(testEnv().DB!, {
      id: demoId,
      ownerGithubId: "dev-demo-owner",
      name: "Public Demo",
      playerJwtSecret: "s",
    });

    const api = client(await devLogin("demo-owner"));
    const res = await api(`/api/platform/projects/${demoId}`, { method: "DELETE" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "protected_project" });
  });

  it("preserves usage_daily rows when a project is deleted (billing history)", async () => {
    const cookie = await devLogin("usage-owner");
    const api = client(cookie);
    const project = await (
      await api("/api/platform/projects", { method: "POST", body: JSON.stringify({ name: "Metered" }) })
    ).json();
    const projectId = project.id as string;

    await testEnv()
      .DB!.prepare(
        `INSERT INTO usage_daily (project_id, day, room_hours, peak_ccu, messages) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(projectId, "2026-07-01", 12.5, 8, 100)
      .run();

    const del = await api(`/api/platform/projects/${projectId}`, { method: "DELETE" });
    expect(del.status).toBe(200);

    const row = await testEnv()
      .DB!.prepare(`SELECT room_hours FROM usage_daily WHERE project_id = ?`)
      .bind(projectId)
      .first<{ room_hours: number }>();
    expect(row).not.toBeNull();
    expect(row!.room_hours).toBe(12.5);
  });

  it("rejects an unauthenticated delete with 401", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/platform/projects/some-id`, { method: "DELETE" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
  });

  it("has the dev-auth endpoint enabled in the test env (DEV_MODE=1)", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/platform/auth/dev`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: "" }),
    });
    expect(res.status).toBe(400); // missing login (endpoint reachable, DEV_MODE on)
  });
});
