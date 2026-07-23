// [blueprint] — every threshold (killTarget/captureRadius/scoreTarget/etc.) is read
// dynamically off MODES, not hardcoded, so this holds for any mode config.
import { describe, it, expect } from "vitest";
import {
  TDM_MODE,
  FFA_MODE,
  DOM_MODE,
  PRACTICE_MODE,
  MODE_ORDER,
  modeFromRoomId,
  modeIndex,
  mapForMode,
  isTeamless,
  type ModeCtx,
} from "../src/modes.js";
import { MODES, TEAM } from "../src/config.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";
import type { ArenaState } from "../src/schema.js";

/**
 * modes.ts is a pure module (see its own doc comment): every mode reads/writes
 * state only through {@link ModeCtx}, with no room/DO involved. These tests drive
 * that contract directly with a minimal state + mock ctx — no createTestRoom.
 */

interface MockPlayer {
  team: number;
  k: number;
}

function makeState(players: Record<string, MockPlayer> = {}): ArenaState {
  return {
    players,
    redScore: 0,
    blueScore: 0,
    capA: 100, // 100 = neutral, 0 = fully blue, 200 = fully red
    capB: 100,
    capC: 100,
  } as unknown as ArenaState;
}

/** A ctx whose playersAt() returns canned occupants for whichever cap point (a/b/c) it's asked about. */
function makeCtx(
  state: ArenaState,
  opts: {
    now?: number;
    occupants?: Partial<Record<"a" | "b" | "c", { id: string; team: number; alive: boolean }[]>>;
  } = {},
): ModeCtx {
  const occupants = opts.occupants ?? {};
  return {
    state,
    now: opts.now ?? 0,
    broadcast: (_type: string, _payload: unknown) => {},
    playersAt(x: number, z: number) {
      // dom is always played on ARENA2 (see modes.ts's mapForMode) — its capture
      // points come from there, not ARENA1.
      if (x === ARENA2.caps.a.x && z === ARENA2.caps.a.z) return occupants.a ?? [];
      if (x === ARENA2.caps.b.x && z === ARENA2.caps.b.z) return occupants.b ?? [];
      if (x === ARENA2.caps.c.x && z === ARENA2.caps.c.z) return occupants.c ?? [];
      return [];
    },
  };
}

describe("TDM_MODE", () => {
  it("credits a frag to the killer's team score", () => {
    const state = makeState({ r1: { team: TEAM.red, k: 0 }, b1: { team: TEAM.blue, k: 0 } });
    const ctx = makeCtx(state);
    TDM_MODE.onKill(ctx, "r1", "v1");
    expect(state.redScore).toBe(1);
    expect(state.blueScore).toBe(0);
    TDM_MODE.onKill(ctx, "b1", "v2");
    expect(state.redScore).toBe(1);
    expect(state.blueScore).toBe(1);
  });

  it("ignores a kill credited to an unknown player id", () => {
    const state = makeState();
    const ctx = makeCtx(state);
    expect(() => TDM_MODE.onKill(ctx, "ghost", "v1")).not.toThrow();
    expect(state.redScore).toBe(0);
    expect(state.blueScore).toBe(0);
  });

  it("winCheck returns the winner once a team reaches the tdm kill target, else null", () => {
    const state = makeState();
    const ctx = makeCtx(state);
    state.redScore = MODES.tdm.killTarget - 1;
    expect(TDM_MODE.winCheck(ctx)).toBeNull();
    state.redScore = MODES.tdm.killTarget;
    expect(TDM_MODE.winCheck(ctx)).toEqual({ winner: "red" });

    state.redScore = 0;
    state.blueScore = MODES.tdm.killTarget;
    expect(TDM_MODE.winCheck(ctx)).toEqual({ winner: "blue" });
  });
});

