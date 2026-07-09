/**
 * Pure grenade projectile physics (PLAN §4 "+수류탄"): gravity integration, bouncing
 * off the arena bounds and cover, and the detonation AoE falloff. No room, no timers —
 * the room owns the fuse clock and the per-tick loop and calls {@link stepGrenade}; the
 * geometry here is deterministic and unit-testable, mirroring how `physics.ts` splits
 * collision out of the room.
 *
 * The grenade is a sphere of radius `r`. Each step integrates gravity, advances the
 * centre, then resolves it out of the floor/ceiling/walls and every {@link Box},
 * reflecting the velocity along the contact normal with restitution `e`. Coordinates
 * match config.ts: `x,z` horizontal, `y` up.
 */

import type { Box, Bounds, Vec3 } from "./physics.js";

/** A grenade's live kinematic state (mutated in place by {@link stepGrenade}). */
export interface GrenadeBody {
  pos: Vec3;
  vel: Vec3;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Bounce `vel` off unit normal `n` in place: flip the normal component and scale
 * it by restitution `e`, leaving the tangential component (the slide along the
 * surface) untouched. Scaling the whole vector would wrongly bleed speed out of a
 * grenade skimming a floor.
 */
function reflect(vel: Vec3, nx: number, ny: number, nz: number, e: number): void {
  const vn = vel.x * nx + vel.y * ny + vel.z * nz;
  if (vn >= 0) return; // already separating along the normal — don't re-flip
  const k = (1 + e) * vn;
  vel.x -= k * nx;
  vel.y -= k * ny;
  vel.z -= k * nz;
}

/**
 * Resolve the grenade centre out of one box (sphere-vs-AABB) and bounce off it.
 * Returns true if it was touching the box. Handles the centre-inside-box case (a
 * fast grenade that tunnelled a face) by ejecting along the least-penetrated axis.
 */
function collideBox(g: GrenadeBody, r: number, b: Box, e: number): boolean {
  const cx = clamp(g.pos.x, b.min.x, b.max.x);
  const cy = clamp(g.pos.y, b.min.y, b.max.y);
  const cz = clamp(g.pos.z, b.min.z, b.max.z);
  let nx = g.pos.x - cx;
  let ny = g.pos.y - cy;
  let nz = g.pos.z - cz;
  const d2 = nx * nx + ny * ny + nz * nz;

  if (d2 > 1e-9) {
    if (d2 >= r * r) return false; // outside the sphere's reach
    const d = Math.sqrt(d2);
    nx /= d;
    ny /= d;
    nz /= d;
    g.pos.x = cx + nx * r;
    g.pos.y = cy + ny * r;
    g.pos.z = cz + nz * r;
  } else {
    // Centre is inside the box: eject along the axis with the smallest overlap.
    const px = Math.min(g.pos.x - b.min.x, b.max.x - g.pos.x);
    const py = Math.min(g.pos.y - b.min.y, b.max.y - g.pos.y);
    const pz = Math.min(g.pos.z - b.min.z, b.max.z - g.pos.z);
    nx = ny = nz = 0;
    if (px <= py && px <= pz) {
      nx = g.pos.x - (b.min.x + b.max.x) / 2 >= 0 ? 1 : -1;
      g.pos.x = nx > 0 ? b.max.x + r : b.min.x - r;
    } else if (py <= pz) {
      ny = g.pos.y - (b.min.y + b.max.y) / 2 >= 0 ? 1 : -1;
      g.pos.y = ny > 0 ? b.max.y + r : b.min.y - r;
    } else {
      nz = g.pos.z - (b.min.z + b.max.z) / 2 >= 0 ? 1 : -1;
      g.pos.z = nz > 0 ? b.max.z + r : b.min.z - r;
    }
  }
  reflect(g.vel, nx, ny, nz, e);
  return true;
}

/**
 * Advance a grenade by `dt` seconds: apply gravity, move, and bounce off the arena
 * bounds and `boxes`. Mutates `g` in place; returns true if it bounced this step
 * (the room emits a `nadeBounce` correction on a true).
 */
export function stepGrenade(
  g: GrenadeBody,
  dt: number,
  gravity: number,
  restitution: number,
  r: number,
  boxes: readonly Box[],
  bounds: Bounds,
): boolean {
  g.vel.y -= gravity * dt;
  g.pos.x += g.vel.x * dt;
  g.pos.y += g.vel.y * dt;
  g.pos.z += g.vel.z * dt;

  let bounced = false;

  // Floor / ceiling.
  if (g.pos.y - r <= 0) {
    g.pos.y = r;
    reflect(g.vel, 0, 1, 0, restitution);
    bounced = true;
  } else if (g.pos.y + r >= bounds.ceiling) {
    g.pos.y = bounds.ceiling - r;
    reflect(g.vel, 0, -1, 0, restitution);
    bounced = true;
  }
  // Side walls (x, z).
  if (g.pos.x - r <= 0) {
    g.pos.x = r;
    reflect(g.vel, 1, 0, 0, restitution);
    bounced = true;
  } else if (g.pos.x + r >= bounds.width) {
    g.pos.x = bounds.width - r;
    reflect(g.vel, -1, 0, 0, restitution);
    bounced = true;
  }
  if (g.pos.z - r <= 0) {
    g.pos.z = r;
    reflect(g.vel, 0, 0, 1, restitution);
    bounced = true;
  } else if (g.pos.z + r >= bounds.depth) {
    g.pos.z = bounds.depth - r;
    reflect(g.vel, 0, 0, -1, restitution);
    bounced = true;
  }
  // Cover.
  for (const b of boxes) {
    if (collideBox(g, r, b, restitution)) bounced = true;
  }
  return bounced;
}

/**
 * Explosion damage to a target whose centre is `dist` metres from the blast: full
 * `maxDamage` at the centre, linearly to `0` at `radius`, and `0` beyond. Line of
 * sight (cover between the blast and the target) is the caller's concern.
 */
export function blastDamage(maxDamage: number, radius: number, dist: number): number {
  if (dist >= radius) return 0;
  return maxDamage * (1 - dist / radius);
}
