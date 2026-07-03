/**
 * Buff container — add (stack resolution + tolerance DR + immunity), remove, tick,
 * removeOn triggers, CC/immunity queries, damage shields, and proc firing. Buff
 * instances live on `unit.buffs`; their stat modifiers register into `unit.mods` keyed
 * by instance id so removal is source-scoped. Ticks and expiry are driven by the
 * engine's {@link TimerHeap} via the schedule hooks below.
 *
 * These are free functions over `(engine, unit, …)` rather than methods so the buff
 * rules stay isolated and independently testable; the engine is referenced type-only.
 */

import type { RpgEngine } from "./engine.js";
import type { ApplyCtx } from "./effects.js";
import type { BuffDef, BuffToleranceDef } from "./content.js";
import type { DamageSchool } from "./stats.js";
import type { BuffInstance, Unit } from "./unit.js";

/** Priority bands for scheduled buff timers (ticks fire before expiry at equal ms). */
export const TICK_PRI = 0;
export const EXPIRE_PRI = 1;

/** Absolute duration for a buff at `abLevel`; 0 means permanent-until-removed. */
export function buffDuration(def: BuffDef, abLevel: number): number {
  return Math.max(0, (def.levelDurationMs ?? 0) * abLevel + (def.durationMs ?? 0));
}

function hasTick(def: BuffDef): boolean {
  return def.tick !== undefined && def.tick.intervalMs > 0;
}

function sameBuff(unit: Unit, buffId: string): BuffInstance[] {
  return unit.buffs.filter((b) => b.buffId === buffId);
}

/** Clamp hp/mp down to current maxima after a modifier change (never heals). */
function clampPools(unit: Unit): void {
  const mh = unit.maxHp;
  const mm = unit.maxMp;
  if (unit.hp > mh) unit.hp = mh;
  if (unit.mp > mm) unit.mp = mm;
}

/** True if any active buff grants immunity to a buff carrying one of `tags`. */
function immuneToTags(unit: Unit, tags: readonly string[], engine: RpgEngine): boolean {
  for (const inst of unit.buffs) {
    const d = engine.buff(inst.buffId);
    const blocked = d?.immunities?.buffTags;
    if (!blocked) continue;
    for (const t of tags) if (blocked.includes(t)) return true;
  }
  return false;
}

/**
 * Advance the per-tag tolerance counter on the RECEIVER. Returns the time-reduction to
 * apply, or `immune: true` when the counter maxed out (the CC is then blocked and, if
 * configured, an immunity buff is granted by the caller). Window expiry resets to step 0.
 */
function applyTolerance(
  unit: Unit,
  tol: BuffToleranceDef,
  now: number,
): { immune: boolean; timeReductionPct: number } {
  const c = unit.tolerance.get(tol.tag) ?? { step: -1, windowEndsAt: 0 };
  const step = now >= c.windowEndsAt ? 0 : c.step + 1;
  if (step >= tol.steps.length) {
    unit.tolerance.set(tol.tag, { step: 0, windowEndsAt: now + tol.windowMs });
    return { immune: true, timeReductionPct: 0 };
  }
  unit.tolerance.set(tol.tag, { step, windowEndsAt: now + tol.windowMs });
  return { immune: false, timeReductionPct: tol.steps[step]!.timeReductionPct };
}

function registerModifiers(engine: RpgEngine, unit: Unit, inst: BuffInstance, def: BuffDef): void {
  if (def.modifiers && def.modifiers.length > 0) {
    unit.mods.set(String(inst.instanceId), def.modifiers.map((m) => ({ ...m })));
    clampPools(unit);
  }
}

