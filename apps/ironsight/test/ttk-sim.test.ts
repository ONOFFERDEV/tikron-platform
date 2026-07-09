import { describe, it, expect } from "vitest";
import { WEAPONS, GRENADE, PLAYER, type WeaponSpec } from "../src/config.js";
import { resolveHitscan, type HitTarget } from "../src/hitscan.js";
import { dirFromAngles, falloffMul, pelletPattern } from "../src/weapons.js";
import { blastDamage } from "../src/grenade.js";
import type { Vec3 } from "../src/physics.js";

/**
 * M1 gate (PLAN-IRONSIGHT §5): the time-to-kill table by weapon × range × body part,
 * plus the balance heuristics that keep any one weapon from ruling every range.
 *
 * The sim fires the SAME rays the room fires — the shared pure primitives
 * (`pelletPattern`, `dirFromAngles`, `falloffMul`, `resolveHitscan`) — from a still,
 * perfectly-on-target shooter (no accuracy jitter, so the table is deterministic).
 * TTK is the time from the first shot to the shot that drops a full-HP target:
 * `(pulls − 1) × fireInterval`, so a one-shot reads 0 ms and an unkillable matchup
 * reads ∞.
 */

const CFG = { radius: PLAYER.radius, headRadius: PLAYER.headRadius };
const EYE = PLAYER.standEye; // muzzle height (feet-relative), standing
const RANGES = [5, 15, 30] as const; // close / mid / long (metres)
type Part = "body" | "head";

const spec = (name: string): WeaponSpec => WEAPONS.find((w) => w.name === name)!;

/** The world height the shooter aims at on the target for a given part. */
function aimY(part: Part): number {
  return part === "head" ? PLAYER.standHeight - PLAYER.headRadius : 1.0; // head centre / chest
}

/** Total damage from one trigger pull at `dist`, aiming at `part`, still + on target. */
function pullDamage(w: WeaponSpec, dist: number, part: Part): number {
  const origin: Vec3 = { x: 0, y: EYE, z: 0 };
  const target: HitTarget = { id: "t", x: dist, z: 0, feetY: 0, headY: PLAYER.standHeight, team: 1 };
  const baseYaw = Math.atan2(dist, 0); // target lies along +x → yaw = π/2
  const basePitch = Math.atan2(aimY(part) - EYE, dist);
  let dmg = 0;
  for (const off of pelletPattern(w)) {
    const dir = dirFromAngles(baseYaw + off.dyaw, basePitch + off.dpitch);
    const hit = resolveHitscan(origin, dir, w.range, 0, [target], [], CFG);
    if (!hit) continue;
    const base = hit.part === "head" ? w.damageHead : w.damageBody;
    dmg += base * falloffMul(w, hit.t);
  }
  return dmg;
}

/** Time-to-kill in ms (Infinity when a single pull can't accumulate a kill). */
function ttkMs(w: WeaponSpec, dist: number, part: Part): number {
  const per = pullDamage(w, dist, part);
  if (per <= 0) return Infinity;
  return (Math.ceil(PLAYER.maxHp / per) - 1) * w.fireIntervalMs;
}

/** The weapon with the lowest body TTK at `dist` (the range band's "best"). */
function bestBodyAt(dist: number): string {
  return WEAPONS.reduce((best, w) =>
    ttkMs(w, dist, "body") < ttkMs(best, dist, "body") ? w : best,
  ).name;
}

describe("ironsight M1 gate — TTK table + balance", () => {
  it("prints the TTK table (body / head ms, by range)", () => {
    const cell = (v: number): string => (v === Infinity ? "∞" : String(Math.round(v)));
    const header = "weapon".padEnd(9) + RANGES.map((r) => `${r}m (body/head)`.padStart(16)).join("");
    const lines = [header];
    for (const w of WEAPONS) {
      const row = RANGES.map((r) => `${cell(ttkMs(w, r, "body"))}/${cell(ttkMs(w, r, "head"))}`.padStart(16)).join("");
      lines.push(w.name.padEnd(9) + row);
    }
    // eslint-disable-next-line no-console
    console.log("\nTTK (ms) — first shot → kill shot\n" + lines.join("\n") + "\n");
    expect(lines.length).toBe(WEAPONS.length + 1);
  });

  it("close range (5 m) belongs to the shotgun", () => {
    expect(bestBodyAt(5)).toBe("Shotgun");
    // …and it's a point-blank one-shot (all pellets connect).
    expect(ttkMs(spec("Shotgun"), 5, "body")).toBe(0);
  });

  it("mid range (15 m) goes to an automatic, not the shotgun or the sniper", () => {
    const b = bestBodyAt(15);
    expect(b).not.toBe("Shotgun");
    expect(b).not.toBe("Sniper");
  });

  it("long range (30 m) drops the close-range weapons (not shotgun, not SMG)", () => {
    const b = bestBodyAt(30);
    expect(b).not.toBe("Shotgun");
    expect(b).not.toBe("SMG");
  });

  it("no weapon dominates every range — the best differs across ≥3 bands", () => {
    const bests = new Set(RANGES.map((r) => bestBodyAt(r)));
    expect(bests.size).toBeGreaterThanOrEqual(3);
  });

  it("every range band has ≥3 weapons that can kill (no forced pick)", () => {
    for (const r of RANGES) {
      const killers = WEAPONS.filter((w) => ttkMs(w, r, "body") < Infinity).length;
      expect(killers).toBeGreaterThanOrEqual(3);
    }
  });

  it("the shotgun falls off a cliff: 30 m body TTK ≥ 2× the AR's", () => {
    expect(ttkMs(spec("Shotgun"), 30, "body")).toBeGreaterThanOrEqual(
      2 * ttkMs(spec("AR"), 30, "body"),
    );
  });

  it("the sniper one-shots on a headshot at every range", () => {
    for (const r of RANGES) expect(ttkMs(spec("Sniper"), r, "head")).toBe(0);
  });

  it("a grenade is not a one-shot, even a direct blast on yourself", () => {
    expect(blastDamage(GRENADE.maxDamage, GRENADE.radius, 0)).toBeLessThan(PLAYER.maxHp);
  });
});
