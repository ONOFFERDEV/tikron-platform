/**
 * ironsight game modes (PLAN-IRONSIGHT M2 — tdm/ffa/dom). Each {@link GameMode} is a
 * pure object: it reads/writes {@link ArenaState} only through {@link ModeCtx}, with no
 * import of the room itself, so a test can drive a mode without a Durable Object.
 *
 * `state.mode` on the wire is the numeric index into {@link MODE_ORDER}.
 */
import { MODES, TEAM } from "./config.js";
import { ARENA1_CAPS } from "./map/arena1.js";
import type { ArenaState } from "./schema.js";

export type ModeId = "tdm" | "ffa" | "dom";

/** Wire encoding: `state.mode` is the index into this array. */
export const MODE_ORDER: readonly ModeId[] = ["tdm", "ffa", "dom"];

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
const CAPTURE_POINTS = [
  { key: "capA" as const, point: ARENA1_CAPS.a },
  { key: "capB" as const, point: ARENA1_CAPS.b },
  { key: "capC" as const, point: ARENA1_CAPS.c },
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

export function modeFromRoomId(roomId: string): GameMode {
  if (roomId === "arena-ffa") return FFA_MODE;
  if (roomId === "arena-dom") return DOM_MODE;
  return TDM_MODE;
}

export function modeIndex(m: ModeId): number {
  return MODE_ORDER.indexOf(m);
}