/** Wire timers for a freshly added instance and its CC interrupt side effect. */
function activateInstance(engine: RpgEngine, unit: Unit, inst: BuffInstance, def: BuffDef, now: number): void {
  if (hasTick(def)) {
    inst.nextTickAt = now + def.tick!.intervalMs;
    if (inst.endsAt === 0 || inst.nextTickAt <= inst.endsAt) {
      engine.scheduleBuffTick(unit.id, inst.instanceId, inst.nextTickAt);
    }
  }
  if (inst.endsAt > 0) engine.scheduleBuffExpire(unit.id, inst.instanceId, inst.endsAt);

  if (def.cc?.stun || def.cc?.sleep) engine.interruptCast(unit.id, "stunned", now);
  else if (def.cc?.silence) engine.interruptCast(unit.id, "silenced", now);
}

/**
 * Add a buff. Order: buff-tag immunity → tolerance DR → duration → stack resolution
 * (refresh / chargeRefresh / extend / multiple|independent) → new instance with
 * modifiers, shield pool, tick/expiry timers, CC interrupt, `buffAdded`. Returns the
 * resulting instance, or `undefined` when blocked (immune) or dropped (shorter refresh).
 */
export function addBuff(
  engine: RpgEngine,
  unit: Unit,
  def: BuffDef,
  caster: string,
  abLevel: number,
  now: number,
): BuffInstance | undefined {
  if (def.tags && immuneToTags(unit, def.tags, engine)) return undefined;

  let duration = buffDuration(def, abLevel);
  if (def.tolerance) {
    const tol = applyTolerance(unit, def.tolerance, now);
    if (tol.immune) {
      if (def.tolerance.immunityBuffId) {
        const imm = engine.buff(def.tolerance.immunityBuffId);
        if (imm) addBuff(engine, unit, imm, caster, 1, now);
      }
      return undefined;
    }
    duration = (duration * (100 - tol.timeReductionPct)) / 100;
  }

  const perm = duration <= 0;
  const endsAt = perm ? 0 : now + duration;
  const rule = def.stackRule ?? "refresh";
  const charges = def.initialCharges ?? -1;
  const shield = def.shield ? def.shield.amount + (def.shield.perLevel ?? 0) * abLevel : 0;
  const existing = sameBuff(unit, def.id);

  // ---- refresh family: mutate an existing instance in place ----
  if ((rule === "refresh" || rule === "chargeRefresh" || rule === "extend") && existing.length > 0) {
    const inst = existing[0]!;
    if (rule === "chargeRefresh" && charges < inst.charges) return undefined;
    const incomingPerm = endsAt === 0;
    const existingPerm = inst.endsAt === 0;
    if (rule === "extend") {
      const remaining = existingPerm ? 0 : Math.max(0, inst.endsAt - now);
      inst.endsAt = perm ? 0 : now + duration + remaining;
    } else {
      // refresh / chargeRefresh: newer duration wins, drop only if strictly shorter
      const atLeastAsLong = incomingPerm || (!existingPerm && endsAt >= inst.endsAt);
      if (!atLeastAsLong) return undefined;
      inst.endsAt = endsAt;
    }
    inst.appliedAt = now;
    inst.abLevel = abLevel;
    inst.caster = caster;
    if (charges >= 0) inst.charges = charges;
    if (shield > 0) inst.shieldLeft = shield;
    engine.cancelBuffTimers(unit.id, inst.instanceId);
    activateInstance(engine, unit, inst, def, now);
    engine.emit({
      t: "buffRefreshed",
      target: unit.id,
      buffId: def.id,
      instanceId: inst.instanceId,
      durationMs: inst.endsAt === 0 ? 0 : inst.endsAt - now,
      stacks: sameBuff(unit, def.id).length,
    });
    return inst;
  }

  // ---- multiple / independent (and refresh with no existing): new instance ----
  const maxStack = def.maxStack ?? 1;
  if ((rule === "multiple" || rule === "independent") && existing.length >= maxStack) {
    // at cap: overwrite the shortest-remaining instance
    let victim = existing[0]!;
    for (const b of existing) {
      const vr = victim.endsAt === 0 ? Infinity : victim.endsAt;
      const br = b.endsAt === 0 ? Infinity : b.endsAt;
      if (br < vr) victim = b;
    }
    victim.appliedAt = now;
    victim.abLevel = abLevel;
    victim.caster = caster;
    victim.endsAt = endsAt;
    if (charges >= 0) victim.charges = charges;
    victim.shieldLeft = shield;
    engine.cancelBuffTimers(unit.id, victim.instanceId);
    activateInstance(engine, unit, victim, def, now);
    engine.emit({
      t: "buffRefreshed",
      target: unit.id,
      buffId: def.id,
      instanceId: victim.instanceId,
      durationMs: victim.endsAt === 0 ? 0 : victim.endsAt - now,
      stacks: sameBuff(unit, def.id).length,
    });
    return victim;
  }

  const inst: BuffInstance = {
    instanceId: engine.nextInstanceId(),
    buffId: def.id,
    caster,
    abLevel,
    appliedAt: now,
    endsAt,
    nextTickAt: 0,
    stacks: 1,
    charges,
    shieldLeft: shield,
  };
  unit.buffs.push(inst);
  registerModifiers(engine, unit, inst, def);
  activateInstance(engine, unit, inst, def, now);
  engine.emit({
    t: "buffAdded",
    target: unit.id,
    buffId: def.id,
    instanceId: inst.instanceId,
    source: caster,
    durationMs: endsAt === 0 ? 0 : endsAt - now,
    stacks: sameBuff(unit, def.id).length,
  });
  return inst;
}

