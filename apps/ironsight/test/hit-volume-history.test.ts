import { describe, expect, it } from "vitest";
import { HitVolumeHistory, type HitVolumeWorldChannels } from "../src/hit-volume-history.js";
import { targetHitVolume, type HitTarget } from "../src/hitscan.js";

const radians = (degrees: number): number => degrees * Math.PI / 180;

function channels(values: {
  rootX: number;
  rootZ: number;
  feetY: number;
  headX: number;
  headY: number;
  headZ: number;
  bodyTopY: number;
}, omit?: keyof HitVolumeWorldChannels): HitVolumeWorldChannels {
  const id = "target";
  return {
    roots: new Map(omit === "roots" ? [] : [[id, { x: values.rootX, z: values.rootZ }]]),
    feetYs: new Map(omit === "feetYs" ? [] : [[id, values.feetY]]),
    headCenters: new Map(omit === "headCenters" ? [] : [[id, { x: values.headX, y: values.headY, z: values.headZ }]]),
    bodyTopYs: new Map(omit === "bodyTopYs" ? [] : [[id, values.bodyTopY]]),
  };
}

const a = { rootX: 10, rootZ: 20, feetY: 1, headX: 10.2, headY: 2.6, headZ: 20,
  bodyTopY: 2.4 };
const b = { rootX: 12, rootZ: 24, feetY: 2, headX: 12, headY: 3.3, headZ: 24.2,
  bodyTopY: 3.1 };

describe("same-timestamp hit volume history", () => {
  it("rewinds every world channel together across a facing wrap", () => {
    const history = new HitVolumeHistory();
    const wrappedA = { ...a, headX: a.rootX + Math.cos(radians(350)) * .2,
      headZ: a.rootZ + Math.sin(radians(350)) * .2 };
    const wrappedB = { ...b, headX: b.rootX + Math.cos(radians(10)) * .2,
      headZ: b.rootZ + Math.sin(radians(10)) * .2 };
    history.record(10, 1_000, channels(wrappedA));
    history.record(12, 1_100, channels(wrappedB));

    const rewound = history.atTime(1_050).get("target")!;
    expect(rewound).toMatchObject({ x: 11, z: 22, feetY: 1.5 });
    expect(rewound.yaw).toBe(0);
    const legacy: HitTarget = { id: "target", x: 0, z: 0, feetY: 0, headY: 1.8, team: 1 };
    const world = targetHitVolume({ ...legacy, ...rewound }, .22);
    expect(world.headCenter.x).toBeCloseTo((wrappedA.headX + wrappedB.headX) / 2, 12);
    expect(world.headCenter.y).toBeCloseTo((wrappedA.headY + wrappedB.headY) / 2, 12);
    expect(world.headCenter.z).toBeCloseTo((wrappedA.headZ + wrappedB.headZ) / 2, 12);
    expect(world.bodyTopY).toBe(2.75);
  });

  it("interpolates stance dimensions as continuous world values without a pose enum", () => {
    const history = new HitVolumeHistory();
    history.record(1, 100, channels({ ...a, headY: 2.6, bodyTopY: 2.4 }));
    history.record(2, 200, channels({ ...a, headY: 2.2, bodyTopY: 2 }));
    const rewound = history.at(1.5).get("target")!;
    const world = targetHitVolume({ id: "target", headY: 9, team: 1, ...rewound }, .22);
    expect(world.headCenter.y).toBeCloseTo(2.4, 12);
    expect(world.bodyTopY).toBeCloseTo(2.2, 12);
    expect(rewound).not.toHaveProperty("pose");
  });

  it.each(["roots", "feetYs", "headCenters", "bodyTopYs"] as const)
  ("omits the explicit result when %s is missing so the caller stays wholly legacy", missing => {
    const history = new HitVolumeHistory();
    history.record(1, 100, channels(a, missing));
    const legacy: HitTarget = { id: "target", x: 4, z: 5, feetY: 0, headY: 1.8, team: 1 };
    const explicit = history.atTime(100).get("target");
    const target = explicit ? { ...legacy, ...explicit } : legacy;
    expect(explicit).toBeUndefined();
    expect(target).toBe(legacy);
  });

  it("omits non-finite geometry so the caller stays wholly legacy", () => {
    const history = new HitVolumeHistory();
    history.record(1, 100, channels({ ...a, headY: Number.NaN }));
    expect(history.atTime(100).get("target")).toBeUndefined();
  });

  it("preserves LagCompensator retention, clamp and reset semantics", () => {
    const history = new HitVolumeHistory({ depthMs: 100, maxSnapshots: 2 });
    history.record(1, 100, channels(a));
    history.record(2, 150, channels({ ...a, rootX: 11 }));
    history.record(3, 200, channels({ ...a, rootX: 12 }));
    expect(history.depthMs).toBe(100);
    expect(history.size).toBe(2);
    expect(history.atTime(-1).get("target")?.x).toBe(11);
    history.clear();
    expect(history.size).toBe(0);
    expect(history.atTime(200).size).toBe(0);
  });

  it("keeps complete world geometry usable at the midpoint of a half-turn", () => {
    const history = new HitVolumeHistory();
    history.record(1, 100, channels(a));
    history.record(2, 200, channels(a));
    const rewound = history.atTime(150).get("target")!;
    expect(rewound).toBeDefined();
    const world = targetHitVolume({ id: "target", headY: 9, team: 1, ...rewound }, .22);
    expect(world.headCenter).toEqual({ x: a.headX, y: a.headY, z: a.headZ });
    expect(world.bodyTopY).toBe(a.bodyTopY);
  });
});
