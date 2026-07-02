import type { Vec2 } from "@tikron/sim";

/**
 * Uniform spatial-hash grid for interest management (AOI).
 *
 * The naive AOI filter is O(viewers × entities): every viewer's view radius is
 * tested against every entity, each flush. This grid replaces that with a
 * broad-phase index — entities are bucketed into square cells of side
 * `viewRadius`, so a viewer only exact-tests the 3×3 block of cells around its
 * own cell. With a cell side equal to the view radius, any entity within the
 * radius is guaranteed to fall in that 3×3 neighborhood (its cell differs from
 * the viewer's by at most one on each axis), so the result is IDENTICAL to the
 * naive circle scan — the grid only skips entities that could not possibly pass.
 *
 * Pure functions, no room/DO coupling: the room builds one grid per filtered
 * field per flush and queries it once per viewer.
 */

/** A cell bucket holds `[id, entity]` pairs; entity is opaque (the room's shape). */
export type Grid = Map<string, Array<[string, unknown]>>;

/** A non-positive cell/radius falls back to this so `floor(x/size)` stays finite. */
function cellSize(viewRadius: number): number {
  return viewRadius > 0 ? viewRadius : 1;
}

function key(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/**
 * Bucket a string-keyed entity map into a grid with cell side `viewRadius`.
 * `position` extracts an entity's world position (the same extractor the query
 * and the naive filter use).
 */
export function buildGrid(
  map: Record<string, unknown>,
  position: (entity: unknown) => Vec2,
  viewRadius: number,
): Grid {
  const size = cellSize(viewRadius);
  const grid: Grid = new Map();
  for (const [id, entity] of Object.entries(map)) {
    const p = position(entity);
    const k = key(Math.floor(p.x / size), Math.floor(p.y / size));
    const bucket = grid.get(k);
    if (bucket) bucket.push([id, entity]);
    else grid.set(k, [[id, entity]]);
  }
  return grid;
}

/**
 * The subset of the grid's entities within `viewRadius` of `vp` — the exact same
 * set the naive `dx²+dy² ≤ r²` scan would return, obtained by exact-testing only
 * the 3×3 cell neighborhood around the viewpoint. Returns a fresh id→entity map.
 */
export function queryRadius(
  grid: Grid,
  vp: Vec2,
  viewRadius: number,
  position: (entity: unknown) => Vec2,
): Record<string, unknown> {
  const size = cellSize(viewRadius);
  const r2 = viewRadius * viewRadius;
  const cx = Math.floor(vp.x / size);
  const cy = Math.floor(vp.y / size);
  const out: Record<string, unknown> = {};
  for (let gx = cx - 1; gx <= cx + 1; gx++) {
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      const bucket = grid.get(key(gx, gy));
      if (!bucket) continue;
      for (const [id, entity] of bucket) {
        const p = position(entity);
        const dx = p.x - vp.x;
        const dy = p.y - vp.y;
        if (dx * dx + dy * dy <= r2) out[id] = entity;
      }
    }
  }
  return out;
}
