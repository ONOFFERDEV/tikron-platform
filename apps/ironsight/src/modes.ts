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
import { ARENA3 } from "./map/arena3.js";
import type { MapDef } from "./map/types.js";
import type { ArenaState } from "./schema.js";
import type { ShowcaseRole } from "./bots.js";

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
  /** Actual uncontested gauge movement, for non-scoring round honors. */
  captureProgress?(ids: readonly string[], gauge: number): void;
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
      const progress = Math.abs(gauge - ctx.state[key]);
      if (progress > 0) ctx.captureProgress?.(occupants.map(p => p.id), progress);
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

/** One row per {@link ShowcaseRole}, positioned/named for arena-room.ts's practice
 *  bot fill + client/main.ts's scoreboard name lookup. */
export interface ShowcaseBotDef {
  readonly id: string;
  readonly role: ShowcaseRole;
  readonly label: string;
  readonly x: number;
  readonly z: number;
  /** Metres either side of `z` the bot paces (0 = stationary). */
  readonly amp: number;
}

/**
 * Practice-mode-only demonstration roster: one bot per {@link ShowcaseRole}, so a
 * solo player can see every crouch/sprint animation without needing a second
 * client. Practice is always played on ARENA1 (see {@link mapForMode}), and these
 * positions are specific to it: all sit at x=12 — 8 m ahead, along +x, of the
 * room's first (teamless round-robin) spawn point {x:4,z:6} (arena-room.ts's
 * spawnInto pins showcase bots here regardless of the round-robin, including on
 * respawn) — and every ARENA1_BOXES entry starts at x=14+, so that whole Z range
 * is clear of interior geometry. Reciprocating bots pace along Z: the practice
 * spawn faces yaw=π/2 (+x, see GAME.teams.spawnFacingYaw), so Z is what reads as
 * left-right on screen — a profile-view gait, not a toward/away foreshortened one.
 */
// All amps are 0 since the stand-still change (2026-07-23, user request): every
// role now holds its position — bots.ts's showcaseThink no longer has a pacing
// branch, so a non-zero amp would be inert anyway. The field stays on
// ShowcaseBotDef (and arena-room still builds the waypoints) so restoring
// movement later is a data-only change back here.
export const PRACTICE_SHOWCASE_BOTS: readonly ShowcaseBotDef[] = [
  { id: "bot-idle", role: "idle", label: "IDLE", x: 10, z: 39, amp: 0 },
  { id: "bot-crouch", role: "crouch", label: "CROUCH", x: 10, z: 43, amp: 0 },
  { id: "bot-sneak", role: "sneak", label: "SNEAK", x: 10, z: 47, amp: 0 },
  { id: "bot-walk", role: "walk", label: "WALK", x: 10, z: 51, amp: 0 },
  { id: "bot-sprint", role: "sprint", label: "SPRINT", x: 10, z: 55, amp: 0 },
];

/** The stationary showcase roles face back along this yaw so their pose reads
 *  head-on to the spawning player (who faces the opposite way, +x, toward them). */
export const PRACTICE_SHOWCASE_FACE_YAW = -Math.PI / 2;

/** id → scoreboard label for the showcase roster — client/main.ts's name() checks
 *  this before falling back to the generic "BOT{n}" naming other modes' bots use. */
export const PRACTICE_SHOWCASE_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  PRACTICE_SHOWCASE_BOTS.map((b) => [b.id, b.label]),
);

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
  // Hardcoded on purpose: modes.ts cannot import GAME (game-config) without a
  // module cycle (ironsight.config imports MODE_ORDER from here at eval time —
  // the W2 revert), so the config's `mapFor` record is documentation/blueprint
  // data and THIS ternary is the app's live authority. Keep the two in sync —
  // the arena3 wiring shipped with only the config edited, which silently left
  // ffa running on arena1 while every arena3-coordinate consumer (bots,
  // metrics, spawn seeding) assumed arena3: invisible-wall wedges + shots
  // eaten by arena1's lane dividers, all with individually-correct-looking
  // forensics.
  return mode === "dom" ? ARENA2 : mode === "ffa" ? ARENA3 : ARENA1;
}

/** Which practice map a room id encodes: `arena-practice-arena2-<rand>` → "arena2",
 *  `arena-practice-arena3-<rand>` → "arena3", anything else (including the plain
 *  `arena-practice-<rand>` every pre-existing practice session already uses) →
 *  "arena1". Matched by prefix, same as {@link modeFromRoomId}. */
export function practiceMapKeyFromRoomId(roomId: string): "arena1" | "arena2" | "arena3" {
  if (roomId.startsWith("arena-practice-arena2-")) return "arena2";
  if (roomId.startsWith("arena-practice-arena3-")) return "arena3";
  return "arena1";
}

/** The map a (mode, room id) pair is played on — the single source of truth for
 *  practice map selection. Every non-practice mode still has exactly one map
 *  ({@link mapForMode} decides it); practice is the one mode with more than
 *  one, resolved from the room id via {@link practiceMapKeyFromRoomId}. Both
 *  the server (arena-room.ts, from its own `this.id`) and the client
 *  (main.ts, from the matchmake response's `room`) feed the same string into
 *  this function, so they can never resolve different maps for the same
 *  session. */
export function mapForRoom(mode: ModeId, roomId: string): MapDef {
  if (mode !== "practice") return mapForMode(mode);
  const key = practiceMapKeyFromRoomId(roomId);
  return key === "arena2" ? ARENA2 : key === "arena3" ? ARENA3 : ARENA1;
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
