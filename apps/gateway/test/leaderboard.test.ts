import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { Env } from "../src/index.js";
import {
  createApiKey,
  createProject,
  previousSeasonKey,
  seasonKey,
  submitScore,
  topScores,
  upsertLeaderboardBoardPeriod,
} from "../src/platform/db.js";
import { generateApiKey } from "../src/platform/apikeys.js";
import { handleLeaderboard } from "../src/platform/api.js";

const db = () => (env as unknown as Env).DB!;
const board = () => `b-${crypto.randomUUID()}`;
const proj = () => `p-${crypto.randomUUID()}`;

async function put(
  projectId: string,
  b: string,
  playerId: string,
  score: number,
  mode: "max" | "sum" | "last" = "max",
): Promise<void> {
  await submitScore(db(), { projectId, board: b, playerId, displayName: playerId, score, mode });
}

describe("leaderboard aggregation modes", () => {
  it("keeps the max, adds for sum, and overwrites for last", async () => {
    const p = proj();
    const b = board();

    await put(p, b, "u", 10, "max");
    await put(p, b, "u", 5, "max"); // lower — max keeps 10
    expect((await topScores(db(), p, b, 10))[0]!.score).toBe(10);

    await put(p, b, "u", 3, "sum"); // 10 + 3
    expect((await topScores(db(), p, b, 10))[0]!.score).toBe(13);

    await put(p, b, "u", 1, "last"); // overwrite → 1
    expect((await topScores(db(), p, b, 10))[0]!.score).toBe(1);
  });
});

describe("leaderboard top-N", () => {
  it("orders by score descending and honors the limit", async () => {
    const p = proj();
    const b = board();
    await put(p, b, "a", 3);
    await put(p, b, "b", 9);
    await put(p, b, "c", 7);
    await put(p, b, "d", 1);

    const top2 = await topScores(db(), p, b, 2);
    expect(top2.map((r) => r.player_id)).toEqual(["b", "c"]); // 9, 7
    expect(top2).toHaveLength(2);
  });
});

describe("leaderboard project isolation", () => {
  it("keeps identical board names separate across projects", async () => {
    const p1 = proj();
    const p2 = proj();
    const b = "shared";
    await put(p1, b, "u", 100);
    await put(p2, b, "u", 1);

    expect((await topScores(db(), p1, b, 10))[0]!.score).toBe(100);
    expect((await topScores(db(), p2, b, 10))[0]!.score).toBe(1);
  });
});

