import {
  nearestBox,
  raySphere,
  rayVerticalCylinder,
  type Box,
  type Vec3,
} from "./physics.js";

/**
 * Server hitscan resolution — pure, so it unit-tests without a room or timers.
 * The room rewinds each target's position (lag compensation), builds a
 * {@link HitTarget} from it, and calls {@link resolveHitscan}; this file owns the
 * "nearest unoccluded hit, head vs body" decision and nothing else.
 *
 * A target is two volumes: a **head sphere** just under the crown and a **body
 * capsule** (upright) below it. The nearer of the two decides the part (so a shot
 * grazing the crown is a headshot, a chest shot is a body hit); a map box entered
 * before the target blocks the shot entirely (line-of-sight cover).
 */

export interface HitTarget {
  id: string;
  /** Horizontal position (ground plane). */
  x: number;
  z: number;
  /** Feet height (rewound). */
  feetY: number;
  /** Crown height = feetY + capsule height (rewound). */
  headY: number;
  team: number;
}

export interface HitConfig {
  /** Capsule (body) radius. */
  radius: number;
  /** Head sphere radius. */
  headRadius: number;
}

export type HitPart = "head" | "body";

export interface Hit {
  id: string;
  part: HitPart;
  /** Distance along the ray to the impact (world units). */
  t: number;
}

/**
 * A client's hit claim (hybrid hit registration — PLAN "모양 100%"): the
 * shooter's OWN raycast against its actually-rendered scene (the remote rig's
 * real mesh in its current animated pose, not this file's capsule+sphere
 * approximation) — see client/scene.ts's `raycastHitClaim`. The server
 * (arena-room.ts's `validateClaim`) plausibility-checks a claim before
 * trusting it for damage; on any failure the existing {@link resolveHitscan}
 * path is the fallback, unchanged. Shared between client and server so the
 * wire shape can't drift between the two independent implementations.
 */
export interface FireClaim {
  id: string;
  part: HitPart;
}

/**
 * The nearest enemy hit along `origin + t·dir` within `range`, or `null`. Ray
 * direction must be unit length. Targets on `shooterTeam` are ignored (no friendly
 * fire and teammates never block your bullets in M0) UNLESS `teamless` is set (FFA:
 * every other player is a valid target regardless of the shared team=0 the room
 * assigns everyone — the shooter itself is excluded upstream, before `targets` is
 * built, so this flag never needs to reintroduce self-exclusion). A map box entered
 * before a target shields it.
 */
export function resolveHitscan(
  origin: Vec3,
  dir: Vec3,
  range: number,
  shooterTeam: number,
  targets: readonly HitTarget[],
  boxes: readonly Box[],
  cfg: HitConfig,
  teamless = false,
): Hit | null {
  const occludeT = nearestBox(origin, dir, boxes, range);
  let best: Hit | null = null;

  for (const tgt of targets) {
    if (!teamless && tgt.team === shooterTeam) continue;

    const headCentre: Vec3 = { x: tgt.x, y: tgt.headY - cfg.headRadius, z: tgt.z };
    const tHead = raySphere(origin, dir, headCentre, cfg.headRadius, range);

    // Body cylinder: feet up to the neck (crown − 2·headRadius), where the head
    // sphere's underside begins — so the two volumes meet without overlapping.
    const yTop = tgt.headY - 2 * cfg.headRadius;
    const tBody =
      yTop > tgt.feetY
        ? rayVerticalCylinder(origin, dir, tgt.x, tgt.z, tgt.feetY, yTop, cfg.radius, range)
        : null;

    let t: number;
    let part: HitPart;
    if (tHead !== null && (tBody === null || tHead <= tBody)) {
      t = tHead;
      part = "head";
    } else if (tBody !== null) {
      t = tBody;
      part = "body";
    } else {
      continue;
    }

    if (t >= occludeT) continue; // a map box shields this target
    if (best === null || t < best.t) best = { id: tgt.id, part, t };
  }

  return best;
}
