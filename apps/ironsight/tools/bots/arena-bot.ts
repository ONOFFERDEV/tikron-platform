import type { Vec2 } from "@tikron/sim";
import { xorshift32 } from "@tikron/sim";
import { ARENA1_BOXES } from "../../src/map/arena1.js";
import { nearestBox, type Box, type Vec3 } from "../../src/physics.js";
import { AR, PLAYER } from "../../src/config.js";
import type { ArenaPlayer, ArenaState } from "../../src/schema.js";

/**
 * ironsight arena bot — a transport-agnostic FPS opponent for the M0 gate tests.
 *
 * The brain is intentionally decoupled from any socket: {@link ArenaBot.decide}
 * takes the world *as the bot perceives it* ({@link ArenaState}) and the current
 * clock, and returns the intents to send this tick ({@link BotIntents}). A driver
 * (the E2E harness, or a real `@tikron/client` `GameClient`) forwards those to the
 * server with {@link applyIntents}. Because the bot never integrates its own
 * position — it steers off the authoritative `state.players[id]` the server sends
 * back — there is no client prediction to drift.
 *
 * Behaviour: patrol the supplied lane {@link ArenaBotOptions.waypoints} until an
 * enemy is in line of sight (occlusion-tested against {@link ArenaBotOptions.boxes},
 * arena1's by default), then face the nearest one, keep strafing between waypoints
 * so it stays a moving
 * target, and fire on the weapon's cadence. Aim carries a seeded normal-distribution
 * angular error so two mirrored bots never land pixel-identical shots (and the run
 * stays reproducible). Ammo is modelled from the bot's own shot count — the mag
 * is owner-only state the bot never sees on the wire — so it reloads after a full
 * magazine, and it requests a respawn while dead.
 */

export interface MoveIntent {
  mx: number;
  mz: number;
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
}

export interface LookIntent {
  yaw: number;
  pitch: number;
}

/** The intents a bot wants to emit on one tick (any subset). */
export interface BotIntents {
  move?: MoveIntent;
  look?: LookIntent;
  fire?: boolean;
  reload?: boolean;
  respawn?: boolean;
}

export interface ArenaBotOptions {
  /** The client id the server knows this bot by (== `state.players` key). */
  id: string;
  /** PRNG seed for the aim-noise stream (fixed → reproducible runs). */
  seed: number;
  /** Patrol path in the ground plane (`x`, `z`); the bot loops through it. */
  waypoints: readonly Vec2[];
  /** Std-dev of the gaussian angular aim error, radians (default 0.012 ≈ 0.7°). */
  aimNoiseRad?: number;
  /** Aim from the muzzle at this height above the target's feet (default chest). */
  aimHeight?: number;
  /**
   * Combat-strafe anchor + amplitude on the depth (`z`) axis (metres). While
   * engaging, the bot slides between `strafeZ ± strafeAmp` to stay a moving target
   * without wandering into cover; keep the band inside the open lane. Defaults to
   * the mid corridor (11 ± 1.2), safe between the platforms (z ≤ 9) and the lane
   * divider (z ≥ 13).
   */
  strafeZ?: number;
  strafeAmp?: number;
  /** Half-period of the strafe oscillation, ms (default 700). */
  strafePeriodMs?: number;
  /** Map geometry for the line-of-sight occlusion test (default arena1's boxes —
   *  pass a different map's boxes to run this harness against e.g. arena2). */
  boxes?: readonly Box[];
}

/** A sink the driver adapts to its transport (`TestConnection`, `GameClient`, …). */
export interface IntentSink {
  send(type: string, payload?: unknown): Promise<void> | void;
}

