import { describe, it, expect } from "vitest";
import { DurationRing } from "./perf.js";

describe("DurationRing", () => {
  it("reports zeros for an empty window", () => {
    const ring = new DurationRing(8);
    expect(ring.stats(1000, 10_000)).toEqual({ p50: 0, p95: 0, max: 0, n: 0 });
  });

  it("computes p50/p95/max/n over recorded samples", () => {
    const ring = new DurationRing(64);
    // 1..10 ms recorded at t=100..109; query at t=110 with a 1s window (all in).
    for (let i = 1; i <= 10; i++) ring.record(100 + i, i);
    const s = ring.stats(120, 1000);
    expect(s.n).toBe(10);
    expect(s.max).toBe(10);
    // nearest-rank: p50 -> index floor(0.5*10)=5 -> sorted[5]=6; p95 -> index 9 -> 10.
    expect(s.p50).toBe(6);
    expect(s.p95).toBe(10);
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
