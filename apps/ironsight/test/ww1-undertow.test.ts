import { describe, expect, it } from "vitest";
import { undertowCanalSurface, undertowFieldKitPlacements } from "../client/undertow-site.js";
import { MODES, MOVE, PLAYER } from "../src/config.js";
import { validateMapAccess } from "../src/map/contracts.js";
import { ARENA2 } from "../src/map/arena2.js";
import { UNDERTOW_BRIDGE_SPANS, UNDERTOW_CHANNEL_CUT } from "../src/map/undertow-channel.js";
import { surfaceForBox, surfaceForRamp, surfaceForTerrainFace } from "../src/map/materials.js";
import { walkSeconds } from "../src/map/nav.js";
import { UNDERTOW_B_APPROACHES, validateUndertowApproaches } from "../src/map/undertow-yard.js";
import type { UndertowApproaches } from "../src/map/undertow-yard.js";
import type { MapDef, MapNavigationDef } from "../src/map/types.js";
import { canStand, moveAndSlide, nearestBox } from "../src/physics.js";
import { traversalRoute } from "../src/traversal.js";
import { CoreCollision } from "../src/core-gate.js";

const routeSolids = (map: MapDef) => [...map.boxes, ...(map.ramps ?? []).map((ramp) => ({
  min: { x: ramp.minX, y: ramp.baseY ?? 0, z: ramp.minZ },
  max: { x: ramp.maxX, y: ramp.topY, z: ramp.maxZ },
}))];