/** Remove a specific instance, unregister its modifiers/timers, and emit `buffRemoved`. */
export function removeBuffInstance(
  engine: RpgEngine,
  unit: Unit,
  inst: BuffInstance,
  reason: "expired" | "dispelled" | "consumed" | "death" | "removed",
  now: number,
): void {
  const idx = unit.buffs.indexOf(inst);
  if (idx < 0) return;
  unit.buffs.splice(idx, 1);
  unit.mods.delete(String(inst.instanceId));
  engine.cancelBuffTimers(unit.id, inst.instanceId);
  clampPools(unit);
  engine.emit({
    t: "buffRemoved",
    target: unit.id,
    buffId: inst.buffId,
    instanceId: inst.instanceId,
    reason,
  });
  // On-dispel proc
  if (reason === "dispelled") fireTriggers(engine, unit, "dispelled", {}, now, 0);
}

/** Look up an instance by id on a unit. */
export function findInstance(unit: Unit, instanceId: number): BuffInstance | undefined {
  return unit.buffs.find((b) => b.instanceId === instanceId);
}

/**
 * Fire a scheduled buff tick: pay upkeep, apply tick effects through the shared effect
 * executor (with the buff's caster as source), then self-requeue the next tick or let
 * the expiry timer remove it. Ticks do not crit (v1).
 */
export function tickBuff(engine: RpgEngine, unit: Unit, instanceId: number, now: number): void {
  const inst = findInstance(unit, instanceId);
  if (!inst || !unit.alive) return;
  const def = engine.buff(inst.buffId);
  if (!def || !def.tick) return;

  if (def.tick.manaPerTick && def.tick.manaPerTick > 0) {
    unit.mp = Math.max(0, unit.mp - def.tick.manaPerTick);
    engine.markPoints(unit);
  }

  const casterUnit = engine.unit(inst.caster) ?? unit;
  const ctx: ApplyCtx = { now, source: "buffTick", depth: 0, buffCaster: inst.caster };
  for (const eff of def.tick.effects) {
    engine.applyEffect(ctx, eff, casterUnit, { unit, pos: unit.pos });
  }

  const nextAt = inst.nextTickAt + def.tick.intervalMs;
  if (inst.endsAt === 0 || nextAt <= inst.endsAt) {
    inst.nextTickAt = nextAt;
    engine.scheduleBuffTick(unit.id, inst.instanceId, nextAt);
  }
}

