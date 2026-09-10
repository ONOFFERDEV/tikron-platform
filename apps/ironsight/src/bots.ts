import type { Vec2 } from "@tikron/sim";
import { xorshift32 } from "@tikron/sim";
import { nearestBox, type Box, type Vec3 } from "./physics.js";
import { PLAYER } from "./config.js";
import { GAME } from "./game-config.js";
import type { BotRole } from './bot-roles.js';

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

/** Difficulty changes observation time and decision depth, never weapon stats
 * or aim error. Hard is the existing live-room default. */
export const BOT_DIFFICULTIES = {
  easy: { reactionMs: 600, depth: 1 },
  regular: { reactionMs: 300, depth: 2 },
  hard: { reactionMs: 150, depth: 3 },
} as const;
export type BotDifficulty = keyof typeof BOT_DIFFICULTIES;
export const BOT_ARCHETYPES = {
  rusher: { label: 'RUSH', weapon: 1, reactionExtraMs: 0, range: 28, closeTo: 9,
    reloadFraction: .15, preferCrouch: false },
  anchor: { label: 'ANCHOR', weapon: 0, reactionExtraMs: 30, range: 36, closeTo: 22,
    reloadFraction: .25, preferCrouch: true },
  marksman: { label: 'MARKSMAN', weapon: 3, reactionExtraMs: 50, range: 40, closeTo: 14,
    reloadFraction: .2, preferCrouch: false },
  support: { label: 'SUPPORT', weapon: 0, reactionExtraMs: 25, range: 34, closeTo: 24,
    reloadFraction: .35, preferCrouch: true },
} as const;
export type BotArchetype = keyof typeof BOT_ARCHETYPES;
const SQUAD: readonly BotArchetype[] = ['rusher', 'anchor', 'marksman', 'rusher', 'support', 'marksman'];
export function combatBotArchetype(id: string): BotArchetype | undefined {
  if (!/^bot-[1-9]\d*$/.test(id)) return;
  const n = Number(id.slice(4));
  return Number.isSafeInteger(n) ? SQUAD[Math.floor((n - 1) / 2) % SQUAD.length] : undefined;
}
export function combatBotLabel(id: string): string | undefined {
  const role = combatBotArchetype(id);
  return role ? `${BOT_ARCHETYPES[role].label} ${id.slice(4)}` : undefined;
}

/** y is feet height, when supplied. Never consider the floor below a roof an
 * arrival. A navigator owns the route; the brain only sends movement intents. */
export interface BotRoutePoint { x: number; z: number; y?: number }
export interface BotCover { point: Vec3; crouch: boolean }
export function botReached(self: Vec3, target: BotRoutePoint, radius = 1): boolean {
  return Math.hypot(target.x - self.x, target.z - self.z) < radius &&
    (target.y === undefined || Math.abs(target.y - self.y) < .45);
}

/** Fair perception, shared by all combat bots. Sound is an expiring location,
 * never a target id or permission to fire. No hidden-player pursuit. */
export const BOT_PERCEPTION = {
  acquireHalfAngle: Math.PI / 3, trackHalfAngle: Math.PI * 4 / 9,
  hearingRange: 28, occludedHearingRange: 10, soundMemoryMs: 1250,
  soundRefreshMs: 250, turnRadiansPerSecond: 6,
} as const;

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
  ads?: boolean;
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
  reload?: boolean;
  tactic?: 'reload' | 'retreat' | 'suppress' | 'position' | 'hold';
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

/** Practice-only demonstration roles — see {@link showcaseThink}. */
export type ShowcaseRole = "idle" | "walk" | "sprint" | "crouch" | "sneak";

/** What a showcase bot needs beyond its role: a fixed facing for the stationary
 *  roles (idle/crouch), pointed back at the spawning player — supplied by the
 *  room, which is the one that knows which way the practice spawn faces. */
export interface ShowcaseView {
  role: ShowcaseRole;
  faceYaw: number;
}

