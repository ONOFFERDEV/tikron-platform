import type { Box, Bounds, Vec3 } from "../physics.js";

/**
 * The shape every map module (arena1, arena2, …) exports as one value, so the
 * room (server authority), the client (rendering + prediction), and the bots
 * (navigation) resolve a map ONCE — via `modes.ts`'s `mapForMode` — and thread
 * that single object everywhere, instead of each consumer importing one
 * specific arena's named constants directly.
 */
/**
 * A true sloped-surface collider for a ramp/staircase footprint, replacing the
 * old approximation of three stacked AABB "steps" (which produced seam bugs at
 * corners and edges — half-overlapping boxes causing landing/falling/step-up
 * ticks to alternate, inconsistent side-entry, and occasional pass-through in
 * narrow gaps). The footprint is the full tile rectangle; height rises
 * linearly along `axis` in direction `dir` from 0 at the low end to `topY` at
 * the high end.
 */
export interface RampDef {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly axis: "x" | "z";
  /** +1 = rises toward increasing axis coordinate, -1 = toward decreasing. */
  readonly dir: 1 | -1;
  /** Height at the high end (always 1.2 for the current tile set). */
  readonly topY: number;
}

export interface MapDef {
  /** Event shutters are part of the CLOSED map; only replicated coreOpen may
   * remove them. The chamber bounds also define the safe-close occupancy zone. */
  readonly signalCore?: { readonly doors: readonly Box[]; readonly chamber: Box };
  /** Fixed induction-pad trajectories. Server and prediction derive the route;
   * clients never supply endpoints. Cosmetic pad paint has no collision. */
  readonly launchPads?: readonly LaunchPad[];
  /** Game-owned visual kit. Collision remains the boxes/ramps below. */
  readonly presentation?: "relay" | "undertow" | "switchyard";
  /** Optional non-objective patrol circuit, on navigable ground. Omitting it
   * preserves the spawn/cap circuit. Used to keep FFA bots out of spawn bays. */
  readonly patrolWaypoints?: readonly { readonly x: number; readonly z: number }[];
  /** Ground-level side routes, ordered west to east. Rushers commit to one per
   * life; these are map knowledge, never hidden-player destinations. */
  readonly flankRoutes?: readonly (readonly { readonly x: number; readonly z: number }[])[];
  readonly bounds: Bounds;
  readonly boxes: readonly Box[];
  /** Sloped-surface colliders — see {@link RampDef}. Optional for backward
   *  compatibility with existing fixtures/blueprints that predate ramps. */
  readonly ramps?: readonly RampDef[];
  readonly spawns: { readonly red: readonly Vec3[]; readonly blue: readonly Vec3[] };
  /** Authored first-look targets for screened arrivals. These orient the player;
   * they never select a spawn or change collision/threat scoring. */
  readonly spawnViews?: readonly {
    readonly from: { readonly x: number; readonly z: number };
    readonly toward: { readonly x: number; readonly z: number };
  }[];
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
  /** Optional covered ground approaches to an objective. The nearest entry is
   * chosen from the bot's own position; these are map knowledge, never enemy
   * tracking. The actual capture/guard anchor remains caps/capWaypoints. */
  readonly capApproaches?: Partial<Record<'a' | 'b' | 'c',
    readonly (readonly { readonly x: number; readonly z: number }[])[]>>;
}

export interface LaunchPad {
  readonly id: string;
  readonly from: Vec3;
  readonly to: Vec3;
}
