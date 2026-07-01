import { describe, it, expect } from "vitest";
import { validateMovement } from "./movement.js";

describe("validateMovement", () => {
  const cfg = { maxSpeed: 10, tolerance: 1 }; // 10 units/sec, no jitter allowance

  it("accepts movement within the speed budget", () => {
    // 1000ms at 10 u/s => 10 units allowed; moving 5 is fine
    const r = validateMovement({ x: 0, y: 0 }, { x: 5, y: 0 }, cfg, 1000);
    expect(r.rejected).toBe(false);
    expect(r.position).toEqual({ x: 5, y: 0 });
  });

  it("rejects a teleport and snaps back to the previous position", () => {
    const r = validateMovement({ x: 0, y: 0 }, { x: 500, y: 500 }, cfg, 100);
    expect(r.rejected).toBe(true);
    expect(r.position).toEqual({ x: 0, y: 0 });
  });

  it("rejects a speed hack (too far for the elapsed time)", () => {
    // 100ms at 10 u/s => 1 unit allowed; moving 5 is too fast
    const r = validateMovement({ x: 0, y: 0 }, { x: 5, y: 0 }, cfg, 100);
    expect(r.rejected).toBe(true);
    expect(r.position).toEqual({ x: 0, y: 0 });
  });

  it("honors the jitter tolerance", () => {
    // 100ms at 10 u/s => 1 unit; tolerance 1.5 => 1.5 allowed; moving 1.4 is ok
    const r = validateMovement({ x: 0, y: 0 }, { x: 1.4, y: 0 }, { maxSpeed: 10, tolerance: 1.5 }, 100);
    expect(r.rejected).toBe(false);
  });
});
