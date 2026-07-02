import { describe, it, expect } from "vitest";
import { integrateMove, decayOffset, applyCorrection } from "../demo/movement.js";

const MAX_SPEED = 500;
const WORLD = 3000;
const MAX_DT = 50;

describe("movement integration (continuous local player)", () => {
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
});

describe("correction offset (server reconcile absorption)", () => {
  it("decays the offset toward zero, frame-rate independently", () => {
    const one = decayOffset({ x: 100, y: 0 }, 32, 100);
    const half = decayOffset({ x: 100, y: 0 }, 16, 100);
    const twoHalves = decayOffset(half, 16, 100);
    expect(one.x).toBeCloseTo(twoHalves.x, 6);
    expect(one.x).toBeLessThan(100);
    expect(one.x).toBeGreaterThan(0);
  });

  it("converges: repeated decay drives the offset to ~zero", () => {
    let off = { x: 40, y: -30 };
    for (let i = 0; i < 40; i++) off = decayOffset(off, 16, 100);
    expect(Math.hypot(off.x, off.y)).toBeLessThan(0.5);
  });

  it("absorbs a small correction without moving the rendered position", () => {
    // render = continuous + offset must be unchanged; continuous adopts authoritative.
    const continuous = { x: 0, y: 0 };
    const offset = { x: 10, y: 0 };
    const renderBefore = { x: continuous.x + offset.x, y: continuous.y + offset.y };
    const r = applyCorrection(continuous, offset, { x: 5, y: 0 }, 300);
    expect(r.continuous).toEqual({ x: 5, y: 0 });
    expect(r.continuous.x + r.offset.x).toBeCloseTo(renderBefore.x, 9);
    expect(r.continuous.y + r.offset.y).toBeCloseTo(renderBefore.y, 9);
  });

  it("snaps (clears offset) when the error reaches the teleport threshold", () => {
    const r = applyCorrection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 400, y: 0 }, 300);
    expect(r.continuous).toEqual({ x: 400, y: 0 });
    expect(r.offset).toEqual({ x: 0, y: 0 });
  });
});
