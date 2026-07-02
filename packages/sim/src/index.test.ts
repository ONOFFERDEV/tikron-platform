import { describe, it, expect } from "vitest";
import { stepToward, validateMovement } from "./index.js";

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
