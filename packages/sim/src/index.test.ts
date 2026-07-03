import { describe, it, expect } from "vitest";
import {
  stepToward,
  validateMovement,
  integrateMove,
  clampToBudget,
  resolveMovement,
  MoveBudget,
  xorshift32,
  obstacleContains,
  rayObstacleHit,
  shotBlockedByObstacles,
  pushOutOfObstacles,
  type MotionProfile,
  type Vec2,
} from "./index.js";

describe("stepToward", () => {
  it("reaches a target within the per-step budget", () => {
    // budget = 200 * 50 / 1000 = 10 units; target is 5 away → reached exactly.
    expect(stepToward({ x: 0, y: 0 }, { x: 5, y: 0 }, 200, 50)).toEqual({ x: 5, y: 0 });
  });

  it("caps at the budget distance toward a far target", () => {
    // budget = 10; target 100 away on +x → advance exactly 10.
    expect(stepToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 200, 50)).toEqual({ x: 10, y: 0 });
  });

  it("returns the current position for a zero-distance target", () => {
    expect(stepToward({ x: 3, y: 4 }, { x: 3, y: 4 }, 200, 50)).toEqual({ x: 3, y: 4 });
  });
});

describe("validateMovement", () => {
  it("accepts a move within the tolerant budget", () => {
    const r = validateMovement({ x: 0, y: 0 }, { x: 10, y: 0 }, { maxSpeed: 200 }, 50);
    expect(r).toEqual({ position: { x: 10, y: 0 }, rejected: false });
  });

  it("rejects a teleport and snaps back to prev", () => {
    const r = validateMovement({ x: 0, y: 0 }, { x: 999, y: 999 }, { maxSpeed: 200 }, 50);
    expect(r).toEqual({ position: { x: 0, y: 0 }, rejected: true });
  });
});

describe("shared-sim parity (server accepts exactly what the client produces)", () => {
  it("validateMovement never rejects a stepToward output at the same budget", () => {
    const maxSpeed = 600;
    const dtMs = 50;
    const pos = { x: 137, y: 921 };
    // Sweep a range of targets (near, far, diagonal, negative) around the budget.
    for (let a = 0; a < 360; a += 17) {
      for (const reach of [0.1, 0.9, 1, 5, 50, 500]) {
        const rad = (a * Math.PI) / 180;
        const budget = (maxSpeed * dtMs) / 1000;
        const target = {
          x: pos.x + Math.cos(rad) * budget * reach,
          y: pos.y + Math.sin(rad) * budget * reach,
        };
        const next = stepToward(pos, target, maxSpeed, dtMs);
        const res = validateMovement(pos, next, { maxSpeed }, dtMs);
        expect(res.rejected).toBe(false);
        expect(res.position).toEqual(next);
      }
    }
  });
});

const MAX_SPEED = 500;
const WORLD = 3000;
const MAX_DT = 50;
const PROFILE: MotionProfile = {
  maxSpeed: MAX_SPEED,
  tolerance: 1.15,
  stepMs: MAX_DT,
  world: WORLD,
  sendHeadroom: 1.1,
};
// The server's per-move delta clamp (MOVE_DELTA_MIN/MAX_MS in the shooter room).
const serverDelta = (elapsedMs: number) =>
  Math.min(Math.max(elapsedMs, PROFILE.stepMs * 0.5), PROFILE.stepMs * 2);

