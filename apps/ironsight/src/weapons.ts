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
export function accuracySpread(spec: WeaponSpec, moving: boolean, grounded: boolean): number {
  if (!grounded) return spec.spreadStill + spec.spreadAir;
  if (moving) return spec.spreadStill + spec.spreadMove;
  return spec.spreadStill;
}