/** The world as the bot perceives it this tick: own state, enemy list, map constants. */
export interface BotView {
  /** Expanded arenas: keep patrolling until an effective fight is in range. */
  engagementRange?: number;
  /** Optional game-owned route steering, independent of aim/hit validation. */
  navigate?: (target: BotRoutePoint) => BotRoutePoint;
  findCover?: (threat: Vec3, depth: number, preferCrouch: boolean) => BotCover | undefined;
  ammo?: { mag: number; capacity: number; reserve: number; reloading: boolean };
  self: BotPlayerView & {
    /** Current facing, used to bound acquisition and tracking speed. */
    yaw: number;
    pitch: number;
    hp?: number;
  };
  enemies: readonly BotEnemyView[];
  /** True in teamless modes (FFA), where the room assigns everyone team=0 — target
   *  acquisition must not treat every other player as a "teammate". */
  teamless: boolean;
  /** The active room's map geometry, for line-of-sight occlusion (arena1 for
   *  tdm/ffa, arena2 for dom — see modes.ts's mapForMode). */
  boxes: readonly Box[];
  /** Room-assigned reachable capture/defence anchor or event-route target.
   * Allied assignments commit briefly so distant fights don't attract every bot.
   * This never supplies enemy positions or changes perception/fire rules. */
  objective?: BotRoutePoint;
  /** Intermediate covered approach, separate from the actual hold/duel anchor. */
  objectiveApproach?: BotRoutePoint;
  /** Static map approach to watch AFTER arrival, never a hidden enemy location.
   * Event-route volunteers omit this so they keep looking along their route. */
  objectiveWatch?: { x: number; z: number };
  /** Practice-only: demonstrates one locomotion state instead of patrolling/
   *  fighting (see botThink's very first check → {@link showcaseThink}). Every
   *  other mode leaves this undefined. Set by the room. */
  showcase?: ShowcaseView;
}

