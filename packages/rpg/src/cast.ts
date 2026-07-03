/**
 * Cast pipeline — the single skill entry point for players and NPC AI alike. `useSkill`
 * walks the load-bearing gate order (alive → CC → already-casting → anti-spam → GCD →
 * cooldown → cancel-on-start buffs → target → weapon → mana → range → cast branch), then
 * the cast/channel/apply phases run off the engine's timer heap. Interrupts unwind cast
 * or channel state and emit `castStopped`.
 *
 * The gate ORDER is deliberate: a silenced unit may still swing a melee skill (silence
 * only blocks spell/heal), so CC is checked per-school before the resource gates.
 */

import type { Vec2 } from "@tikron/sim";
import type { RpgEngine } from "./engine.js";
import type { ApplyCtx, EffectTarget } from "./effects.js";
import type { SkillDef, SkillEffectBinding, TargetRelation } from "./content.js";
import type { TargetRef } from "./events.js";
import type { Unit } from "./unit.js";
import {
  fireRemoveOn,
  hasBuffTag,
  isDisarmed,
  isSilenced,
  isSleeping,
  isStunned,
} from "./buffs.js";
import { pickWeighted } from "./rng.js";
import { gatherAoe, resolveInitialTarget, type Relation } from "./targeting.js";

/** Client-visible skill-use status (mirrors AAEmu's SkillResult enum, v1 subset). */
export type SkillResult =
  | "ok"
  | "dead"
  | "stunned"
  | "silenced"
  | "onCooldown"
  | "onGcd"
  | "tooSoon"
  | "noTarget"
  | "invalidTarget"
  | "tooClose"
  | "tooFar"
  | "lackMana"
  | "alreadyCasting"
  | "unknownSkill"
  | "noWeapon";

export const ANTISPAM_MS = 150;
export const DEFAULT_GCD_PLAYER = 1000;
export const DEFAULT_GCD_NPC = 1500;
export const POSTCAST_MS = 5000;
export const DEFAULT_MAX_RANGE = 4;
export const AUTO_SWING_MIN_MS = 400;
export const AUTO_SWING_MAX_MS = 5000;
export const DEFAULT_AUTO_SWING_MS = 1500;

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Is `attackerPos` within the front hemisphere of `target` (used for facing gates). */
export function isFrontalAttack(target: Unit, attackerPos: Vec2): boolean {
  const dir = Math.atan2(attackerPos.y - target.pos.y, attackerPos.x - target.pos.x);
  let delta = Math.abs(dir - target.facing) % (Math.PI * 2);
  if (delta > Math.PI) delta = Math.PI * 2 - delta;
  return delta <= Math.PI / 2;
}

function resolveGcd(skill: SkillDef, unit: Unit): number {
  if (skill.gcd === "none") return 0;
  if (typeof skill.gcd === "number") return skill.gcd;
  return unit.kind === "npc" ? DEFAULT_GCD_NPC : DEFAULT_GCD_PLAYER;
}

function cancelsOnMove(skill: SkillDef): boolean {
  return skill.cancelOnMove ?? ((skill.castTimeMs ?? 0) > 0 || skill.channel !== undefined);
}

function weaponMatches(unit: Unit, engine: RpgEngine, need: SkillDef["requiresWeapon"]): boolean {
  if (!need) return true;
  const w = unit.weaponId ? engine.weapon(unit.weaponId) : undefined;
  if (!w) return false;
  if (need === true) return true;
  return w.kind === need;
}

/**
 * Validate and begin a skill use. On a cast-time skill this sets cast state, emits
 * `skillStarted`, and schedules the commit; instant skills commit inline. Returns `"ok"`
 * once the cast has been accepted (the effects land later via the timer heap).
 */
