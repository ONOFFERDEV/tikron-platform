import type { Vec2 } from "@tikron/sim";
import { xorshift32 } from "@tikron/sim";
import { nearestBox, type Box, type Vec3 } from "./physics.js";
import { PLAYER } from "./config.js";
import { GAME } from "./game-config.js";

/**
 * ironsight server filler bot — a pure brain with no room import.
 *
 * {@link botThink} takes the world *as the bot perceives it* ({@link BotView}) plus
 * its own mutable state ({@link BotBrain}) and a tick delta, and returns the intents
 * to apply this tick ({@link BotDecision}). The room injects that decision through the
 * SAME code paths real player intents use (input map writes, look field writes, the
 * shared fire handler) — this file never talks to a socket or a `Client`.
 *
 * Ported from `tools/bots/arena-bot.ts` (the E2E test-harness bot): waypoint patrol,
 * line-of-sight occlusion test against the active map's boxes (passed in via
 * {@link BotView.boxes} — a filler bot on a dom room must occlude against arena2's
 * geometry, not arena1's), and seeded gaussian aim
 * error. Ammo/reload/fire-cadence modelling from the harness is dropped here — the
 * room's own authoritative ammo/cooldown state already gates the bot's `fire` intent
 * the same way it gates a real player's, so the brain only needs to decide *want to
 * shoot*, not *am I allowed to*. A reaction-delay difficulty knob (new, not present in
 * the harness) holds the trigger cold for a beat after a target is first acquired.
 *
 * Note: no "unstick" (vertical nudge) logic exists in the ported source — omitted
 * here rather than invented; the room's normal collision/ground resolution already
 * governs the y-axis for bot-driven players the same as for real ones.
 */

const TAU = Math.PI * 2;

/**
 * DOM-only: movement toward the objective is the DEFAULT regardless of enemy
 * visibility — aim/fire always track a visible enemy the same way combat does,
 * only the MOVE vector differs. Gating travel on mere visibility (the legacy
 * tdm/ffa rule below) doesn't work here: arena2 has no lane dividers, so an
 * enemy is visible from across the whole open map almost constantly, and that
 * would freeze every dom bot's push to the cap nearly all the time. Only a
 * genuinely close threat gets brief combat priority. */
const CLOSE_THREAT_M = GAME.bots.closeThreatM;
/** DOM-only: once this close to the objective, hold position (strafe around the
 *  objective's own z) instead of continuing to walk straight through the point. */
const OBJECTIVE_ARRIVE_M = GAME.bots.objectiveArriveM;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export interface BotMoveIntent {
  mx: number;
  mz: number;
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
}

export interface BotLookIntent {
  yaw: number;
  pitch: number;
}

/** What the bot brain decides this tick. */
export interface BotDecision {
  move: BotMoveIntent;
  look: BotLookIntent;
  fire: boolean;
  switchSlot?: number;
}

/** The subset of a player's state the bot brain can see (itself or an enemy). */
export interface BotPlayerView {
  x: number;
  y: number;
  z: number;
  crouch: boolean;
  alive: boolean;
  team: number;
}

export interface BotEnemyView extends BotPlayerView {
  id: string;
}

/** The world as the bot perceives it this tick: own state, enemy list, map constants. */
export interface BotView {
  self: BotPlayerView & {
    /** Current facing (radians) — read only by the passive branch below, to hold
     *  the bot's existing look instead of snapping it to a fixed direction every
     *  tick; combat/patrol logic derives its own look from aiming or waypoints
     *  and never reads this. */
    yaw: number;
    pitch: number;
  };
  enemies: readonly BotEnemyView[];
  /** True in teamless modes (FFA), where the room assigns everyone team=0 — target
   *  acquisition must not treat every other player as a "teammate". */
  teamless: boolean;
  /** The active room's map geometry, for line-of-sight occlusion (arena1 for
   *  tdm/ffa, arena2 for dom — see modes.ts's mapForMode). */
  boxes: readonly Box[];
  /** DOM-only: the reachable point (capWaypoints anchor, else the cap's own
   *  centre) on the nearest capture point this bot's team hasn't fully secured —
   *  undefined outside dom, or once every point is already owned in this team's
   *  favour (falls back to the plain waypoint patrol below). Set by the room
   *  (arena-room.ts's botView), never computed here. */
  objective?: { x: number; z: number };
  /** Practice-only: a fully passive target — no movement, no aim tracking, no
   *  firing, holding its current look (see botThink's very first check). Every
   *  other mode leaves this undefined. Set by the room. */
  passive?: boolean;
}

