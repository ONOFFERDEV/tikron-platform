// [config: ironsight] — the formulas under test (falloffMul/pelletPattern/
// accuracySpread/dirFromAngles/blastDamage/stepGrenade) are theme-agnostic, but
// this file imports `WEAPONS` directly from src/config.ts (ironsight's own fixed
// array, NOT `GAME.weapons`), so it stays green through a config swap by being
// entirely decoupled from it — it never actually exercises the swapped-in
// roster. Confirmed empirically (W3): passes unchanged during the NEONSTRIKE
// swap, but only because it's testing ironsight's own AR/Shotgun/Sniper
// regardless of what's loaded into GAME — a from-scratch theme would need its
// own equivalent suite (`byName("Pulse Rifle")`, etc.), not a rerun of this one.
import { describe, it, expect } from "vitest";
import {
  accuracySpread,
  dirFromAngles,
  falloffMul,
  jitter,
  pelletPattern,
} from "../src/weapons.js";
import { stepGrenade, blastDamage, type GrenadeBody } from "../src/grenade.js";
import { WEAPONS, GRENADE, MOVE, PLAYER, type WeaponSpec } from "../src/config.js";
import type { Box, Bounds } from "../src/physics.js";

const byName = (n: string): WeaponSpec => WEAPONS.find((w) => w.name === n)!;
const AR = byName("AR");
const SHOTGUN = byName("Shotgun");
const SNIPER = byName("Sniper");

describe("weapons — falloff", () => {
  it("is 1 within falloffStart, floors at falloffMin past falloffEnd, linear between", () => {
    expect(falloffMul(AR, 10)).toBe(1); // inside start (30)
    expect(falloffMul(AR, 30)).toBe(1); // exactly start
    expect(falloffMul(AR, 65)).toBeCloseTo(AR.falloffMin, 5); // exactly end
    expect(falloffMul(AR, 200)).toBe(AR.falloffMin); // past end, clamped
    // Midpoint (47.5 m) sits halfway down to the floor.
    expect(falloffMul(AR, (30 + 65) / 2)).toBeCloseTo(1 + 0.5 * (AR.falloffMin - 1), 5);
  });

  it("the sniper never falls off inside its range", () => {
    expect(falloffMul(SNIPER, 5)).toBe(1);
    expect(falloffMul(SNIPER, SNIPER.range)).toBe(1);
  });
});

describe("weapons — pellet pattern", () => {
  it("single-ray weapons emit one centred pellet", () => {
    expect(pelletPattern(AR)).toEqual([{ dyaw: 0, dpitch: 0 }]);
  });

  it("the shotgun emits `pellets` offsets, centred first, the rest inside the cone", () => {
    const pat = pelletPattern(SHOTGUN);
    expect(pat.length).toBe(SHOTGUN.pellets);
    expect(pat[0]).toEqual({ dyaw: 0, dpitch: 0 }); // pellet 0 dead-centre
    for (const p of pat) {
      const r = Math.hypot(p.dyaw, p.dpitch);
      expect(r).toBeLessThanOrEqual(SHOTGUN.pelletSpread + 1e-9);
    }
    // The pattern is deterministic (fixed, not random) — same call, same offsets.
    expect(pelletPattern(SHOTGUN)).toEqual(pat);
    // The outermost pellet reaches the cone edge.
    const maxR = Math.max(...pat.map((p) => Math.hypot(p.dyaw, p.dpitch)));
    expect(maxR).toBeCloseTo(SHOTGUN.pelletSpread, 6);
  });
});

describe("weapons — accuracy spread by movement state", () => {
  it("still ≤ moving ≤ airborne (movement widens the cone)", () => {
    const still = accuracySpread(AR, false, true);
    const moving = accuracySpread(AR, true, true);
    const air = accuracySpread(AR, true, false);
    expect(still).toBe(AR.spreadStill);
    expect(moving).toBe(AR.spreadStill + AR.spreadMove);
    expect(air).toBe(AR.spreadStill + AR.spreadAir);
    expect(still).toBeLessThanOrEqual(moving);
    expect(moving).toBeLessThanOrEqual(air);
  });
});