/** Expire a buff instance (fires the timeout proc first). */
export function expireBuff(engine: RpgEngine, unit: Unit, instanceId: number, now: number): void {
  const inst = findInstance(unit, instanceId);
  if (!inst) return;
  fireTriggers(engine, unit, "timeout", {}, now, 0);
  removeBuffInstance(engine, unit, inst, "expired", now);
}

// ---------------------------------------------------------------------------
// CC / immunity queries — boolean predicates over active buff templates.
// ---------------------------------------------------------------------------

function anyCc(unit: Unit, engine: RpgEngine, pick: (d: BuffDef) => boolean | undefined): boolean {
  for (const inst of unit.buffs) {
    const d = engine.buff(inst.buffId);
    if (d && pick(d)) return true;
  }
  return false;
}

export const isStunned = (engine: RpgEngine, unit: Unit): boolean => anyCc(unit, engine, (d) => d.cc?.stun);
export const isRooted = (engine: RpgEngine, unit: Unit): boolean => anyCc(unit, engine, (d) => d.cc?.root);
export const isSilenced = (engine: RpgEngine, unit: Unit): boolean => anyCc(unit, engine, (d) => d.cc?.silence);
export const isDisarmed = (engine: RpgEngine, unit: Unit): boolean => anyCc(unit, engine, (d) => d.cc?.disarm);
export const isSleeping = (engine: RpgEngine, unit: Unit): boolean => anyCc(unit, engine, (d) => d.cc?.sleep);

export function isImmuneSchool(engine: RpgEngine, unit: Unit, school: DamageSchool): boolean {
  return anyCc(unit, engine, (d) => d.immunities?.allDamage || d.immunities?.schools?.includes(school));
}
export function isKnockbackImmune(engine: RpgEngine, unit: Unit): boolean {
  return anyCc(unit, engine, (d) => d.immunities?.knockback);
}
export function hasBuffTag(engine: RpgEngine, unit: Unit, tag: string): boolean {
  return anyCc(unit, engine, (d) => d.tags?.includes(tag));
}

// ---------------------------------------------------------------------------
// Damage shields — mana shield first, then absorb pools oldest-first.
// ---------------------------------------------------------------------------

function maxManaShieldRatio(engine: RpgEngine, unit: Unit): number {
  let ratio = 0;
  for (const inst of unit.buffs) {
    const d = engine.buff(inst.buffId);
    if (d?.manaShieldRatio && d.manaShieldRatio > ratio) ratio = d.manaShieldRatio;
  }
  return ratio;
}

/**
 * Absorb `raw` post-mitigation damage: pay the mana-shield fraction from MP (1 dmg =
 * 1 MP), then consume absorb-shield pools oldest-first (emptied shields are removed with
 * reason `consumed`). Returns the hp-reducing remainder and the total prevented.
 */
export function absorbDamage(
  engine: RpgEngine,
  unit: Unit,
  raw: number,
  now: number,
): { hpDamage: number; absorbed: number } {
  let remaining = raw;
  let prevented = 0;

  const ratio = maxManaShieldRatio(engine, unit);
  if (ratio > 0 && unit.mp > 0 && remaining > 0) {
    const want = (remaining * ratio) / 100;
    const pay = Math.min(unit.mp, want);
    unit.mp -= pay;
    remaining -= pay;
    prevented += pay;
  }

  if (remaining > 0) {
    const shields = unit.buffs
      .filter((b) => b.shieldLeft > 0)
      .sort((a, b) => a.appliedAt - b.appliedAt || a.instanceId - b.instanceId);
    for (const sh of shields) {
      if (remaining <= 0) break;
      const use = Math.min(sh.shieldLeft, remaining);
      sh.shieldLeft -= use;
      remaining -= use;
      prevented += use;
      if (sh.shieldLeft <= 0) removeBuffInstance(engine, unit, sh, "consumed", now);
    }
  }

  return { hpDamage: remaining, absorbed: prevented };
}

