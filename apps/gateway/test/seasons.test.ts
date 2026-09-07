import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { Env } from "../src/index.js";
import { seasonKey, previousSeasonKey } from "../src/platform/db.js";

const db = () => (env as unknown as Env).DB!;
const T = (iso: string) => Date.parse(iso);

// Ground truth for every case below is cross-checked against `date -u -d <date>
// +"%G-W%V"` (glibc's independent ISO-8601 week implementation), not just
// re-derived from this file's own algorithm.
describe("seasonKey", () => {
  it("alltime -> empty string (matches every pre-F4 row, no backfill needed)", () => {
    expect(seasonKey("alltime", T("2026-06-15T12:00:00Z"))).toBe("");
  });

  it("daily -> UTC YYYY-MM-DD", () => {
    expect(seasonKey("daily", T("2026-06-15T23:59:59Z"))).toBe("2026-06-15");
  });

  it("monthly -> UTC YYYY-MM", () => {
    expect(seasonKey("monthly", T("2026-06-15T00:00:00Z"))).toBe("2026-06");
  });

  it("weekly -> Jan 1 2026 (a Thursday) is week 1 of 2026", () => {
    expect(seasonKey("weekly", T("2026-01-01T00:00:00Z"))).toBe("2026-W01");
  });

  it("weekly -> late Dec 2025 already belongs to the NEXT ISO year's week 1", () => {
    expect(seasonKey("weekly", T("2025-12-31T12:00:00Z"))).toBe("2026-W01");
  });

  it("weekly -> early Jan 2027 still belongs to the PREVIOUS ISO year's last week", () => {
    expect(seasonKey("weekly", T("2027-01-01T00:00:00Z"))).toBe("2026-W53");
    expect(seasonKey("weekly", T("2027-01-03T00:00:00Z"))).toBe("2026-W53");
  });

  it("weekly -> Jan 4 2027 (a Monday) starts 2027-W01", () => {
    expect(seasonKey("weekly", T("2027-01-04T00:00:00Z"))).toBe("2027-W01");
  });
});

describe("previousSeasonKey", () => {
  it("alltime -> empty string", () => {
    expect(previousSeasonKey("alltime", T("2026-06-15T00:00:00Z"))).toBe("");
  });

  it("daily -> the prior UTC calendar day", () => {
    expect(previousSeasonKey("daily", T("2026-06-15T00:00:30Z"))).toBe("2026-06-14");
  });

  it("weekly -> the prior ISO week, crossing a year boundary", () => {
    expect(previousSeasonKey("weekly", T("2026-01-01T00:00:00Z"))).toBe("2025-W52");
  });

  it("monthly -> the prior calendar month, crossing a year boundary", () => {
    expect(previousSeasonKey("monthly", T("2026-01-15T00:00:00Z"))).toBe("2025-12");
  });
});

describe("0005 migration schema", () => {
  it("rebuilds leaderboards with season in the primary key + index, and adds leaderboard_boards", async () => {
    const rows = await db()
      .prepare(
        `SELECT type, name, sql FROM sqlite_master
         WHERE tbl_name IN ('leaderboards', 'leaderboard_boards') AND sql IS NOT NULL`,
      )
      .all<{ type: string; name: string; sql: string }>();
    const results = rows.results ?? [];

    const table = results.find((r) => r.type === "table" && r.name === "leaderboards");
    expect(table?.sql).toContain("season");
    expect(table?.sql).toContain("PRIMARY KEY (project_id, board, season, player_id)");

    const index = results.find((r) => r.type === "index" && r.name === "idx_leaderboards_topn");
    expect(index?.sql).toContain("season");

    const boardsTable = results.find((r) => r.type === "table" && r.name === "leaderboard_boards");
    expect(boardsTable?.sql).toContain("period");
    expect(boardsTable?.sql).toContain("PRIMARY KEY (project_id, board)");
  });
});