describe("FFA_MODE", () => {
  it("onKill is a no-op — personal score (state.players[id].k) is tracked by the room, not the mode", () => {
    const state = makeState({ r1: { team: TEAM.red, k: 5 } });
    const ctx = makeCtx(state);
    FFA_MODE.onKill(ctx, "r1", "v1");
    expect(state.players["r1"]).toEqual({ team: TEAM.red, k: 5 });
  });

  it("winCheck returns the player whose kill count reaches the ffa target", () => {
    const state = makeState({
      p1: { team: TEAM.red, k: MODES.ffa.killTarget - 1 },
      p2: { team: TEAM.blue, k: MODES.ffa.killTarget },
    });
    const ctx = makeCtx(state);
    expect(FFA_MODE.winCheck(ctx)).toEqual({ winner: "p2" });
  });

  it("winCheck returns null while every player is below the target", () => {
    const state = makeState({
      p1: { team: TEAM.red, k: MODES.ffa.killTarget - 1 },
      p2: { team: TEAM.blue, k: 0 },
    });
    const ctx = makeCtx(state);
    expect(FFA_MODE.winCheck(ctx)).toBeNull();
  });
});

describe("DOM_MODE — capture gauges", () => {
  const DT = 50; // ms; small so `now` stays inside a single 2 s scoring bucket
  const STEP = (MODES.dom.capturePerSec * DT) / 1000;

  it("moves a point's gauge toward the sole occupying team, holds when contested or empty", () => {
    const state = makeState();
    const ctx = makeCtx(state, {
      now: DT,
      occupants: {
        a: [{ id: "r1", team: TEAM.red, alive: true }],
        b: [{ id: "b1", team: TEAM.blue, alive: true }],
        c: [
          { id: "r2", team: TEAM.red, alive: true },
          { id: "b2", team: TEAM.blue, alive: true },
        ],
      },
    });
    DOM_MODE.tick(ctx, DT);
    expect(state.capA).toBeCloseTo(100 + STEP, 6); // red alone → gauge climbs toward red
    expect(state.capB).toBeCloseTo(100 - STEP, 6); // blue alone → gauge falls toward blue
    expect(state.capC).toBe(100); // contested → no movement
  });

  it("ignores dead occupants when judging point control", () => {
    const state = makeState();
    const ctx = makeCtx(state, { now: DT, occupants: { a: [{ id: "r1", team: TEAM.red, alive: false }] } });
    DOM_MODE.tick(ctx, DT);
    expect(state.capA).toBe(100); // a dead red doesn't count as controlling
  });

  it("clamps the gauge at the 0/200 rails instead of overshooting", () => {
    const state = makeState();
    state.capA = 200 - STEP / 2; // half a tick's worth below the red rail
    state.capC = STEP / 2; // half a tick's worth above the blue rail
    const ctx = makeCtx(state, {
      now: DT,
      occupants: {
        a: [{ id: "r1", team: TEAM.red, alive: true }],
        c: [{ id: "b1", team: TEAM.blue, alive: true }],
      },
    });
    DOM_MODE.tick(ctx, DT);
    expect(state.capA).toBe(200);
    expect(state.capC).toBe(0);
  });
});