describe("integrateMove (continuous local-player integration)", () => {
  it("advances by an equal amount every frame at constant dt (uniform on-screen motion)", () => {
    // The core anti-jitter property: with a held direction and a fixed frame time, the
    // per-frame displacement is identical — no 50 ms tick step to pulse against.
    let pos = { x: 100, y: 100 };
    const xs: number[] = [pos.x];
    for (let i = 0; i < 5; i++) {
      pos = integrateMove(pos, 1, 0, 16, MAX_SPEED, WORLD, MAX_DT);
      xs.push(pos.x);
    }
    const steps = xs.slice(1).map((x, i) => x - xs[i]!);
    const expected = MAX_SPEED * (16 / 1000); // 8 u/frame
    for (const s of steps) expect(s).toBeCloseTo(expected, 9);
  });

  it("normalizes diagonals so speed matches a cardinal move", () => {
    const straight = integrateMove({ x: 100, y: 100 }, 1, 0, 16, MAX_SPEED, WORLD, MAX_DT);
    const diag = integrateMove({ x: 100, y: 100 }, 1, 1, 16, MAX_SPEED, WORLD, MAX_DT);
    const dStraight = Math.hypot(straight.x - 100, straight.y - 100);
    const dDiag = Math.hypot(diag.x - 100, diag.y - 100);
    expect(dDiag).toBeCloseTo(dStraight, 9);
  });

  it("clamps dt to one tick and position to the world bounds", () => {
    // A huge dt (tab-out) is capped at MAX_DT, not integrated at full magnitude.
    const capped = integrateMove({ x: 100, y: 100 }, 1, 0, 5000, MAX_SPEED, WORLD, MAX_DT);
    expect(capped.x - 100).toBeCloseTo(MAX_SPEED * (MAX_DT / 1000), 9); // 25 u, not 2500
    // Moving into the +x wall clamps at `world`, never past it.
    const atWall = integrateMove({ x: WORLD - 1, y: 100 }, 1, 0, 50, MAX_SPEED, WORLD, MAX_DT);
    expect(atWall.x).toBe(WORLD);
  });

  it("holds still with no input", () => {
    expect(integrateMove({ x: 100, y: 100 }, 0, 0, 16, MAX_SPEED, WORLD, MAX_DT)).toEqual({ x: 100, y: 100 });
  });

  it("supports an unbounded plane (world = Infinity)", () => {
    const p = integrateMove({ x: 100, y: 100 }, 1, 0, 16, MAX_SPEED, Infinity, MAX_DT);
    expect(p.x).toBeCloseTo(108, 9);
  });

  it("contract: any frame split of one stepMs composes to a server-accepted send", () => {
    // Whatever frame boundaries the browser produces, the total displacement over one
    // simulation step stays within the one-step budget, so it passes the send clamp
    // undistorted AND the server accepts it at the same profile — the wire never sees
    // an over-budget move from an honest integrator.
    const splits = [[50], [16, 16, 18], [1, 1, 1, 47], [25, 25], [8, 8, 8, 8, 8, 10]];
    for (const split of splits) {
      const start: Vec2 = { x: 800, y: 800 };
      let pos: Vec2 = start;
      for (const dt of split) pos = integrateMove(pos, 1, 1, dt, MAX_SPEED, WORLD, MAX_DT);
      // Full-speed displacement over 50 ms is 25u ≤ the 27.5u clamp budget: untouched.
      const sent = clampToBudget(start, pos, PROFILE, PROFILE.stepMs);
      expect(sent.x).toBeCloseTo(pos.x, 9);
      expect(sent.y).toBeCloseTo(pos.y, 9);
      expect(validateMovement(start, sent, PROFILE, serverDelta(PROFILE.stepMs)).rejected).toBe(false);
    }
  });
});

describe("clampToBudget (outgoing move snapshot budget clamp)", () => {
  it("passes an in-budget snapshot through unchanged", () => {
    const sent = clampToBudget({ x: 100, y: 100 }, { x: 115, y: 100 }, PROFILE, PROFILE.stepMs);
    expect(sent).toEqual({ x: 115, y: 100 });
  });

  it("passes the first send (no previous send) through unchanged", () => {
    expect(clampToBudget(null, { x: 900, y: 40 }, PROFILE, PROFILE.stepMs)).toEqual({ x: 900, y: 40 });
  });

  it("keeps up with sustained full-speed motion on a late timer — no structural deficit", () => {
    // The regression that re-introduced rubber-banding: with a fixed one-tick budget a
    // 70 ms timer fire integrates 35u of legal motion but could only send 22.5u, so the
    // wire fell ~12.5u further behind on EVERY send and the correction snap was
    // inevitable on a long run. Budgeting by the measured elapsed time passes each send
    // through whole (35u ≤ 500 × 1.1 × 0.07 = 38.5u) and the server accepts it for the
    // same delta.
    let sent: Vec2 | null = null;
    let x = 100;
    for (let i = 0; i < 20; i++) {
      const prev = sent;
      x += 35; // 500 u/s × 70 ms — full legal speed on a late timer
      sent = clampToBudget(prev, { x, y: 100 }, PROFILE, 70);
      expect(sent.x).toBeCloseTo(x, 9); // wire tracks the render exactly — zero backlog
      if (prev) {
        expect(validateMovement(prev, sent, PROFILE, serverDelta(70)).rejected).toBe(false);
      }
    }
  });

  it("clamps an over-speed target and the server accepts the clamped send", () => {
    // 40u in 50 ms is 800 u/s — a genuine over-speed ask. The clamp caps it at the
    // elapsed-time budget (500 × 1.1 × 0.05 = 27.5u), which fits the server's budget
    // for the same measured delta (500 × 1.15 × 0.05 = 28.75u).
    const last = { x: 100, y: 100 };
    const sent = clampToBudget(last, { x: 140, y: 100 }, PROFILE, PROFILE.stepMs);
    expect(Math.hypot(sent.x - last.x, sent.y - last.y)).toBeCloseTo(27.5, 9);
    expect(validateMovement(last, sent, PROFILE, serverDelta(PROFILE.stepMs)).rejected).toBe(false);
  });

  it("caps the budget at two ticks — a long stall can't buy unlimited distance", () => {
    // A 400 ms stall doesn't grant a 400 ms budget: the clamp caps the delta at two
    // ticks (100 ms → 55u), exactly like a server that caps its measured inter-move
    // delta at two ticks, so the two sides agree and the send is still accepted.
    const last = { x: 100, y: 100 };
    const sent = clampToBudget(last, { x: 300, y: 100 }, PROFILE, 400);
    expect(Math.hypot(sent.x - last.x, sent.y - last.y)).toBeCloseTo(55, 9);
    expect(validateMovement(last, sent, PROFILE, serverDelta(400)).rejected).toBe(false);
  });

  it("stays inside the server's MINIMUM-delta budget on a catch-up burst", () => {
    // After a main-thread stall, setInterval fires twice ~10 ms apart. The server
    // raises the measured delta to the ½-tick floor (25 ms → 14.375u budget); a fixed
    // one-tick client budget would send a 22.5u full step here and get rejected. The
    // elapsed-time budget sends at most 500 × 1.1 × 0.01 = 5.5u — always inside the
    // floor (1.1 × e < 1.15 × 25 for every e < 25).
    const last = { x: 100, y: 100 };
    const sent = clampToBudget(last, { x: 140, y: 100 }, PROFILE, 10);
    expect(Math.hypot(sent.x - last.x, sent.y - last.y)).toBeCloseTo(5.5, 9);
    expect(validateMovement(last, sent, PROFILE, serverDelta(10)).rejected).toBe(false);
  });

  it("carries the residual: repeated sends converge on the render position", () => {
    // The render position sits 60u ahead after an over-speed clamp. With the timer back
    // to normal 50 ms ticks each send advances by the 27.5u budget — the >1 headroom is
    // what lets the wire close a backlog at all — and converges exactly.
    const target = { x: 160, y: 100 };
    let sent: Vec2 | null = { x: 100, y: 100 };
    for (let i = 0; i < 3; i++) sent = clampToBudget(sent, target, PROFILE, PROFILE.stepMs);
    expect(sent).toEqual(target); // 60u ≤ 3 × 27.5u — fully caught up
  });

  it("defaults sendHeadroom to 1.1 when the profile omits it", () => {
    const bare: MotionProfile = { maxSpeed: MAX_SPEED, stepMs: 50 };
    const sent = clampToBudget({ x: 0, y: 0 }, { x: 100, y: 0 }, bare, 50);
    expect(sent.x).toBeCloseTo(27.5, 9);
  });
});