export function useSkill(
  engine: RpgEngine,
  casterId: string,
  skillId: string,
  target: TargetRef | undefined,
  now: number,
): SkillResult {
  const unit = engine.unit(casterId);
  if (!unit) return "unknownSkill";
  const skill = engine.skill(skillId);
  if (!skill) return "unknownSkill";

  if (!unit.alive) return "dead";

  // CC (per-school): stun/sleep block all; silence blocks spell/heal; disarm blocks weapon skills.
  // (Sleep surfaces as "stunned" — the SkillResult enum has no distinct asleep code.)
  if (isStunned(engine, unit) || isSleeping(engine, unit)) return "stunned";
  const schoolSilenced = skill.school === "spell" || skill.school === "heal";
  if (schoolSilenced && isSilenced(engine, unit)) return "silenced";
  const weaponSchool = skill.school === "melee" || skill.school === "ranged" || !!skill.requiresWeapon;
  if (weaponSchool && isDisarmed(engine, unit)) return "noWeapon";

  if (unit.cast) return "alreadyCasting";

  if (now < unit.lastSkillUseAt + ANTISPAM_MS) return "tooSoon";
  if (skill.gcd !== "none" && now < unit.gcdUntil) return "onGcd";
  const cd = unit.cooldowns.get(skillId);
  if (cd !== undefined && now < cd) return "onCooldown";

  // Cancel buffs flagged removeOn.startSkill.
  fireRemoveOn(engine, unit, "startSkill", now);

  const init = resolveInitialTarget(skill, target, unit, (id) => engine.unit(id), (a, b) => engine.relation(a, b));
  if (!init.ok) return init.reason;

  if (!weaponMatches(unit, engine, skill.requiresWeapon)) return "noWeapon";

  if ((skill.manaCost ?? 0) > unit.mp) return "lackMana";

  // Range against the aim point (weapon range for auto-attacks).
  const aim = init.pos;
  const d = dist(unit.pos, aim);
  let maxRange = skill.maxRange ?? DEFAULT_MAX_RANGE;
  const minRange = skill.minRange ?? 0;
  if (skill.autoAttack && unit.weaponId) {
    const w = engine.weapon(unit.weaponId);
    if (w?.maxRange !== undefined) maxRange = w.maxRange;
  }
  if (d < minRange) return "tooClose";
  if (d > maxRange + unit.radius + (init.unit?.radius ?? 0)) return "tooFar";

  unit.lastSkillUseAt = now;
  const token = engine.newCastToken();
  const castTime = Math.round((skill.castTimeMs ?? 0) * (unit.stat("castTimeMul") / 100));

  if (castTime > 0) {
    unit.cast = { skillId, token, phase: "casting", startedAt: now, endsAt: now + castTime, target };
    engine.emit({ t: "skillStarted", caster: unit.id, skillId, castMs: castTime, target });
    engine.scheduleCastCommit(unit.id, token, now + castTime);
  } else {
    engine.emit({ t: "skillStarted", caster: unit.id, skillId, castMs: 0, target });
    commitCast(engine, unit, skill, target, token, now);
  }
  return "ok";
}

/** Timer callback: the cast bar completed — commit the skill. */
export function onCastCommit(engine: RpgEngine, unitId: string, token: number, now: number): void {
  const unit = engine.unit(unitId);
  if (!unit || !unit.cast || unit.cast.token !== token || unit.cast.phase !== "casting") return;
  const skill = engine.skill(unit.cast.skillId);
  if (!skill) return;
  commitCast(engine, unit, skill, unit.cast.target, token, now);
}

/** Commitment: GCD, mana, cooldown, toggle, then channel-or-schedule-apply. */
export function commitCast(
  engine: RpgEngine,
  unit: Unit,
  skill: SkillDef,
  target: TargetRef | undefined,
  token: number,
  now: number,
): void {
  const gcd = resolveGcd(skill, unit);
  if (gcd > 0) unit.gcdUntil = now + Math.round(gcd * (unit.stat("gcdMul") / 100));

  const manaCost = skill.manaCost ?? 0;
  if (manaCost > 0) {
    unit.mp = Math.max(0, unit.mp - manaCost);
    unit.postCastUntil = now + POSTCAST_MS;
    engine.markPoints(unit);
  }

  if (skill.cooldownMs && skill.cooldownMs > 0) {
    unit.cooldowns.set(skill.id, now + Math.round(skill.cooldownMs * (unit.stat("cooldownMul") / 100)));
  }

  if (skill.toggleBuffId) {
    engine.toggleBuff(unit, skill.toggleBuffId, now);
  }

  if (skill.channel) {
    startChannel(engine, unit, skill, target, token, now);
  } else {
    // Cast bar done; the effect is "fired" and can no longer be interrupted.
    unit.cast = undefined;
    scheduleApply(engine, unit, skill, target, token, now);
  }
}