const TAU = Math.PI * 2;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class ArenaBot {
  readonly id: string;
  private readonly rng: () => number;
  private readonly aimNoise: number;
  private readonly aimHeight: number;
  private readonly waypoints: readonly Vec2[];
  private readonly strafeZ: number;
  private readonly strafeAmp: number;
  private readonly strafePeriodMs: number;
  private readonly boxes: readonly Box[];
  private wpIndex = 0;

  // Ammo model (mag is owner-only, off the wire) + fire cadence, on the bot clock.
  private magFired = 0;
  private reloadUntilMs = 0;
  private lastFireMs = -Infinity;

  // Box–Muller keeps a second normal sample per two uniforms.
  private spareNormal = 0;
  private hasSpare = false;

  constructor(opts: ArenaBotOptions) {
    if (opts.waypoints.length === 0) throw new Error("ArenaBot needs at least one waypoint");
    this.id = opts.id;
    this.rng = xorshift32(opts.seed >>> 0 || 1);
    this.aimNoise = opts.aimNoiseRad ?? 0.012;
    this.aimHeight = opts.aimHeight ?? 1.0;
    this.waypoints = opts.waypoints;
    this.strafeZ = opts.strafeZ ?? 11;
    this.strafeAmp = opts.strafeAmp ?? 1.2;
    this.strafePeriodMs = opts.strafePeriodMs ?? 700;
    this.boxes = opts.boxes ?? ARENA1_BOXES;
  }

  /** Uniform in [0, 1). */
  private uniform(): number {
    return this.rng() / 0x1_0000_0000;
  }

  /** One standard-normal sample (Box–Muller, cached in pairs). */
  private gaussian(): number {
    if (this.hasSpare) {
      this.hasSpare = false;
      return this.spareNormal;
    }
    // u1 in (0,1] so log() is finite.
    const u1 = 1 - this.uniform();
    const u2 = this.uniform();
    const mag = Math.sqrt(-2 * Math.log(u1));
    this.spareNormal = mag * Math.sin(TAU * u2);
    this.hasSpare = true;
    return mag * Math.cos(TAU * u2);
  }

  /** Decide this tick's intents from the perceived world. */
  decide(state: ArenaState, nowMs: number): BotIntents {
    const me = state.players[this.id];
    if (!me) return {};
    if (!me.alive) {
      // Reset the ammo model so the bot comes back with a full mag, and rewind the
      // return route to its first waypoint — the spawn-side clear corridor — so a
      // bot respawning behind cover walks back through open ground instead of
      // cutting diagonally into a wall.
      this.magFired = 0;
      this.reloadUntilMs = 0;
      this.wpIndex = 0;
      return { respawn: true };
    }

    const enemy = this.nearestVisibleEnemy(me, state);

    if (!enemy) {
      // Nothing in sight (spawned far away, or cover between): walk the return
      // route back to the fight lane, one waypoint at a time.
      const wp = this.advanceWaypoint(me);
      const yaw = Math.atan2(wp.x - me.x, wp.y - me.z);
      return { look: { yaw, pitch: 0 }, move: { mx: 0, mz: 1, jump: false, crouch: false, sprint: false } };
    }

    const { yaw, pitch } = this.aimAt(me, enemy);
    const intents: BotIntents = {
      look: { yaw, pitch },
      move: this.combatStrafe(me, yaw, nowMs),
    };

    // Reload after a spent magazine; hold fire until it finishes.
    if (nowMs < this.reloadUntilMs) return intents;
    if (this.magFired >= AR.mag) {
      this.magFired = 0;
      this.reloadUntilMs = nowMs + AR.reloadMs;
      intents.reload = true;
      return intents;
    }

    // One shot per fire interval so the count tracks real (rate-capped) shots.
    if (nowMs - this.lastFireMs >= AR.fireIntervalMs) {
      this.lastFireMs = nowMs;
      this.magFired += 1;
      intents.fire = true;
    }
    return intents;
  }

  /** Loop the patrol cursor forward once the bot reaches the current waypoint. */
  private advanceWaypoint(me: ArenaPlayer): Vec2 {
    const wp = this.waypoints[this.wpIndex] ?? { x: me.x, y: me.z };
    if (Math.hypot(wp.x - me.x, wp.y - me.z) < 1.0) {
      this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
    }
    return wp;
  }

  /** Nearest alive enemy with clear line of sight from the muzzle, else null. */
  private nearestVisibleEnemy(me: ArenaPlayer, state: ArenaState): ArenaPlayer | null {
    const eye: Vec3 = { x: me.x, y: me.y + eyeHeight(me), z: me.z };
    let best: ArenaPlayer | null = null;
    let bestDist = Infinity;
    for (const [pid, p] of Object.entries(state.players)) {
      if (pid === this.id || p.team === me.team || !p.alive) continue;
      const aim = this.aimPoint(p);
      const dx = aim.x - eye.x;
      const dy = aim.y - eye.y;
      const dz = aim.z - eye.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist === 0 || dist >= bestDist) continue;
      const dir: Vec3 = { x: dx / dist, y: dy / dist, z: dz / dist };
      // Occluded if a map box is entered before the target along the ray.
      if (nearestBox(eye, dir, this.boxes, dist) < dist) continue;
      best = p;
      bestDist = dist;
    }
    return best;
  }

  /** The world point the bot aims at (chest height above the target's feet). */
  private aimPoint(p: ArenaPlayer): Vec3 {
    return { x: p.x, y: p.y + this.aimHeight, z: p.z };
  }

  /** Yaw/pitch from the bot's muzzle to an enemy, plus seeded gaussian error. */
  private aimAt(me: ArenaPlayer, enemy: ArenaPlayer): LookIntent {
    const eye: Vec3 = { x: me.x, y: me.y + eyeHeight(me), z: me.z };
    const aim = this.aimPoint(enemy);
    const dx = aim.x - eye.x;
    const dy = aim.y - eye.y;
    const dz = aim.z - eye.z;
    const horiz = Math.hypot(dx, dz);
    let yaw = Math.atan2(dx, dz); // 0 → +z, +yaw → +x (server convention)
    let pitch = Math.atan2(dy, horiz); // + = up
    yaw += this.gaussian() * this.aimNoise;
    pitch += this.gaussian() * this.aimNoise;
    yaw = ((yaw % TAU) + TAU) % TAU;
    return { yaw, pitch };
  }

  /**
   * Sidestep along the depth axis while facing the enemy: a square wave slides the
   * bot between `strafeZ ± strafeAmp`, so it is always a moving target but never
   * drifts out of the open lane into cover (which would break line of sight).
   */
  private combatStrafe(me: ArenaPlayer, yaw: number, nowMs: number): MoveIntent {
    const phase = Math.floor(nowMs / this.strafePeriodMs) % 2 === 0 ? 1 : -1;
    const targetZ = this.strafeZ + phase * this.strafeAmp;
    // Desired world move is purely along z, toward the oscillating anchor.
    return this.worldToMove(yaw, 0, clamp(targetZ - me.z, -1, 1));
  }

  /** Convert a world-space move direction to WASD in the bot's facing frame. */
  private worldToMove(yaw: number, wx: number, wz: number): MoveIntent {
    // Invert the server's wish-dir rotation (forward = sin yaw, cos yaw).
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const mz = clamp(wx * sy + wz * cy, -1, 1);
    const mx = clamp(wx * cy - wz * sy, -1, 1);
    return { mx, mz, jump: false, crouch: false, sprint: false };
  }
}

function eyeHeight(p: ArenaPlayer): number {
  return p.crouch ? PLAYER.crouchEye : PLAYER.standEye;
}

/** Forward a bot's chosen intents to the server through a transport sink. */
export async function applyIntents(sink: IntentSink, intents: BotIntents): Promise<void> {
  if (intents.respawn) {
    await sink.send("respawn");
    return;
  }
  if (intents.look) await sink.send("look", intents.look);
  if (intents.move) await sink.send("move", intents.move);
  if (intents.reload) await sink.send("reload");
  if (intents.fire) await sink.send("fire");
}