export interface BotBrainOptions {
  /** PRNG seed for the aim-noise stream (fixed → reproducible runs). */
  seed: number;
  /** Patrol path in the ground plane (`x`, `z`); the bot loops through it. */
  waypoints: readonly Vec2[];
  /** Std-dev of the gaussian angular aim error, radians (default 0.012 ≈ 0.7°) — difficulty knob. */
  aimNoiseRad?: number;
  /** Delay before pulling the trigger on a newly-acquired target, ms (default 150) — difficulty knob. */
  reactionMs?: number;
  /** Aim from the muzzle at this height above the target's feet (default chest). */
  aimHeight?: number;
  /** Combat-strafe anchor + amplitude on the depth (`z`) axis, metres (default 11 ± 1.2). */
  strafeZ?: number;
  strafeAmp?: number;
  /** Half-period of the strafe oscillation, ms (default 700). */
  strafePeriodMs?: number;
}

/** Per-bot mutable state, held by the caller and threaded through every {@link botThink} call. */
export interface BotBrain {
  readonly aimNoiseRad: number;
  readonly reactionMs: number;
  readonly aimHeight: number;
  readonly waypoints: readonly Vec2[];
  readonly strafeZ: number;
  readonly strafeAmp: number;
  readonly strafePeriodMs: number;
  readonly rng: () => number;
  wpIndex: number;
  clockMs: number;
  spareNormal: number;
  hasSpare: boolean;
  lockId: string | null;
  lockMs: number;
}

export function createBotBrain(opts: BotBrainOptions): BotBrain {
  if (opts.waypoints.length === 0) throw new Error("bot brain needs at least one waypoint");
  return {
    aimNoiseRad: opts.aimNoiseRad ?? GAME.bots.aimNoiseRad,
    reactionMs: opts.reactionMs ?? GAME.bots.reactionMs,
    aimHeight: opts.aimHeight ?? GAME.bots.aimHeight,
    waypoints: opts.waypoints,
    strafeZ: opts.strafeZ ?? GAME.bots.strafeZ,
    strafeAmp: opts.strafeAmp ?? GAME.bots.strafeAmp,
    strafePeriodMs: opts.strafePeriodMs ?? GAME.bots.strafePeriodMs,
    rng: xorshift32(opts.seed >>> 0 || 1),
    wpIndex: 0,
    clockMs: 0,
    spareNormal: 0,
    hasSpare: false,
    lockId: null,
    lockMs: 0,
  };
}

function uniform(brain: BotBrain): number {
  return brain.rng() / 0x1_0000_0000;
}

/** One standard-normal sample (Box–Muller, cached in pairs). */
function gaussian(brain: BotBrain): number {
  if (brain.hasSpare) {
    brain.hasSpare = false;
    return brain.spareNormal;
  }
  const u1 = 1 - uniform(brain);
  const u2 = uniform(brain);
  const mag = Math.sqrt(-2 * Math.log(u1));
  brain.spareNormal = mag * Math.sin(TAU * u2);
  brain.hasSpare = true;
  return mag * Math.cos(TAU * u2);
}

function eyeHeight(p: BotPlayerView): number {
  return p.crouch ? PLAYER.crouchEye : PLAYER.standEye;
}

function aimPoint(p: BotPlayerView, aimHeight: number): Vec3 {
  return { x: p.x, y: p.y + aimHeight, z: p.z };
}

/** Nearest alive enemy with clear line of sight from the muzzle, else null. `teamless`
 *  skips the team-equality check (FFA: everyone is team=0, so it would otherwise
 *  reject every other player as a false-positive "teammate"). */
function nearestVisibleEnemy(
  self: BotPlayerView,
  enemies: readonly BotEnemyView[],
  aimHeight: number,
  teamless: boolean,
  boxes: readonly Box[],
): BotEnemyView | null {
  const eye: Vec3 = { x: self.x, y: self.y + eyeHeight(self), z: self.z };
  let best: BotEnemyView | null = null;
  let bestDist = Infinity;
  for (const p of enemies) {
    if (!p.alive || (!teamless && p.team === self.team)) continue;
    const aim = aimPoint(p, aimHeight);
    const dx = aim.x - eye.x;
    const dy = aim.y - eye.y;
    const dz = aim.z - eye.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist === 0 || dist >= bestDist) continue;
    const dir: Vec3 = { x: dx / dist, y: dy / dist, z: dz / dist };
    if (nearestBox(eye, dir, boxes, dist) < dist) continue;
    best = p;
    bestDist = dist;
  }
  return best;
}

