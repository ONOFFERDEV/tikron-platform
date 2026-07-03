/**
 * Targeting — initial target resolution plus AoE gather (circle / cone / line) with a
 * relation filter and closest-N cap. Geometry is pure over {@link Vec2}; the engine
 * supplies the candidate units and a relation resolver so this module stays decoupled
 * from faction data. Model size (`unit.radius`) counts toward every shape test.
 */

import type { Vec2 } from "@tikron/sim";
import type { AoeDef, SkillDef } from "./content.js";
import type { TargetRef } from "./events.js";
import type { Unit } from "./unit.js";

/** Pairwise relation as the engine resolves it from factions. */
export type Relation = "hostile" | "friendly" | "neutral";

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Smallest absolute angle (radians) between two headings. */
function angleDelta(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/** Perpendicular distance from `p` to the segment `a→b` (0 when the foot is inside). */
function pointToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

/**
 * Does `point` (a unit of radius `pointRadius`) fall inside the AoE shape anchored at
 * `anchor` and — for cone/line — oriented along `facing`? Circle: within `radius`. Cone:
 * within `radius` and within `angleRad/2` of `facing`. Line: within a capsule of length
 * `radius` and half-width `width/2` swept from `anchor` along `facing`.
 */
export function inAoe(
  aoe: AoeDef,
  anchor: Vec2,
  facing: number,
  point: Vec2,
  pointRadius: number,
): boolean {
  const reach = aoe.radius + pointRadius;
  if (aoe.shape === "circle") {
    return dist(anchor, point) <= reach;
  }
  if (aoe.shape === "cone") {
    const d = dist(anchor, point);
    if (d > reach) return false;
    if (d <= pointRadius) return true; // overlapping the anchor: always in
    const dir = Math.atan2(point.y - anchor.y, point.x - anchor.x);
    const half = (aoe.angleRad ?? Math.PI / 2) / 2;
    return angleDelta(dir, facing) <= half;
  }
  // line: capsule from anchor along facing for `radius`, half-width width/2
  const end: Vec2 = {
    x: anchor.x + Math.cos(facing) * aoe.radius,
    y: anchor.y + Math.sin(facing) * aoe.radius,
  };
  const halfWidth = (aoe.width ?? 1) / 2 + pointRadius;
  return pointToSegment(point, anchor, end) <= halfWidth;
}

/** Inputs for {@link gatherAoe}. */
export interface GatherParams {
  aoe: AoeDef;
  anchor: Vec2;
  facing: number;
  /** The unit at the anchor (caster or the primary target), for include/exclude. */
  anchorUnit?: Unit;
  candidates: Iterable<Unit>;
  /** Relation gate — only units for which this returns true are kept. */
  relationOk: (u: Unit) => boolean;
  /** Extra membership gate (e.g. alive). */
  includeUnit?: (u: Unit) => boolean;
}

/**
 * Gather AoE targets: shape test → relation filter → alive/extra filter → closest-N cap
 * (nearest to the anchor). The anchor unit is force-included when `aoe.includeAnchor`
 * and force-excluded when it is explicitly false; otherwise the geometry decides.
 */
export function gatherAoe(p: GatherParams): Unit[] {
  const out: Unit[] = [];
  for (const u of p.candidates) {
    if (p.includeUnit && !p.includeUnit(u)) continue;
    if (!p.relationOk(u)) continue;
    const isAnchor = p.anchorUnit !== undefined && u.id === p.anchorUnit.id;
    if (isAnchor && p.aoe.includeAnchor === false) continue;
    if (isAnchor && p.aoe.includeAnchor === true) {
      out.push(u);
      continue;
    }
    if (inAoe(p.aoe, p.anchor, p.facing, u.pos, u.radius)) out.push(u);
  }
  const cap = p.aoe.maxTargets;
  if (cap !== undefined && out.length > cap) {
    out.sort((a, b) => dist(p.anchor, a.pos) - dist(p.anchor, b.pos));
    return out.slice(0, cap);
  }
  return out;
}

/** Resolved initial target: the aim point plus the unit hit (absent for point-casts). */
export type InitialTarget =
  | { ok: true; unit?: Unit; pos: Vec2 }
  | { ok: false; reason: "noTarget" | "invalidTarget" };

/**
 * Resolve a skill's primary target from the client-supplied {@link TargetRef} per
 * `targetType`. Enforces the coarse relation gate (hostile needs an attackable living
 * unit; friendly falls back to self when omitted; point needs a position). Range and
 * fine per-effect gates are applied later by the cast pipeline.
 */
export function resolveInitialTarget(
  skill: SkillDef,
  target: TargetRef | undefined,
  caster: Unit,
  lookup: (id: string) => Unit | undefined,
  relation: (a: Unit, b: Unit) => Relation,
): InitialTarget {
  const targetUnit = target && "unitId" in target ? lookup(target.unitId) : undefined;
  const targetPos: Vec2 | undefined =
    target && "pos" in target ? target.pos : targetUnit ? targetUnit.pos : undefined;

  switch (skill.targetType) {
    case "self":
      return { ok: true, unit: caster, pos: caster.pos };

    case "point": {
      if (!targetPos) return { ok: false, reason: "noTarget" };
      return { ok: true, pos: targetPos };
    }

    case "hostile": {
      if (!targetUnit) return { ok: false, reason: "noTarget" };
      if (!targetUnit.alive) return { ok: false, reason: "invalidTarget" };
      if (relation(caster, targetUnit) !== "hostile") return { ok: false, reason: "invalidTarget" };
      return { ok: true, unit: targetUnit, pos: targetUnit.pos };
    }

    case "friendly": {
      if (!targetUnit) return { ok: true, unit: caster, pos: caster.pos };
      if (relation(caster, targetUnit) === "hostile") return { ok: false, reason: "invalidTarget" };
      return { ok: true, unit: targetUnit, pos: targetUnit.pos };
    }

    case "any":
    default: {
      if (!targetUnit) {
        if (targetPos) return { ok: true, pos: targetPos };
        return { ok: false, reason: "noTarget" };
      }
      return { ok: true, unit: targetUnit, pos: targetUnit.pos };
    }
  }
}
