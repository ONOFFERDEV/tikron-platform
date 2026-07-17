// [blueprint] — pure physics/hitscan math (moveAndSlide, canStand, ray primitives,
// head/body/occlusion resolution); every fixture reads PLAYER dynamically, so this
// holds for any player capsule size, not just ironsight's.
import { describe, it, expect } from "vitest";
import {
  canStand,
  moveAndSlide,
  nearestBox,
  rayAabb,
  raySphere,
  rayVerticalCylinder,
  type Box,
  type Bounds,
  type Vec3,
} from "../src/physics.js";
import { resolveHitscan, type HitTarget } from "../src/hitscan.js";
import { PLAYER, MOVE } from "../src/config.js";

const BOUNDS: Bounds = { width: 60, depth: 40, ceiling: 16 };
const CFG = { radius: PLAYER.radius, headRadius: PLAYER.headRadius };

/** A standing (feet=0, crown=1.8) enemy target at (x, z). */
function standing(id: string, x: number, z: number, team = 1): HitTarget {
  return { id, x, z, feetY: 0, headY: PLAYER.standHeight, team };
}

describe("physics — ray primitives", () => {
  it("rayAabb enters the near face; misses when off-axis; ignores an origin inside", () => {
    const box: Box = { min: { x: 10, y: 0, z: -1 }, max: { x: 12, y: 2, z: 1 } };
    expect(rayAabb({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, box, 100)).toBeCloseTo(10, 5);
    expect(rayAabb({ x: 0, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }, box, 100)).toBeNull(); // above it
    expect(rayAabb({ x: 11, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, box, 100)).toBeNull(); // inside
    expect(rayAabb({ x: 20, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, box, 100)).toBeNull(); // behind
  });

  it("raySphere returns the near intersection and null past maxT", () => {
    expect(raySphere({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 10, y: 1, z: 0 }, 1, 100)).toBeCloseTo(9, 5);
    expect(raySphere({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 10, y: 5, z: 0 }, 1, 100)).toBeNull();
    expect(raySphere({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 10, y: 1, z: 0 }, 1, 5)).toBeNull();
  });

  it("rayVerticalCylinder hits inside the y-band, misses above it", () => {
    // Shaft radius 0.5 at (10,0), band y ∈ [0,2].
    expect(rayVerticalCylinder({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 10, 0, 0, 2, 0.5, 100)).toBeCloseTo(9.5, 5);
    expect(rayVerticalCylinder({ x: 0, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }, 10, 0, 0, 2, 0.5, 100)).toBeNull();
  });

  it("nearestBox returns the closest occluder or Infinity", () => {
    const boxes: Box[] = [
      { min: { x: 20, y: 0, z: -1 }, max: { x: 21, y: 3, z: 1 } },
      { min: { x: 10, y: 0, z: -1 }, max: { x: 11, y: 3, z: 1 } },
    ];
    expect(nearestBox({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, boxes, 100)).toBeCloseTo(10, 5);
    expect(nearestBox({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }, boxes, 100)).toBe(Infinity); // upward, no box
  });
});

describe("physics — movement", () => {
  it("a fall clamps to the floor and grounds", () => {
    const r = moveAndSlide({ x: 30, y: 0.3, z: 20 }, PLAYER.radius, PLAYER.standHeight, { x: 0, y: -0.5, z: 0 }, -10, [], BOUNDS);
    expect(r.pos.y).toBe(0);
    expect(r.vy).toBe(0);
    expect(r.grounded).toBe(true);
  });

  it("walking into a wall stops that axis but slides along the other", () => {
    const wall: Box = { min: { x: 5, y: 0, z: 0 }, max: { x: 6, y: 3, z: 20 } };
    const r = moveAndSlide({ x: 4.5, y: 0, z: 10 }, PLAYER.radius, PLAYER.standHeight, { x: 0.3, y: 0, z: 0.3 }, 0, [wall], BOUNDS);
    expect(r.pos.x).toBeCloseTo(5 - PLAYER.radius, 5); // pushed flush against the wall
    expect(r.pos.z).toBeCloseTo(10.3, 5); // slid freely along z
  });

  it("a descending player lands on a box top and grounds", () => {
    const platform: Box = { min: { x: 27, y: 0, z: 4 }, max: { x: 33, y: 1.2, z: 9 } };
    const r = moveAndSlide({ x: 30, y: 1.5, z: 6.5 }, PLAYER.radius, PLAYER.standHeight, { x: 0, y: -0.5, z: 0 }, -10, [platform], BOUNDS);
    expect(r.pos.y).toBeCloseTo(1.2, 5);
    expect(r.grounded).toBe(true);
    expect(r.vy).toBe(0);
  });

  it("horizontal position clamps to the arena bounds", () => {
    const r = moveAndSlide({ x: 0.5, y: 0, z: 20 }, PLAYER.radius, PLAYER.standHeight, { x: -5, y: 0, z: 0 }, 0, [], BOUNDS);
    expect(r.pos.x).toBeCloseTo(PLAYER.radius, 5); // clamped to left edge, not negative
  });

  it("canStand rejects standing under low cover but allows it in the open", () => {
    const lowCover: Box = { min: { x: 28.5, y: 0, z: 18.5 }, max: { x: 31.5, y: 2.2, z: 21.5 } };
    expect(canStand(30, 0, 20, PLAYER.radius, PLAYER.standHeight, [lowCover], BOUNDS)).toBe(false);
    expect(canStand(10, 0, 10, PLAYER.radius, PLAYER.standHeight, [lowCover], BOUNDS)).toBe(true);
  });
});

describe("physics — step-up", () => {
  it("a resting player auto-climbs a 0.4m step via stepUp", () => {
    const step: Box = { min: { x: 5, y: 0, z: 9 }, max: { x: 6, y: 0.4, z: 11 } };
    const r = moveAndSlide(
      { x: 4.5, y: 0, z: 10 },
      PLAYER.radius,
      PLAYER.standHeight,
      { x: 0.6, y: 0, z: 0 },
      0,
      [step],
      BOUNDS,
      MOVE.stepUp,
    );
    expect(r.pos.y).toBeCloseTo(0.4, 5);
    expect(r.grounded).toBe(true);
    expect(r.pos.x).toBeGreaterThan(4.5); // made real forward progress, not just bonked flush
  });

  it("a 1.1m crate is too tall for stepUp — still blocks like a wall", () => {
    const crate: Box = { min: { x: 5, y: 0, z: 9 }, max: { x: 6, y: 1.1, z: 11 } };
    const r = moveAndSlide(
      { x: 4.5, y: 0, z: 10 },
      PLAYER.radius,
      PLAYER.standHeight,
      { x: 0.6, y: 0, z: 0 },
      0,
      [crate],
      BOUNDS,
      MOVE.stepUp,
    );
    expect(r.pos.x).toBeCloseTo(5 - PLAYER.radius, 5); // pushed flush against it — no climb
    expect(r.pos.y).toBe(0);
  });

  it("insufficient headroom overhead cancels an otherwise-valid step-up", () => {
    const lowCeiling: Bounds = { width: 60, depth: 40, ceiling: 2.0 };
    const step: Box = { min: { x: 5, y: 0, z: 9 }, max: { x: 6, y: 0.4, z: 11 } };
    const r = moveAndSlide(
      { x: 4.5, y: 0, z: 10 },
      PLAYER.radius,
      PLAYER.standHeight,
      { x: 0.6, y: 0, z: 0 },
      0,
      [step],
      lowCeiling,
      MOVE.stepUp,
    );
    // Raised by stepUp (0.45m), a 1.8m-tall capsule would poke through a 2.0m
    // ceiling (0.45+1.8=2.25 > 2.0) — canStand rejects it, so the step-up is
    // cancelled and the player stays bonked at the step's face, same as stepUp=0.
    expect(r.pos.x).toBeCloseTo(5 - PLAYER.radius, 5);
    expect(r.pos.y).toBe(0);
  });

  it("no step-up while airborne (mid-fall), even toward an otherwise-steppable box", () => {
    const step: Box = { min: { x: 5, y: 0, z: 9 }, max: { x: 6, y: 0.4, z: 11 } };
    // Feet at y=0.3 (not resting: not on the floor, not exactly on a box top) and
    // still falling (vyIn=-10) — restingAt() gates the step-up attempt off before
    // it's ever tried, so this must behave exactly like stepUp=0.
    const r = moveAndSlide(
      { x: 4.5, y: 0.3, z: 10 },
      PLAYER.radius,
      PLAYER.standHeight,
      { x: 0.6, y: -0.2, z: 0 },
      -10,
      [step],
      BOUNDS,
      MOVE.stepUp,
    );
    expect(r.pos.x).toBeCloseTo(5 - PLAYER.radius, 5); // bonked, not climbed
    expect(r.grounded).toBe(false);
    expect(r.vy).toBe(-10);
  });

  it("stepUp=0 reproduces the pre-step-up blocked behavior exactly", () => {
    const step: Box = { min: { x: 5, y: 0, z: 9 }, max: { x: 6, y: 0.4, z: 11 } };
    const withDefault = moveAndSlide(
      { x: 4.5, y: 0, z: 10 },
      PLAYER.radius,
      PLAYER.standHeight,
      { x: 0.6, y: 0, z: 0 },
      0,
      [step],
      BOUNDS,
    );
    const withExplicitZero = moveAndSlide(
      { x: 4.5, y: 0, z: 10 },
      PLAYER.radius,
      PLAYER.standHeight,
      { x: 0.6, y: 0, z: 0 },
      0,
      [step],
      BOUNDS,
      0,
    );
    expect(withExplicitZero).toEqual(withDefault);
    expect(withExplicitZero.pos.x).toBeCloseTo(5 - PLAYER.radius, 5); // still blocked, no auto-climb
    expect(withExplicitZero.pos.y).toBe(0);
  });

  it("walking across a 3-step ramp climbs smoothly to the top step's height (multi-tick E2E)", () => {
    const stepDepth = 2 / 3;
    const ramp: Box[] = [
      { min: { x: 10, y: 0, z: 9 }, max: { x: 10 + stepDepth, y: 0.4, z: 11 } },
      { min: { x: 10 + stepDepth, y: 0, z: 9 }, max: { x: 10 + 2 * stepDepth, y: 0.8, z: 11 } },
      { min: { x: 10 + 2 * stepDepth, y: 0, z: 9 }, max: { x: 12, y: 1.2, z: 11 } },
    ];
    const dt = 1 / 20; // matches the room's 20 Hz tick
    let pos: Vec3 = { x: 9.5, y: 0, z: 10 };
    let vy = 0;
    let ticks = 0;
    while (pos.x < 12.1 && ticks < 100) {
      vy -= MOVE.gravity * dt;
      const delta: Vec3 = { x: MOVE.walk * dt, y: vy * dt, z: 0 };
      const res = moveAndSlide(pos, PLAYER.radius, PLAYER.standHeight, delta, vy, ramp, BOUNDS, MOVE.stepUp);
      pos = res.pos;
      vy = res.vy;
      ticks++;
    }
    expect(ticks).toBeLessThan(100); // reached the far side, never got stuck bonking a step
    expect(pos.y).toBeCloseTo(1.2, 5); // climbed all 3 steps to the top step's height
  });
});

describe("hitscan — head/body/occlusion", () => {
  it("a chest-height shot is a body hit", () => {
    const hit = resolveHitscan({ x: 0, y: 1.0, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 0, [standing("t", 10, 0)], [], CFG);
    expect(hit).not.toBeNull();
    expect(hit!.id).toBe("t");
    expect(hit!.part).toBe("body");
    expect(hit!.t).toBeCloseTo(10 - PLAYER.radius, 2);
  });

  it("a head-height shot is a headshot (the body cylinder does not steal it)", () => {
    const headCentreY = PLAYER.standHeight - PLAYER.headRadius; // 1.58
    const hit = resolveHitscan({ x: 0, y: headCentreY, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 0, [standing("t", 10, 0)], [], CFG);
    expect(hit).not.toBeNull();
    expect(hit!.part).toBe("head");
  });

  it("a map box in front shields the target", () => {
    const wall: Box = { min: { x: 10, y: 0, z: -2 }, max: { x: 11, y: 3, z: 2 } };
    const hit = resolveHitscan({ x: 0, y: 1.0, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 0, [standing("t", 20, 0)], [wall], CFG);
    expect(hit).toBeNull();
  });

  it("the nearest enemy wins; a same-team target is ignored; out of range misses", () => {
    const near = standing("near", 10, 0);
    const far = standing("far", 15, 0);
    const nearest = resolveHitscan({ x: 0, y: 1.0, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 0, [far, near], [], CFG);
    expect(nearest!.id).toBe("near");

    const friendly = { ...standing("mate", 10, 0), team: 0 };
    expect(resolveHitscan({ x: 0, y: 1.0, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 0, [friendly], [], CFG)).toBeNull();

    expect(resolveHitscan({ x: 0, y: 1.0, z: 0 }, { x: 1, y: 0, z: 0 }, 40, 0, [standing("t", 50, 0)], [], CFG)).toBeNull();
  });
});

describe("physics — fail-closed penetration guard (sub-capsule-width slot)", () => {
  // Reproduces the live incident (2026-07-17 user report: "rubbing climbs over /
  // walls sometimes don't block"): a ramp tile compiled flush against a 2.5 m wall
  // leaves the 0.4-step band as a 0.667 m slot between the 0.8-step's face and the
  // wall's face — narrower than the player's 0.8 m diameter. A player standing on
  // the low step and rubbing into the wall overlaps BOTH boxes; sequential MTV
  // push-out could then resolve one overlap INTO the other box and, once past the
  // wall's midplane, eject out the FAR side (through-wall). The guard reverts any
  // horizontal move that would newly penetrate; these walkers must never cross.
  const wall: Box = { min: { x: 14, y: 0, z: 12 }, max: { x: 46, y: 2.5, z: 14 } };
  const slotSteps: Box[] = [
    { min: { x: 30, y: 0, z: 11 + 1 / 3 }, max: { x: 32, y: 0.4, z: 12 } },
    { min: { x: 30, y: 0, z: 10 + 2 / 3 }, max: { x: 32, y: 0.8, z: 11 + 1 / 3 } },
    { min: { x: 30, y: 0, z: 10 }, max: { x: 32, y: 1.2, z: 10 + 2 / 3 } },
  ];
  const slotBoxes = [wall, ...slotSteps];
  const R = PLAYER.radius;
  const H = PLAYER.standHeight;
  const DT = 1 / 20;

  function truePenetration(x: number, y: number, z: number): boolean {
    for (const b of slotBoxes) {
      if (!(y < b.max.y && y + H > b.min.y)) continue;
      const nx = Math.max(b.min.x, Math.min(x, b.max.x));
      const nz = Math.max(b.min.z, Math.min(z, b.max.z));
      if (Math.hypot(x - nx, z - nz) < R - 5e-3) return true;
    }
    return false;
  }

  const rubDirs: readonly [number, number, string][] = [
    [1, 0, "straight +x into the ramp's side"],
    [0.7, 0.7, "diagonal +x+z into the wall/ramp corner"],
    [0.3, 0.95, "mostly into the wall, drifting +x"],
    [0.9, 0.44, "shallow along the wall toward the ramp"],
  ];

  for (const [dx, dz, name] of rubDirs) {
    it(`a clean walker in the corridor rubbing ${name} never penetrates or crosses`, () => {
      // Reachable, non-penetrating start: on the corridor floor hugging the wall,
      // just west of the ramp tile (the state a real player is actually in right
      // before the pre-fix step-up used to hoist them into the wedge).
      let pos = { x: 29, y: 0, z: 11.55 };
      let vy = 0;
      for (let t = 0; t < 120; t++) {
        vy -= MOVE.gravity * DT;
        const delta = { x: dx * MOVE.sprint * DT, y: vy * DT, z: dz * MOVE.sprint * DT };
        const res = moveAndSlide(pos, R, H, delta, vy, slotBoxes, BOUNDS, MOVE.stepUp);
        pos = res.pos;
        vy = res.vy;
        // Never on the far side of the wall (near face z=12, far face z=14) and
        // never truly interpenetrating — the two pre-guard failure modes (the
        // un-guarded resolver crossed at t55-t115 from this same approach).
        // z is only bounded while still alongside the wall (x span 14-46) — a
        // walker that slides past its open east end and turns the corner is
        // walking AROUND the wall, which is legitimate.
        if (pos.x <= 45.5) expect(pos.z).toBeLessThan(12.5);
        expect(truePenetration(pos.x, pos.y, pos.z)).toBe(false);
      }
      // Climbing the ramp steps themselves stays legitimate (max top 1.2).
      expect(pos.y).toBeLessThanOrEqual(1.2 + 1e-6);
    });
  }

  it("even from the (now-unreachable) wedged state, penetration only ever decreases — no far-side ejection", () => {
    // The pre-fix step-up could deposit a player ON the low step at z≈11.6, where a
    // 0.8 m capsule geometrically cannot fit clean (slot is 0.667 m) — every tick
    // starts already-penetrating, which is exactly the state that used to bypass a
    // naive "only guard NEW penetration" rule and tunnel through the wall. The
    // monotonic guard instead lets such a player only shed embedding: depth must
    // never rise, and crossing the wall (depth peaking at its midplane) is impossible.
    const startPen = (p: { x: number; y: number; z: number }): number => {
      let worst = 0;
      for (const b of slotBoxes) {
        if (!(p.y < b.max.y && p.y + H > b.min.y)) continue;
        const nx = Math.max(b.min.x, Math.min(p.x, b.max.x));
        const nz = Math.max(b.min.z, Math.min(p.z, b.max.z));
        worst = Math.max(worst, R - Math.hypot(p.x - nx, p.z - nz));
      }
      return worst;
    };
    let pos = { x: 31, y: 0.4, z: 11.6 };
    let vy = 0;
    let prevPen = startPen(pos);
    for (let t = 0; t < 120; t++) {
      vy -= MOVE.gravity * DT;
      const delta = { x: 0.3 * MOVE.sprint * DT, y: vy * DT, z: 0.95 * MOVE.sprint * DT };
      const res = moveAndSlide(pos, R, H, delta, vy, slotBoxes, BOUNDS, MOVE.stepUp);
      pos = res.pos;
      vy = res.vy;
      const pen = startPen(pos);
      expect(pen).toBeLessThanOrEqual(prevPen + 1e-6); // monotonic — embedding never deepens
      prevPen = pen;
      if (pos.x <= 45.5) expect(pos.z).toBeLessThan(12.5); // never THROUGH the wall (around its open end is fine)
    }
  });

  it("a player already inside geometry (teleport/respawn) can still escape — guard only fires on NEW penetration", () => {
    // Start embedded in the wall; the ejection path must keep working.
    let pos = { x: 30, y: 0, z: 13 };
    let vy = 0;
    for (let t = 0; t < 30; t++) {
      vy -= MOVE.gravity * DT;
      const res = moveAndSlide(pos, R, H, { x: 0, y: vy * DT, z: 0 }, vy, slotBoxes, BOUNDS, MOVE.stepUp);
      pos = res.pos;
      vy = res.vy;
    }
    expect(truePenetration(pos.x, pos.y, pos.z)).toBe(false); // ejected, not frozen inside
  });
});

describe("physics — smooth ramp colliders (2026-07-17 rework: no more 3-box steps)", () => {
  // One '>'-style ramp: footprint x [24,26], z [6,8], rising +x from 0 to 1.2,
  // flush against a 1.2m platform box to its east — the live arena1 shape.
  const ramp = { minX: 24, maxX: 26, minZ: 6, maxZ: 8, axis: "x" as const, dir: 1 as const, topY: 1.2 };
  const platform: Box = { min: { x: 26, y: 0, z: 4 }, max: { x: 34, y: 1.2, z: 10 } };
  const R = PLAYER.radius;
  const H = PLAYER.standHeight;
  const DT = 1 / 20;

  function step(pos: Vec3, vy: number, dx: number, dz: number, jump = false) {
    if (jump) vy = MOVE.jumpSpeed;
    vy -= MOVE.gravity * DT;
    const delta = { x: dx * MOVE.walk * DT, y: vy * DT, z: dz * MOVE.walk * DT };
    return moveAndSlide(pos, R, H, delta, vy, [platform], BOUNDS, MOVE.stepUp, [ramp]);
  }

  it("walking up is glued: grounded every tick, y monotonically non-decreasing, tops out at 1.2 onto the platform", () => {
    let pos: Vec3 = { x: 23, y: 0, z: 7 };
    let vy = 0;
    let lastY = 0;
    // 30 ticks: floor → ramp → platform, stopping well before the platform's
    // far edge (walking off it at t≈37 would legitimately un-ground the walker).
    for (let t = 0; t < 30; t++) {
      const r = step(pos, vy, 1, 0);
      pos = r.pos;
      vy = r.vy;
      expect(r.grounded).toBe(true); // never an airborne flicker mid-climb
      expect(pos.y).toBeGreaterThanOrEqual(lastY - 1e-9); // monotonic ascent
      lastY = pos.y;
    }
    expect(pos.x).toBeGreaterThan(26); // carried onto the platform
    expect(pos.y).toBeCloseTo(1.2, 5); // at platform height, flush hand-off
  });

  it("standing still mid-slope is perfectly stable — zero drift over 60 ticks (the jitter regression)", () => {
    // Start ON the surface at the ramp's middle (x=25 → t=0.5 → y=0.6).
    let pos: Vec3 = { x: 25, y: 0.6, z: 7 };
    let vy = 0;
    for (let t = 0; t < 60; t++) {
      const r = step(pos, vy, 0, 0);
      expect(r.pos.x).toBe(pos.x);
      expect(r.pos.z).toBe(pos.z);
      expect(r.pos.y).toBeCloseTo(0.6, 6);
      expect(r.grounded).toBe(true);
      pos = r.pos;
      vy = r.vy;
    }
  });

  it("walking down stays grounded every tick (no land/fall alternation)", () => {
    let pos: Vec3 = { x: 25.5, y: rampY(25.5), z: 7 };
    let vy = 0;
    for (let t = 0; t < 40 && pos.x > 24.6; t++) {
      const r = step(pos, vy, -1, 0);
      pos = r.pos;
      vy = r.vy;
      expect(r.grounded).toBe(true);
      expect(Math.abs(pos.y - rampY(pos.x))).toBeLessThan(0.02); // glued to the surface
    }
  });

  it("side entry: allowed where the surface is within stepUp of the feet, blocked (like a wall) where it is not", () => {
    // Low part: x=24.5 → surface 0.3 ≤ 0.45 — walking in from the side works.
    // Several ticks so the capsule CENTER actually crosses into the footprint
    // (entry is judged at the center, and glue only applies inside it).
    let low: Vec3 = { x: 24.5, y: 0, z: 8.6 };
    let lowVy = 0;
    for (let t = 0; t < 6; t++) {
      const r = step(low, lowVy, 0, -1);
      low = r.pos;
      lowVy = r.vy;
    }
    expect(low.z).toBeLessThan(8); // center entered the footprint
    expect(low.y).toBeCloseTo(rampY(low.x), 2); // glued onto the slope

    // High part: x=25.8 → surface 1.08 > 0.45 → blocked like a wall, held outside.
    let high: Vec3 = { x: 25.8, y: 0, z: 8.55 };
    let highVy = 0;
    for (let t = 0; t < 6; t++) {
      const r = step(high, highVy, 0, -1);
      high = r.pos;
      highVy = r.vy;
    }
    expect(high.z).toBeGreaterThan(7.95); // center never swallowed into the footprint
    expect(high.y).toBe(0);
  });

  it("rubbing the high side diagonally SLIDES along it instead of freezing (sticky-edge regression)", () => {
    // Ramp alone (no platform box) — pure ramp-side behavior: pushing diagonally
    // into the high side must keep the tangential component moving.
    let pos: Vec3 = { x: 24.9, y: 0, z: 8.55 };
    let vy = 0;
    let minZWhileAlongside = pos.z;
    for (let t = 0; t < 20; t++) {
      vy -= MOVE.gravity * DT;
      const delta = { x: 0.7 * MOVE.walk * DT, y: vy * DT, z: -0.7 * MOVE.walk * DT };
      const r = moveAndSlide(pos, R, H, delta, vy, [], BOUNDS, MOVE.stepUp, [ramp]);
      pos = r.pos;
      vy = r.vy;
      // Only bounded while still alongside the high side — once past x=26 the
      // space behind the ramp's back face is open floor and -z is legitimate.
      if (pos.x <= ramp.maxX) minZWhileAlongside = Math.min(minZWhileAlongside, pos.z);
    }
    expect(pos.x).toBeGreaterThan(26.2); // real tangential progress past the ramp
    expect(minZWhileAlongside).toBeGreaterThan(7.9); // never swallowed into the blocked footprint while alongside
  });

  it("a jump from the slope rises freely (no glue while ascending) and lands back on the surface", () => {
    let pos: Vec3 = { x: 25, y: 0.6, z: 7 };
    let vy = 0;
    let r = step(pos, vy, 0, 0, true); // jump
    pos = r.pos;
    vy = r.vy;
    expect(pos.y).toBeGreaterThan(0.6 + 0.2); // left the surface
    expect(r.grounded).toBe(false);
    let peak = pos.y;
    for (let t = 0; t < 40; t++) {
      r = step(pos, vy, 0, 0);
      pos = r.pos;
      vy = r.vy;
      if (pos.y > peak) peak = pos.y;
      if (r.grounded) break;
    }
    expect(peak).toBeGreaterThan(1.2); // genuinely airborne past the ramp top
    expect(pos.y).toBeCloseTo(0.6, 2); // came back down onto the slope, glued
  });

  it("fast fall spanning two overlapping tops lands on the HIGHER one (order-independence fix)", () => {
    const lowBox: Box = { min: { x: 40, y: 0, z: 20 }, max: { x: 42, y: 0.5, z: 22 } };
    const highBox: Box = { min: { x: 41, y: 0, z: 20 }, max: { x: 43, y: 1.0, z: 22 } };
    // Falling fast enough that one tick passes BOTH tops: pos.y 1.3 → 0.3.
    const r = moveAndSlide({ x: 41.5, y: 1.3, z: 21 }, R, H, { x: 0, y: -1.0, z: 0 }, -20, [lowBox, highBox], BOUNDS, MOVE.stepUp, []);
    expect(r.pos.y).toBe(1.0); // the higher qualifying top, regardless of array order
    expect(r.grounded).toBe(true);
  });

  function rampY(x: number): number {
    return ((x - ramp.minX) / (ramp.maxX - ramp.minX)) * ramp.topY;
  }
});
