import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { Env } from "../src/index.js";
import { submitScore, topScores } from "../src/platform/db.js";
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
    const body = (await res.json()) as {
      rank: number;
      playerId: string;
      displayName: string | null;
      score: number;
    }[];
    expect(body[0]).toEqual({ rank: 1, playerId: "hi", displayName: "hero", score: 42 });
  });

  it("400s a missing board and 401s an invalid key", async () => {
    const e = { DB: db(), DEMO_PROJECT_ID: "demo" } as Env;
    expect((await handleLeaderboard(e, new URL("https://x/api/leaderboard"))).status).toBe(400);
    const bad = await handleLeaderboard(
      e,
      new URL("https://x/api/leaderboard?board=x&apiKey=pe_live_nope"),
    );
    expect(bad.status).toBe(401);
  });
});