export interface BotBrainOptions {
  flankRoute?: readonly BotRoutePoint[];
  patrolRoute?: readonly BotRoutePoint[];
  archetype?: BotArchetype;
  difficulty?: BotDifficulty;
  role?: BotRole;
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
  readonly flankRoute?: readonly BotRoutePoint[];
  readonly patrolRoute?: readonly BotRoutePoint[];
  readonly archetype?: BotArchetype;
  readonly difficulty: BotDifficulty;
  readonly decisionDepth: number;
  flank?: { points: readonly BotRoutePoint[]; index: number; untilMs: number };
  positioning?: { point: Vec3; untilMs: number; holdUntilMs?: number };
  recentThreat?: Vec3 & { untilMs: number };
  recovery?: BotCover & { startedMs: number; untilMs: number; reason: 'reload' | 'retreat' };
  nextCoverMs: number;
  nextRetreatMs: number;
  readonly role?: BotRole;
  sound?: { x: number; z: number; untilMs: number };
  nextSoundMs: number;
  engagementZ?: number;
  objectiveDuel?: { targetId: string; objectiveX: number; objectiveZ: number; z: number };
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
  const archetype = opts.archetype ?? (opts.role === 'sniper' ? 'marksman' : opts.role);
  const difficulty = opts.difficulty ?? 'hard';
  const tuning = BOT_DIFFICULTIES[difficulty];
  return {
    flankRoute: opts.flankRoute,
    patrolRoute: opts.patrolRoute,
    archetype,
    difficulty,
    decisionDepth: tuning.depth,
    // Legacy role remains for existing objective/perception consumers.
    role: opts.role ?? (archetype === 'marksman' ? 'sniper' : archetype === 'support' ? 'anchor' : archetype),
    nextCoverMs: 0,
    nextRetreatMs: 0,
    nextSoundMs: 0,
    aimNoiseRad: opts.aimNoiseRad ?? GAME.bots.aimNoiseRad,
    reactionMs: opts.reactionMs ?? (archetype || opts.difficulty
      ? Math.min(600, tuning.reactionMs + (archetype ? BOT_ARCHETYPES[archetype].reactionExtraMs : 0))
      : GAME.bots.reactionMs),
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

/** Called only for an accepted server shot or confirmed victim damage.
 * Copy the point: subsequent movement by its source cannot update the memory. */
export function alertBot(brain: BotBrain, point: { x: number; z: number }, damage = false): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return;
  if (!damage && brain.clockMs < brain.nextSoundMs) return;
  brain.sound = { x: point.x, z: point.z, untilMs: brain.clockMs + BOT_PERCEPTION.soundMemoryMs };
  brain.nextSoundMs = brain.clockMs + BOT_PERCEPTION.soundRefreshMs;
}

export function resetBotPerception(brain: BotBrain): void {
  brain.recentThreat = undefined;
  brain.recovery = undefined;
  brain.nextCoverMs = 0;
  brain.nextRetreatMs = 0;
  brain.flank = undefined;
  brain.positioning = undefined;
  brain.sound = undefined;
  brain.nextSoundMs = 0;
  brain.lockId = null;
  brain.lockMs = 0;
  brain.engagementZ = undefined;
  brain.objectiveDuel = undefined;
}

/** One route per life, oriented from the nearer end of an authored lane.
 * Close fights can interrupt movement but cannot secretly retarget the route.
 * A 35s deadline bounds stale commitments; DOM/core assignments cancel them. */
export function startBotFlank(brain: BotBrain, self: {x:number;z:number}): void {
  const route = brain.flankRoute, first = route?.[0], last = route?.at(-1);
  if (brain.role !== 'rusher' || brain.decisionDepth < 2 || !route || !first || !last) return;
  const reverse = Math.hypot(last.x-self.x,last.z-self.z) < Math.hypot(first.x-self.x,first.z-self.z);
  brain.flank = { points: reverse ? [...route].reverse() : route, index: 0, untilMs: brain.clockMs + 35000 };
}

/** A reachable, map-derived firing position, selected from the bot's own spawn.
 * Higher decision depth buys route planning, never a health/aim advantage.
 * One bounded trip and a six-second hold per life; objectives take priority. */
export function startBotPosition(brain: BotBrain, point: Vec3 | undefined): void {
  if (brain.archetype !== 'marksman' || brain.decisionDepth < 2 || !point) return;
  brain.positioning = { point: { ...point }, untilMs: brain.clockMs + 35000 };
}

function flankTarget(brain: BotBrain, self: BotPlayerView): BotRoutePoint | undefined {
  const route = brain.flank;
  if (!route) return;
  if (brain.clockMs >= route.untilMs) { brain.flank = undefined; return; }
  let point = route.points[route.index];
  while (point && botReached(self, point)) point = route.points[++route.index];
  if (!point) brain.flank = undefined;
  return point;
}

/** Uses current authoritative cover, including ramps and the core shutters. */
export function botHearsShot(self: BotPlayerView, source: Vec3, boxes: readonly Box[]): boolean {
  const eye = { x: self.x, y: self.y + eyeHeight(self), z: self.z };
  const dx = source.x - eye.x, dy = source.y - eye.y, dz = source.z - eye.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > BOT_PERCEPTION.hearingRange) return false;
  if (d <= BOT_PERCEPTION.occludedHearingRange) return true;
  return nearestBox(eye, { x: dx / d, y: dy / d, z: dz / d }, boxes, d) >= d;
}

function turnToward(self: BotView['self'], yaw: number, pitch: number, dtMs: number): BotLookIntent {
  const step = Math.max(0, Math.min(100, dtMs)) / 1000;
  const delta = Math.atan2(Math.sin(yaw - self.yaw), Math.cos(yaw - self.yaw));
  const turn = BOT_PERCEPTION.turnRadiansPerSecond * step;
  return { yaw: ((self.yaw + clamp(delta, -turn, turn)) % TAU + TAU) % TAU,
    pitch: self.pitch + clamp(pitch - self.pitch, -4 * step, 4 * step) };
}

function searchLook(self: BotView['self'], brain: BotBrain, target: { x: number; z: number }, dtMs: number): BotLookIntent {
  const point = brain.sound ?? target;
  return turnToward(self, Math.atan2(point.x - self.x, point.z - self.z), 0, dtMs);
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
export function nearestVisibleEnemy(
  self: BotView['self'],
  enemies: readonly BotEnemyView[],
  aimHeight: number,
  teamless: boolean,
  boxes: readonly Box[],
  maxDistance = Infinity,
  lockId: string | null = null,
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
    if (dist === 0 || dist >= bestDist || dist > maxDistance) continue;
    const bearing = Math.atan2(dx, dz) - self.yaw;
    const halfAngle = p.id === lockId ? BOT_PERCEPTION.trackHalfAngle : BOT_PERCEPTION.acquireHalfAngle;
    if (Math.abs(Math.atan2(Math.sin(bearing), Math.cos(bearing))) > halfAngle) continue;
    const dir: Vec3 = { x: dx / dist, y: dy / dist, z: dz / dist };
    if (nearestBox(eye, dir, boxes, dist) < dist) continue;
    best = p;
    bestDist = dist;
  }
  return best;
}

