import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { Env } from "../src/index.js";

const ORIGIN = "https://example.com";
const testEnv = () => env as unknown as Env;

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

/** Insert a showcase row straight into D1 (bypasses moderation for the fixture). */
async function seedGame(row: {
  id: string;
  slug: string;
  title: string;
  status: string;
  projectId?: string | null;
  genres?: string;
}): Promise<void> {
  const now = Date.now();
  await testEnv()
    .DB!.prepare(
      `INSERT INTO showcase_games
         (id, project_id, owner_github_id, slug, title, tagline, thumbnail_url, play_url,
          genres, author, status, featured, created_at, updated_at)
       VALUES (?, ?, 'dev-seed', ?, ?, '', '/t.svg', '/p.html', ?, 'Seed', ?, 0, ?, ?)`,
    )
    .bind(
      row.id,
      row.projectId ?? null,
      row.slug,
      row.title,
      row.genres ?? "io",
      row.status,
      now,
      now,
    )
    .run();
}

describe("showcase API", () => {
  it("public GET is unauthenticated and returns only approved games", async () => {
    await seedGame({ id: "t-appr", slug: "appr", title: "Approved Game", status: "approved" });
    await seedGame({ id: "t-pend", slug: "pend", title: "Pending Game", status: "pending" });

    const res = await SELF.fetch(`${ORIGIN}/api/platform/showcase`);
    expect(res.status).toBe(200);
    const list = (await res.json()) as any[];
    expect(list.some((g) => g.id === "t-appr")).toBe(true);
    expect(list.some((g) => g.id === "t-pend")).toBe(false);

    const g = list.find((x) => x.id === "t-appr");
    expect(g.genres).toEqual(["io"]);
    expect(g.livePlayers).toBe(0); // no project link → no live counts
    expect(typeof g.createdAt).toBe("string"); // ISO string, not epoch
  });

  it("submits a game as pending, filters bad genres, and lists it under /mine only", async () => {
    const api = client(await devLogin("sc-dev"));
    const res = await api("/api/platform/showcase", {
      method: "POST",
      body: JSON.stringify({
        title: "My Game",
        tagline: "fun",
        thumbnailUrl: "https://x/t.png",
        playUrl: "https://x/play",
        genres: ["fps", "bogus"],
        author: "me",
      }),
    });
    expect(res.status).toBe(201);
    const g = (await res.json()) as any;
    expect(g.status).toBe("pending");
    expect(g.genres).toEqual(["fps"]); // "bogus" dropped
    expect(g.slug).toContain("my-game");

    const mine = (await (await api("/api/platform/showcase/mine")).json()) as any[];
    expect(mine.some((x) => x.id === g.id)).toBe(true);

    // Pending games never appear in the public gallery.
    const pub = (await (await SELF.fetch(`${ORIGIN}/api/platform/showcase`)).json()) as any[];
    expect(pub.some((x) => x.id === g.id)).toBe(false);
  });

  it("rejects invalid submissions (missing title, unsafe url)", async () => {
    const api = client(await devLogin("sc-bad"));
    const noTitle = await api("/api/platform/showcase", {
      method: "POST",
      body: JSON.stringify({ thumbnailUrl: "/t.png", playUrl: "/p" }),
    });
    expect(noTitle.status).toBe(400);

    const jsUrl = await api("/api/platform/showcase", {
      method: "POST",
      body: JSON.stringify({ title: "X", thumbnailUrl: "javascript:alert(1)", playUrl: "/p" }),
    });
    expect(jsUrl.status).toBe(400);
  });

  it("lets an owner delete their submission; a non-owner gets 404", async () => {
    const owner = client(await devLogin("sc-owner"));
    const g = (await (
      await owner("/api/platform/showcase", {
        method: "POST",
        body: JSON.stringify({ title: "Del", thumbnailUrl: "/t.png", playUrl: "/p" }),
      })
    ).json()) as any;

    const intruder = client(await devLogin("sc-intruder"));
    const bad = await intruder(`/api/platform/showcase/${g.id}`, { method: "DELETE" });
    expect(bad.status).toBe(404); // existence hidden from non-owners

    const del = await owner(`/api/platform/showcase/${g.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ ok: true });
  });

  it("gates moderation routes to admins (403 for normal users)", async () => {
    const api = client(await devLogin("sc-nonadmin"));
    expect((await api("/api/platform/showcase/pending")).status).toBe(403);
    const status = await api("/api/platform/showcase/whatever/status", {
      method: "POST",
      body: JSON.stringify({ status: "approved" }),
    });
    expect(status.status).toBe(403);
  });

  it("requires a session to submit", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/platform/showcase`, {
      method: "POST",
      body: JSON.stringify({ title: "x" }),
    });
    expect(res.status).toBe(401);
  });

  it("exposes isAdmin:false on /me for a normal dev user", async () => {
    const me = (await (await client(await devLogin("sc-me"))("/api/platform/me")).json()) as any;
    expect(me.isAdmin).toBe(false);
  });
});
