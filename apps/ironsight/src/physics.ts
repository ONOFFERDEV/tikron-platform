/**
 * 3D collision + ray geometry for ironsight — the FPS analogue of the 2D
 * `@tikron/sim` obstacle helpers (which only cover the ground plane). Pure,
 * deterministic, zero dependencies: safe to import in the room, the client, or a
 * bot harness, and unit-testable without timers.
 *
 * Two jobs:
 *  - **movement** — {@link moveAndSlide} advances a vertical-capsule player against
 *    axis-aligned boxes + the arena bounds, resolving penetration per axis so a
 *    blocked axis stops while the others slide (walls, floors, standing on cover).
 *  - **hitscan** — {@link rayAabb} (map occlusion), {@link raySphere} (head), and
 *    {@link rayVerticalCapsule} (body). The room rewinds target positions, rebuilds
 *    their hit volumes, and takes the nearest unoccluded hit.
 *
 * Coordinate convention: `x,z` horizontal, `y` up (see config.ts). Player capsules
 * are always upright, so the capsule test specialises to a vertical segment — a
 * 2D circle test in `xz` clipped to a `y` band plus two hemisphere caps.
 */

import { pushOutOfObstacles, type Obstacle } from "@tikron/sim";
import type { RampDef } from "./map/types.js";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Axis-aligned box by min/max corners (world units). */
export interface Box {
  min: Vec3;
  max: Vec3;
}

