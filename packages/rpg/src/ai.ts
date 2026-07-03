/**
 * NPC AI — a compact FSM (idle → combat → return → idle; dead terminal) plus the skill
 * picker and chase/leash movement. Driven once per AI interval by the engine tick. Uses
 * the SAME `useSkill` entry point as players, so an NPC's cast obeys every gate a
 * player's does. Aggro selection and engagement live in the engine; this steps behavior.
 */

import type { Vec2 } from "@tikron/sim";
import { stepToward } from "@tikron/sim";
import type { RpgEngine } from "./engine.js";
import type { NpcDef } from "./content.js";
import type { Unit } from "./unit.js";
import { isRooted, isSleeping, isStunned } from "./buffs.js";
import { useSkill } from "./cast.js";
import { pickWeighted, rollRange } from "./rng.js";
import { DEFAULT_MAX_RANGE } from "./cast.js";

export const DEFAULT_LEASH = 50;
export const DEFAULT_HARD_LEASH = 200;
export const DEFAULT_AGGRO_RADIUS = 12;
export const DEFAULT_MOVE_SPEED = 4;
export const DEFAULT_SKILL_DELAY: [number, number] = [1500, 1550];
export const MIN_SKILL_INTERVAL_MS = 150;

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Advance one NPC's behavior by `dt` ms at absolute time `now`. */
export function stepAi(engine: RpgEngine, unit: Unit, now: number, dt: number): void {
  const npc = unit.npc;
  if (!npc || !unit.alive) return;
  const def = unit.npcDefId ? engine.npcDef(unit.npcDefId) : undefined;
  if (!def) return;

  switch (npc.fsm) {
    case "idle":
      stepIdle(engine, unit, def, now);
      return;
    case "combat":
      stepCombat(engine, unit, def, now, dt);
      return;
    case "return":
      stepReturn(engine, unit, def, now, dt);
      return;
    case "dead":
      return;
  }
}

function stepIdle(engine: RpgEngine, unit: Unit, def: NpcDef, now: number): void {
  const npc = unit.npc!;
  if (npc.aggro.size > 0) {
    npc.fsm = "combat";
    return;
  }
  const radius = def.ai?.aggroRadius ?? DEFAULT_AGGRO_RADIUS;
  if (radius <= 0) return;
  for (const u of engine.rawUnits()) {
    if (!u.alive || u.id === unit.id) continue;
    if (engine.relation(unit, u) !== "hostile") continue;
    if (dist(unit.pos, u.pos) <= radius) {
      engine.addAggro(unit, u.id, "damage", 1);
      return; // engine.addAggro flips us to combat + aggro-links
    }
  }
}

function stepCombat(engine: RpgEngine, unit: Unit, def: NpcDef, now: number, dt: number): void {
  const npc = unit.npc!;
  const targetId = npc.aggro.top((id) => {
    const u = engine.unit(id);
    return !!u && u.alive;
  });
  if (!targetId) {
    setTarget(engine, unit, undefined);
    npc.fsm = "return";
    return;
  }
  const target = engine.unit(targetId);
  if (!target) {
    npc.fsm = "return";
    return;
  }
  setTarget(engine, unit, targetId);

  const leash = def.ai?.leashDistance ?? DEFAULT_LEASH;
  if (dist(unit.pos, npc.home) > leash) {
    setTarget(engine, unit, undefined);
    npc.fsm = "return";
    return;
  }

  const d = dist(unit.pos, target.pos);
  const ready = !unit.cast && now >= npc.nextSkillAt && now >= unit.lastSkillUseAt + MIN_SKILL_INTERVAL_MS;
  let acted = false;
  if (ready) {
    const skillId = pickSkill(engine, unit, def, target, d, now);
    if (skillId) {
      if (useSkill(engine, unit.id, skillId, { unitId: targetId }, now) === "ok") {
        const [lo, hi] = def.ai?.skillDelayMs ?? DEFAULT_SKILL_DELAY;
        npc.nextSkillAt = now + rollRange(engine.rngFn(), lo, hi);
        acted = true;
      }
    }
  }

  if (!acted && !unit.cast) {
    const reach = baseReach(engine, def);
    if (d > reach + unit.radius + target.radius) moveToward(engine, unit, target.pos, now, dt);
    else faceToward(unit, target.pos);
  }
}

