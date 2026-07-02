import { describe, it, expect } from "vitest";
import { LagCompensator } from "./lag-compensation.js";
import type { Vec2 } from "@tikron/sim";

const pos = (entries: Record<string, Vec2>): Map<string, Vec2> => new Map(Object.entries(entries));

describe("LagCompensator", () => {
  it("returns an exact recorded snapshot by tick and by time", () => {
    const lag = new LagCompensator({ depthMs: 1000 });
    lag.record(1, 1000, pos({ a: { x: 0, y: 0 } }));
    lag.record(2, 1050, pos({ a: { x: 10, y: 0 } }));

    expect(lag.at(1).get("a")).toEqual({ x: 0, y: 0 });
    expect(lag.at(2).get("a")).toEqual({ x: 10, y: 0 });
    expect(lag.atTime(1000).get("a")).toEqual({ x: 0, y: 0 });
    expect(lag.atTime(1050).get("a")).toEqual({ x: 10, y: 0 });
  });

  it("linearly interpolates positions between two recorded ticks", () => {
    const lag = new LagCompensator({ depthMs: 1000 });
    lag.record(1, 1000, pos({ a: { x: 0, y: 0 } }));
    lag.record(2, 1050, pos({ a: { x: 10, y: 20 } }));

    // Halfway in time → halfway in position.
    expect(lag.atTime(1025).get("a")).toEqual({ x: 5, y: 10 });
    // A quarter of the way by tick.
    expect(lag.at(1.25).get("a")).toEqual({ x: 2.5, y: 5 });
  });

  it("clamps out-of-range queries to the nearest end (present / depth horizon)", () => {
    const lag = new LagCompensator({ depthMs: 1000 });
    lag.record(1, 1000, pos({ a: { x: 0, y: 0 } }));
    lag.record(2, 1050, pos({ a: { x: 10, y: 0 } }));

    expect(lag.atTime(2000).get("a")).toEqual({ x: 10, y: 0 }); // future → present
    expect(lag.atTime(500).get("a")).toEqual({ x: 0, y: 0 }); // past → oldest kept
  });

  it("handles entities present in only one of the bracketing snapshots", () => {
    const lag = new LagCompensator({ depthMs: 1000 });
    lag.record(1, 1000, pos({ a: { x: 0, y: 0 }, gone: { x: 5, y: 5 } }));
    lag.record(2, 1050, pos({ a: { x: 10, y: 0 }, spawned: { x: 9, y: 9 } }));

    const mid = lag.atTime(1025);
    expect(mid.get("a")).toEqual({ x: 5, y: 0 }); // interpolated (in both)
    expect(mid.get("gone")).toEqual({ x: 5, y: 5 }); // only in the older → frozen
    expect(mid.get("spawned")).toEqual({ x: 9, y: 9 }); // only in the newer → its value
  });

  it("drops snapshots older than the retention depth", () => {
    const lag = new LagCompensator({ depthMs: 100 });
    lag.record(1, 1000, pos({ a: { x: 0, y: 0 } }));
    lag.record(2, 1120, pos({ a: { x: 6, y: 0 } }));
    lag.record(3, 1200, pos({ a: { x: 20, y: 0 } })); // cutoff = 1100 → drops only t=1000

    expect(lag.size).toBe(2); // t=1120 (>= 1100) is kept
    // The dropped horizon is now t=1120, so an older query clamps there.
    expect(lag.atTime(1000).get("a")).toEqual({ x: 6, y: 0 });
  });

  it("returns an empty map before anything is recorded", () => {
    expect(new LagCompensator().atTime(0).size).toBe(0);
    expect(new LagCompensator().at(0).size).toBe(0);
  });

  it("resolves a moved target: a rewound hit lands where a current-state hit misses", () => {
    // A target sweeping +50 units/tick; the shooter's packet lands ~2 ticks late.
    const lag = new LagCompensator({ depthMs: 1000 });
    for (let tick = 1; tick <= 10; tick++) {
      lag.record(tick, 1000 + tick * 50, pos({ target: { x: tick * 50, y: 0 } }));
    }
    const currentX = 500; // tick 10
    const rewound = lag.atTime(1000 + 8 * 50).get("target")!; // 2 ticks ago → x = 400

    const aim = rewound.x; // the shooter aimed where they SAW the target
    const hitRadius = 25;
    expect(Math.abs(aim - rewound.x) <= hitRadius).toBe(true); // hit against the rewound world
    expect(Math.abs(aim - currentX) <= hitRadius).toBe(false); // miss against the current world
  });
});
