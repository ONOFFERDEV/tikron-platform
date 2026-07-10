import type { Box, Bounds, Vec3 } from "../physics.js";

/**
 * The shape every map module (arena1, arena2, …) exports as one value, so the
 * room (server authority), the client (rendering + prediction), and the bots
 * (navigation) resolve a map ONCE — via `modes.ts`'s `mapForMode` — and thread
 * that single object everywhere, instead of each consumer importing one
 * specific arena's named constants directly.
 */
export interface MapDef {
  readonly bounds: Bounds;
  readonly boxes: readonly Box[];
  readonly spawns: { readonly red: readonly Vec3[]; readonly blue: readonly Vec3[] };
  /** Domination capture points. Every map defines them (even a tdm/ffa-only
   *  map) so `mapForMode` never has to special-case a missing field. */
  readonly caps: { readonly a: Vec3; readonly b: Vec3; readonly c: Vec3 };
  /**
   * Optional patrol-waypoint override per cap, for a cap whose own (x,z) sits
   * inside solid geometry (an elevated platform under it) and so is unreachable
   * as a raw bot waypoint — arena-room.ts's `botWaypoints()` would otherwise send
   * a patrolling bot to walk straight into the box and never satisfy its "within
   * 1 m" waypoint-reached check. Each override point must itself sit outside
   * every box and within `MODES.dom.captureRadius` of the cap it stands in for.
   * A cap absent from this map (or the whole field absent) falls back to using
   * the cap's own (x,z) as its single waypoint — unchanged default behaviour for
   * an open, ground-level cap (e.g. A/C on both current maps).
   */
  readonly capWaypoints?: {
    readonly a?: readonly Vec3[];
    readonly b?: readonly Vec3[];
    readonly c?: readonly Vec3[];
  };
}