// ---------------------------------------------------------------------------
// removeOn triggers, dispel, death strip.
// ---------------------------------------------------------------------------

/** Strip buffs flagged to drop on a lifecycle event (`move`/`startSkill`/`damaged`/`attack`). */
export function fireRemoveOn(
  engine: RpgEngine,
  unit: Unit,
  on: "move" | "startSkill" | "damaged" | "attack",
  now: number,
): void {
  const doomed = unit.buffs.filter((inst) => {
    const d = engine.buff(inst.buffId);
    return d?.removeOn?.[on] === true;
  });
  for (const inst of doomed) removeBuffInstance(engine, unit, inst, "removed", now);
}

/** Strip buffs on death — all except those with `removeOn.death === false`. */
export function stripOnDeath(engine: RpgEngine, unit: Unit, now: number): void {
  const doomed = unit.buffs.filter((inst) => {
    const d = engine.buff(inst.buffId);
    return d?.removeOn?.death !== false;
  });
  for (const inst of doomed) removeBuffInstance(engine, unit, inst, "death", now);
}

/**
 * Dispel up to `count` buffs of a kind (`good`/`bad`), shortest-remaining first, with an
 * optional tag filter. Hidden buffs are never dispelled. Returns the number removed.
 */
export function dispel(
  engine: RpgEngine,
  unit: Unit,
  kind: "good" | "bad",
  count: number,
  tag: string | undefined,
  now: number,
): number {
  const candidates = unit.buffs.filter((inst) => {
    const d = engine.buff(inst.buffId);
    if (!d || d.kind === "hidden" || d.kind !== kind) return false;
    if (tag && !(d.tags?.includes(tag) ?? false)) return false;
    return true;
  });
  candidates.sort((a, b) => {
    const ar = a.endsAt === 0 ? Infinity : a.endsAt;
    const br = b.endsAt === 0 ? Infinity : b.endsAt;
    return ar - br;
  });
  let removed = 0;
  for (const inst of candidates) {
    if (removed >= count) break;
    removeBuffInstance(engine, unit, inst, "dispelled", now);
    removed++;
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Procs (triggers).
// ---------------------------------------------------------------------------

/** Context passed to a proc: the counterpart unit and the damage school, if any. */
export interface TriggerCtx {
  other?: Unit;
  school?: DamageSchool;
}

/**
 * Fire buff triggers on `unit` matching `on`. Each trigger rolls its chance, respects a
 * 100 ms per-trigger anti-loop guard, and runs its effect through the shared executor —
 * on the proc source (`onSource`) or the owner. `depth` bounds proc→effect→proc chains.
 */
export function fireTriggers(
  engine: RpgEngine,
  unit: Unit,
  on: "attack" | "damage" | "damaged" | "dispelled" | "timeout" | "started" | "death" | "kill",
  ctx: TriggerCtx,
  now: number,
  depth: number,
): void {
  if (depth >= 3) return;
  for (const inst of [...unit.buffs]) {
    const d = engine.buff(inst.buffId);
    if (!d?.triggers) continue;
    for (let i = 0; i < d.triggers.length; i++) {
      const tr = d.triggers[i]!;
      if (tr.on !== on) continue;
      if (tr.school && ctx.school && tr.school !== ctx.school) continue;
      const key = `${inst.instanceId}:${i}`;
      const last = unit.procGuard.get(key) ?? -Infinity;
      if (now - last < 100) continue;
      if (!engine.roll(tr.chance ?? 100)) continue;
      unit.procGuard.set(key, now);
      // The owner is always the effect's source; `onSource` redirects the effect onto
      // the counterpart (e.g. reflect-to-attacker), otherwise it lands on the owner.
      const tgt = tr.onSource && ctx.other ? ctx.other : unit;
      const applyCtx: ApplyCtx = { now, source: "proc", depth: depth + 1 };
      engine.applyEffect(applyCtx, tr.effect, unit, { unit: tgt, pos: tgt.pos });
    }
  }
}
