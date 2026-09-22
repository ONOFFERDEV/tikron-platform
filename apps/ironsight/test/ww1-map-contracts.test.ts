import { describe, expect, it } from "vitest";
import { MOVE, MODES } from "../src/config.js";
import {
  MAP_SURFACES,
  SurfaceBindingError,
  surfaceForBox,
  surfaceForRamp,
  surfaceForTerrainFace,
  withSurfaceBindings,
} from "../src/map/materials.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";
import {
  baselineMapNavigation,
  validateMapAccess,
} from "../src/map/contracts.js";
import type {
  MapDef,
  MapNavigationDef,
  SurfaceBinding,
} from "../src/map/types.js";
import { COVER_CLASSES, MAP_LAYER_HEIGHTS } from "../src/map/types.js";

const MAPS = [
  { id: "arena1", map: ARENA1 },
  { id: "arena2", map: ARENA2 },
  { id: "arena3", map: ARENA3 },
] as const;

function fixtureMap(boxes: MapDef["boxes"] = []): MapDef {
  return {
    bounds: { width: 10, depth: 10, ceiling: 8 },
    boxes,
    ramps: [],
    spawns: {
      red: [{ x: 1, y: 0, z: 2 }],
      blue: [{ x: 1, y: 0, z: 8 }],
    },
    caps: {
      a: { x: 8, y: 0, z: 2 },
      b: { x: 8, y: 0, z: 5 },
      c: { x: 8, y: 0, z: 8 },
    },
  };
}

describe("WW1 map identity and access baseline", () => {
  it.each(MAPS)("keeps $id at 150x100 with six spawns per team", ({ id, map }) => {
    const navigation = baselineMapNavigation(id, map);

    expect(map.bounds).toMatchObject({ width: 150, depth: 100, floor: -3 });
    expect(map.spawns.red).toHaveLength(6);
    expect(map.spawns.blue).toHaveLength(6);
    expect(navigation.anchors.filter((anchor) => anchor.role === "spawn")).toHaveLength(12);
  });

  it.each(MAPS)("keeps every current $id spawn and cap ground-reachable", ({ id, map }) => {
    const result = validateMapAccess(map, {
      captureRadius: MODES.dom.captureRadius,
      navigation: baselineMapNavigation(id, map),
    });

    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("records current Task 12 movement separately from the pre-retune baseline", () => {
    const preRetuneBaseline = { walk: 6, sprint: 9, crouch: 3 } as const;

    expect(MOVE).toMatchObject({ walk: 5.5, sprint: 8, crouch: 2.6, adsGroundMultiplier: 0.75 });
    expect(preRetuneBaseline).toEqual({ walk: 6, sprint: 9, crouch: 3 });
  });

  it("fixes the authored layer and cover vocabularies", () => {
    expect(MAP_LAYER_HEIGHTS).toEqual([-3, 0, 3]);
    expect(COVER_CLASSES).toEqual(["standing-block", "crouching-block", "body-exposed"]);
  });
});

describe("WW1 map failure fixtures", () => {
  it("rejects sealed required route", () => {
    const wall = { min: { x: 4, y: 0, z: 0 }, max: { x: 6, y: 3, z: 10 } };
    const map = fixtureMap([wall]);

    const result = validateMapAccess(map, {
      captureRadius: 1,
      navigation: baselineMapNavigation("arena1", map),
    });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "sealed_required_route")).toBe(true);
  });

  it("rejects stacked capture volume", () => {
    const map = fixtureMap();
    const baseline = baselineMapNavigation("arena2", map);
    const navigation: MapNavigationDef = {
      ...baseline,
      anchors: [
        ...baseline.anchors,
        {
          id: "arena2.route.bridge-over-a",
          point: { x: 8, y: 3, z: 2 },
          layer: 3,
          role: "route",
        },
      ],
    };

    const result = validateMapAccess(map, { captureRadius: 1, navigation });

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      code: "stacked_capture_volume",
      anchorId: "arena2.route.bridge-over-a",
      captureId: "arena2.cap.a",
    });
  });
});

describe("surface bindings", () => {
  it("binds every supported surface to an exact shared support object", () => {
    const supports = MAP_SURFACES.map((surface, index) => ({
      surface,
      box: { min: { x: index, y: 0, z: 2 }, max: { x: index + 0.5, y: 1, z: 2.5 } },
    }));
    const map = fixtureMap(supports.map(({ box }) => box));
    const bindings: readonly SurfaceBinding[] = supports.map(({ surface, box }) => ({
      id: `arena1.surface.${surface}`,
      surface,
      kind: "box",
      box,
    }));
    const firstSupport = supports[0];
    if (firstSupport === undefined) throw new TypeError("surface fixture must not be empty");

    const bound = withSurfaceBindings(map, bindings);

    expect(bound.surfaceBindings).toHaveLength(MAP_SURFACES.length);
    expect(surfaceForBox(bound, firstSupport.box)).toBe("mud");
  });

  it("rejects a surface binding whose support is not in the map", () => {
    const map = fixtureMap();
    const foreignBox = { min: { x: 2, y: 0, z: 2 }, max: { x: 3, y: 1, z: 3 } };
    const binding: SurfaceBinding = {
      id: "arena1.surface.foreign",
      surface: "wood",
      kind: "box",
      box: foreignBox,
    };

    expect(() => withSurfaceBindings(map, [binding])).toThrowError(SurfaceBindingError);
  });

  it("resolves box, ramp, and terrain bindings through shared object identity", () => {
    const box = ARENA1.boxes[0];
    const ramp = ARENA1.ramps?.[0];
    const face = ARENA1.terrain?.faces[0];
    if (box === undefined || ramp === undefined || face === undefined) {
      throw new TypeError("arena1 support fixtures must exist");
    }
    const bound = withSurfaceBindings(ARENA1, [
      { id: "arena1.surface.box", surface: "wood", kind: "box", box },
      { id: "arena1.surface.ramp", surface: "gravel", kind: "ramp", ramp },
      { id: "arena1.surface.terrain", surface: "mud", kind: "terrain", face },
    ]);

    expect(surfaceForBox(bound, box)).toBe("wood");
    expect(surfaceForRamp(bound, ramp)).toBe("gravel");
    expect(surfaceForTerrainFace(bound, face)).toBe("mud");
  });

  it("rejects an unsupported runtime surface string", () => {
    const box = { min: { x: 2, y: 0, z: 2 }, max: { x: 3, y: 1, z: 3 } };
    const map = fixtureMap([box]);
    const invalid = { id: "arena1.surface.asphalt", surface: "asphalt", kind: "box", box };

    expect(() => Reflect.apply(withSurfaceBindings, undefined, [map, [invalid]])).toThrow("unsupported_surface");
  });

  it("rejects duplicate binding IDs and duplicate support objects", () => {
    const box = { min: { x: 2, y: 0, z: 2 }, max: { x: 3, y: 1, z: 3 } };
    const map = fixtureMap([box]);
    const first: SurfaceBinding = { id: "arena1.surface.same", surface: "wood", kind: "box", box };
    const duplicateId: SurfaceBinding = { ...first, box: map.boxes[0] ?? box };
    const duplicateSupport: SurfaceBinding = { ...first, id: "arena1.surface.other" };

    expect(() => withSurfaceBindings(map, [first, duplicateId])).toThrow("duplicate_id");
    expect(() => withSurfaceBindings(map, [first, duplicateSupport])).toThrow("duplicate_support");
  });
});
