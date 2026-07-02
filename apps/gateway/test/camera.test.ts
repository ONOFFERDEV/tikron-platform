import { describe, it, expect } from "vitest";
import { smoothAxis, smoothAngle, followCamera } from "../demo/camera.js";

describe("camera smoothing (shooter demo follow easing)", () => {
  it("eases toward the target without overshooting", () => {
    // One 16 ms frame at τ = 60 ms closes 1 - exp(-16/60) ≈ 23.5% of the gap.
    const next = smoothAxis(0, 100, 16, 60, 300);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(100);
    expect(next).toBeCloseTo(100 * (1 - Math.exp(-16 / 60)), 6);
  });

  it("is frame-rate independent: two half-steps ≈ one full step", () => {
    const oneStep = smoothAxis(0, 100, 32, 60, 300);
    const half = smoothAxis(0, 100, 16, 60, 300);
    const twoHalves = smoothAxis(half, 100, 16, 60, 300);
    expect(twoHalves).toBeCloseTo(oneStep, 6);
  });

  it("absorbs a reconcile nudge instead of jumping the full distance", () => {
    // A 25 u reconcile step (one unacked input at max speed) must move the camera
    // far less than 25 u in a single frame — that attenuation is the anti-shake.
    const moved = smoothAxis(0, 25, 16, 60, 300) - 0;
    expect(moved).toBeLessThan(25 * 0.3);
  });

  it("teleports when the gap reaches the snap distance (respawn / big correction)", () => {
    expect(smoothAxis(0, 300, 16, 60, 300)).toBe(300);
    expect(smoothAxis(0, 5000, 16, 60, 300)).toBe(5000);
  });

  it("smoothAngle rotates the short way across the ±π wrap", () => {
    // From +170° toward −170° is a +20° short arc (crossing π), not −340° the long way.
    const from = (170 * Math.PI) / 180;
    const to = (-170 * Math.PI) / 180;
    const next = smoothAngle(from, to, 16, 100, Math.PI);
    // A short-arc step nudges the angle *up* past +π (wrapping), never down toward 0.
    expect(next).toBeGreaterThan(from);
  });

  it("smoothAngle eases along the shortest arc without overshoot", () => {
    const next = smoothAngle(0, 1, 16, 100, Math.PI);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
    expect(next).toBeCloseTo(1 * (1 - Math.exp(-16 / 100)), 6);
  });

  it("followCamera eases both axes and leaves the input untouched", () => {
    const cam = { x: 0, y: 0 };
    const next = followCamera(cam, 100, 200, 16, 60, 300);
    expect(cam).toEqual({ x: 0, y: 0 });
    expect(next.x).toBeCloseTo(smoothAxis(0, 100, 16, 60, 300), 6);
    expect(next.y).toBeCloseTo(smoothAxis(0, 200, 16, 60, 300), 6);
  });
});
