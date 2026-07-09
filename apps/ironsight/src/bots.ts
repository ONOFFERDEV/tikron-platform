import type { Vec2 } from "@tikron/sim";
import { xorshift32 } from "@tikron/sim";
import { ARENA1_BOXES } from "./map/arena1.js";
import { nearestBox, type Vec3 } from "./physics.js";
import { PLAYER } from "./config.js";

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
 * line-of-sight occlusion test against {@link ARENA1_BOXES}, and seeded gaussian aim
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
  self: BotPlayerView;
  enemies: readonly BotEnemyView[];
  /** True in teamless modes (FFA), where the room assigns everyone team=0 — target
   *  acquisition must not treat every other player as a "teammate". */
  teamless: boolean;
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
    aimNoiseRad: opts.aimNoiseRad ?? 0.012,
    reactionMs: opts.reactionMs ?? 150,
    aimHeight: opts.aimHeight ?? 1.0,
    waypoints: opts.waypoints,
    strafeZ: opts.strafeZ ?? 11,
    strafeAmp: opts.strafeAmp ?? 1.2,
    strafePeriodMs: opts.strafePeriodMs ?? 700,
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
    if (nearestBox(eye, dir, ARENA1_BOXES, dist) < dist) continue;
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

/** Sidestep along the depth axis while facing the enemy — see {@link BotBrainOptions.strafeZ}. */
function combatStrafe(brain: BotBrain, self: BotPlayerView, yaw: number): BotMoveIntent {
  const phase = Math.floor(brain.clockMs / brain.strafePeriodMs) % 2 === 0 ? 1 : -1;
  const targetZ = brain.strafeZ + phase * brain.strafeAmp;
  return worldToMove(yaw, 0, clamp(targetZ - self.z, -1, 1));
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

  const enemy = nearestVisibleEnemy(self, enemies, brain.aimHeight, view.teamless);

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