/** Yaw/pitch from the bot's muzzle to an enemy, plus seeded gaussian error. */
function aimAt(brain: BotBrain, self: BotView["self"], enemy: BotPlayerView, dtMs: number): BotLookIntent {
  const eye: Vec3 = { x: self.x, y: self.y + eyeHeight(self), z: self.z };
  const aim = aimPoint(enemy, brain.aimHeight);
  const dx = aim.x - eye.x;
  const dy = aim.y - eye.y;
  const dz = aim.z - eye.z;
  const horiz = Math.hypot(dx, dz);
  let yaw = Math.atan2(dx, dz);
  const targetPitch = Math.atan2(dy, horiz) + gaussian(brain) * brain.aimNoiseRad;
  yaw += gaussian(brain) * brain.aimNoiseRad;
  return turnToward(self, yaw, targetPitch, dtMs);
}

/** Don't shoot while still turning through a newly acquired target. */
function aimSettled(self: BotPlayerView, enemy: BotPlayerView, look: BotLookIntent): boolean {
  const target = Math.atan2(enemy.x - self.x, enemy.z - self.z);
  return Math.abs(Math.atan2(Math.sin(target - look.yaw), Math.cos(target - look.yaw))) < 0.16;
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
  return strafeAround(brain, self, yaw, brain.engagementZ ?? brain.strafeZ);
}

/** Role movement consumes only a currently visible target. Losing sight resumes
 * ordinary navigation; it never pursues the hidden enemy's live coordinates.
 * SCOUT settles for 2.5s, then moves for 1.5s so it isn't a permanent turret.
 * RUSH closes through the collision navigator, fighting at nine metres.
 * Profiles vary reaction and movement, retaining identical aim noise and the
 * normal room weapon/handling gates. */
