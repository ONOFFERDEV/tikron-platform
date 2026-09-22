import { describe, expect, it } from "vitest";
import { createResultPresentation, type ResultViewModel } from "../client/ui/result-view.js";

const base = (overrides: Partial<ResultViewModel> = {}): ResultViewModel => ({
  mode: "tdm", winner: "red", red: 50, blue: 40, won: true, localKills: 3, localDeaths: 0,
  rows: [
    { id: "self", name: "나", team: 0, kills: 3, deaths: 0, isMe: true },
    { id: "ally", name: "의무병", team: 0, kills: 1, deaths: 2, isMe: false },
    { id: "enemy", name: "적", team: 1, kills: 4, deaths: 3, isMe: false },
  ],
  intermission: { kind: "scheduled", seconds: 8 }, vote: { count: 1, need: 2, sent: false }, ...overrides,
});

describe("result presentation", () => {
  it("builds sorted team sections and represents zero-death K/D without division", () => {
    const result = createResultPresentation(base());
    expect(result.outcome).toBe("victory");
    expect(result.sections.map(section => section.rows.map(row => row.id))).toEqual([["self", "ally"], ["enemy"]]);
    expect(result.local.kd).toBeNull();
    expect(result.intermission).toEqual({ kind: "scheduled", seconds: 8 });
  });

  it("builds one FFA section and treats a draw independently of the local row", () => {
    const result = createResultPresentation(base({ mode: "ffa", winner: "draw", won: false }));
    expect(result.outcome).toBe("draw");
    expect(result.winner).toBeNull();
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.rows.map(row => row.id)).toEqual(["enemy", "self", "ally"]);
  });

  it("presents the authoritative FFA winner without trusting it as markup", () => {
    const result = createResultPresentation(base({ mode: "ffa", winner: "<승자>", won: false }));
    expect(result.winner).toMatchObject({ text: "<승자>", html: "&lt;승자&gt;" });
  });

  it("preserves empty results and safe long or hostile player names", () => {
    expect(createResultPresentation(base({ rows: [] })).sections.map(section => section.rows)).toEqual([[], []]);
    const hostile = createResultPresentation(base({ rows: [
      { id: "x", name: `<img src=x onerror="boom">${"가".repeat(40)}`, team: 0, kills: 0, deaths: 1, isMe: false },
    ] }));
    expect(hostile.sections[0]?.rows[0]?.name.html).toContain("&lt;img");
    expect(hostile.sections[0]?.rows[0]?.name.compact).not.toContain("onerror=\"boom\"");
  });

  it("keeps vote and awaiting-server state machine-readable", () => {
    const result = createResultPresentation(base({ intermission: { kind: "awaiting-server" }, vote: { count: 2, need: 2, sent: true } }));
    expect(result.intermission.kind).toBe("awaiting-server");
    expect(result.vote).toEqual({ count: 2, need: 2, sent: true });
  });
});