/** Yaw/pitch from the bot's muzzle to an enemy, plus seeded gaussian error. */
function aimAt(brain: BotBrain, self: BotPlayerView, enemy: BotPlayerView): BotLookIntent {
  const eye: Vec3 = { x: self.x, y: self.y + eyeHeight(self), z: self.z };
  const aim = aimPoint(enemy, brain.aimHeight);
  const dx = aim.x - eye.x;
  const dy = aim.y - eye.y;
  const dz = aim.z - eye.z;
  const horiz = Math.hypot(dx, dz);
  let yaw = Math.atan2(dx, dz);
  const pitch = Math.atan2(dy, horiz) + gaussian(brain) * brain.aimNoiseRad;
  yaw += gaussian(brain) * brain.aimNoiseRad;
  yaw = ((yaw % TAU) + TAU) % TAU;
  return { yaw, pitch };
}

/** Convert a world-space move direction to WASD in the bot's facing frame. */
function worldToMove(yaw: number, wx: number, wz: number): BotMoveIntent {
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const mz = clamp(wx * sy + wz * cy, -1, 1);
  const mx = clamp(wx * cy - wz * sy, -1, 1);
  return { mx, mz, jump: false, crouch: false, sprint: false };
}

/** Unit world-space direction from `from` to `to` ({x:0,z:0} if coincident). */
function dirTo(from: { x: number; z: number }, to: { x: number; z: number }): { x: number; z: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  return len < 1e-6 ? { x: 0, z: 0 } : { x: dx / len, z: dz / len };
}

/** Sidestep along the depth axis while facing a target: oscillates between
 *  `anchorZ ± strafeAmp` (half-period `strafePeriodMs`), converted to WASD via
 *  `yaw`. Factored out of {@link combatStrafe} so {@link domThink}'s "hold the
 *  objective" case can anchor the oscillation on the objective's own z instead
 *  of the brain's unrelated tuned default (see {@link BotBrainOptions.strafeZ}). */
function strafeAround(brain: BotBrain, self: BotPlayerView, yaw: number, anchorZ: number): BotMoveIntent {
  const phase = Math.floor(brain.clockMs / brain.strafePeriodMs) % 2 === 0 ? 1 : -1;
  const targetZ = anchorZ + phase * brain.strafeAmp;
  return worldToMove(yaw, 0, clamp(targetZ - self.z, -1, 1));
}

/** Sidestep along the depth axis while facing the enemy — see {@link BotBrainOptions.strafeZ}. */
function combatStrafe(brain: BotBrain, self: BotPlayerView, yaw: number): BotMoveIntent {
  return strafeAround(brain, self, yaw, brain.strafeZ);
}

/** Loop the patrol cursor forward once the bot reaches the current waypoint. */
function advanceWaypoint(brain: BotBrain, self: BotPlayerView): Vec2 {
  const wp = brain.waypoints[brain.wpIndex] ?? { x: self.x, y: self.z };
  if (Math.hypot(wp.x - self.x, wp.y - self.z) < 1.0) {
    brain.wpIndex = (brain.wpIndex + 1) % brain.waypoints.length;
  }
  return wp;
}

/**
 * Decide this tick's intents from the perceived world. Pure given `view` and `brain`'s
 * current contents — `brain` is the caller-owned mutable state threaded through every
 * call (patrol cursor, aim-noise RNG stream, target-lock timer), so this function never
 * imports the room and never reaches for a wall clock.
 */