describe("DOM_MODE — scoring & win", () => {
  it("awards a point per fully-owned capture point when a 2 s boundary is crossed", () => {
    const state = makeState();
    state.capA = 200; // red-owned
    state.capB = 0; // blue-owned
    state.capC = 100; // neutral — nobody scores it
    const ctx = makeCtx(state, { now: 2000 }); // now=2000, now-dtMs=1900 → crosses the 0/2000 boundary
    DOM_MODE.tick(ctx, 100);
    expect(state.redScore).toBe(MODES.dom.pointsPer2s);
    expect(state.blueScore).toBe(MODES.dom.pointsPer2s);
  });

  it("does not score again on a tick that stays inside the same 2 s bucket", () => {
    const state = makeState();
    state.capA = 200;
    const ctx = makeCtx(state, { now: 2100 }); // now-dtMs=2000, floor(2000/2000)===floor(2100/2000)
    DOM_MODE.tick(ctx, 100);
    expect(state.redScore).toBe(0);
  });

  it("onKill does not affect score — only capture-point ownership does", () => {
    const state = makeState();
    const ctx = makeCtx(state);
    DOM_MODE.onKill(ctx, "k1", "v1");
    expect(state.redScore).toBe(0);
    expect(state.blueScore).toBe(0);
  });

  it("winCheck returns the winner once a team's score reaches the dom target, else null", () => {
    const state = makeState();
    const ctx = makeCtx(state);
    state.redScore = MODES.dom.scoreTarget - 1;
    expect(DOM_MODE.winCheck(ctx)).toBeNull();
    state.redScore = MODES.dom.scoreTarget;
    expect(DOM_MODE.winCheck(ctx)).toEqual({ winner: "red" });

    state.redScore = 0;
    state.blueScore = MODES.dom.scoreTarget;
    expect(DOM_MODE.winCheck(ctx)).toEqual({ winner: "blue" });
  });
});

describe("PRACTICE_MODE", () => {
  it("onKill is a no-op — practice is a sandbox, not a scored match", () => {
    const state = makeState({ r1: { team: TEAM.red, k: 5 } });
    const ctx = makeCtx(state);
    PRACTICE_MODE.onKill(ctx, "r1", "v1");
    expect(state.redScore).toBe(0);
    expect(state.blueScore).toBe(0);
  });

  it("winCheck always returns null — practice never ends", () => {
    const state = makeState();
    const ctx = makeCtx(state);
    state.redScore = 999_999;
    state.blueScore = 999_999;
    expect(PRACTICE_MODE.winCheck(ctx)).toBeNull();
  });
});

describe("modeFromRoomId", () => {
  it("routes the ffa room id to FFA_MODE", () => {
    expect(modeFromRoomId("arena-ffa")).toBe(FFA_MODE);
  });

  it("falls back to TDM_MODE for the tdm room id and any unrecognized id", () => {
    expect(modeFromRoomId("arena-tdm")).toBe(TDM_MODE);
    expect(modeFromRoomId("some-other-room")).toBe(TDM_MODE);
  });

  it("routes the dom room id to DOM_MODE", () => {
    expect(modeFromRoomId("arena-dom")).toBe(DOM_MODE);
  });

  it("routes any arena-practice-<random> room id to PRACTICE_MODE by prefix", () => {
    expect(modeFromRoomId("arena-practice-a1b2c3d4")).toBe(PRACTICE_MODE);
    expect(modeFromRoomId("arena-practice-00000000")).toBe(PRACTICE_MODE);
  });
});

describe("MODE_ORDER & modeIndex", () => {
  it("orders tdm, ffa, dom, practice to match the documented wire encoding", () => {
    expect(MODE_ORDER).toEqual(["tdm", "ffa", "dom", "practice"]);
  });

  it("round-trips each mode id through its wire index", () => {
    for (let i = 0; i < MODE_ORDER.length; i++) {
      expect(modeIndex(MODE_ORDER[i]!)).toBe(i);
    }
  });
});

describe("mapForMode", () => {
  it("routes tdm/practice to ARENA1, dom to ARENA2, and ffa to ARENA3 (crossyard)", () => {
    expect(mapForMode("tdm")).toBe(ARENA1);
    expect(mapForMode("ffa")).toBe(ARENA3);
    expect(mapForMode("dom")).toBe(ARENA2);
    expect(mapForMode("practice")).toBe(ARENA1);
  });
});

describe("isTeamless", () => {
  it("is true for ffa and practice, false for tdm and dom", () => {
    expect(isTeamless("ffa")).toBe(true);
    expect(isTeamless("practice")).toBe(true);
    expect(isTeamless("tdm")).toBe(false);
    expect(isTeamless("dom")).toBe(false);
  });
});