function scheduleApply(
  engine: RpgEngine,
  unit: Unit,
  skill: SkillDef,
  target: TargetRef | undefined,
  token: number,
  now: number,
): void {
  const aim = aimPos(engine, unit, target);
  let delay = skill.effectDelayMs ?? 0;
  if (skill.projectileSpeed && skill.projectileSpeed > 0) {
    delay += (dist(unit.pos, aim) / skill.projectileSpeed) * 1000;
  }
  engine.emit({ t: "skillFired", caster: unit.id, skillId: skill.id, delayMs: Math.round(delay), target });
  if (delay <= 0) {
    applySkill(engine, unit.id, skill.id, target, now, 0);
  } else {
    engine.scheduleCastApply(unit.id, token, skill.id, target, now + delay);
  }
}

function aimPos(engine: RpgEngine, unit: Unit, target: TargetRef | undefined): Vec2 {
  if (target && "pos" in target) return target.pos;
  if (target && "unitId" in target) {
    const u = engine.unit(target.unitId);
    if (u) return u.pos;
  }
  return unit.pos;
}

// ---------------------------------------------------------------------------
// Channel.
// ---------------------------------------------------------------------------

function startChannel(
  engine: RpgEngine,
  unit: Unit,
  skill: SkillDef,
  target: TargetRef | undefined,
  token: number,
  now: number,
): void {
  const ch = skill.channel!;
  unit.cast = { skillId: skill.id, token, phase: "channeling", startedAt: now, endsAt: now + ch.durationMs, target };
  if (ch.selfBuffId) engine.applyBuffId(unit, ch.selfBuffId, unit.id, 1, now);
  const tgt = target && "unitId" in target ? engine.unit(target.unitId) : undefined;
  if (ch.targetBuffId && tgt) engine.applyBuffId(tgt, ch.targetBuffId, unit.id, 1, now);

  engine.emit({ t: "skillFired", caster: unit.id, skillId: skill.id, delayMs: 0, target });

  const totalTicks = Math.floor(ch.durationMs / ch.tickMs);
  for (let i = 1; i <= totalTicks; i++) {
    engine.scheduleChannelTick(unit.id, token, now + i * ch.tickMs);
  }
  engine.scheduleChannelEnd(unit.id, token, now + ch.durationMs);
}

/** Timer callback: one channel tick — pay upkeep then apply tick effects. */
export function onChannelTick(engine: RpgEngine, unitId: string, token: number, now: number): void {
  const unit = engine.unit(unitId);
  if (!unit || !unit.cast || unit.cast.token !== token || unit.cast.phase !== "channeling") return;
  const skill = engine.skill(unit.cast.skillId);
  const ch = skill?.channel;
  if (!ch) return;

  if (ch.manaPerTick && ch.manaPerTick > 0) {
    if (unit.mp < ch.manaPerTick) {
      stopCast(engine, unit, "cancelled", now);
      return;
    }
    unit.mp -= ch.manaPerTick;
    unit.postCastUntil = now + POSTCAST_MS;
    engine.markPoints(unit);
  }

  const tgt = unit.cast.target && "unitId" in unit.cast.target ? engine.unit(unit.cast.target.unitId) : undefined;
  const et: EffectTarget = { unit: tgt, pos: tgt?.pos ?? aimPos(engine, unit, unit.cast.target) };
  const ctx: ApplyCtx = { now, source: "skill", skillId: skill!.id, depth: 0 };
  for (const eff of ch.tickEffects) engine.applyEffect(ctx, eff, unit, et);
}