describe("WW1 Undertow canal bridgehead", () => {
  it("moves B to a single-layer sluice plaza with no lower-channel capture overlap", () => {
    expect(ARENA2.caps.b).toEqual({ x: 75, y: 0, z: 55 });
    const lower = ARENA2.navigation!.anchors.filter((anchor) => anchor.layer === -3);
    expect(lower.length).toBeGreaterThan(1);
    for (const anchor of lower) expect(Math.hypot(anchor.point.x - 75, anchor.point.z - 55)).toBeGreaterThan(MODES.dom.captureRadius);
    expect(validateMapAccess(ARENA2, { captureRadius: MODES.dom.captureRadius, navigation: ARENA2.navigation! }))
      .toEqual({ ok: true, issues: [] });
  });

  it("keeps a dry lower drain, both end ramps, and exactly three upper bridges", () => {
    expect(UNDERTOW_BRIDGE_SPANS).toHaveLength(3);
    expect(ARENA2.terrain?.faces).toContainEqual({ ...UNDERTOW_CHANNEL_CUT, y: -3 });
    const solids = routeSolids(ARENA2);
    for (const x of [51, 80, 104]) expect(canStand(x, -3, 71, PLAYER.radius, PLAYER.standHeight, ARENA2.boxes, ARENA2.bounds)).toBe(true);
    for (const bridge of UNDERTOW_BRIDGE_SPANS) {
      const x = (bridge.minX + bridge.maxX) / 2;
      expect(canStand(x, 0, 71, PLAYER.radius, PLAYER.standHeight, solids, ARENA2.bounds)).toBe(true);
      expect(nearestBox({ x, y: -1.35, z: 71 }, { x: 0, y: 1, z: 0 }, ARENA2.boxes, 5)).toBeCloseTo(1.03);
    }
    expect(ARENA2.ramps?.filter((ramp) => (ramp.baseY ?? 0) === -3)).toHaveLength(2);
    const water = undertowCanalSurface(ARENA2.bounds.width, ARENA2.bounds.depth);
    expect(water.z - water.d / 2).toBeGreaterThan(ARENA2.bounds.depth);
  });

  it("provides two collision-clear protected B approaches for each team", () => {
    expect(UNDERTOW_B_APPROACHES.west).toHaveLength(2);
    expect(UNDERTOW_B_APPROACHES.east).toHaveLength(2);
    for (const [side, routes] of Object.entries(UNDERTOW_B_APPROACHES)) for (const [index, route] of routes.entries()) {
      for (const point of route) expect(canStand(point.x, 0, point.z, PLAYER.radius, PLAYER.standHeight, ARENA2.boxes, ARENA2.bounds), `${side}.${index} ${point.x},${point.z}`).toBe(true);
    }
    expect(validateUndertowApproaches(ARENA2, UNDERTOW_B_APPROACHES)).toEqual([]);
    for (const routes of [UNDERTOW_B_APPROACHES.west, UNDERTOW_B_APPROACHES.east]) for (const route of routes) {
      const screened = route.find((point) => {
        const offset = Math.abs(point.x - ARENA2.caps.b.x);
        return offset >= 19 && offset <= 21;
      })!;
      const sx = ARENA2.caps.b.x - screened.x, sz = ARENA2.caps.b.z - screened.z, sd = Math.hypot(sx, sz);
      expect(nearestBox({ x: screened.x, y: PLAYER.standEye, z: screened.z }, { x: sx / sd, y: 0, z: sz / sd }, ARENA2.boxes, sd)).toBeLessThan(sd);
      const entry = route.at(-2)!, objective = route.at(-1)!;
      const dx = objective.x - entry.x, dz = objective.z - entry.z, distance = Math.hypot(dx, dz);
      expect(nearestBox({ x: entry.x, y: PLAYER.standEye, z: entry.z }, { x: dx / distance, y: 0, z: dz / distance }, ARENA2.boxes, distance)).toBe(Infinity);
    }
  });

  it("walks all four authored B approaches with the production capsule in both gate states", () => {
    const collision = new CoreCollision(ARENA2);
    for (const open of [false, true]) for (const [side, routes] of Object.entries(UNDERTOW_B_APPROACHES)) {
      for (const [index, route] of routes.entries()) {
        let position = { ...route[0]!, y: 0 };
        for (const goal of route.slice(1)) {
          let steps = 0;
          while (Math.hypot(goal.x - position.x, goal.z - position.z) > .15 && steps++ < 2_000) {
            const dx = goal.x - position.x;
            const dz = goal.z - position.z;
            const distance = Math.hypot(dx, dz);
            const moved = moveAndSlide(position, PLAYER.radius, PLAYER.standHeight,
              { x: dx / distance * .1, y: -.025, z: dz / distance * .1 }, -.5,
              collision.boxes(open), ARENA2.bounds, MOVE.stepUp, ARENA2.ramps);
            position = moved.pos;
            expect(moved.grounded, `open=${open} route=${side}.${index} airborne=${position.x},${position.y},${position.z}`).toBe(true);
            expect(position.y).toBeCloseTo(0);
          }
          expect(Math.hypot(goal.x - position.x, goal.z - position.z),
            `open=${open} route=${side}.${index} goal=${goal.x},${goal.z} stopped=${position.x},${position.z}`)
            .toBeLessThanOrEqual(.15);
        }
      }
    }
  });

  it("binds every authoritative support to a coherent WW1 surface", () => {
    for (const box of ARENA2.boxes) expect(surfaceForBox(ARENA2, box)).toBeDefined();
    for (const ramp of ARENA2.ramps ?? []) expect(surfaceForRamp(ARENA2, ramp)).toBeDefined();
    for (const face of ARENA2.terrain?.faces ?? []) expect(surfaceForTerrainFace(ARENA2, face)).toBeDefined();
  });

  it("fits the typed WW1 field kit inside authoritative Undertow supports", () => {
    const placements = undertowFieldKitPlacements();
    expect(placements.filter(({ key }) => key === "rail-platform")).toHaveLength(9);
    expect(placements.filter(({ key }) => key === "trench-wall")).toHaveLength(8);
    expect(placements.filter(({ key }) => key === "sandbag")).toHaveLength(4);
    for (const placement of placements) {
      expect(placement.origin).toBe("bottom-center");
      expect(placement.routeBoundary).toBe(true);
      expect(placement.maxCladdingOffsetM).toBeLessThanOrEqual(.02);
      expect(placement.collision.kind).toBe("box");
      if (placement.collision.kind === "box") expect(placement.collision.dimensionsM).toEqual(placement.dimensionsM);
    }
    for (const deck of placements.filter(({ key }) => key === "rail-platform")) {
      expect(deck.dimensionsM).toEqual([4, .32, 2.4]);
      expect(UNDERTOW_BRIDGE_SPANS.some(({ minX, maxX }) => deck.x - 2 >= minX && deck.x + 2 <= maxX)).toBe(true);
      expect(deck.z - 1.2).toBeGreaterThanOrEqual(UNDERTOW_CHANNEL_CUT.minZ);
      expect(deck.z + 1.2).toBeLessThanOrEqual(UNDERTOW_CHANNEL_CUT.maxZ);
    }
  });

  it("retains real waist-cover traversal fixtures outside the cleared B square", () => {
    const northbound = traversalRoute({ x: 22, y: 0, z: 33.2 }, 0, ARENA2.boxes, ARENA2.bounds, ARENA2.ramps ?? []);
    expect(northbound).toMatchObject({ kind: "vault", end: { x: 22, y: 0 } });
    expect(northbound?.end.z).toBeCloseTo(36.48);
    console.log(JSON.stringify({ kind: "undertow-waist-cover-fixture", northbound }));
  });

  it("records symmetric simulated team route times under the production movement rules", () => {
    const times = (side: "red" | "blue") => ARENA2.spawns[side].map((spawn) => ({ spawn: `${spawn.x},${spawn.z}`, seconds: walkSeconds(ARENA2, spawn, ARENA2.caps.b, MOVE.sprint) }));
    const red = times("red"), blue = times("blue");
    expect(Math.abs(Math.min(...red.map((x) => x.seconds)) - Math.min(...blue.map((x) => x.seconds)))).toBeLessThanOrEqual(.75);
    console.log(JSON.stringify({ kind: "undertow-simulated-route-evidence", movement: { walk: MOVE.walk, sprint: MOVE.sprint }, cap: ARENA2.caps.b, red, blue,
      supportOverlay: { boxes: ARENA2.boxes.length, ramps: ARENA2.ramps?.length ?? 0, terrainFaces: ARENA2.terrain?.faces.length ?? 0, bindings: ARENA2.surfaceBindings?.length ?? 0 } }));
  });

  it("rejects capture from lower channel", () => {
    const navigation: MapNavigationDef = { ...ARENA2.navigation!, anchors: [...ARENA2.navigation!.anchors,
      { id: "arena2.route.stale-lower-b", point: { x: 75, y: -3, z: 55 }, layer: -3, role: "underpass" }] };
    expect(validateMapAccess(ARENA2, { captureRadius: MODES.dom.captureRadius, navigation }).issues).toContainEqual({
      code: "stacked_capture_volume", anchorId: "arena2.route.stale-lower-b", captureId: "arena2.cap.b",
    });
  });

  it("rejects blocked second B approach", () => {
    const blocked: MapDef = { ...ARENA2, boxes: [...ARENA2.boxes, { min: { x: 55, y: 0, z: 64.2 }, max: { x: 65, y: 3, z: 66 } }] };
    expect(validateUndertowApproaches(blocked, UNDERTOW_B_APPROACHES)).toContain("west.south");
  });

  it("rejects a B approach whose upper ground support was deleted", () => {
    const support = ARENA2.terrain?.boxes.find((box) => box.min.x === 0 && box.max.x === 150
      && box.min.z === 0 && box.max.z === UNDERTOW_CHANNEL_CUT.minZ && box.max.y === 0);
    expect(support).toBeDefined();
    const unsupported: MapDef = { ...ARENA2, boxes: ARENA2.boxes.filter((box) => box !== support) };
    expect(validateUndertowApproaches(unsupported, UNDERTOW_B_APPROACHES)).toContain("west.south");
  });

  it("rejects a malformed empty B approach", () => {
    const malformed = { ...UNDERTOW_B_APPROACHES, west: [UNDERTOW_B_APPROACHES.west[0], []] } satisfies UndertowApproaches;
    expect(validateUndertowApproaches(ARENA2, malformed)).toEqual(["west.south"]);
  });
});
