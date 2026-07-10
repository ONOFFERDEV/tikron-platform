/**
 * ironsight game modes (PLAN-IRONSIGHT M2 — tdm/ffa/dom). Each {@link GameMode} is a
 * pure object: it reads/writes {@link ArenaState} only through {@link ModeCtx}, with no
 * import of the room itself, so a test can drive a mode without a Durable Object.
 *
 * `state.mode` on the wire is the numeric index into {@link MODE_ORDER}.
 */
import { MODES, TEAM } from "./config.js";
import { ARENA1 } from "./map/arena1.js";
import { ARENA2 } from "./map/arena2.js";
import type { MapDef } from "./map/types.js";
import type { ArenaState } from "./schema.js";

export type ModeId = "tdm" | "ffa" | "dom" | "practice";

/** Wire encoding: `state.mode` is the index into this array. Append-only — an
 *  existing index must never move or its meaning changes for already-synced
 *  clients (practice is index 3, appended after M3's tdm/ffa/dom). */
export const MODE_ORDER: readonly ModeId[] = ["tdm", "ffa", "dom", "practice"];

/** The minimal room surface a mode needs — modes never import the room itself. */
export interface ModeCtx {
  state: ArenaState;
  /** Server-clock epoch ms (same clock as {@link ArenaState.matchEndMs}). */
  now: number;
  broadcast(type: string, payload: unknown): void;
  /** Players within `r` metres of `(x, z)` on the ground plane. */
  playersAt(x: number, z: number, r: number): { id: string; team: number; alive: boolean }[];
}

export interface GameMode {
  readonly id: ModeId;
  /** false = FFA (individual scoring, no team score). */
  readonly teams: boolean;
  /** A kill was recorded (room already bumped killer.k / victim.d) — update mode score. */
  onKill(ctx: ModeCtx, killerId: string, victimId: string): void;
  /** Periodic tick (capture-point gauges, timed scoring, etc). */
  tick(ctx: ModeCtx, dtMs: number): void;
  /** null = match continues; otherwise the match-ending result. */
  winCheck(ctx: ModeCtx): { winner: string } | null;
}

export const TDM_MODE: GameMode = {
  id: "tdm",
  teams: true,
  onKill(ctx, killerId) {
    const killer = ctx.state.players[killerId];
    if (!killer) return;
    if (killer.team === TEAM.red) ctx.state.redScore++;
    else ctx.state.blueScore++;
  },
  tick() {
    // Score-only mode; the time-limit end is judged by the room via matchEndMs.
  },
  winCheck(ctx) {
    if (ctx.state.redScore >= MODES.tdm.killTarget) return { winner: "red" };
    if (ctx.state.blueScore >= MODES.tdm.killTarget) return { winner: "blue" };
    return null;
  },
};

export const FFA_MODE: GameMode = {
  id: "ffa",
  teams: false,
  onKill() {
    // Personal score is state.players[id].k, already tracked by the room on every kill.
  },
  tick() {
    // No periodic scoring in FFA.
  },
  winCheck(ctx) {
    for (const [id, player] of Object.entries(ctx.state.players)) {
      if (player.k >= MODES.ffa.killTarget) return { winner: id };
    }
    return null;
  },
};

const CAP_KEYS = ["capA", "capB", "capC"] as const;
// Dom is always played on ARENA2 (see mapForMode below) — its capture points come
// straight from that map rather than a room-supplied value, since there is only
// ever one (mode, map) pairing for "dom".
const CAPTURE_POINTS = [
  { key: "capA" as const, point: ARENA2.caps.a },
  { key: "capB" as const, point: ARENA2.caps.b },
  { key: "capC" as const, point: ARENA2.caps.c },
];

export const DOM_MODE: GameMode = {
  id: "dom",
  teams: true,
  onKill() {
    // Kills don't score in dom; only capture-point ownership does.
  },
  tick(ctx, dtMs) {
    const step = (MODES.dom.capturePerSec * dtMs) / 1000;
    for (const { key, point } of CAPTURE_POINTS) {
      const occupants = ctx.playersAt(point.x, point.z, MODES.dom.captureRadius).filter((p) => p.alive);
      const hasRed = occupants.some((p) => p.team === TEAM.red);
      const hasBlue = occupants.some((p) => p.team === TEAM.blue);
      let gauge = ctx.state[key];
      if (hasRed && !hasBlue) gauge = Math.min(200, gauge + step);
      else if (hasBlue && !hasRed) gauge = Math.max(0, gauge - step);
      ctx.state[key] = gauge;
    }

    // Score owned points every 2 s, keyed off the server clock so no extra state is needed.
    const boundaryNow = Math.floor(ctx.now / 2000);
    const boundaryBefore = Math.floor((ctx.now - dtMs) / 2000);
    if (boundaryNow === boundaryBefore) return;
    let redOwned = 0;
    let blueOwned = 0;
    for (const key of CAP_KEYS) {
      const gauge = ctx.state[key];
      if (gauge >= 200) redOwned++;
      else if (gauge <= 0) blueOwned++;
    }
    ctx.state.redScore += redOwned * MODES.dom.pointsPer2s;
    ctx.state.blueScore += blueOwned * MODES.dom.pointsPer2s;
  },
  winCheck(ctx) {
    if (ctx.state.redScore >= MODES.dom.scoreTarget) return { winner: "red" };
    if (ctx.state.blueScore >= MODES.dom.scoreTarget) return { winner: "blue" };
    return null;
  },
};

/** A solo/bot sandbox: teamless (so shooting + bot targeting thread through the
 *  same teamless path FFA already uses), never scores, and never ends — the
 *  room additionally skips warmup and disables the mode-agnostic time-limit
 *  fallback for practice specifically (see arena-room.ts's onReady). */
export const PRACTICE_MODE: GameMode = {
  id: "practice",
  teams: false,
  onKill() {
    // No scoring in practice — it's a sandbox, not a scored match.
  },
  tick() {
    // Nothing to tick; practice has no timers or capture gauges of its own.
  },
  winCheck() {
    return null; // practice never ends
  },
};

/** Every room id practice matchmaking issues is `arena-practice-<random>` (a
 *  private per-request room — see index.ts's handleMatchmake) — matched by
 *  prefix, not exact equality, unlike the fixed tdm/ffa/dom room ids. */
export function modeFromRoomId(roomId: string): GameMode {
  if (roomId === "arena-ffa") return FFA_MODE;
  if (roomId === "arena-dom") return DOM_MODE;
  if (roomId.startsWith("arena-practice")) return PRACTICE_MODE;
  return TDM_MODE;
}

export function modeIndex(m: ModeId): number {
  return MODE_ORDER.indexOf(m);
}

/** The map a mode is played on — single source of truth for both the server (the
 *  room resolves it once from `modeFromRoomId(this.id)`) and the client (resolves
 *  it from `MODE_ORDER[state.mode]` once the first synced state arrives). */
export function mapForMode(mode: ModeId): MapDef {
  return mode === "dom" ? ARENA2 : ARENA1;
}

const TEAMS_BY_ID = new Map<ModeId, boolean>(
  [TDM_MODE, FFA_MODE, DOM_MODE, PRACTICE_MODE].map((m) => [m.id, m.teams]),
);

/** True for a mode with no team score (FFA, practice) — single source of truth
 *  for the client's "FFA-style" display (leaderboard instead of red-vs-blue),
 *  derived straight from each {@link GameMode}'s own `teams` field rather than a
 *  hardcoded list of mode ids the client would have to keep in sync by hand. */
export function isTeamless(mode: ModeId): boolean {
  return TEAMS_BY_ID.get(mode) === false;
}