function stepReturn(engine: RpgEngine, unit: Unit, def: NpcDef, now: number, dt: number): void {
  const npc = unit.npc!;
  const hard = def.ai?.hardLeashDistance ?? DEFAULT_HARD_LEASH;
  if (dist(unit.pos, npc.home) > hard) {
    // Snap home (teleport return) and reset.
    unit.pos = { x: npc.home.x, y: npc.home.y };
    finishReturn(engine, unit);
    return;
  }
  moveToward(engine, unit, npc.home, now, dt);
  if (dist(unit.pos, npc.home) <= 0.5) finishReturn(engine, unit);
}

function finishReturn(engine: RpgEngine, unit: Unit): void {
  const npc = unit.npc!;
  npc.aggro.clear();
  unit.fillToMax();
  engine.clearCombat(unit);
  npc.fsm = "idle";
  engine.markPoints(unit);
}

function setTarget(engine: RpgEngine, unit: Unit, targetId: string | undefined): void {
  const npc = unit.npc!;
  if (npc.targetId === targetId) return;
  npc.targetId = targetId;
  engine.emit({ t: "aiTargetChanged", unit: unit.id, target: targetId });
}

/** The fallback melee reach used to decide when to stop chasing. */
function baseReach(engine: RpgEngine, def: NpcDef): number {
  if (def.baseSkillId) {
    const s = engine.skill(def.baseSkillId);
    if (s) return s.maxRange ?? DEFAULT_MAX_RANGE;
  }
  return DEFAULT_MAX_RANGE;
}

/**
 * Pick a skill: NpcDef slots filtered by cooldown, range, self-hp gates and mana,
 * weighted-random; fall back to `baseSkillId` when in range. Returns `undefined` (→ chase
 * to close distance) when nothing is usable at the current range.
 */
function pickSkill(
  engine: RpgEngine,
  unit: Unit,
  def: NpcDef,
  target: Unit,
  d: number,
  now: number,
): string | undefined {
  const hpPct = (unit.hp / unit.maxHp) * 100;
  const reachPad = unit.radius + target.radius;
  const usable = (def.skills ?? []).filter((s) => {
    const skill = engine.skill(s.skillId);
    if (!skill) return false;
    const cd = unit.cooldowns.get(s.skillId);
    if (cd !== undefined && now < cd) return false;
    const min = s.minRange ?? skill.minRange ?? 0;
    const max = s.maxRange ?? skill.maxRange ?? DEFAULT_MAX_RANGE;
    if (d < min || d > max + reachPad) return false;
    if (s.hpBelowPct !== undefined && hpPct > s.hpBelowPct) return false;
    if (s.hpAbovePct !== undefined && hpPct < s.hpAbovePct) return false;
    if ((skill.manaCost ?? 0) > unit.mp) return false;
    return true;
  });
  if (usable.length > 0) {
    const chosen = pickWeighted(engine.rngFn(), usable, (s) => s.weight ?? 1);
    if (chosen) return chosen.skillId;
  }
  if (def.baseSkillId) {
    const base = engine.skill(def.baseSkillId);
    const max = base?.maxRange ?? DEFAULT_MAX_RANGE;
    const cd = unit.cooldowns.get(def.baseSkillId);
    if (base && d <= max + reachPad && (cd === undefined || now >= cd)) return def.baseSkillId;
  }
  return undefined;
}

function faceToward(unit: Unit, target: Vec2): void {
  if (target.x === unit.pos.x && target.y === unit.pos.y) return;
  unit.facing = Math.atan2(target.y - unit.pos.y, target.x - unit.pos.x);
}

function moveToward(engine: RpgEngine, unit: Unit, target: Vec2, now: number, dt: number): void {
  // Movement-locking CC — mirrors UnitView.canMove (root/stun/sleep). NPC movement is
  // engine-owned, so this must be enforced here; a room cannot correct it.
  if (isRooted(engine, unit) || isStunned(engine, unit) || isSleeping(engine, unit)) return;
  const npc = unit.npc!;
  const speed = npc.moveSpeed * (unit.stat("moveSpeedMul") / 100);
  const np = stepToward(unit.pos, target, speed, dt);
  if (np.x === unit.pos.x && np.y === unit.pos.y) return;
  unit.facing = Math.atan2(np.y - unit.pos.y, np.x - unit.pos.x);
  unit.pos = np;
  engine.emit({ t: "unitMoved", unit: unit.id, pos: { x: np.x, y: np.y }, facing: unit.facing });
}
