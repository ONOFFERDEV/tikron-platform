import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const ORIGIN = "https://example.com";

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

    // Create a key: the full secret is returned exactly once.
    const key = await (
      await api(`/api/platform/projects/${projectId}/keys`, { method: "POST" })
    ).json();
    expect(key.key).toMatch(/^tk_live_/);
    expect(key.prefix).toBe(key.key.slice(0, 12));

    // Listing keys never returns the full secret, only the prefix.
    const keys = await (await api(`/api/platform/projects/${projectId}/keys`)).json();
    expect(keys).toHaveLength(1);
    expect(keys[0].prefix).toBe(key.prefix);
    expect(keys[0].key).toBeUndefined();

    // Revoke it.
    const del = await api(`/api/platform/projects/${projectId}/keys/${key.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    const afterRevoke = await (await api(`/api/platform/projects/${projectId}/keys`)).json();
    expect(afterRevoke[0].revokedAt).not.toBeNull();
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
    expect(limits.caps.monthRoomHours).toBe(5000);
    expect(limits.caps.concurrentRooms).toBe(50);
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

  it("has the dev-auth endpoint enabled in the test env (DEV_MODE=1)", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/platform/auth/dev`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: "" }),
    });
    expect(res.status).toBe(400); // missing login (endpoint reachable, DEV_MODE on)
  });
});