describe("public leaderboard read (GET /api/leaderboard)", () => {
  it("serves ranked JSON for the demo project on a keyless read, with a cache header", async () => {
    // DEV_MODE unset here (enforcement on) so the missing key falls back to demo.
    const e = { DB: db(), DEMO_PROJECT_ID: "demo" } as Env;
    const b = board();
    await submitScore(db(), {
      projectId: "demo",
      board: b,
      playerId: "hi",
      displayName: "hero",
      score: 42,
      mode: "max",
    });

    const res = await handleLeaderboard(e, new URL(`https://x/api/leaderboard?board=${b}&limit=10`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("max-age=10");
    // Cross-origin readable: a self-hosted game reads this from its own origin.
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await res.json()) as {
      rank: number;
      playerId: string;
      displayName: string | null;
      score: number;
    }[];
    expect(body[0]).toEqual({ rank: 1, playerId: "hi", displayName: "hero", score: 42 });
  });

  it("400s a missing board and 401s an invalid key (both CORS-readable)", async () => {
    const e = { DB: db(), DEMO_PROJECT_ID: "demo" } as Env;
    const noBoard = await handleLeaderboard(e, new URL("https://x/api/leaderboard"));
    expect(noBoard.status).toBe(400);
    expect(noBoard.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const bad = await handleLeaderboard(
      e,
      new URL("https://x/api/leaderboard?board=x&apiKey=tk_live_nope"),
    );
    expect(bad.status).toBe(401);
    expect(bad.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("reads with a tk_pub_ (publishable) key under enforcement — no scope gate on reads", async () => {
    // Enforced env (no DEV_MODE, no DEMO fallback): the key must actually resolve.
    const project = await createProject(db(), {
      id: crypto.randomUUID(),
      ownerGithubId: "lb-owner",
      name: "PubRead",
      playerJwtSecret: "s",
    });
    const gen = await generateApiKey("public"); // tk_pub_
    expect(gen.key).toMatch(/^tk_pub_/);
    await createApiKey(db(), {
      id: crypto.randomUUID(),
      projectId: project.id,
      keyHash: gen.hash,
      keyPrefix: gen.prefix,
    });
    const b = board();
    await submitScore(db(), {
      projectId: project.id,
      board: b,
      playerId: "hero",
      displayName: "H",
      score: 7,
      mode: "max",
    });

    const e = { DB: db() } as Env; // enforcement ON
    const res = await handleLeaderboard(
      e,
      new URL(`https://x/api/leaderboard?board=${b}&apiKey=${encodeURIComponent(gen.key)}`),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await res.json()) as { playerId: string; score: number }[];
    expect(body[0]).toMatchObject({ playerId: "hero", score: 7 });
  });
});

describe("leaderboard seasons (F4)", () => {
  it("current/previous/explicit ?season= select the right partition, with X-Tikron-Season/-Period headers", async () => {
    const p = proj();
    const b = board();
    await upsertLeaderboardBoardPeriod(db(), p, b, "weekly");

    const now = Date.now();
    const thisWeek = seasonKey("weekly", now);
    const lastWeek = previousSeasonKey("weekly", now);
    const put = (playerId: string, score: number, season: string) =>
      submitScore(db(), { projectId: p, board: b, playerId, displayName: null, score, mode: "max", season });
    await put("cur", 10, thisWeek);
    await put("prev", 20, lastWeek);
    await put("explicit", 30, "2020-W01");

    const e = { DB: db(), DEMO_PROJECT_ID: p } as Env;

    const curRes = await handleLeaderboard(e, new URL(`https://x/api/leaderboard?board=${b}`));
    expect(curRes.headers.get("X-Tikron-Season")).toBe(thisWeek);
    expect(curRes.headers.get("X-Tikron-Period")).toBe("weekly");
    expect(curRes.headers.get("Access-Control-Expose-Headers")).toContain("X-Tikron-Season");
    expect(((await curRes.json()) as { playerId: string }[])[0]).toMatchObject({ playerId: "cur" });

    const prevRes = await handleLeaderboard(
      e,
      new URL(`https://x/api/leaderboard?board=${b}&season=previous`),
    );
    expect(prevRes.headers.get("X-Tikron-Season")).toBe(lastWeek);
    expect(((await prevRes.json()) as { playerId: string }[])[0]).toMatchObject({ playerId: "prev" });

    // "prev" is the plan's spelling — an alias for "previous".
    const prevAliasRes = await handleLeaderboard(
      e,
      new URL(`https://x/api/leaderboard?board=${b}&season=prev`),
    );
    expect(prevAliasRes.headers.get("X-Tikron-Season")).toBe(lastWeek);
    expect(((await prevAliasRes.json()) as { playerId: string }[])[0]).toMatchObject({
      playerId: "prev",
    });

    const explicitRes = await handleLeaderboard(
      e,
      new URL(`https://x/api/leaderboard?board=${b}&season=2020-W01`),
    );
    expect(explicitRes.headers.get("X-Tikron-Season")).toBe("2020-W01");
    expect(((await explicitRes.json()) as { playerId: string }[])[0]).toMatchObject({
      playerId: "explicit",
    });
  });

  it("a board that never declared a period reads all-time as before (regression)", async () => {
    const p = proj();
    const b = board();
    // No upsertLeaderboardBoardPeriod call — mirrors every pre-F4 board.
    await submitScore(db(), {
      projectId: p,
      board: b,
      playerId: "u",
      displayName: "hero",
      score: 5,
      mode: "max",
    }); // season defaults to "" (alltime)

    const e = { DB: db(), DEMO_PROJECT_ID: p } as Env;
    const res = await handleLeaderboard(e, new URL(`https://x/api/leaderboard?board=${b}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Tikron-Period")).toBe("alltime");
    expect(res.headers.get("X-Tikron-Season")).toBe("");
    const body = (await res.json()) as { playerId: string; score: number }[];
    expect(body[0]).toMatchObject({ playerId: "u", score: 5 });
  });

  it("400s a non-ASCII explicit ?season= (would otherwise throw inside new Response headers)", async () => {
    const e = { DB: db(), DEMO_PROJECT_ID: proj() } as Env;
    const url = new URL(`https://x/api/leaderboard?board=${board()}`);
    url.searchParams.set("season", "시즌");

    const res = await handleLeaderboard(e, url);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_season" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*"); // still CORS-readable
  });

  it("400s a CRLF explicit ?season= (header-injection shaped input)", async () => {
    const e = { DB: db(), DEMO_PROJECT_ID: proj() } as Env;
    const url = new URL(`https://x/api/leaderboard?board=${board()}`);
    url.searchParams.set("season", "a\r\nX-Injected: 1");

    const res = await handleLeaderboard(e, url);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_season" });
  });
});
