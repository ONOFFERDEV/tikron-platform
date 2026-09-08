// [blueprint] — structural invariants only (spawn/cap in-bounds, cap separation via
// MODES.dom.captureRadius read dynamically, bot-waypoint reachability); imports
// ARENA1/ARENA2/MODES directly (not GAME), so it's unaffected by any config swap.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestRoomHandle } from "@tikron/server/testing";
import { canStand, type Box, type Bounds, type Vec3 } from "../src/physics.js";
import { PLAYER, MODES } from "../src/config.js";
import { MODE_ORDER, mapForMode } from "../src/modes.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";
import type { MapDef } from "../src/map/types.js";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";

/**
 * Pure-data regression gate for every map in the registry: a spawn or cap point
 * buried in a wall, overlapping capture zones, or an unreachable bot waypoint
 * would otherwise only surface as a confusing bot-battle e2e failure (or a live
 * "why can't I stand here" bug report). None of this needs a room — every map
 * module is a plain data object.
 */

const MAPS: { readonly name: string; readonly map: MapDef }[] = [
  { name: "arena1 (tdm/ffa)", map: ARENA1 },
  { name: "arena2 (dom)", map: ARENA2 },
  { name: "arena3 (ffa)", map: ARENA3 },
];

/** Mirrors arena-room.ts's private `botWaypoints()` — spawns + each cap's
 *  `capWaypoints` override (or its own (x,z) if the map declares none) — kept
 *  here since the room doesn't expose the method itself. */
function botWaypoints(map: MapDef): { x: number; y: number }[] {
  const { spawns, caps, capWaypoints } = map;
  const capPts = [
    ...(capWaypoints?.a ?? [caps.a]),
    ...(capWaypoints?.b ?? [caps.b]),
    ...(capWaypoints?.c ?? [caps.c]),
  ];
  return [...spawns.red, ...spawns.blue, ...capPts].map((p) => ({ x: p.x, y: p.z }));
}

/** Can a standing player be at ground level (x,z) without clipping a box? */
function clearAtGround(x: number, z: number, map: MapDef): boolean {
  return canStand(x, 0, z, PLAYER.radius, PLAYER.standHeight, map.boxes, map.bounds);
}

function inBounds(x: number, z: number, bounds: Bounds): boolean {
  return x >= 0 && x <= bounds.width && z >= 0 && z <= bounds.depth;
}

/** True if `p` sits at ground level, or exactly on the top face of a box beneath it. */
function onGroundOrBoxTop(p: Vec3, boxes: readonly Box[]): boolean {
  if (p.y === 0) return true;
  return boxes.some(
    (b) => p.y === b.max.y && p.x >= b.min.x && p.x <= b.max.x && p.z >= b.min.z && p.z <= b.max.z,
  );
}

describe.each(MAPS)("map invariants — $name", ({ map }) => {
  it("every spawn is inside bounds, clear of boxes, and standable", () => {
    for (const p of [...map.spawns.red, ...map.spawns.blue]) {
      expect(inBounds(p.x, p.z, map.bounds)).toBe(true);
      expect(onGroundOrBoxTop(p, map.boxes)).toBe(true);
      expect(canStand(p.x, p.y, p.z, PLAYER.radius, PLAYER.standHeight, map.boxes, map.bounds)).toBe(true);
    }
  });

  it("every cap is inside bounds and at ground level or on a box top", () => {
    // Not a `canStand` check: capture occupancy (playersAt) is a pure 2D (x,z) radius
    // test that ignores collision entirely, so a cap point may legitimately sit under
    // cover (arena1's own cap B does, on purpose — occupants stand just outside it,
    // still well within captureRadius) without that being a bug.
    for (const p of Object.values(map.caps)) {
      expect(inBounds(p.x, p.z, map.bounds)).toBe(true);
      expect(onGroundOrBoxTop(p, map.boxes)).toBe(true);
    }
  });

  it("caps are pairwise far enough apart that their capture zones never overlap", () => {
    const pts = Object.values(map.caps);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.z - pts[j]!.z);
        expect(d).toBeGreaterThanOrEqual(2 * MODES.dom.captureRadius);
      }
    }
  });

  it("every derived bot waypoint is inside bounds and outside every box", () => {
    for (const wp of botWaypoints(map)) {
      expect(inBounds(wp.x, wp.y, map.bounds)).toBe(true);
      // wp.y is really the map's z (botWaypoints remaps z→y for the Vec2 shape).
      expect(clearAtGround(wp.x, wp.y, map)).toBe(true);
    }
  });

  it("every cap has at least one reachable patrol anchor (outside every box, within captureRadius)", () => {
    const capKeys = ["a", "b", "c"] as const;
    for (const key of capKeys) {
      const cap = map.caps[key];
      const candidates = map.capWaypoints?.[key] ?? [cap];
      const reachable = candidates.some((c) => {
        const dist = Math.hypot(c.x - cap.x, c.z - cap.z);
        return clearAtGround(c.x, c.z, map) && dist <= MODES.dom.captureRadius;
      });
      expect(reachable).toBe(true);
    }
  });
});

describe("mapForMode", () => {
  it("resolves every MODE_ORDER entry to a map sharing the wire-fixed arena extents", () => {
    for (const id of MODE_ORDER) {
      const map = mapForMode(id);
      expect(map.bounds.width).toBeLessThanOrEqual(200);
      expect(map.bounds.depth).toBeLessThanOrEqual(160); // same extents on every map — no codec/quant change
    }
  });
});

function liveState(h: TestRoomHandle<ArenaState>): ArenaState {
  return (h.room as unknown as { state: ArenaState }).state;
}

/** Boots straight into "live" with no filler bots, so a single scripted connection
 *  isn't joined by autofilled bots wandering into the capture zone under test. */
class DomSmokeArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("dom room loads arena2", () => {
  it("a player standing at ARENA2's cap A moves that gauge (ARENA1's cap A sits at a different x)", async () => {
    expect(ARENA2.caps.a.x).not.toBe(ARENA1.caps.a.x); // sanity: the two maps' cap A truly differ

    const h = await createTestRoom(DomSmokeArena, { id: "arena-dom", codec: ArenaSchema, sync: "immediate" });
    const conn = await h.connect(); // 1st join → red
    const p = liveState(h).players[conn.id]!;
    p.x = ARENA2.caps.a.x;
    p.z = ARENA2.caps.a.z;
    p.alive = true;
    p.prot = false;

    await h.advance(500); // 10 ticks — well under a 2 s scoring boundary, just gauge movement
    expect(h.snapshot().capA).toBeGreaterThan(100); // red-occupied → gauge climbed off neutral
  });
});