/** Timer callback: the channel duration elapsed — end it cleanly. */
export function onChannelEnd(engine: RpgEngine, unitId: string, token: number, now: number): void {
  const unit = engine.unit(unitId);
  if (!unit || !unit.cast || unit.cast.token !== token || unit.cast.phase !== "channeling") return;
  endChannelBuffs(engine, unit, now);
  engine.emit({ t: "skillEnded", caster: unit.id, skillId: unit.cast.skillId });
  unit.cast = undefined;
}

function endChannelBuffs(engine: RpgEngine, unit: Unit, now: number): void {
  const cast = unit.cast;
  if (!cast) return;
  const skill = engine.skill(cast.skillId);
  const ch = skill?.channel;
  if (!ch) return;
  if (ch.selfBuffId) engine.removeBuffsById(unit, ch.selfBuffId, now);
  if (ch.targetBuffId && cast.target && "unitId" in cast.target) {
    const tgt = engine.unit(cast.target.unitId);
    if (tgt) engine.removeBuffsById(tgt, ch.targetBuffId, now);
  }
}

// ---------------------------------------------------------------------------
// Interrupt.
// ---------------------------------------------------------------------------

/** Unwind an in-progress cast/channel and emit `castStopped` + `skillEnded`. */
export function stopCast(
  engine: RpgEngine,
  unit: Unit,
  reason: "moved" | "stunned" | "silenced" | "cancelled" | "dead",
  now: number,
): void {
  const cast = unit.cast;
  if (!cast) return;
  if (cast.phase === "channeling") endChannelBuffs(engine, unit, now);
  engine.cancelCastTimers(unit.id, cast.token);
  engine.emit({ t: "castStopped", caster: unit.id, skillId: cast.skillId, reason });
  engine.emit({ t: "skillEnded", caster: unit.id, skillId: cast.skillId });
  unit.cast = undefined;
}

/** Movement interrupt: cancel the cast when the skill breaks on move. */
export function onMoved(engine: RpgEngine, unitId: string, now: number): void {
  const unit = engine.unit(unitId);
  if (!unit || !unit.cast) return;
  const skill = engine.skill(unit.cast.skillId);
  if (skill && cancelsOnMove(skill)) stopCast(engine, unit, "moved", now);
}

// ---------------------------------------------------------------------------
// Apply — gather targets, run per-binding gates, execute effects.
// ---------------------------------------------------------------------------

function relationPredicate(rel: TargetRelation, engine: RpgEngine, caster: Unit): (u: Unit) => boolean {
  switch (rel) {
    case "hostile":
      return (u) => engine.relation(caster, u) === "hostile";
    case "friendly":
      return (u) => engine.relation(caster, u) === "friendly";
    case "others":
      return (u) => u.id !== caster.id;
    case "any":
    default:
      return () => true;
  }
}

/**
 * Execute a skill's effects. Gathers the target set (AoE or single), splits weighted
 * bindings into one competing group, applies each surviving binding through the effect
 * executor per its relation/facing/buff-tag/chance gates, then emits `skillEnded`. Reused
 * by the timer path and by `subSkill`.
 */
