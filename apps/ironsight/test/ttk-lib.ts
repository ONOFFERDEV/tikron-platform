import type { WeaponSpec } from "../src/config.js";
import { resolveHitscan, type HitTarget } from "../src/hitscan.js";
import { dirFromAngles, falloffMul, pelletPattern } from "../src/weapons.js";
import type { Vec3 } from "../src/physics.js";

/**
 * Theme-agnostic TTK (time-to-kill) math, factored out of ttk-sim.test.ts (M4 W3)
 * so the SAME functions drive both the [blueprint] balance-heuristic checks
 * (run against whichever weapons array is currently active) and the ad-hoc
 * authoring check used to validate a new theme's roster (e.g. NEONSTRIKE)
 * before it ships. Pure — no import of `GAME`/any specific config.
 */

export type Part = "body" | "head";

export interface TtkPlayer {
  radius: number;
  headRadius: number;
  standHeight: number;
  standEye: number;
  maxHp: number;
}

const CFG = (p: TtkPlayer) => ({ radius: p.radius, headRadius: p.headRadius });

/** The world height the shooter aims at on the target for a given part. */
function aimY(p: TtkPlayer, part: Part): number {
  return part === "head" ? p.standHeight - p.headRadius : 1.0; // head centre / chest
}

/** Total damage from one trigger pull at `dist`, aiming at `part`, still + on target. */
export function pullDamage(w: WeaponSpec, dist: number, part: Part, p: TtkPlayer): number {
  const origin: Vec3 = { x: 0, y: p.standEye, z: 0 };
  const target: HitTarget = { id: "t", x: dist, z: 0, feetY: 0, headY: p.standHeight, team: 1 };
  const baseYaw = Math.atan2(dist, 0); // target lies along +x → yaw = π/2
  const basePitch = Math.atan2(aimY(p, part) - p.standEye, dist);
  let dmg = 0;
  for (const off of pelletPattern(w)) {
    const dir = dirFromAngles(baseYaw + off.dyaw, basePitch + off.dpitch);
    const hit = resolveHitscan(origin, dir, w.range, 0, [target], [], CFG(p));
    if (!hit) continue;
    const base = hit.part === "head" ? w.damageHead : w.damageBody;
    dmg += base * falloffMul(w, hit.t);
  }
  return dmg;
}

/** Time-to-kill in ms (Infinity when a single pull can't accumulate a kill). */
export function ttkMs(w: WeaponSpec, dist: number, part: Part, p: TtkPlayer): number {
  const per = pullDamage(w, dist, part, p);
  if (per <= 0) return Infinity;
  return (Math.ceil(p.maxHp / per) - 1) * w.fireIntervalMs;
}

/** The weapon with the lowest body TTK at `dist` (the range band's "best"). */
export function bestBodyAt(weapons: readonly WeaponSpec[], dist: number, p: TtkPlayer): string {
  return weapons.reduce((best, w) =>
    ttkMs(w, dist, "body", p) < ttkMs(best, dist, "body", p) ? w : best,
  ).name;
}

/**
 * The theme-agnostic balance shape (PLAN-IRONSIGHT §5's heuristic, generalized):
 * no single weapon dominates every range band, and every band still has a real
 * choice of killers. Holds for any well-balanced 5-weapon roster, not just
 * ironsight's own AR/SMG/Shotgun/Sniper/Pistol names.
 */
export interface BalanceReport {
  bestByRange: Record<number, string>;
  killersByRange: Record<number, number>;
  distinctBests: number;
}

export function balanceReport(weapons: readonly WeaponSpec[], ranges: readonly number[], p: TtkPlayer): BalanceReport {
  const bestByRange: Record<number, string> = {};
  const killersByRange: Record<number, number> = {};
  for (const r of ranges) {
    bestByRange[r] = bestBodyAt(weapons, r, p);
    killersByRange[r] = weapons.filter((w) => ttkMs(w, r, "body", p) < Infinity).length;
  }
  return { bestByRange, killersByRange, distinctBests: new Set(Object.values(bestByRange)).size };
}