// Hybrid hit registration's client-side spread roll (team-lead's balance
// requirement, is-anim): main.ts's computeClaim uses this SAME jitter() to
// degrade the claim ray by accuracySpread before raycasting, so a moving
// shooter's hybrid claim carries the identical movement penalty the analytic
// pellet loop already has — arena-room.ts's private jitter() is the
// server-side twin (own seeded RNG; same formula).
describe("weapons — jitter (hybrid-hit client-side spread roll)", () => {
  it("is exactly 0 when spread is 0 (pinpoint — stationary AR's regression case)", () => {
    expect(jitter(0, Math.random)).toBe(0);
    expect(jitter(0, () => 0.9999)).toBe(0); // not just "small" — the random source is never even consulted
  });

  it("is bounded within [-spread, +spread] across the random source's full [0,1) domain", () => {
    const spread = 0.05;
    expect(jitter(spread, () => 0)).toBeCloseTo(-spread, 9);
    expect(jitter(spread, () => 0.5)).toBeCloseTo(0, 9);
    expect(jitter(spread, () => 1)).toBeCloseTo(spread, 9);
  });

  it("draws a non-constant value across repeated calls (an actual roll, not a fixed offset)", () => {
    const spread = 0.1;
    const samples = new Set(Array.from({ length: 20 }, () => jitter(spread, Math.random)));
    expect(samples.size).toBeGreaterThan(1);
    for (const v of samples) {
      expect(Math.abs(v)).toBeLessThanOrEqual(spread);
    }
  });
});

describe("weapons — dirFromAngles", () => {
  it("yaw 0 faces +z; +yaw turns toward +x; +pitch looks up; unit length", () => {
    const fwd = dirFromAngles(0, 0);
    expect(fwd.x).toBeCloseTo(0, 6);
    expect(fwd.z).toBeCloseTo(1, 6);
    expect(dirFromAngles(Math.PI / 2, 0).x).toBeCloseTo(1, 6);
    expect(dirFromAngles(0, Math.PI / 2).y).toBeCloseTo(1, 6);
    const d = dirFromAngles(1.1, -0.4);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 6);
  });
});

describe("grenade — blast AoE", () => {
  it("full at the centre, linear to 0 at the radius, 0 beyond", () => {
    expect(blastDamage(GRENADE.maxDamage, GRENADE.radius, 0)).toBe(GRENADE.maxDamage);
    expect(blastDamage(GRENADE.maxDamage, GRENADE.radius, GRENADE.radius / 2)).toBeCloseTo(
      GRENADE.maxDamage / 2,
      5,
    );
    expect(blastDamage(GRENADE.maxDamage, GRENADE.radius, GRENADE.radius)).toBe(0);
    expect(blastDamage(GRENADE.maxDamage, GRENADE.radius, GRENADE.radius + 1)).toBe(0);
  });

  it("a point-blank blast (including self) is NOT a one-shot", () => {
    expect(blastDamage(GRENADE.maxDamage, GRENADE.radius, 0)).toBeLessThan(PLAYER.maxHp);
  });
});

describe("grenade — projectile step (bounce)", () => {
  const BOUNDS: Bounds = { width: 60, depth: 40, ceiling: 16 };
  const r = GRENADE.projRadius;

  it("bounces off the floor, reversing and damping vertical velocity", () => {
    const g: GrenadeBody = { pos: { x: 30, y: r + 0.05, z: 20 }, vel: { x: 2, y: -6, z: 0 } };
    const bounced = stepGrenade(g, 0.05, MOVE.gravity, GRENADE.restitution, r, [], BOUNDS);
    expect(bounced).toBe(true);
    expect(g.pos.y).toBeGreaterThanOrEqual(r - 1e-9); // ejected to rest on the floor
    expect(g.vel.y).toBeGreaterThan(0); // now heading up
    expect(g.vel.y).toBeLessThan(6); // …but slower than it came in (restitution)
    expect(g.vel.x).toBeCloseTo(2, 6); // horizontal untouched by a floor hit
  });

  it("bounces off a cover box instead of tunnelling through it", () => {
    const box: Box = { min: { x: 28, y: 0, z: 18 }, max: { x: 32, y: 3, z: 22 } };
    // Flying straight at the box's west face.
    const g: GrenadeBody = { pos: { x: 27.9, y: 1, z: 20 }, vel: { x: 10, y: 0, z: 0 } };
    const bounced = stepGrenade(g, 0.05, MOVE.gravity, GRENADE.restitution, r, [box], BOUNDS);
    expect(bounced).toBe(true);
    expect(g.pos.x).toBeLessThanOrEqual(box.min.x); // stayed outside the box
    expect(g.vel.x).toBeLessThan(0); // reflected back off the face
  });

  it("a free grenade in the open just arcs (no phantom bounce)", () => {
    const g: GrenadeBody = { pos: { x: 30, y: 5, z: 20 }, vel: { x: 4, y: 2, z: 0 } };
    const bounced = stepGrenade(g, 0.05, MOVE.gravity, GRENADE.restitution, r, [], BOUNDS);
    expect(bounced).toBe(false);
    expect(g.pos.x).toBeCloseTo(30 + 4 * 0.05, 6);
    expect(g.vel.y).toBeLessThan(2); // gravity pulled it down
  });
});