export function applySkill(
  engine: RpgEngine,
  casterId: string,
  skillId: string,
  target: TargetRef | undefined,
  now: number,
  depth: number,
): void {
  const unit = engine.unit(casterId);
  const skill = engine.skill(skillId);
  if (!unit || !skill) return;

  const primaryUnit = target && "unitId" in target ? engine.unit(target.unitId) : undefined;
  const anchorPos = target && "pos" in target ? target.pos : primaryUnit?.pos ?? unit.pos;

  let targets: EffectTarget[];
  if (skill.aoe) {
    const anchorUnit = skill.aoe.anchor === "caster" ? unit : primaryUnit;
    const anchor = skill.aoe.anchor === "caster" ? unit.pos : anchorPos;
    const facing = anchor.x === anchorPos.x && anchor.y === anchorPos.y
      ? unit.facing
      : Math.atan2(anchorPos.y - anchor.y, anchorPos.x - anchor.x);
    const found = gatherAoe({
      aoe: skill.aoe,
      anchor,
      facing,
      anchorUnit,
      candidates: engine.rawUnits(),
      relationOk: relationPredicate(skill.aoe.relation, engine, unit),
      includeUnit: (u) => u.alive,
    });
    targets = found.map((u) => ({ unit: u, pos: u.pos }));
  } else {
    targets = primaryUnit ? [{ unit: primaryUnit, pos: primaryUnit.pos }] : [{ pos: anchorPos }];
  }

  const ctx: ApplyCtx = { now, source: "skill", skillId: skill.id, depth };

  // Weighted bindings compete as one group; the rest always apply.
  const normal: SkillEffectBinding[] = [];
  const weighted: SkillEffectBinding[] = [];
  for (const b of skill.effects) (b.weight && b.weight > 0 ? weighted : normal).push(b);
  const active = [...normal];
  if (weighted.length > 0) {
    const picked = pickWeighted(engine.rngFn(), weighted, (b) => b.weight ?? 0);
    if (picked) active.push(picked);
  }

  for (const binding of active) {
    if (binding.applyTo === "caster" || binding.applyTo === "casterOnce") {
      applyBinding(engine, unit, skill, binding, { unit, pos: unit.pos }, ctx);
    } else {
      for (const t of targets) applyBinding(engine, unit, skill, binding, t, ctx);
    }
  }

  if (skill.threatBonus && skill.threatBonus > 0) {
    for (const t of targets) {
      if (t.unit && t.unit.kind === "npc") engine.addAggro(t.unit, unit.id, "damage", skill.threatBonus);
    }
  }

  engine.emit({ t: "skillEnded", caster: unit.id, skillId: skill.id });
}

function applyBinding(
  engine: RpgEngine,
  caster: Unit,
  skill: SkillDef,
  binding: SkillEffectBinding,
  target: EffectTarget,
  ctx: ApplyCtx,
): void {
  const tu = target.unit;
  if (binding.relation && tu) {
    const rel: Relation = engine.relation(caster, tu);
    if (rel !== binding.relation) return;
  }
  if (binding.position && tu) {
    const front = isFrontalAttack(tu, caster.pos);
    if (binding.position === "front" && !front) return;
    if (binding.position === "back" && front) return;
  }
  if (binding.requireTargetBuffTag && tu && !hasBuffTag(engine, tu, binding.requireTargetBuffTag)) return;
  if (binding.forbidTargetBuffTag && tu && hasBuffTag(engine, tu, binding.forbidTargetBuffTag)) return;
  if (!engine.roll(binding.chance ?? 100)) return;
  engine.applyEffect(ctx, binding.effect, caster, target);
}

// ---------------------------------------------------------------------------
// Auto-attack.
// ---------------------------------------------------------------------------

/** Weapon swing cadence in ms, clamped to the auto-attack bounds. */
export function swingInterval(engine: RpgEngine, unit: Unit): number {
  const w = unit.weaponId ? engine.weapon(unit.weaponId) : undefined;
  const base = w?.speedMs ?? DEFAULT_AUTO_SWING_MS;
  return Math.min(AUTO_SWING_MAX_MS, Math.max(AUTO_SWING_MIN_MS, base));
}

/** Timer callback: one auto-attack swing — re-uses `useSkill`, then reschedules. */
export function onAutoAttack(engine: RpgEngine, unitId: string, targetId: string, now: number): void {
  const unit = engine.unit(unitId);
  if (!unit || !unit.alive || !unit.autoAttack || unit.autoAttack.targetId !== targetId) return;
  const target = engine.unit(targetId);
  if (!target || !target.alive) {
    unit.autoAttack = undefined;
    return;
  }
  const autoSkillId = engine.autoAttackSkillId(unit);
  if (autoSkillId) useSkill(engine, unit.id, autoSkillId, { unitId: targetId }, now);
  engine.scheduleAutoAttack(unit.id, targetId, now + swingInterval(engine, unit));
}
