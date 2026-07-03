import { describe, it, expect } from "vitest";
import {
  makeCrates,
  crateContains,
  rayCoverDistance,
  shotBlocked,
  type Crate,
} from "../src/rooms/shooter-crates.js";

describe("shooter crates (shared cover geometry)", () => {
  it("is deterministic per seed (client render == server hit-test)", () => {
    const a = makeCrates(1234, 3000);
    const b = makeCrates(1234, 3000);
    expect(a).toEqual(b);
    expect(a).toHaveLength(44);
    // A different seed produces a different layout.
    expect(makeCrates(5678, 3000)).not.toEqual(a);
  });

  it("keeps every crate inside the world margins", () => {
    for (const c of makeCrates(42, 3000)) {
      expect(c.x).toBeGreaterThanOrEqual(80);
      expect(c.x).toBeLessThanOrEqual(2920);
      expect(c.size).toBeGreaterThanOrEqual(26);
      expect(c.size).toBeLessThanOrEqual(54);
    }
  });

  const box: Crate = { x: 100, y: 0, size: 40 }; // AABB x:[80,120] y:[-20,20]

  it("rayCoverDistance: hits the near face of a crate on the ray", () => {
    // Ray from origin along +x enters the box at x=80.
    expect(rayCoverDistance([box], 0, 0, 1, 0, 550)).toBeCloseTo(80);
  });

  it("rayCoverDistance: misses a crate off the ray / beyond maxT", () => {
    expect(rayCoverDistance([box], 0, 100, 1, 0, 550)).toBe(Infinity); // parallel, outside y-slab
    expect(rayCoverDistance([box], 0, 0, 1, 0, 50)).toBe(Infinity); // too far for maxT
    expect(rayCoverDistance([box], 0, 0, -1, 0, 550)).toBe(Infinity); // behind the shooter
  });

  it("rayCoverDistance: ignores the crate the shooter stands in", () => {
    // Origin inside the box: you can fire out of your own cover.
    expect(rayCoverDistance([box], 100, 0, 1, 0, 550)).toBe(Infinity);
  });

  it("shotBlocked: cover between shooter and victim blocks the hit", () => {
    // Victim at x=200 behind the box [80,120].
    expect(shotBlocked([box], 0, 0, 1, 0, 200, 200, 0)).toBe(true);
    // Victim in FRONT of the box (x=60) is hittable.
    expect(shotBlocked([box], 0, 0, 1, 0, 60, 60, 0)).toBe(false);
  });

  it("shotBlocked: a crate never shields a victim standing inside it", () => {
    // Victim at the box centre — movement doesn't collide with crates, so the
    // box is exempt or the victim would be unhittable (degenerate camping).
    expect(shotBlocked([box], 0, 0, 1, 0, 100, 100, 0)).toBe(false);
  });

  it("shotBlocked: victim exemption applies only to the containing crate", () => {
    const far: Crate = { x: 300, y: 0, size: 40 };
    // Victim inside `far` but the NEAR box still blocks the ray on the way.
    expect(shotBlocked([box, far], 0, 0, 1, 0, 300, 300, 0)).toBe(true);
  });

  it("crateContains matches the AABB inclusively", () => {
    expect(crateContains(box, 80, -20)).toBe(true);
    expect(crateContains(box, 79.9, 0)).toBe(false);
  });
});