function roleCombat(view: BotView, brain: BotBrain, enemy: BotEnemyView, yaw: number): BotMoveIntent {
  const distance = Math.hypot(enemy.x - view.self.x, enemy.z - view.self.z);
  if (brain.role === 'rusher' && (distance > BOT_ARCHETYPES.rusher.closeTo || Math.abs(enemy.y - view.self.y) > .65)) {
    const next = view.navigate?.(enemy) ?? enemy;
    const dir = dirTo(view.self, next);
    return worldToMove(yaw, dir.x, dir.z);
  }
  if (brain.role === 'sniper' && distance >= BOT_ARCHETYPES.marksman.closeTo && brain.lockMs % 4000 < 2500) {
    return { mx: 0, mz: 0, jump: false, crouch: false, sprint: false, ads: true };
  }
  if ((brain.archetype === 'anchor' || brain.archetype === 'support') && distance >= CLOSE_THREAT_M) {
    const spec = BOT_ARCHETYPES[brain.archetype];
    if (distance > spec.closeTo + 4) {
      const next = view.navigate?.(enemy) ?? enemy, dir = dirTo(view.self, next);
      return worldToMove(yaw, dir.x, dir.z);
    }
    // Deliberate firing positions, punctuated by a relocation. Suppression is
    // normal aimed fire at a visible opponent, never a damage/accuracy buff.
    if (brain.lockMs % 2800 < (brain.archetype === 'support' ? 1900 : 1400))
      return { mx: 0, mz: 0, jump: false, crouch: false, sprint: false, ads: true };
  }
  const move = combatStrafe(brain, view.self, yaw);
  // Anchors retain the rifle's mobile suppression; scouts lower the scope to
  // relocate or handle a close threat. Rushers never gain stationary ADS aim.
  return move;
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
 * Practice-only: demonstrates one locomotion state at a fixed spot instead of
 * patrolling/fighting. Stationary roles (idle/crouch) hold a fixed facing
 * (`view.faceYaw`, back toward the spawning player) so their pose reads head-on.
 * Moving roles (walk/sprint/sneak) reuse the same 2-point {@link BotBrain.waypoints}
 * patrol {@link advanceWaypoint} already drives for combat bots — the room sets
 * them to the role's home ± amplitude along the map's Z axis — and face their own
 * direction of travel, so a player looking down the map's X axis sees a natural
 * profile-view gait rather than a sideways slide.
 */
function showcaseThink(view: ShowcaseView, _self: BotPlayerView, _brain: BotBrain): BotDecision {
  // Every showcase role now holds its pinned position (user request 2026-07-23:
  // practice bots must stand still — they serve as target dummies first). The
  // crouching roles (crouch/sneak) keep their low pose so the roster still shows
  // both stances; the old walk/sneak/sprint waypoint-pacing branch — the roster's
  // original animation-demo purpose, already served during the locomotion
  // milestones — is gone, so a practice player is never tracking a mover.
  return {
    move: {
      mx: 0,
      mz: 0,
      jump: false,
      crouch: view.role === "crouch" || view.role === "sneak",
      sprint: false,
    },
    look: { yaw: view.faceYaw, pitch: 0 },
    fire: false,
  };
}

/**
 * Decide this tick's intents from the perceived world. Pure given `view` and `brain`'s
 * current contents — `brain` is the caller-owned mutable state threaded through every
 * call (patrol cursor, aim-noise RNG stream, target-lock timer), so this function never
 * imports the room and never reaches for a wall clock.
 */
export function botThink(view: BotView, brain: BotBrain, dtMs: number): BotDecision {
  const decision = combatThink(view, brain, dtMs);
  if (!view.self.alive || view.showcase) return decision;
  return recoveryThink(view, brain, positionThink(view, brain, decision, dtMs));
}

function positionThink(view: BotView, brain: BotBrain, decision: BotDecision, dtMs: number): BotDecision {
  const order = brain.positioning;
  if (!order) return decision;
  if (view.objective || brain.clockMs >= order.untilMs ||
    order.holdUntilMs !== undefined && brain.clockMs >= order.holdUntilMs) {
    brain.positioning = undefined; return decision;
  }
  // Fight a visible close attacker normally; no hidden-player distance checks.
  const close = brain.lockId && view.enemies.find(p => p.id === brain.lockId);
  if (close && Math.hypot(close.x-view.self.x,close.y-view.self.y,close.z-view.self.z) < CLOSE_THREAT_M) return decision;
  if (botReached(view.self, order.point, .65)) {
    order.holdUntilMs ??= brain.clockMs + 6000;
    return { ...decision, move: { mx:0,mz:0,jump:false,crouch:false,sprint:false,ads:true }, tactic:'hold' };
  }
  const next = view.navigate?.(order.point) ?? order.point, dir = dirTo(view.self, next);
  const look = brain.lockId ? decision.look : searchLook(view.self,brain,next,dtMs);
  return { ...decision, look, move:worldToMove(look.yaw,dir.x,dir.z), tactic:'position' };
}

/** Recovery interrupts movement briefly, without replacing the strategic goal
 * or ever firing from a remembered target. Full magazines end reload recovery;
 * a deadline and cooldown prevent low-health bots hiding for the whole match. */
function recoveryThink(view: BotView, brain: BotBrain, decision: BotDecision): BotDecision {
  const { ammo, self } = view;
  const spec = brain.archetype ? BOT_ARCHETYPES[brain.archetype] : undefined;
  if (!ammo || !spec) return decision;
  const low = ammo.mag <= Math.floor(ammo.capacity * spec.reloadFraction) && ammo.reserve > 0;
  if (brain.recovery && (brain.clockMs >= brain.recovery.untilMs ||
    brain.recovery.reason === 'reload' && !ammo.reloading && !low)) brain.recovery = undefined;
  const hurt = (self.hp ?? PLAYER.maxHp) <= 35 && brain.decisionDepth >= 2 && brain.clockMs >= brain.nextRetreatMs;
  const threat = brain.recentThreat ?? (brain.sound ? { ...brain.sound, y: self.y + PLAYER.standEye } : undefined);
  if (!brain.recovery && threat && (low || hurt || ammo.reloading) && brain.clockMs >= brain.nextCoverMs) {
    brain.nextCoverMs = brain.clockMs + 1200;
    const cover = view.findCover?.(threat, brain.decisionDepth, spec.preferCrouch);
    if (cover) {
      const reason = low || ammo.reloading ? 'reload' : 'retreat';
      brain.recovery = { ...cover, startedMs: brain.clockMs,
        untilMs: brain.clockMs + (reason === 'reload' ? 5500 : 1800), reason };
      brain.nextRetreatMs = brain.clockMs + 8000;
    }
  }
  const recovery = brain.recovery;
  if (recovery) {
    const arrived = botReached(self, recovery.point, .35);
    // The index already swept this short route with the normal movement
    // capsule. Feeding it back through the ground-only flow field would erase
    // a valid doorway or slope; follow the verified local segment directly.
    const dir = arrived ? { x: 0, z: 0 } : dirTo(self, recovery.point);
    const move = worldToMove(decision.look.yaw, dir.x, dir.z);
    move.crouch = arrived && recovery.crouch;
    const reload = !ammo.reloading && ammo.reserve > 0 && ammo.mag < ammo.capacity &&
      (arrived || ammo.mag === 0 || brain.clockMs - recovery.startedMs >= 1600);
    return { ...decision, move, fire: false, reload, tactic: recovery.reason };
  }
  if (ammo.reloading) return { ...decision, fire: false, tactic: 'reload' };
  // No safe cover is better than walking into a wall forever. Empty magazines
  // reload immediately; a tactical top-up waits for loss of visual contact.
  if (low && (ammo.mag === 0 || !brain.lockId))
    return { ...decision, fire: false, reload: true, tactic: 'reload' };
  if (brain.archetype === 'support' && decision.fire) {
    // 900 ms aimed burst / 350 ms pause. Aim randomness and authoritative
    // cadence still come from exactly the normal brain and weapon paths.
    return { ...decision, fire: (brain.lockMs - brain.reactionMs) % 1250 < 900, tactic: 'suppress' };
  }
  return decision;
}

function combatThink(view: BotView, brain: BotBrain, dtMs: number): BotDecision {
  brain.clockMs += dtMs;
  if (brain.sound && brain.clockMs >= brain.sound.untilMs) brain.sound = undefined;
  const { self, enemies } = view;

  // Practice-only: demonstrate one locomotion state — no aim tracking, no firing.
  if (view.showcase) return showcaseThink(view.showcase, self, brain);

  if (!self.alive) {
    brain.wpIndex = 0;
    resetBotPerception(brain);
    return {
      move: { mx: 0, mz: 0, jump: false, crouch: false, sprint: false },
      look: { yaw: 0, pitch: 0 },
      fire: false,
    };
  }

  const range = brain.archetype ? Math.min(view.engagementRange ?? Infinity, BOT_ARCHETYPES[brain.archetype].range) : view.engagementRange;
  const enemy = nearestVisibleEnemy(self, enemies, brain.aimHeight, view.teamless, view.boxes, range, brain.lockId);
  // Once a real visual target is acquired, don't later turn back to old gunfire.
  if (enemy) {
    brain.sound = undefined;
    brain.recentThreat = { x: enemy.x, y: enemy.y + eyeHeight(enemy), z: enemy.z,
      untilMs: brain.clockMs + BOT_PERCEPTION.soundMemoryMs };
  } else if (brain.recentThreat && brain.clockMs >= brain.recentThreat.untilMs) brain.recentThreat = undefined;

  // Assigned DOM captures/guards and temporary event routes share movement.
  // Other combat bots retain their role/patrol logic below.
  if (view.objective) {
    brain.flank = undefined;
    return domThink(view.objective, self, enemy, brain, dtMs, view.navigate, view);
  }
  brain.objectiveDuel = undefined;

  const flank = flankTarget(brain, self);

  if (!enemy) {
    brain.lockId = null;
    brain.lockMs = 0;
    let target = flank;
    if (!target && brain.patrolRoute?.length) {
      target = brain.patrolRoute[brain.wpIndex % brain.patrolRoute.length]!;
      if (botReached(self, target)) target = brain.patrolRoute[++brain.wpIndex % brain.patrolRoute.length]!;
    }
    if (!target) { const wp = advanceWaypoint(brain, self); target = { x: wp.x, z: wp.y }; }
    const next = view.navigate?.(target) ?? target;
    const look = searchLook(self, brain, next, dtMs);
    const dir = dirTo(self, next);
    return {
      look,
      move: worldToMove(look.yaw, dir.x, dir.z),
      fire: false,
    };
  }

  // Reaction delay: the trigger stays cold for `reactionMs` after a new target is
  // acquired, even though the bot already turns to face it — mimics human target lag.
  if (brain.lockId !== enemy.id) {
    brain.lockId = enemy.id;
    if (view.engagementRange !== undefined) brain.engagementZ = self.z;
    brain.lockMs = 0;
  } else {
    brain.lockMs += dtMs;
  }

  const look = aimAt(brain, self, enemy, dtMs);
  const next = flank && Math.hypot(enemy.x-self.x,enemy.z-self.z) >= CLOSE_THREAT_M
    ? view.navigate?.(flank) ?? flank : undefined;
  const dir = next ? dirTo(self, next) : undefined;
  const move = dir ? worldToMove(look.yaw, dir.x, dir.z) : roleCombat(view, brain, enemy, look.yaw);
  const fire = brain.lockMs >= brain.reactionMs && aimSettled(self, enemy, look);
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
  objective: BotRoutePoint,
  self: BotView["self"],
  enemy: BotEnemyView | null,
  brain: BotBrain,
  dtMs: number,
  navigate?: BotView["navigate"],
  view?: BotView,
): BotDecision {
  const distToObjective = objective.y !== undefined && Math.abs(objective.y - self.y) >= .45
    ? Infinity : Math.hypot(objective.x - self.x, objective.z - self.z);
  const travelTarget = view?.objectiveApproach ?? objective;
  let look: BotLookIntent;
  let fire = false;
  if (enemy) {
    if (brain.lockId !== enemy.id) {
      brain.lockId = enemy.id;
      brain.lockMs = 0;
    } else {
      brain.lockMs += dtMs;
    }
    look = aimAt(brain, self, enemy, dtMs);
    fire = brain.lockMs >= brain.reactionMs && aimSettled(self, enemy, look);
  } else {
    brain.lockId = null;
    brain.lockMs = 0;
    const watch = view?.objectiveWatch;
    if (watch && !brain.sound && distToObjective <= OBJECTIVE_ARRIVE_M) {
      // Six-second, +/-30-degree sector scan. Keep the existing turn-rate and
      // acquisition cone: a silent flank behind this guard remains possible.
      const yaw = Math.atan2(watch.x - objective.x, watch.z - objective.z)
        + Math.sin(brain.clockMs * TAU / 6000) * Math.PI / 6;
      look = turnToward(self, yaw, 0, dtMs);
    } else look = searchLook(self, brain, navigate?.(travelTarget) ?? travelTarget, dtMs);
  }

  const enemyDist = enemy ? Math.hypot(enemy.x - self.x, enemy.y - self.y, enemy.z - self.z) : Infinity;
  if (enemy && enemyDist < CLOSE_THREAT_M) {
    // Start the dodge where this CLOSE encounter began, not at first distant
    // sight and never at the legacy z=11 lane. An arrived defender uses the
    // flag itself. Loss/range exit/reassignment release the local commitment.
    const duel = brain.objectiveDuel;
    if (!duel || duel.targetId !== enemy.id || duel.objectiveX !== objective.x || duel.objectiveZ !== objective.z)
      brain.objectiveDuel = { targetId: enemy.id, objectiveX: objective.x, objectiveZ: objective.z,
        z: distToObjective <= OBJECTIVE_ARRIVE_M ? objective.z : self.z };
    return { look, move: strafeAround(brain, self, look.yaw, brain.objectiveDuel!.z), fire };
  }
  brain.objectiveDuel = undefined;

  if (distToObjective <= OBJECTIVE_ARRIVE_M) {
    if (enemy && view && brain.role === 'sniper') {
      const move = roleCombat(view, brain, enemy, look.yaw);
      if (move.ads) return { look, move, fire };
    }
    return { look, move: strafeAround(brain, self, look.yaw, objective.z), fire };
  }

  // Default: push toward the objective — converts the world-space direction
  // into a move intent relative to wherever we're currently looking (mirrors
  // how combatStrafe lets a bot strafe sideways while keeping its aim on target).
  const dir = dirTo(self, navigate?.(travelTarget) ?? travelTarget);
  return { look, move: worldToMove(look.yaw, dir.x, dir.z), fire };
}