export function botThink(view: BotView, brain: BotBrain, dtMs: number): BotDecision {
  brain.clockMs += dtMs;
  const { self, enemies } = view;

  // Practice-only: a fully passive target — no movement, no aim tracking, no
  // firing. Holds its current look (self.yaw/pitch) rather than snapping to a
  // fixed direction every tick, so it doesn't visibly "reset" facing in place.
  if (view.passive) {
    return {
      move: { mx: 0, mz: 0, jump: false, crouch: false, sprint: false },
      look: { yaw: self.yaw, pitch: self.pitch },
      fire: false,
    };
  }

  if (!self.alive) {
    brain.wpIndex = 0;
    brain.lockId = null;
    brain.lockMs = 0;
    return {
      move: { mx: 0, mz: 0, jump: false, crouch: false, sprint: false },
      look: { yaw: 0, pitch: 0 },
      fire: false,
    };
  }

  const enemy = nearestVisibleEnemy(self, enemies, brain.aimHeight, view.teamless, view.boxes);

  // DOM-only branch (see BotView.objective's doc comment). Every other mode (and
  // dom once every point is owned) falls through to the legacy logic below,
  // completely unchanged.
  if (view.objective) return domThink(view.objective, self, enemy, brain, dtMs);

  if (!enemy) {
    brain.lockId = null;
    brain.lockMs = 0;
    const wp = advanceWaypoint(brain, self);
    const yaw = Math.atan2(wp.x - self.x, wp.y - self.z);
    return {
      look: { yaw, pitch: 0 },
      move: { mx: 0, mz: 1, jump: false, crouch: false, sprint: false },
      fire: false,
    };
  }

  // Reaction delay: the trigger stays cold for `reactionMs` after a new target is
  // acquired, even though the bot already turns to face it — mimics human target lag.
  if (brain.lockId !== enemy.id) {
    brain.lockId = enemy.id;
    brain.lockMs = 0;
  } else {
    brain.lockMs += dtMs;
  }

  const look = aimAt(brain, self, enemy);
  const move = combatStrafe(brain, self, look.yaw);
  const fire = brain.lockMs >= brain.reactionMs;
  return { look, move, fire };
}

/**
 * DOM-only decision path. Aim/fire ALWAYS track a visible enemy (identical
 * lock/reaction-delay + aim as combat) regardless of what the bot is doing —
 * only the MOVE vector changes:
 *  - a genuinely close threat (`CLOSE_THREAT_M`) gets brief combat-priority
 *    evasive strafing, same as the legacy branch;
 *  - otherwise, movement pushes toward the objective BY DEFAULT, visible enemy
 *    or not — the legacy branch above freezes its waypoint cursor the instant
 *    ANY enemy is visible, and on arena2's open, divider-free sightlines that's
 *    nearly always true, so a dom bot would otherwise never reach a point;
 *  - once within `OBJECTIVE_ARRIVE_M`, hold there — strafing around the
 *    OBJECTIVE'S OWN z, not the brain's unrelated tuned {@link BotBrainOptions.strafeZ}
 *    default (11), which would otherwise pull an arrived bot straight back off
 *    a cap sitting at a different z.
 */
function domThink(
  objective: { x: number; z: number },
  self: BotPlayerView,
  enemy: BotEnemyView | null,
  brain: BotBrain,
  dtMs: number,
): BotDecision {
  let look: BotLookIntent;
  let fire = false;
  if (enemy) {
    if (brain.lockId !== enemy.id) {
      brain.lockId = enemy.id;
      brain.lockMs = 0;
    } else {
      brain.lockMs += dtMs;
    }
    look = aimAt(brain, self, enemy);
    fire = brain.lockMs >= brain.reactionMs;
  } else {
    brain.lockId = null;
    brain.lockMs = 0;
    look = { yaw: Math.atan2(objective.x - self.x, objective.z - self.z), pitch: 0 };
  }

  const enemyDist = enemy ? Math.hypot(enemy.x - self.x, enemy.y - self.y, enemy.z - self.z) : Infinity;
  if (enemy && enemyDist < CLOSE_THREAT_M) {
    // Very close threat: brief combat-priority evasive strafing beats the push.
    return { look, move: combatStrafe(brain, self, look.yaw), fire };
  }

  const distToObjective = Math.hypot(objective.x - self.x, objective.z - self.z);
  if (distToObjective <= OBJECTIVE_ARRIVE_M) {
    return { look, move: strafeAround(brain, self, look.yaw, objective.z), fire };
  }

  // Default: push toward the objective — converts the world-space direction
  // into a move intent relative to wherever we're currently looking (mirrors
  // how combatStrafe lets a bot strafe sideways while keeping its aim on target).
  const dir = dirTo(self, objective);
  return { look, move: worldToMove(look.yaw, dir.x, dir.z), fire };
}