describe("resolveMovement (non-freezing movement validation)", () => {
  it("matches validateMovement exactly for an in-budget move", () => {
    const prev = { x: 0, y: 0 };
    const req = { x: 20, y: 0 };
    expect(resolveMovement(prev, req, PROFILE, 50)).toEqual(validateMovement(prev, req, PROFILE, 50));
  });

  it("partially advances (never freezes) on an over-budget move and flags it rejected", () => {
    // The un-toleranced budget is 25u per 50 ms; a 1500u teleport ask advances exactly
    // 25u toward the target instead of snapping back to prev.
    const r = resolveMovement({ x: 0, y: 0 }, { x: 1500, y: 0 }, PROFILE, 50);
    expect(r.rejected).toBe(true);
    expect(r.position.x).toBeCloseTo(25, 9);
    expect(r.position.y).toBeCloseTo(0, 9);
  });

  it("advances monotonically under sustained over-speed input (no freeze amplifier)", () => {
    // A speed hack asking 2× speed every move is capped at maxSpeed — the position
    // strictly advances each move; a frozen position (the cascade amplifier) never occurs.
    let pos = { x: 0, y: 0 };
    for (let i = 1; i <= 10; i++) {
      const r = resolveMovement(pos, { x: pos.x + 50, y: 0 }, PROFILE, 50);
      expect(r.rejected).toBe(true);
      expect(r.position.x).toBeGreaterThan(pos.x);
      pos = r.position;
    }
    expect(pos.x).toBeCloseTo(250, 6); // 10 × the 25u budget — capped at maxSpeed, not 500u
  });

  it("keeps validateMovement's freeze semantics untouched (backward compatibility)", () => {
    const r = validateMovement({ x: 0, y: 0 }, { x: 999, y: 999 }, PROFILE, 50);
    expect(r).toEqual({ position: { x: 0, y: 0 }, rejected: true });
  });
});