export interface Bounds {
  /** Lowest walkable datum; omitted preserves legacy y=0 ground. */
  floor?: number;
  width: number; // x ∈ [0, width]
  depth: number; // z ∈ [0, depth]
  ceiling: number; // y ∈ [floor ?? 0, ceiling]
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** A player's collision state after a movement step. */
export interface MoveResult {
  pos: Vec3; // new feet position
  vy: number; // vertical velocity after ground/ceiling resolution
  grounded: boolean; // standing on the floor or a box top this step
}

/**
 * Advance a player (upright capsule: feet at `pos`, `height` tall, `radius` wide)
 * by `delta`, resolving collisions against `boxes` and the arena bounds. The
 * capsule is treated as an AABB of half-extents `(radius, height/2, radius)` and
 * moved one axis at a time (X, then Z, then Y), with penetration push-out after
 * each — so a wall stops only the axis into it and the player slides along it, and
 * a box top or the floor stops a fall (setting `grounded`).
 *
 * `vyIn` is the incoming vertical velocity; the returned `vy` is zeroed when the
 * player lands or hits a ceiling. Horizontal speed is expected to already bake the
 * per-tick budget into `delta` (the caller integrates velocity × dt).
 *
 * `stepUp` (default 0, fully backward compatible) lets a resting player auto-climb
 * a low lip instead of bonking into it: if the ordinary horizontal pass above gets
 * meaningfully blocked, {@link tryStepUp} retries it with feet raised by `stepUp`
 * and adopts that result when it makes real progress and clears headroom. See
 * `config.ts`'s `MOVE.stepUp` for why 0.45 clears ramp steps but not crates.
 *
 * `ramps` (default `[]`, backward compatible) are sloped-surface colliders, kept
 * entirely separate from `boxes` — a ramp's footprint is never in `boxes`, so the
 * push-out/step-up logic above never sees it. Instead: a move that would land
 * inside a ramp's footprint more than `stepUp` below its surface reverts, like
 * hitting a wall (the ramp's high side/back); otherwise, once inside the
 * footprint and not rising, `y` glues to the sloped surface every tick instead
 * of alternating land/fall states across ticks (the jitter the old 3-box-step
 * approximation produced at corners and edges).
 */
export function moveAndSlide(
  pos: Vec3,
  radius: number,
  height: number,
  delta: Vec3,
  vyIn: number,
  boxes: readonly Box[],
  bounds: Bounds,
  stepUp = 0,
  ramps: readonly RampDef[] = [],
): MoveResult {
  let { x, y, z } = pos;
  let vy = vyIn;
  let grounded = false;

  // --- horizontal integrate + bounds ---
  x = clamp(x + delta.x, radius, bounds.width - radius);
  z = clamp(z + delta.z, radius, bounds.depth - radius);

  // --- horizontal push-out (radial minimum-translation, so a wall slides instead
  //     of teleporting the player around the box) against only the boxes whose
  //     vertical span overlaps the player's at its CURRENT feet level. A box you
  //     stand on top of (feet == box top) fails that test, so its top is walkable;
  //     a box your body passes through blocks you. Reuses @tikron/sim's 2D
  //     obstacle push-out with (x,z) mapped to (x,y). ---
  const obstacles: Obstacle[] = [];
  for (const b of boxes) {
    if (overlapsY(pos.y, height, b)) obstacles.push(boxToObstacle(b));
  }
  if (obstacles.length > 0) {
    const settled = pushOutOfObstacles({ x, y: z }, radius, obstacles);
    x = clamp(settled.x, radius, bounds.width - radius);
    z = clamp(settled.y, radius, bounds.depth - radius);
  }

  // --- fail-closed penetration guard: pushOutOfObstacles resolves overlaps against
  //     each box in sequence with no global "never increases penetration" invariant,
  //     so a player wedged into a sub-capsule-width slot between two boxes (e.g. a
  //     ramp step flush against a wall) can get shoved through the FAR side of one box
  //     while escaping the other — tunneling. The invariant enforced here instead:
  //     a horizontal move may never leave the player MORE embedded than it found
  //     them — accept the resolved (x,z) only if it ends clean, or at strictly
  //     shallower max penetration than the tick started with. Passing THROUGH a box
  //     requires penetration depth to rise to a peak at its midplane, which a
  //     monotonic-decrease rule can never permit — while a player who spawned or
  //     teleported inside geometry still escapes (every step of a genuine ejection
  //     reduces depth, and a full single-box ejection ends clean in one tick). ---
  {
    const endPen = maxPenetration(x, pos.y, z, radius, height, boxes);
    if (endPen > 1e-3 && endPen >= maxPenetration(pos.x, pos.y, pos.z, radius, height, boxes) - 1e-4) {
      x = pos.x;
      z = pos.z;
    }
  }

  // --- step-up retry: only for a player already resting on a surface (never mid-air —
  //     `vyIn` alone can't tell "grounded, gravity ticking down" from "genuinely
  //     falling", so this also checks `restingAt` the START position) whose horizontal
  //     move above got meaningfully blocked. Retries the horizontal pass with feet
  //     raised by `stepUp`; adopted only if it makes strictly more progress AND the
  //     raised spot has headroom (canStand) — otherwise the blocked result above stands. ---
  if (stepUp > 0 && vyIn <= 0 && restingAt(pos.x, pos.y, pos.z, radius, boxes, ramps, bounds.floor ?? 0)) {
    const intendedDist = Math.hypot(delta.x, delta.z);
    const actualDist = Math.hypot(x - pos.x, z - pos.z);
    if (intendedDist > 1e-6 && actualDist < intendedDist - 1e-3) {
      const stepped = tryStepUp(pos, radius, height, delta, boxes, bounds, stepUp, x, z);
      if (stepped && !rampBlocksEntry(stepped.pos.x, stepped.pos.z, stepped.pos.y, stepUp, ramps)) {
        return stepped;
      }
    }
  }

  // --- ramp horizontal block: a ramp's high side/back acts like a wall — if the
  //     capsule center's final (x,z) sits inside a ramp footprint at a point whose
  //     sloped surface is more than `stepUp` above the player's CURRENT y, the move
  //     can't be taken as-is. Like a wall, it should still SLIDE: try keeping each
  //     axis alone (rubbing diagonally along the high side must not freeze the
  //     player — that sticky-edge feel is exactly what this rework is removing),
  //     falling back to a full revert only when both axes independently enter the
  //     blocked region (a square-on push into the high face/corner). A low-side
  //     entry (surface within `stepUp`) is never blocked; it glues to the slope. ---
  for (const r of ramps) {
    if (!insideRampFootprint(x, z, r)) continue;
    if (rampSurfaceY(r, x, z) - pos.y > stepUp) {
      const okAt = (px: number, pz: number): boolean =>
        !insideRampFootprint(px, pz, r) || rampSurfaceY(r, px, pz) - pos.y <= stepUp;
      if (okAt(x, pos.z)) {
        z = pos.z; // slide along x, give up the blocked z component
      } else if (okAt(pos.x, z)) {
        x = pos.x; // slide along z
      } else {
        x = pos.x;
        z = pos.z;
      }
      // The axis-mix can recombine a resolved coordinate with a pre-resolution
      // one — keep the box no-new/deeper-penetration invariant airtight.
      const pen = maxPenetration(x, pos.y, z, radius, height, boxes);
      if (pen > 1e-3 && pen >= maxPenetration(pos.x, pos.y, pos.z, radius, height, boxes) - 1e-4) {
        x = pos.x;
        z = pos.z;
      }
    }
    break;
  }

  // --- vertical ---
  y = y + delta.y;
  const floor = bounds.floor ?? 0;
  if (y <= floor) {
    y = floor;
    if (vy < 0) vy = 0;
    grounded = true;
  }
  if (y + height >= bounds.ceiling) {
    y = bounds.ceiling - height;
    if (vy > 0) vy = 0;
  }
  // Box tops / undersides: land when descending onto a top the feet were above,
  // bonk when rising into an underside the head was below. Picks the highest
  // qualifying top / lowest qualifying underside across ALL matching boxes this
  // tick rather than letting iteration order decide — two boxes overlapping in
  // xz with different heights used to let whichever the loop visited last win.
  let landTop: number | null = null;
  let bonkBottom: number | null = null;
  for (const b of boxes) {
    if (!overlapsXZ(x, z, radius, b)) continue;
    if (vy <= 0 && pos.y >= b.max.y - 1e-3 && y < b.max.y) {
      if (landTop === null || b.max.y > landTop) landTop = b.max.y;
    } else if (vy > 0 && pos.y + height <= b.min.y + 1e-3 && y + height > b.min.y) {
      const bottom = b.min.y - height;
      if (bonkBottom === null || bottom < bonkBottom) bonkBottom = bottom;
    }
  }
  if (landTop !== null) {
    y = landTop;
    vy = 0;
    grounded = true;
  } else if (bonkBottom !== null) {
    y = bonkBottom;
    vy = 0;
  }

  // --- ramp surface glue: keeps a walking/falling player glued to the slope every
  //     tick instead of oscillating a hair above/below it — the dominant jitter
  //     source with the old 3-box-step approximation (half-overlapping boxes made
  //     landing/falling/step-up ticks alternate). Skipped while genuinely airborne
  //     and ascending (vy > 0, e.g. jump apex); a descent that overshoots the
  //     near-surface snap band in one tick still lands via the surface-crossing
  //     check below. ---
  for (const r of ramps) {
    if (!insideRampFootprint(x, z, r)) continue;
    const surface = rampSurfaceY(r, x, z);
    // Uphill / from below: feet at or under the surface and not rising — pull up.
    const nearSurface = y <= surface + 0.01 && (vy <= 0 || grounded);
    // Fast descent through the surface in one tick — land on it.
    const crossedDescending =
      insideRampFootprint(pos.x, pos.z, r) && pos.y >= rampSurfaceY(r, pos.x, pos.z) - 1e-3 && y < surface;
    // Downhill: a walker who STARTED this tick standing on this ramp's surface
    // and is now a little above it (the slope fell away under a horizontal step)
    // snaps back down — without this, walking downhill alternates one airborne
    // tick per contact tick (land/fall/land), which is exactly the jitter this
    // rework exists to kill. Never while ascending from a jump (vyIn > 0), and
    // never further than a stepUp's worth of drop in one tick.
    const walkedDownSlope =
      vyIn <= 0 &&
      y > surface &&
      y - surface <= stepUp &&
      insideRampFootprint(pos.x, pos.z, r) &&
      Math.abs(pos.y - rampSurfaceY(r, pos.x, pos.z)) <= 0.02;
    // The capsule can remain supported by the deck lip after its center has
    // entered a steep ramp. Continue that grounded descent once the lip ends.
    // Require actual previous box support; this must never snap a jumping player.
    const walkedOffDeck = vyIn <= 0 && y > surface && pos.y - surface <= stepUp
      && boxes.some(b => Math.abs(b.max.y - r.topY) <= .02
        && Math.abs(pos.y - b.max.y) <= .02 && overlapsXZ(pos.x, pos.z, radius, b));
    if (nearSurface || crossedDescending || walkedDownSlope || walkedOffDeck) {
      // A capsule straddling a ramp/deck junction still rests on the deck.
      // Do not let slope glue undo the box-top landing and pull its feet into
      // that slab. Descend onto the slope once the capsule clears the lip.
      y = Math.max(surface, landTop ?? surface);
      vy = 0;
      grounded = true;
    }
    break;
  }

  // A low-end ramp exit is a continuous floor transition. The final horizontal
  // step may cross the footprint (including floating-point epsilon), so the
  // in-footprint glue above cannot catch it. Do not create a one-frame airborne
  // dip for a grounded walker; jumping and high-side exits remain ballistic.
  if (!grounded && vyIn <= 0) {
    for (const r of ramps) {
      const base = r.baseY ?? 0;
      if (y <= base || y > base + stepUp) continue;
      const coord = r.axis === 'x' ? x : z;
      const low = r.dir === 1 ? (r.axis === 'x' ? r.minX : r.minZ) : (r.axis === 'x' ? r.maxX : r.maxZ);
      const crossedLow = r.dir === 1 ? coord < low : coord > low;
      const wasOnLowSlope = insideRampFootprint(pos.x, pos.z, r)
        && rampSurfaceY(r, pos.x, pos.z) <= base + stepUp
        && Math.abs(pos.y - rampSurfaceY(r, pos.x, pos.z)) <= 0.02;
      const supported = base === floor || boxes.some(b => Math.abs(b.max.y - base) < .001 && overlapsXZ(x, z, radius, b));
      if (crossedLow && wasOnLowSlope && supported) { y = base; vy = 0; grounded = true; break; }
    }
  }
  return { pos: { x, y, z }, vy, grounded };
}

/** Is `(x, z)` — the capsule's horizontal center — inside ramp `r`'s footprint? */
function insideRampFootprint(x: number, z: number, r: RampDef): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

/**
 * A ramp's sloped surface height at `(x, z)` — linear from baseY at the low end to
 * `r.topY` at the high end along `r.axis`, climbing toward `r.dir`. Callers are
 * expected to only ask this for a point inside `r`'s footprint (see
 * {@link insideRampFootprint}).
 */
export function rampSurfaceY(r: RampDef, x: number, z: number): number {
  const isX = r.axis === "x";
  const coord = isX ? x : z;
  const min = isX ? r.minX : r.minZ;
  const max = isX ? r.maxX : r.maxZ;
  const range = max - min;
  const t = range > 1e-9 ? clamp((coord - min) / range, 0, 1) : 0;
  const progress = r.dir === 1 ? t : 1 - t;
  return (r.baseY ?? 0) + progress * (r.topY - (r.baseY ?? 0));
}

/**
 * Would landing at `(x, z, y)` put the capsule center inside a ramp's footprint
 * at a height its sloped surface is more than `stepUp` above — i.e. would this
 * position have needed to pass through the ramp's wall-like high side to reach?
 * Used to veto a step-up candidate the same way the ordinary horizontal move
 * above is vetoed by the ramp block, so a step-up retry can't sneak past it.
 */
function rampBlocksEntry(x: number, z: number, y: number, stepUp: number, ramps: readonly RampDef[]): boolean {
  for (const r of ramps) {
    if (insideRampFootprint(x, z, r) && rampSurfaceY(r, x, z) - y > stepUp) return true;
  }
  return false;
}

const boxToObstacle = (b: Box): Obstacle => ({
  x: (b.min.x + b.max.x) / 2,
  y: (b.min.z + b.max.z) / 2,
  w: b.max.x - b.min.x,
  h: b.max.z - b.min.z,
});

/** Does the capsule's footprint circle-vs-box (as an AABB) overlap in the xz plane? */
function overlapsXZ(x: number, z: number, radius: number, b: Box): boolean {
  const nx = clamp(x, b.min.x, b.max.x);
  const nz = clamp(z, b.min.z, b.max.z);
  const dx = x - nx;
  const dz = z - nz;
  return dx * dx + dz * dz < radius * radius;
}

/** Does the capsule's vertical span [feet, feet+height] overlap the box's y range? */
function overlapsY(feet: number, height: number, b: Box): boolean {
  return feet < b.max.y && feet + height > b.min.y;
}

/** The capsule's deepest TRUE penetration (metres past grazing contact) into any
 *  box, or 0 when clean. Unlike {@link overlapsXZ} — a boundary-inclusive-ish `<`
 *  test used for landing/canStand/restingAt, where near-tangent contact is the
 *  expected steady state — flush resting against a face reports 0 here. Used only
 *  by {@link moveAndSlide}'s fail-closed monotonic-penetration guard and
 *  {@link tryStepUp}'s landing check. */
function maxPenetration(
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  boxes: readonly Box[],
): number {
  let worst = 0;
  for (const b of boxes) {
    if (!overlapsY(y, height, b)) continue;
    const nx = clamp(x, b.min.x, b.max.x);
    const nz = clamp(z, b.min.z, b.max.z);
    const pen = radius - Math.hypot(x - nx, z - nz);
    if (pen > worst) worst = pen;
  }
  return worst;
}

/**
 * Can a player of `height` stand at `(x, y, z)` without their taller capsule
 * intersecting a box or the ceiling? Used to reject standing up under low cover.
 */
export function canStand(
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  boxes: readonly Box[],
  bounds: Bounds,
): boolean {
  if (y < (bounds.floor ?? 0) - 1e-6 || y + height > bounds.ceiling) return false;
  for (const b of boxes) {
    if (overlapsXZ(x, z, radius, b) && overlapsY(y, height, b) && b.max.y > y + 1e-3) {
      return false;
    }
  }
  return true;
}

/**
 * Is the player already resting on a surface at `(x, y, z)` — the floor, or exactly
 * the top of some box? Used to gate {@link moveAndSlide}'s step-up retry: geometry-
 * only (physics.ts takes no config; see header) because `vyIn` alone can't
 * distinguish "grounded, gravity just ticked negative" from "genuinely airborne" —
 * only a player already planted on something should auto-climb a step.
 */
function restingAt(
  x: number,
  y: number,
  z: number,
  radius: number,
  boxes: readonly Box[],
  ramps: readonly RampDef[] = [],
  floor = 0,
): boolean {
  if (Math.abs(y - floor) <= 1e-3) return true;
  if (boxes.some((b) => overlapsXZ(x, z, radius, b) && Math.abs(y - b.max.y) <= 1e-3)) return true;
  // Standing glued to a ramp's sloped surface counts as resting too — without
  // this, a player climbing a ramp could never step-up over the small lip where
  // the slope meets its flush platform (the surface sits a hair below the
  // platform top for the entire final stretch of the climb).
  return ramps.some(
    (r) => insideRampFootprint(x, z, r) && Math.abs(y - rampSurfaceY(r, x, z)) <= 0.02,
  );
}

/**
 * The step-up retry itself: redo the horizontal pass with feet raised by `stepUp`
 * from the ORIGINAL `pos`, then require it to (a) make strictly more horizontal
 * progress than the base (blocked) attempt at `(baseX, baseZ)`, and (b) clear
 * headroom at the raised spot ({@link canStand}). On success, snap down onto the
 * highest box top at/below the raised height beneath the new (x,z) — a stepped-up
 * player stands ON the step, not floating at `pos.y + stepUp` — and returns a
 * grounded result with `vy` zeroed. Returns `null` if the retry doesn't qualify,
 * leaving {@link moveAndSlide}'s normal (blocked) resolution in place.
 */
function tryStepUp(
  pos: Vec3,
  radius: number,
  height: number,
  delta: Vec3,
  boxes: readonly Box[],
  bounds: Bounds,
  stepUp: number,
  baseX: number,
  baseZ: number,
): MoveResult | null {
  const raisedY = pos.y + stepUp;
  let rx = clamp(pos.x + delta.x, radius, bounds.width - radius);
  let rz = clamp(pos.z + delta.z, radius, bounds.depth - radius);

  const obstacles: Obstacle[] = [];
  for (const b of boxes) {
    if (overlapsY(raisedY, height, b)) obstacles.push(boxToObstacle(b));
  }
  if (obstacles.length > 0) {
    const settled = pushOutOfObstacles({ x: rx, y: rz }, radius, obstacles);
    rx = clamp(settled.x, radius, bounds.width - radius);
    rz = clamp(settled.y, radius, bounds.depth - radius);
  }

  const raisedDist = Math.hypot(rx - pos.x, rz - pos.z);
  const baseDist = Math.hypot(baseX - pos.x, baseZ - pos.z);
  if (raisedDist <= baseDist + 1e-4) return null; // no real progress over the blocked attempt

  if (!canStand(rx, raisedY, rz, radius, height, boxes, bounds)) return null;

  let landY = bounds.floor ?? 0;
  for (const b of boxes) {
    if (!overlapsXZ(rx, rz, radius, b)) continue;
    if (b.max.y <= raisedY + 1e-6 && b.max.y > landY) landY = b.max.y;
  }

  // Same fail-closed defense as moveAndSlide's base pass, applied to the step-up's
  // own adopted landing spot: a wedged slot can make the raised push-out resolve
  // through the far side of a box just as easily as the un-raised one does. Step-up
  // is stricter than the base guard — an adopted landing must be fully clean, since
  // unlike a base move it can teleport the feet upward into new surroundings.
  if (maxPenetration(rx, landY, rz, radius, height, boxes) > 1e-3) return null;

  return { pos: { x: rx, y: landY, z: rz }, vy: 0, grounded: true };
}

/**
 * Distance `t` along the ray `origin + t·dir` to the first face of `box` it
 * enters within `maxT`, or `null`. Standard slab test; `dir` must be unit length
 * for `t` to be in world units. A ray starting inside the box returns `null`
 * (you can always fire out of cover you stand in).
 */
export function rayAabb(origin: Vec3, dir: Vec3, box: Box, maxT: number): number | null {
  if (
    origin.x >= box.min.x &&
    origin.x <= box.max.x &&
    origin.y >= box.min.y &&
    origin.y <= box.max.y &&
    origin.z >= box.min.z &&
    origin.z <= box.max.z
  ) {
    return null; // origin inside
  }
  let tMin = 0;
  let tMax = maxT;
  const axes: [number, number, number, number][] = [
    [origin.x, dir.x, box.min.x, box.max.x],
    [origin.y, dir.y, box.min.y, box.max.y],
    [origin.z, dir.z, box.min.z, box.max.z],
  ];
  for (const [p, d, lo, hi] of axes) {
    if (d === 0) {
      if (p < lo || p > hi) return null;
      continue;
    }
    let t1 = (lo - p) / d;
    let t2 = (hi - p) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin > 0 && tMin <= maxT ? tMin : null;
}

/** Nearest box face the ray enters within `maxT` (map occlusion), or `Infinity`. */
export function nearestBox(origin: Vec3, dir: Vec3, boxes: readonly Box[], maxT: number): number {
  let best = Infinity;
  for (const b of boxes) {
    const t = rayAabb(origin, dir, b, maxT);
    if (t !== null && t < best) best = t;
  }
  return best;
}

/**
 * Distance `t` to the first intersection of the ray with a sphere at `centre`
 * radius `r`, within `maxT`, or `null`. `dir` must be unit length.
 */
export function raySphere(
  origin: Vec3,
  dir: Vec3,
  centre: Vec3,
  r: number,
  maxT: number,
): number | null {
  const ox = origin.x - centre.x;
  const oy = origin.y - centre.y;
  const oz = origin.z - centre.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t0 = -b - sq;
  if (t0 >= 0 && t0 <= maxT) return t0;
  const t1 = -b + sq; // origin inside the sphere
  if (t1 >= 0 && t1 <= maxT) return t1;
  return null;
}

/**
 * Distance `t` to the first intersection of the ray with an UPRIGHT (flat-topped)
 * cylinder — a `y`-axis shaft at `(cx, cz)` of radius `r` clipped to the band
 * `[yBottom, yTop]` — within `maxT`, or `null`. `dir` must be unit length.
 *
 * The body hit volume is a cylinder, not a capsule, on purpose: a capsule's top
 * hemisphere would bulge into the head sphere above it and, being wider than the
 * head, steal the nearer impact and mis-classify headshots as body hits. A flat
 * top at the neck leaves head/body cleanly separated. Players never lean in M0,
 * so the axis is always +y and the shaft reduces to a 2D circle test in `xz`.
 */
export function rayVerticalCylinder(
  origin: Vec3,
  dir: Vec3,
  cx: number,
  cz: number,
  yBottom: number,
  yTop: number,
  r: number,
  maxT: number,
): number | null {
  const a = dir.x * dir.x + dir.z * dir.z;
  if (a < 1e-9) return null; // ray parallel to the axis — no side entry
  const ox = origin.x - cx;
  const oz = origin.z - cz;
  const b = ox * dir.x + oz * dir.z;
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let best = Infinity;
  for (const t of [(-b - sq) / a, (-b + sq) / a]) {
    if (t < 0 || t > maxT) continue;
    const hy = origin.y + dir.y * t;
    if (hy >= yBottom && hy <= yTop && t < best) best = t;
  }
  return best === Infinity ? null : best;
}
