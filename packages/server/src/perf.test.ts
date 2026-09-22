import { describe, it, expect } from "vitest";
import { DurationRing } from "./perf.js";

describe("DurationRing", () => {
  it("reports zeros for an empty window", () => {
    const ring = new DurationRing(8);
    expect(ring.stats(1000, 10_000)).toEqual({ p50: 0, p95: 0, p99: 0, max: 0, n: 0 });
  });

  it("computes distinct p50/p95/p99/max values over 100 samples", () => {
    const ring = new DurationRing(128);
    for (let i = 1; i <= 100; i++) ring.record(100 + i, i);
    const s = ring.stats(220, 1000);
    expect(s).toEqual({ p50: 51, p95: 96, p99: 100, max: 100, n: 100 });
  });

  it("excludes samples older than the window", () => {
    const ring = new DurationRing(64);
    ring.record(0, 100); // old spike at t=0
    ring.record(9_000, 5);
    ring.record(9_500, 7);
    // Query at t=10_000 with a 5s window: the t=0 spike falls outside.
    const s = ring.stats(10_000, 5_000);
    expect(s.n).toBe(2);
    expect(s.max).toBe(7);
  });

  it("overwrites oldest samples once capacity is exceeded", () => {
    const ring = new DurationRing(4);
    for (let i = 0; i < 10; i++) ring.record(1000 + i, i); // only the last 4 survive
    const s = ring.stats(2000, 10_000);
    expect(s.n).toBe(4);
    expect(s.max).toBe(9);
  });
});
