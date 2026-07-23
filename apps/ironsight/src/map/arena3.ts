import type { Box, Bounds, Vec3 } from "../physics.js";
import { compileTileMap } from "./tilemap.js";
import type { MapDef } from "./types.js";

/**
 * arena3 — "crossyard", an FFA-only map (60×40 m). A pure data module so the
 * server (authority), the client (rendering), and the bots (navigation) all
 * import the SAME geometry — walls cost zero wire bytes because both sides
 * derive them here, not from state.
 *
 * Authored as an ASCII tile grid (see the legend in tilemap.ts). All terrain,
 * caps a/c, and spawns are 180°-rotationally symmetric about the grid center —
 * (i,j) ↔ (19−i, 29−j) — and each team's own spawn set is closed under that
 * same rotation. Since FFA has no "sides," this rotational symmetry (rather
 * than arena1's mirror symmetry) is what guarantees every spawn's ETA to every
 * cap is fair by construction — geometry does the work the map-timing gate
 * would otherwise have to catch after the fact.
 *
 * A central 2×2 platform (`=`) with a ramp (`< > ^ v`) on each of its four
 * sides is the map's hotspot. Two diagonal walls (`#`) cut the long
 * sightlines across the yard. Because the mode is FFA, the red/blue spawn
 * split is just a spawn-pool partition, not a "team side" — all three caps
 * sit on open floor, so no `capWaypoints` override is needed.
 *
 * v1 is a blockout: no dressing tiles are placed here on purpose — the scene
 * layer's manifest-optional fallback renders this map procedurally (plus
 * wedges) when no dressing glTF is registered for it.
 */
const ROWS_ARENA3: readonly string[] = [
  "..............................",
  "..r...........................",
  ".........................b....",
  "........########..............",
  "....................r.XX......",
  "........1.............XX......",
  "..............................",
  ".....x....x...................",
  "..............v........b......",
  ".....##......>==..............",
  "..............==<......##.....",
  "......b......2.^..............",
  "...................x....x.....",
  "..............................",
  "......XX.............3........",
  "......XX.r....................",
  "..............########........",
  "....b.........................",
  "...........................r..",
  "..............................",
];

const compiled: MapDef = compileTileMap(ROWS_ARENA3);

export const ARENA3_BOUNDS: Bounds = compiled.bounds;
export const ARENA3_BOXES: readonly Box[] = compiled.boxes;
export const ARENA3_SPAWNS: { readonly red: readonly Vec3[]; readonly blue: readonly Vec3[] } = compiled.spawns;
export const ARENA3_CAPS: { readonly a: Vec3; readonly b: Vec3; readonly c: Vec3 } = compiled.caps;

/** arena3 packaged as one {@link MapDef} — the single value `mapForMode` (modes.ts)
 *  resolves and threads everywhere; the individual named exports above stay as
 *  aliases so existing direct importers don't need to change. */
export const ARENA3: MapDef = compiled;
