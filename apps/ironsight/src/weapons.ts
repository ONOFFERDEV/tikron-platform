/**
 * Pure weapon math — the deterministic core the room and the TTK sim share. No room,
 * no timers, no RNG: given a {@link WeaponSpec} it yields the fixed pellet pattern,
 * the distance falloff, and the ray direction from angles. The room layers its own
 * per-ray accuracy jitter (movement penalty) on top; everything here is reproducible,
 * so `test/ttk-sim.test.ts` can fire the exact rays the server fires and read a stable
 * damage-by-distance table.
 *
 * Coordinate convention matches config.ts / physics.ts: yaw 0 → +z, +yaw → +x, pitch
 * positive looking up.
 */

import type { WeaponSpec } from "./config.js";
import type { Vec3 } from "./physics.js";

/** Golden angle (rad) — spaces the sunflower pellet pattern evenly with no clumping. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Damage multiplier from muzzle distance: `1` within `falloffStart`, linearly down
 * to `falloffMin` at `falloffEnd`, then flat. This is the whole falloff model — a
 * weapon with `falloffStart ≥ range` never decays.
 */
export function falloffMul(spec: WeaponSpec, dist: number): number {
  if (dist <= spec.falloffStart) return 1;
  if (dist >= spec.falloffEnd) return spec.falloffMin;
  const t = (dist - spec.falloffStart) / (spec.falloffEnd - spec.falloffStart);
  return 1 + t * (spec.falloffMin - 1);
}

/** A pellet's angular offset from the aim ray (added to yaw / pitch). */
export interface PelletOffset {
  dyaw: number;
  dpitch: number;
}

/**
 * The FIXED pellet pattern for one trigger pull: `spec.pellets` offsets arranged as
 * a sunflower disc of half-angle `spec.pelletSpread` (pellet 0 dead-centre, the last
 * on the rim). Deterministic on purpose — the shotgun's spread is a repeatable
 * pattern, not luck — so damage-by-distance is stable and testable. A single-ray
 * weapon returns one centred offset.
 */
export function pelletPattern(spec: WeaponSpec): PelletOffset[] {
  const n = Math.max(1, spec.pellets);
  if (n === 1) return [{ dyaw: 0, dpitch: 0 }];
  const out: PelletOffset[] = [];
  for (let i = 0; i < n; i++) {
    const r = spec.pelletSpread * Math.sqrt(i / (n - 1));
    const a = i * GOLDEN_ANGLE;
    out.push({ dyaw: r * Math.cos(a), dpitch: r * Math.sin(a) });
  }
  return out;
}

/** Unit ray direction from yaw/pitch (yaw 0 → +z, +yaw → +x, +pitch → up). */
export function dirFromAngles(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: Math.cos(yaw) * cp };
}

/** The accuracy-cone half-angle for a shot, by movement state (movement penalty). */
export function accuracySpread(spec: WeaponSpec, moving: boolean, grounded: boolean,
  ads = false, crouch = false, shotIndex = 0): number {
  const base = spec.spreadStill + (!grounded ? spec.spreadAir : moving ? spec.spreadMove : 0);
  const deep = shotIndex >= spec.recoil.hybridAfter ? spec.recoil.hybridSpread : 0;
  return (base + deep) * (ads ? spec.recoil.adsMul : 1) * (grounded && crouch ? spec.recoil.crouchMul : 1);
}

/**
 * Symmetric center-biased triangular jitter in `[-spread, +spread]`, zero at zero spread.
 * (pinpoint — matches `accuracySpread`'s "stationary AR" case exactly). The
 * SAME distribution arena-room.ts's private `jitter()` applies server-side for
 * pellet spread — shared here so the client's hybrid-hit claim ray (main.ts's
 * `computeClaim`) degrades by the identical movement-penalty model instead of
 * a hand-copied one that could drift. Takes its random source as a parameter
 * on purpose: the server supplies its seeded per-room PRNG (secret, so a
 * client can't predict the exact pellet ray), the client supplies `Math.random`
 * for its own claim roll — the two are independent draws from the same
 * distribution, not a synchronized sequence (see arena-room.ts's `validateClaim`,
 * which widens its cone tolerance by the same `accuracySpread` value to accept
 * either side's independent roll).
 */
export function jitter(spread: number, random01: () => number): number {
  return spread > 0 ? (random01() + random01() - 1) * spread : 0;
}