describe("MoveBudget", () => {
  it("grants a same-instant burst at most the seed + nothing more (closes the ×N floor hole)", () => {
    const b = new MoveBudget({ stepMs: 50, burstMs: 100 });
    // 10 moves in the same instant, each requesting the 25 ms floor.
    let total = 0;
    for (let i = 0; i < 10; i++) total += b.grant(1000, 25);
    // seed = one tick (50 ms): first two moves drain it, the rest get 0.
    expect(total).toBe(50);
  });

  it("never limits an honest fixed-cadence sender", () => {
    const b = new MoveBudget({ stepMs: 50, burstMs: 100 });
    let now = 1000;
    for (let i = 0; i < 100; i++) {
      expect(b.grant(now, 50)).toBe(50);
      now += 50;
    }
  });

  it("grants the full 2-tick catch-up after a late timer fire or a dropped move", () => {
    const b = new MoveBudget({ stepMs: 50, burstMs: 100 });
    expect(b.grant(1000, 50)).toBe(50);
    // 150 ms gap (drop + late fire): accrual capped at burst 100 -> full grant.
    expect(b.grant(1150, 100)).toBe(100);
  });

  it("bounds total granted time to elapsed + burst under a sustained 60/s spam", () => {
    const b = new MoveBudget({ stepMs: 50, burstMs: 100 });
    let total = 0;
    // 60 moves over 1 real second, each claiming the 25 ms floor... every ~16.7 ms.
    for (let i = 0; i < 60; i++) total += b.grant(1000 + Math.floor(i * 16.7), 25);
    // Accrual over the window is ~983 ms + 50 seed; the old per-move floor
    // would have granted 60 × 25 = 1500 ms.
    expect(total).toBeLessThanOrEqual(1000 + 50);
    expect(total).toBeGreaterThan(900); // and an honest-rate spend still flows
  });

  it("accrues nothing on a timeline regression", () => {
    const b = new MoveBudget({ stepMs: 50, burstMs: 100 });
    expect(b.grant(1000, 50)).toBe(50); // drained
    expect(b.grant(900, 50)).toBe(0); // regression: no accrual, bucket dry
    expect(b.grant(1050, 50)).toBe(50); // forward again: 50 ms accrued
  });

  it("reset() returns to the one-tick seed", () => {
    const b = new MoveBudget({ stepMs: 50, burstMs: 100 });
    b.grant(1000, 50);
    b.reset();
    expect(b.grant(5000, 100)).toBe(50); // seed, not burst
  });
});

describe("obstacle geometry (seed-derived cover)", () => {
  const box = { x: 100, y: 0, w: 40, h: 40 }; // AABB x:[80,120] y:[-20,20]

  it("xorshift32 streams are deterministic per seed", () => {
    const a = xorshift32(42);
    const b = xorshift32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(xorshift32(7)()).not.toBe(xorshift32(42)());
  });

  it("rayObstacleHit: near face + index, origin-inside exemption, skip callback", () => {
    expect(rayObstacleHit([box], 0, 0, 1, 0, 550)).toEqual({ t: 80, index: 0 });
    expect(rayObstacleHit([box], 100, 0, 1, 0, 550)).toBeNull(); // fire out of your cover
    expect(rayObstacleHit([box], 0, 0, 1, 0, 550, () => true)).toBeNull(); // broken
    expect(rayObstacleHit([box], 0, 100, 1, 0, 550)).toBeNull(); // parallel, outside slab
    expect(rayObstacleHit([box], 0, 0, 1, 0, 50)).toBeNull(); // beyond maxT
  });

  it("shotBlockedByObstacles: blocks behind cover, never shields a contained victim", () => {
    expect(shotBlockedByObstacles([box], 0, 0, 1, 0, 200, 200, 0)).toBe(true);
    expect(shotBlockedByObstacles([box], 0, 0, 1, 0, 60, 60, 0)).toBe(false);
    expect(shotBlockedByObstacles([box], 0, 0, 1, 0, 100, 100, 0)).toBe(false); // victim inside
  });

  it("pushOutOfObstacles: pushes a circle to the face + resolves centre-inside", () => {
    // Circle r=14 overlapping the left face (x=80): pushed to x = 80 - 14.
    const out = pushOutOfObstacles({ x: 85, y: 0 }, 14, [box]);
    expect(out.x).toBeCloseTo(66);
    expect(out.y).toBeCloseTo(0);
    // Centre inside: exits through the nearest face.
    const inside = pushOutOfObstacles({ x: 82, y: 0 }, 14, [box]);
    expect(inside.x).toBeCloseTo(66);
    // Skip (broken) obstacles never collide.
    const ghost = pushOutOfObstacles({ x: 100, y: 0 }, 14, [box], () => true);
    expect(ghost).toEqual({ x: 100, y: 0 });
  });

  it("rectangular obstacles use per-axis extents", () => {
    const wall = { x: 0, y: 0, w: 200, h: 10 }; // long thin wall
    expect(rayObstacleHit([wall], 0, -50, 0, 1, 100)!.t).toBeCloseTo(45); // enters y=-5
    expect(obstacleContains(wall, 99, 4)).toBe(true);
    expect(obstacleContains(wall, 99, 6)).toBe(false);
  });
});
