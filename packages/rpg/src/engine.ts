/**
 * RpgEngine — the orchestrator and the only public driver. A Tikron room constructs one
 * per instance, feeds player intents (`useSkill`, `moveUnit`, …) and NPC spawns, and
 * calls {@link RpgEngine.tick} once per room tick to advance time and drain the combat
 * event feed. Everything is deterministic: time is the absolute `now` you pass in, and
 * randomness is a single seeded stream, so `serialize`/`restore` round-trips a live
 * fight across a Durable Object eviction with identical subsequent behavior.
 *
 * The engine owns all mutation and the timer heap; the sibling modules (cast, buffs,
 * effects, ai, combat, targeting) are pure/stateless helpers it calls. Effect
 * consequences that touch shared state (aggro, combat state, death, scheduling) live
 * here so the effect executor stays a thin registry.
 */

import type { Vec2 } from "@tikron/sim";
import type {
  AiProfile,
  ContentIndex,
  ContentPack,
  EffectDef,
  NpcDef,
  SkillDef,
  WeaponDef,
  BuffDef,
} from "./content.js";
import { indexContent, factionsHostile } from "./content.js";
import type { CombatEvent, TargetRef } from "./events.js";
import type { ApplyCtx, CustomEffectFn, EffectTarget } from "./effects.js";
import { applyEffect } from "./effects.js";
import type { DamageSchool, Modifier, Primaries, StatKey } from "./stats.js";
import { DEFAULT_PRIMARIES } from "./stats.js";
import type { Rng, SeededRng } from "./rng.js";
import { makeRng, rollChance } from "./rng.js";
import { TimerHeap, type TimerHeapSnapshot } from "./scheduler.js";
import type { AiFsmState, BuffInstance, CastState, CcFlags, ToleranceCounter, UnitView } from "./unit.js";
import { Unit } from "./unit.js";
import { AggroTable, type AggroEntry } from "./aggro.js";
import { computeDamage, computeHeal, rollCrit, rollHealCrit, rollHitType } from "./combat.js";
import {
  EXPIRE_PRI,
  TICK_PRI,
  absorbDamage,
  addBuff,
  dispel,
  expireBuff,
  fireRemoveOn,
  fireTriggers,
  isKnockbackImmune,
  isImmuneSchool,
  isRooted,
  isSilenced,
  isSleeping,
  isStunned,
  removeBuffInstance,
  stripOnDeath,
  tickBuff,
} from "./buffs.js";
import {
  applySkill,
  isFrontalAttack,
  onAutoAttack,
  onCastCommit,
  onChannelEnd,
  onChannelTick,
  onMoved,
  stopCast,
  useSkill as runUseSkill,
  type SkillResult,
} from "./cast.js";
import { stepAi } from "./ai.js";
import { DEFAULT_MOVE_SPEED } from "./ai.js";
import { defaultLevelCurve, killExp, levelForXp } from "./xp.js";
import type { Relation } from "./targeting.js";

/** Constructor options; every field has a documented default. */
export interface RpgEngineOptions {
  seed?: number;
  combatTimeoutMs?: number;
  aiIntervalMs?: number;
  regenIntervalMs?: number;
  pvpEnabled?: boolean;
  maxUnits?: number;
}

/** Spawn parameters for a player-controlled unit. */
export interface SpawnPlayerSpec {
  id: string;
  pos: Vec2;
  facing?: number;
  level?: number;
  faction?: string;
  stats?: Partial<Record<StatKey, number>>;
  weapon?: string;
  radius?: number;
}

/** Internal scheduled-timer payloads. All carry `unitId` for cancel-on-remove. */
type RpgTimer =
  | { k: "castCommit"; unitId: string; token: number }
  | { k: "castApply"; unitId: string; token: number; skillId: string; target?: TargetRef }
  | { k: "channelTick"; unitId: string; token: number }
  | { k: "channelEnd"; unitId: string; token: number }
  | { k: "buffTick"; unitId: string; instanceId: number }
  | { k: "buffExpire"; unitId: string; instanceId: number }
  | { k: "autoAttack"; unitId: string; targetId: string }
  | { k: "subSkill"; unitId: string; skillId: string; target?: TargetRef; depth: number }
  | { k: "despawn"; unitId: string };

/** JSON-safe per-unit snapshot. */
interface UnitSnapshot {
  id: string;
  kind: "player" | "npc";
  npcDefId?: string;
  faction: string;
  level: number;
  xp: number;
  pos: Vec2;
  facing: number;
  radius: number;
  primaries: Primaries;
  overrides: Partial<Record<StatKey, number>>;
  hp: number;
  mp: number;
  alive: boolean;
  inCombat: boolean;
  lastCombatAt: number;
  postCastUntil: number;
  cast?: CastState;
  cooldowns: [string, number][];
  lastSkillUseAt: number;
  gcdUntil: number;
  buffs: BuffInstance[];
  weaponId?: string;
  autoAttack?: { targetId: string };
  mods: [string, Modifier[]][];
  tolerance: [string, ToleranceCounter][];
  procGuard: [string, number][];
  npc?: {
    home: Vec2;
    moveSpeed: number;
    fsm: AiFsmState;
    targetId?: string;
    lastSkillAt: number;
    nextSkillAt: number;
    aggro: [string, AggroEntry][];
  };
}

/**
 * Serializable subset of {@link RpgEngineOptions} captured in a snapshot so a restored
 * engine keeps the rules it ran under. `maxUnits: null` encodes the unbounded (Infinity)
 * default, which JSON cannot represent.
 */
interface SnapshotOptions {
  combatTimeoutMs: number;
  aiIntervalMs: number;
  regenIntervalMs: number;
  pvpEnabled: boolean;
  maxUnits: number | null;
}

/** The full serialized engine state. */
export interface RpgSnapshot {
  version: 1;
  seed: number;
  /** Engine rules at serialize time; restore replays these unless an explicit opts overrides. */
  opts: SnapshotOptions;
  rngAdvance: number;
  nowMs: number;
  clockStarted: boolean;
  lastAiAt: number;
  lastRegenAt: number;
  instanceCounter: number;
  castTokenCounter: number;
  npcCounter: number;
  units: UnitSnapshot[];
  timers: TimerHeapSnapshot<RpgTimer>;
}

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Reconstruct engine options from a snapshot's serialized options (null maxUnits → unbounded). */
function restoreOptions(snap: RpgSnapshot): RpgEngineOptions {
  const o = snap.opts;
  return {
    combatTimeoutMs: o.combatTimeoutMs,
    aiIntervalMs: o.aiIntervalMs,
    regenIntervalMs: o.regenIntervalMs,
    pvpEnabled: o.pvpEnabled,
    maxUnits: o.maxUnits ?? undefined,
  };
}

/** Extract the five primary attributes from a stat-override map (defaults to 10). */
function extractPrimaries(overrides?: Partial<Record<StatKey, number>>): Primaries {
  return {
    str: overrides?.str ?? DEFAULT_PRIMARIES.str,
    dex: overrides?.dex ?? DEFAULT_PRIMARIES.dex,
    sta: overrides?.sta ?? DEFAULT_PRIMARIES.sta,
    int: overrides?.int ?? DEFAULT_PRIMARIES.int,
    spi: overrides?.spi ?? DEFAULT_PRIMARIES.spi,
  };
}

export class RpgEngine {
  private readonly index: ContentIndex;
  private readonly levelCurve: number[];
  private readonly autoSkills: SkillDef[];
  private readonly opts: Required<RpgEngineOptions>;

  private seed: number;
  private rng: SeededRng;
  private scheduler = new TimerHeap<RpgTimer>();
  private unitMap = new Map<string, Unit>();
  private customEffects = new Map<string, CustomEffectFn>();

  private events: CombatEvent[] = [];
  private pointsDirty = new Set<string>();

  private nowMs = 0;
  private clockStarted = false;
  private lastAiAt = 0;
  private lastRegenAt = 0;
  private instanceCounter = 1;
  private castTokenCounter = 1;
  private npcCounter = 1;

  constructor(content: ContentPack, opts?: RpgEngineOptions) {
    this.index = indexContent(content);
    this.levelCurve = this.index.levelCurve.length > 0 ? this.index.levelCurve : defaultLevelCurve();
    this.autoSkills = content.skills.filter((s) => s.autoAttack === true);
    this.opts = {
      seed: opts?.seed ?? 1,
      combatTimeoutMs: opts?.combatTimeoutMs ?? 15000,
      aiIntervalMs: opts?.aiIntervalMs ?? 200,
      regenIntervalMs: opts?.regenIntervalMs ?? 1000,
      pvpEnabled: opts?.pvpEnabled ?? true,
      maxUnits: opts?.maxUnits ?? Number.POSITIVE_INFINITY,
    };
    this.seed = this.opts.seed;
    this.rng = makeRng(this.seed);
  }

  // ---- content resolvers (internal but used by helper modules) ----

  /** @internal */ skill(id: string): SkillDef | undefined {
    return this.index.skills.get(id);
  }
  /** @internal */ buff(id: string): BuffDef | undefined {
    return this.index.buffs.get(id);
  }
  /** @internal */ npcDef(id: string): NpcDef | undefined {
    return this.index.npcs.get(id);
  }
  /** @internal */ weapon(id: string): WeaponDef | undefined {
    return this.index.weapons.get(id);
  }

  /** @internal */ unit(id: string): Unit | undefined {
    return this.unitMap.get(id);
  }
  /** @internal */ rawUnits(): IterableIterator<Unit> {
    return this.unitMap.values();
  }
  /** @internal */ rngFn(): Rng {
    return this.rng.next;
  }
  /** @internal */ roll(pct: number): boolean {
    return rollChance(this.rng.next, pct);
  }
  /** @internal */ nextInstanceId(): number {
    return this.instanceCounter++;
  }
  /** @internal */ newCastToken(): number {
    return this.castTokenCounter++;
  }
  /** @internal */ emit(e: CombatEvent): void {
    this.events.push(e);
  }
  /** @internal */ markPoints(unit: Unit): void {
    this.pointsDirty.add(unit.id);
  }

  /**
   * Advance the internal clock monotonically and return the effective (never-rewound)
   * `now`. Every entry point that stamps time routes through here so a stray past `now`
   * — e.g. a queued intent that arrives before the room rebases its clock after a
   * restore — can never rewind `nowMs` and defeat the tick guard on the next call.
   */
  private advanceClock(now: number): number {
    this.nowMs = Math.max(now, this.nowMs);
    return this.nowMs;
  }

  /**
   * Pairwise relation. Same faction is always friendly. For cross-faction pairs the
   * content's `factions.hostile` list decides: a pack that declares any hostile pair opts
   * into explicit control (only listed pairs are hostile, every other pairing friendly),
   * while a pack that declares none keeps the v1 default of all cross-faction pairings
   * hostile. This is what makes the `factions.hostile` config actually take effect.
   */
  relation(a: Unit, b: Unit): Relation {
    if (a.faction === b.faction) return "friendly";
    if (this.index.hostilePairs.size === 0) return "hostile";
    return factionsHostile(this.index, a.faction, b.faction) === true ? "hostile" : "friendly";
  }

  // ---- scheduling hooks (called by cast/buffs) ----

  /** @internal */ scheduleCastCommit(unitId: string, token: number, dueAt: number): void {
    this.scheduler.push(dueAt, { k: "castCommit", unitId, token }, 0);
  }
  /** @internal */ scheduleCastApply(unitId: string, token: number, skillId: string, target: TargetRef | undefined, dueAt: number): void {
    this.scheduler.push(dueAt, { k: "castApply", unitId, token, skillId, target }, 0);
  }
  /** @internal */ scheduleChannelTick(unitId: string, token: number, dueAt: number): void {
    this.scheduler.push(dueAt, { k: "channelTick", unitId, token }, TICK_PRI);
  }
  /** @internal */ scheduleChannelEnd(unitId: string, token: number, dueAt: number): void {
    this.scheduler.push(dueAt, { k: "channelEnd", unitId, token }, EXPIRE_PRI);
  }
  /** @internal */ scheduleBuffTick(unitId: string, instanceId: number, dueAt: number): void {
    this.scheduler.push(dueAt, { k: "buffTick", unitId, instanceId }, TICK_PRI);
  }
  /** @internal */ scheduleBuffExpire(unitId: string, instanceId: number, dueAt: number): void {
    this.scheduler.push(dueAt, { k: "buffExpire", unitId, instanceId }, EXPIRE_PRI);
  }
  /** @internal */ scheduleAutoAttack(unitId: string, targetId: string, dueAt: number): void {
    this.scheduler.push(dueAt, { k: "autoAttack", unitId, targetId }, 0);
  }
  /** @internal */ cancelBuffTimers(unitId: string, instanceId: number): void {
    this.scheduler.cancel(
      (t) => (t.k === "buffTick" || t.k === "buffExpire") && t.unitId === unitId && t.instanceId === instanceId,
    );
  }
  /** @internal */ cancelCastTimers(unitId: string, token: number): void {
    this.scheduler.cancel(
      (t) =>
        (t.k === "castCommit" || t.k === "castApply" || t.k === "channelTick" || t.k === "channelEnd") &&
        t.unitId === unitId &&
        t.token === token,
    );
  }

  // ---- combat state ----

  /** @internal */ engageCombat(unit: Unit): void {
    unit.lastCombatAt = this.nowMs;
    if (!unit.inCombat) {
      unit.inCombat = true;
      this.emit({ t: "combatEngaged", unit: unit.id });
    }
  }
  /** @internal */ clearCombat(unit: Unit): void {
    if (unit.inCombat) {
      unit.inCombat = false;
      this.emit({ t: "combatCleared", unit: unit.id });
    }
  }

  // ---- effect primitives (called by the effect executor) ----

  /** @internal */ applyEffect(ctx: ApplyCtx, def: EffectDef, caster: Unit, target: EffectTarget): void {
    applyEffect(this, ctx, def, caster, target);
  }

  /** @internal Full damage pipeline for one landing effect. Returns raw post-mitigation damage. */
  dealDamage(ctx: ApplyCtx, attacker: Unit, target: Unit, def: Extract<EffectDef, { kind: "damage" }>): number {
    if (!target.alive) return 0;
    const school = def.school;

    if (isImmuneSchool(this, target, school)) {
      this.emit({ t: "damaged", source: attacker.id, target: target.id, skillId: ctx.skillId, amount: 0, absorbed: 0, school, hit: "immune" });
      // Symmetric with the miss/dodge path below: a real (non-DoT) immune hit still pulls
      // both sides into combat and seeds the attacker on the NPC's threat table. DoT ticks
      // stay silent so an immune target isn't re-aggroed every interval.
      if (ctx.source !== "buffTick") {
        this.engageCombat(attacker);
        this.engageCombat(target);
        if (target.kind === "npc") this.addAggro(target, attacker.id, "damage", 1);
      }
      return 0;
    }

    // v1: periodic buff ticks (DoT) always land — skip the avoidance roll entirely so a
    // melee DoT can't be dodged/blocked/parried and a tick consumes no RNG draw.
    const avoid =
      ctx.source === "buffTick"
        ? "hit"
        : rollHitType(this.rng.next, attacker, target, school, isFrontalAttack(target, attacker.pos));
    if (avoid !== "hit") {
      this.emit({ t: "damaged", source: attacker.id, target: target.id, skillId: ctx.skillId, amount: 0, absorbed: 0, school, hit: avoid });
      this.engageCombat(attacker);
      this.engageCombat(target);
      if (target.kind === "npc") this.addAggro(target, attacker.id, "damage", 1);
      return 0;
    }

    // v1: periodic buff ticks (DoT) never crit.
    const crit = def.canCrit !== false && ctx.source !== "buffTick" && rollCrit(this.rng.next, attacker, target, school);
    const weapon = attacker.weaponId ? this.weapon(attacker.weaponId) : undefined;
    const pvp = this.opts.pvpEnabled && attacker.kind === "player" && target.kind === "player";
    const raw = computeDamage(this.rng.next, {
      attacker,
      defender: target,
      school,
      crit,
      weapon,
      useWeapon: def.useWeapon ?? false,
      useLevelDamage: def.useLevelDamage ?? false,
      multiplier: def.multiplier ?? 1,
      flat: def.flat ?? 0,
      fixed: def.fixed,
      pvp,
    });

    const { hpDamage, absorbed } = absorbDamage(this, target, raw, ctx.now);
    target.hp = Math.max(0, target.hp - hpDamage);
    const survived = target.hp > 0;

    this.engageCombat(attacker);
    if (survived) this.engageCombat(target);

    if (target.kind === "npc") this.addAggro(target, attacker.id, "damage", raw * (def.aggroMul ?? 1));

    const ls = attacker.stat("lifesteal");
    if (ls > 0 && raw > 0) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + (raw * ls) / 100);
      this.markPoints(attacker);
    }
    const msSteal = attacker.stat("manasteal");
    if (msSteal > 0 && raw > 0) {
      attacker.mp = Math.min(attacker.maxMp, attacker.mp + (raw * msSteal) / 100);
      this.markPoints(attacker);
    }

    fireRemoveOn(this, target, "damaged", ctx.now);
    fireRemoveOn(this, attacker, "attack", ctx.now);

    this.emit({ t: "damaged", source: attacker.id, target: target.id, skillId: ctx.skillId, amount: raw, absorbed, school, hit: crit ? "crit" : "hit" });
    this.markPoints(target);

    this.applyReflect(target, attacker, raw, school, ctx);

    fireTriggers(this, attacker, "attack", { other: target, school }, ctx.now, ctx.depth);
    fireTriggers(this, attacker, "damage", { other: target, school }, ctx.now, ctx.depth);
    fireTriggers(this, target, "damaged", { other: attacker, school }, ctx.now, ctx.depth);

    if (!survived) this.die(target, attacker.id, ctx.now);
    return raw;
  }

  private applyReflect(target: Unit, attacker: Unit, raw: number, school: DamageSchool, ctx: ApplyCtx): void {
    let pct = 0;
    for (const inst of target.buffs) {
      const r = this.buff(inst.buffId)?.reflect;
      if (r && (!r.school || r.school === school)) pct += r.percent;
    }
    if (pct <= 0) return;
    const dmg = Math.floor((raw * pct) / 100);
    if (dmg <= 0 || !attacker.alive) return;
    const { hpDamage, absorbed } = absorbDamage(this, attacker, dmg, ctx.now);
    attacker.hp = Math.max(0, attacker.hp - hpDamage);
    this.emit({ t: "damaged", source: target.id, target: attacker.id, amount: dmg, absorbed, school, hit: "hit" });
    this.markPoints(attacker);
    if (attacker.hp <= 0) this.die(attacker, target.id, ctx.now);
  }

  /** @internal */ applyHeal(ctx: ApplyCtx, healer: Unit, target: Unit, def: Extract<EffectDef, { kind: "heal" }>): void {
    if (!target.alive) return;
    // v1: periodic buff ticks (HoT) never crit.
    const crit = ctx.source !== "buffTick" && rollHealCrit(this.rng.next, healer);
    const amount = computeHeal({ healer, target, crit, multiplier: def.multiplier ?? 1, flat: def.flat ?? 0 });
    if (def.toMana) target.mp = Math.min(target.maxMp, target.mp + amount);
    else target.hp = Math.min(target.maxHp, target.hp + amount);
    this.emit({ t: "healed", source: healer.id, target: target.id, skillId: ctx.skillId, amount, toMana: def.toMana ?? false, crit });
    this.markPoints(target);
    if (amount > 0) {
      for (const u of this.unitMap.values()) {
        if (u.npc && u.alive && u.npc.aggro.has(target.id)) this.addAggro(u, healer.id, "heal", amount);
      }
    }
  }

  /** @internal */ restoreMana(ctx: ApplyCtx, caster: Unit, target: Unit, def: Extract<EffectDef, { kind: "restoreMana" }>): void {
    const amount = (def.flat ?? 0) + (def.multiplier ?? 0) * caster.stat("healPower");
    target.mp = Math.min(target.maxMp, target.mp + amount);
    this.emit({ t: "healed", source: caster.id, target: target.id, skillId: ctx.skillId, amount: Math.floor(amount), toMana: true, crit: false });
    this.markPoints(target);
  }

  /** @internal */ manaBurn(ctx: ApplyCtx, caster: Unit, target: Unit, def: Extract<EffectDef, { kind: "manaBurn" }>): void {
    const want = Math.floor((def.flat ?? 0) + (def.perLevel ?? 0) * caster.level);
    const actual = Math.min(target.mp, want);
    target.mp -= actual;
    this.emit({ t: "manaBurned", source: caster.id, target: target.id, amount: actual });
    this.markPoints(target);
  }

  /** @internal */ applyBuffEffect(ctx: ApplyCtx, caster: Unit, target: Unit, def: Extract<EffectDef, { kind: "buff" }>): void {
    const bd = this.buff(def.buffId);
    if (bd) addBuff(this, target, bd, caster.id, def.abLevel ?? 1, ctx.now);
  }

  /** @internal */ applyDispelEffect(ctx: ApplyCtx, caster: Unit, target: Unit, def: Extract<EffectDef, { kind: "dispel" }>): void {
    dispel(this, target, def.buffKind, def.count, def.tag, ctx.now);
  }

  /** @internal */ applyTaunt(ctx: ApplyCtx, caster: Unit, target: Unit, def: Extract<EffectDef, { kind: "aggro" }>): void {
    if (target.kind !== "npc") return;
    const value = (def.flat ?? 0) + (def.perLevel ?? 0) * caster.level;
    this.addAggro(target, caster.id, "damage", value);
  }

  /** @internal */ applyKnockback(ctx: ApplyCtx, caster: Unit, target: Unit, def: Extract<EffectDef, { kind: "knockback" }>): void {
    if (isKnockbackImmune(this, target)) return;
    let dx: number;
    let dy: number;
    if (def.mode === "radial") {
      dx = target.pos.x - caster.pos.x;
      dy = target.pos.y - caster.pos.y;
    } else {
      dx = Math.cos(caster.facing);
      dy = Math.sin(caster.facing);
    }
    const len = Math.hypot(dx, dy) || 1;
    const from: Vec2 = { x: target.pos.x, y: target.pos.y };
    const to: Vec2 = { x: target.pos.x + (dx / len) * def.distance, y: target.pos.y + (dy / len) * def.distance };
    target.pos = to;
    this.emit({ t: "knockback", unit: target.id, from, to });
  }

  /** @internal */ applyBlink(ctx: ApplyCtx, caster: Unit, pos: Vec2, def: Extract<EffectDef, { kind: "blink" }>): void {
    const dx = pos.x - caster.pos.x;
    const dy = pos.y - caster.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 0) {
      const move = Math.min(def.distance, d);
      caster.pos = { x: caster.pos.x + (dx / d) * move, y: caster.pos.y + (dy / d) * move };
    }
    this.emit({ t: "unitMoved", unit: caster.id, pos: { x: caster.pos.x, y: caster.pos.y }, facing: caster.facing });
  }

  /** @internal */ applyResetCooldown(caster: Unit, def: Extract<EffectDef, { kind: "resetCooldown" }>): void {
    if (def.all) caster.cooldowns.clear();
    else if (def.skillId) caster.cooldowns.delete(def.skillId);
  }

  /** @internal */ applySpawnNpc(ctx: ApplyCtx, caster: Unit, pos: Vec2, def: Extract<EffectDef, { kind: "spawnNpc" }>): void {
    const count = def.count ?? 1;
    const off = def.offset ?? 0;
    for (let i = 0; i < count; i++) {
      const angle = count > 1 ? (i / count) * Math.PI * 2 : 0;
      const p: Vec2 = { x: pos.x + Math.cos(angle) * off, y: pos.y + Math.sin(angle) * off };
      const id = this.spawnNpcInternal(def.npcDefId, p, { home: p, byEffect: true });
      if (id === null) break; // maxUnits reached — stop spawning the rest of the pack
      if (def.lifetimeMs && def.lifetimeMs > 0) this.scheduler.push(ctx.now + def.lifetimeMs, { k: "despawn", unitId: id }, EXPIRE_PRI);
    }
  }

  /** @internal */ applySubSkill(ctx: ApplyCtx, caster: Unit, target: EffectTarget, def: Extract<EffectDef, { kind: "subSkill" }>): void {
    if (ctx.depth >= 3) return;
    const tref: TargetRef | undefined = target.unit ? { unitId: target.unit.id } : { pos: target.pos };
    const delay = def.delayMs ?? 0;
    if (delay <= 0) applySkill(this, caster.id, def.skillId, tref, ctx.now, ctx.depth + 1);
    else this.scheduler.push(ctx.now + delay, { k: "subSkill", unitId: caster.id, skillId: def.skillId, target: tref, depth: ctx.depth + 1 }, 0);
  }

  /** @internal */ applyCustom(ctx: ApplyCtx, caster: Unit, target: EffectTarget, def: Extract<EffectDef, { kind: "custom" }>): void {
    const fn = this.customEffects.get(def.name);
    if (fn) fn(this, ctx, caster, target, def.params);
  }

  /** @internal */ applyBuffId(unit: Unit, buffId: string, casterId: string, abLevel: number, now: number): void {
    const bd = this.buff(buffId);
    if (bd) addBuff(this, unit, bd, casterId, abLevel, now);
  }
  /** @internal */ removeBuffsById(unit: Unit, buffId: string, now: number): void {
    for (const inst of unit.buffs.filter((b) => b.buffId === buffId)) removeBuffInstance(this, unit, inst, "removed", now);
  }
  /** @internal */ toggleBuff(unit: Unit, buffId: string, now: number): void {
    const existing = unit.buffs.filter((b) => b.buffId === buffId);
    if (existing.length > 0) {
      for (const e of existing) removeBuffInstance(this, unit, e, "removed", now);
    } else {
      this.applyBuffId(unit, buffId, unit.id, 1, now);
    }
  }

  /** @internal Add scaled threat to an NPC's aggro table, engaging it (aggro-links on first pull). */
  addAggro(npc: Unit, attackerId: string, kind: "damage" | "heal", value: number, link = true): void {
    if (!npc.npc || !npc.alive) return;
    const attacker = this.unit(attackerId);
    const aggroMul = attacker ? attacker.stat("aggroMul") / 100 : 1;
    const inAggroMul = npc.stat("incomingAggroMul") / 100;
    npc.npc.aggro.add(attackerId, kind, value * aggroMul * inAggroMul);
    this.engageCombat(npc);
    if (npc.npc.fsm === "idle" || npc.npc.fsm === "return") {
      npc.npc.fsm = "combat";
      if (link) this.aggroLink(npc, attackerId);
    }
  }

  private aggroLink(npc: Unit, attackerId: string): void {
    const def = npc.npcDefId ? this.npcDef(npc.npcDefId) : undefined;
    const helpRadius = def?.ai?.helpRadius ?? 0;
    if (helpRadius <= 0) return;
    for (const ally of this.unitMap.values()) {
      if (ally.id === npc.id || !ally.alive || !ally.npc) continue;
      if (ally.faction !== npc.faction) continue;
      if (dist(ally.pos, npc.pos) <= helpRadius && !ally.npc.aggro.has(attackerId)) {
        this.addAggro(ally, attackerId, "damage", 1, false);
      }
    }
  }

  /** @internal */ autoAttackSkillId(unit: Unit): string | undefined {
    const w = unit.weaponId ? this.weapon(unit.weaponId) : undefined;
    const kind = w?.kind;
    if (kind) {
      const match = this.autoSkills.find((s) => s.requiresWeapon === kind || s.requiresWeapon === true || !s.requiresWeapon);
      if (match) return match.id;
    }
    return this.autoSkills[0]?.id;
  }

  // ---- death ----

  /** @internal */ die(unit: Unit, killerId: string | undefined, now: number): void {
    if (!unit.alive) return;
    unit.alive = false;
    unit.hp = 0;
    if (unit.cast) stopCast(this, unit, "dead", now);
    unit.autoAttack = undefined;
    this.scheduler.cancel(
      (t) =>
        (t.k === "castCommit" || t.k === "castApply" || t.k === "channelTick" || t.k === "channelEnd" || t.k === "autoAttack" || t.k === "subSkill") &&
        t.unitId === unit.id,
    );
    this.clearCombat(unit);

    fireTriggers(this, unit, "death", {}, now, 0);
    const killer = killerId ? this.unit(killerId) : undefined;
    if (killer) fireTriggers(this, killer, "kill", { other: unit }, now, 0);

    stripOnDeath(this, unit, now);

    if (killer && unit.kind === "npc") {
      const npcDef = unit.npcDefId ? this.npcDef(unit.npcDefId) : undefined;
      const amount = killExp(killer.level, unit.level, npcDef?.expMultiplier ?? 1);
      if (amount > 0) this.grantXp(killer.id, amount);
    }

    for (const u of this.unitMap.values()) {
      if (u.npc) u.npc.aggro.remove(unit.id);
    }
    if (unit.npc) {
      unit.npc.aggro.clear();
      unit.npc.fsm = "dead";
      unit.npc.targetId = undefined;
    }

    this.emit({ t: "death", unit: unit.id, killer: killerId });
    this.markPoints(unit);
  }

  // ================= public API =================

  /**
   * Spawn a player-controlled unit. Returns `false` without spawning when the `maxUnits`
   * cap (default: unbounded) is already reached, `true` otherwise.
   */
  spawnPlayer(spec: SpawnPlayerSpec): boolean {
    if (this.unitMap.size >= this.opts.maxUnits) return false;
    const primaries = extractPrimaries(spec.stats);
    const unit = new Unit({
      id: spec.id,
      kind: "player",
      faction: spec.faction ?? "players",
      level: spec.level ?? 1,
      primaries,
      overrides: spec.stats,
      pos: spec.pos,
      facing: spec.facing,
      radius: spec.radius,
      weaponId: spec.weapon,
    });
    this.applyWeaponMods(unit);
    unit.fillToMax();
    this.unitMap.set(unit.id, unit);
    return true;
  }

  /**
   * Spawn an NPC and return its id, or `null` without spawning when the `maxUnits` cap
   * (default: unbounded) is already reached.
   */
  spawnNpc(npcDefId: string, pos: Vec2, opts?: { home?: Vec2; facing?: number; id?: string }): string | null {
    return this.spawnNpcInternal(npcDefId, pos, { ...opts, byEffect: false });
  }

  private spawnNpcInternal(
    npcDefId: string,
    pos: Vec2,
    opts: { home?: Vec2; facing?: number; id?: string; byEffect: boolean },
  ): string | null {
    const def = this.npcDef(npcDefId);
    if (!def) throw new Error(`spawnNpc: unknown npcDef "${npcDefId}"`);
    if (this.unitMap.size >= this.opts.maxUnits) return null;
    const id = opts.id ?? `${npcDefId}#${this.npcCounter++}`;
    const primaries = extractPrimaries(def.stats);
    const unit = new Unit({
      id,
      kind: "npc",
      npcDefId,
      faction: def.faction,
      level: def.level,
      primaries,
      overrides: def.stats,
      pos,
      facing: opts.facing,
      radius: def.radius,
      weaponId: def.weapon,
    });
    this.applyWeaponMods(unit);
    const ai: AiProfile | undefined = def.ai;
    unit.npc = {
      home: opts.home ? { x: opts.home.x, y: opts.home.y } : { x: pos.x, y: pos.y },
      moveSpeed: ai?.moveSpeed ?? DEFAULT_MOVE_SPEED,
      fsm: "idle",
      lastSkillAt: 0,
      nextSkillAt: 0,
      aggro: new AggroTable(),
    };
    unit.fillToMax();
    this.unitMap.set(id, unit);
    this.emit({ t: "unitSpawned", unit: id, npcDefId, pos: { x: pos.x, y: pos.y }, byEffect: opts.byEffect });
    return id;
  }

  private applyWeaponMods(unit: Unit): void {
    if (!unit.weaponId) return;
    const w = this.weapon(unit.weaponId);
    if (w?.mods && w.mods.length > 0) unit.mods.set("equip:weapon", w.mods.map((m) => ({ ...m })));
  }

  removeUnit(id: string): void {
    const unit = this.unitMap.get(id);
    if (!unit) return;
    this.scheduler.cancel((t) => t.unitId === id);
    this.unitMap.delete(id);
    for (const u of this.unitMap.values()) {
      if (u.npc) u.npc.aggro.remove(id);
    }
    this.emit({ t: "unitRemoved", unit: id });
  }

  useSkill(casterId: string, skillId: string, target: TargetRef | undefined, now: number): SkillResult {
    now = this.advanceClock(now);
    return runUseSkill(this, casterId, skillId, target, now);
  }

  stopCast(casterId: string, now: number): void {
    now = this.advanceClock(now);
    const unit = this.unit(casterId);
    if (unit?.cast) stopCast(this, unit, "cancelled", now);
  }

  /** @internal Called by buff CC application to interrupt an active cast. */
  interruptCast(unitId: string, reason: "stunned" | "silenced", now: number): void {
    const unit = this.unit(unitId);
    if (!unit?.cast) return;
    if (reason === "silenced") {
      const skill = this.skill(unit.cast.skillId);
      if (skill && skill.school !== "spell" && skill.school !== "heal") return;
    }
    stopCast(this, unit, reason, now);
  }

  startAutoAttack(id: string, targetId: string, now: number): SkillResult {
    now = this.advanceClock(now);
    const unit = this.unit(id);
    if (!unit) return "unknownSkill";
    if (!unit.alive) return "dead";
    const target = this.unit(targetId);
    if (!target) return "noTarget";
    if (this.relation(unit, target) !== "hostile") return "invalidTarget";
    const skillId = this.autoAttackSkillId(unit);
    if (!skillId) return "unknownSkill";
    unit.autoAttack = { targetId };
    this.scheduleAutoAttack(id, targetId, now);
    return "ok";
  }

  stopAutoAttack(id: string): void {
    const unit = this.unit(id);
    if (unit) unit.autoAttack = undefined;
    this.scheduler.cancel((t) => t.k === "autoAttack" && t.unitId === id);
  }

  moveUnit(id: string, pos: Vec2, facing?: number): void {
    const unit = this.unit(id);
    if (!unit) return;
    unit.pos = { x: pos.x, y: pos.y };
    if (facing !== undefined) unit.facing = facing;
    onMoved(this, id, this.nowMs);
    fireRemoveOn(this, unit, "move", this.nowMs);
  }

  setEquipmentModifiers(id: string, key: string, mods: Modifier[] | null): void {
    const unit = this.unit(id);
    if (!unit) return;
    const k = `equip:${key}`;
    if (mods === null) unit.mods.delete(k);
    else unit.mods.set(k, mods.map((m) => ({ ...m })));
    if (unit.hp > unit.maxHp) unit.hp = unit.maxHp;
    if (unit.mp > unit.maxMp) unit.mp = unit.maxMp;
  }

  resurrect(id: string, opts: { hpPct?: number; mpPct?: number; pos?: Vec2 }, now: number): void {
    const unit = this.unit(id);
    if (!unit) return;
    now = this.advanceClock(now);
    unit.alive = true;
    if (unit.npc) unit.npc.fsm = "idle";
    unit.hp = (unit.maxHp * (opts.hpPct ?? 10)) / 100;
    unit.mp = (unit.maxMp * (opts.mpPct ?? 10)) / 100;
    if (opts.pos) unit.pos = { x: opts.pos.x, y: opts.pos.y };
    this.emit({ t: "resurrected", unit: id, hp: Math.round(unit.hp), mp: Math.round(unit.mp) });
    this.markPoints(unit);
  }

  grantXp(id: string, amount: number): void {
    const unit = this.unit(id);
    if (!unit || amount <= 0) return;
    unit.xp += amount;
    this.emit({ t: "xpGained", unit: id, amount });
    const target = levelForXp(this.levelCurve, unit.xp);
    if (target > unit.level) {
      while (unit.level < target) {
        unit.level += 1;
        this.emit({ t: "levelUp", unit: id, level: unit.level });
      }
      unit.recomputeBase(unit.level);
      unit.fillToMax();
      this.markPoints(unit);
    }
  }

  registerCustomEffect(name: string, fn: CustomEffectFn): void {
    this.customEffects.set(name, fn);
  }

  /** Resolve the active crowd-control booleans for a unit from its buff templates. */
  private ccFlags(u: Unit): CcFlags {
    return {
      stunned: isStunned(this, u),
      rooted: isRooted(this, u),
      silenced: isSilenced(this, u),
      sleeping: isSleeping(this, u),
    };
  }

  getUnit(id: string): UnitView | undefined {
    const u = this.unitMap.get(id);
    return u ? u.view(this.ccFlags(u)) : undefined;
  }

  *units(): IterableIterator<UnitView> {
    for (const u of this.unitMap.values()) yield u.view(this.ccFlags(u));
  }

  /**
   * Advance the world to absolute time `now`: drain due timers (casts, buff ticks,
   * projectile applies, auto-attacks), step NPC AI, run regen, and clear timed-out combat
   * state. Returns every buffered event since the last tick (including those from
   * interleaved `useSkill`/`moveUnit` calls); `unitPoints` is coalesced to one per unit.
   */
  tick(now: number): CombatEvent[] {
    // Never let the internal clock run backwards. A room whose `currentTick` restarts
    // at 0 after a cold start (see README) would otherwise feed a `now` behind the
    // restored snapshot's `nowMs` and freeze every timer; the shared clamp keeps time
    // monotonic across every entry point, not just this one.
    now = this.advanceClock(now);
    if (!this.clockStarted) {
      this.clockStarted = true;
      this.lastAiAt = now;
      this.lastRegenAt = now;
    }

    this.drainTimers(now);
    this.stepAllAi(now);
    this.runRegen(now);
    this.runCombatTimeout(now);

    return this.flush();
  }

  private drainTimers(now: number): void {
    let guard = 0;
    for (;;) {
      const due = this.scheduler.nextDueAt();
      if (due === undefined || due > now) break;
      const t = this.scheduler.popMin()!;
      this.processTimer(t, now);
      if (++guard > 100000) break;
    }
  }

  private processTimer(t: RpgTimer, now: number): void {
    switch (t.k) {
      case "castCommit":
        onCastCommit(this, t.unitId, t.token, now);
        return;
      case "castApply":
        applySkill(this, t.unitId, t.skillId, t.target, now, 0);
        return;
      case "channelTick":
        onChannelTick(this, t.unitId, t.token, now);
        return;
      case "channelEnd":
        onChannelEnd(this, t.unitId, t.token, now);
        return;
      case "buffTick": {
        const u = this.unit(t.unitId);
        if (u) tickBuff(this, u, t.instanceId, now);
        return;
      }
      case "buffExpire": {
        const u = this.unit(t.unitId);
        if (u) expireBuff(this, u, t.instanceId, now);
        return;
      }
      case "autoAttack":
        onAutoAttack(this, t.unitId, t.targetId, now);
        return;
      case "subSkill":
        applySkill(this, t.unitId, t.skillId, t.target, now, t.depth);
        return;
      case "despawn":
        this.removeUnit(t.unitId);
        return;
    }
  }

  private stepAllAi(now: number): void {
    if (now - this.lastAiAt < this.opts.aiIntervalMs) return;
    const dt = now - this.lastAiAt;
    this.lastAiAt = now;
    // Snapshot the unit list first: a summon effect fired inside stepAi inserts a new unit
    // into unitMap mid-iteration, which would otherwise let a just-spawned NPC act this
    // same tick (or perturb iteration order).
    for (const u of [...this.unitMap.values()]) {
      if (u.npc && u.alive) stepAi(this, u, now, dt);
    }
  }

  private runRegen(now: number): void {
    let guard = 0;
    while (now - this.lastRegenAt >= this.opts.regenIntervalMs && guard < 1000) {
      this.lastRegenAt += this.opts.regenIntervalMs;
      guard++;
      for (const u of this.unitMap.values()) {
        if (!u.alive) continue;
        const mh = u.maxHp;
        const mm = u.maxMp;
        if (u.hp < mh) {
          u.hp = Math.min(mh, u.hp + u.stat(u.inCombat ? "combatHpRegen" : "hpRegen"));
          this.markPoints(u);
        }
        if (u.mp < mm) {
          const inPostCast = now < u.postCastUntil;
          u.mp = Math.min(mm, u.mp + u.stat(inPostCast ? "postCastMpRegen" : "mpRegen"));
          this.markPoints(u);
        }
      }
    }
  }

  private runCombatTimeout(now: number): void {
    for (const u of this.unitMap.values()) {
      if (u.inCombat && now - u.lastCombatAt >= this.opts.combatTimeoutMs) this.clearCombat(u);
    }
  }

  private flush(): CombatEvent[] {
    for (const id of this.pointsDirty) {
      const u = this.unitMap.get(id);
      if (u) this.emit({ t: "unitPoints", unit: id, hp: Math.round(u.hp), mp: Math.round(u.mp) });
    }
    this.pointsDirty.clear();
    const out = this.events;
    this.events = [];
    return out;
  }

  // ================= serialize / restore =================

  serialize(): RpgSnapshot {
    const units: UnitSnapshot[] = [];
    for (const u of this.unitMap.values()) {
      units.push({
        id: u.id,
        kind: u.kind,
        npcDefId: u.npcDefId,
        faction: u.faction,
        level: u.level,
        xp: u.xp,
        pos: { x: u.pos.x, y: u.pos.y },
        facing: u.facing,
        radius: u.radius,
        primaries: { ...u.primaries },
        overrides: { ...u.overrides },
        hp: u.hp,
        mp: u.mp,
        alive: u.alive,
        inCombat: u.inCombat,
        lastCombatAt: u.lastCombatAt,
        postCastUntil: u.postCastUntil,
        cast: u.cast ? { ...u.cast } : undefined,
        cooldowns: [...u.cooldowns.entries()],
        lastSkillUseAt: u.lastSkillUseAt,
        gcdUntil: u.gcdUntil,
        buffs: u.buffs.map((b) => ({ ...b })),
        weaponId: u.weaponId,
        autoAttack: u.autoAttack ? { ...u.autoAttack } : undefined,
        mods: [...u.mods.entries()].map(([k, v]) => [k, v.map((m) => ({ ...m }))]),
        tolerance: [...u.tolerance.entries()].map(([k, v]) => [k, { ...v }]),
        procGuard: [...u.procGuard.entries()],
        npc: u.npc
          ? {
              home: { x: u.npc.home.x, y: u.npc.home.y },
              moveSpeed: u.npc.moveSpeed,
              fsm: u.npc.fsm,
              targetId: u.npc.targetId,
              lastSkillAt: u.npc.lastSkillAt,
              nextSkillAt: u.npc.nextSkillAt,
              aggro: u.npc.aggro.entries(),
            }
          : undefined,
      });
    }
    return {
      version: 1,
      seed: this.seed,
      opts: {
        combatTimeoutMs: this.opts.combatTimeoutMs,
        aiIntervalMs: this.opts.aiIntervalMs,
        regenIntervalMs: this.opts.regenIntervalMs,
        pvpEnabled: this.opts.pvpEnabled,
        maxUnits: Number.isFinite(this.opts.maxUnits) ? this.opts.maxUnits : null,
      },
      rngAdvance: this.rng.count(),
      nowMs: this.nowMs,
      clockStarted: this.clockStarted,
      lastAiAt: this.lastAiAt,
      lastRegenAt: this.lastRegenAt,
      instanceCounter: this.instanceCounter,
      castTokenCounter: this.castTokenCounter,
      npcCounter: this.npcCounter,
      units,
      timers: this.scheduler.snapshot(),
    };
  }

  /**
   * Rebuild an engine from a snapshot; subsequent identical calls produce identical output.
   * The snapshot's captured options are the baseline (so eviction can't silently revert the
   * rules); an explicit `opts` overrides them field-by-field. `seed` always comes from the
   * snapshot — the persisted RNG position is only meaningful against it.
   */
  static restore(content: ContentPack, snap: RpgSnapshot, opts?: RpgEngineOptions): RpgEngine {
    const engine = new RpgEngine(content, { ...restoreOptions(snap), ...opts, seed: snap.seed });
    engine.rng = makeRng(snap.seed, snap.rngAdvance);
    engine.nowMs = snap.nowMs;
    engine.clockStarted = snap.clockStarted;
    engine.lastAiAt = snap.lastAiAt;
    engine.lastRegenAt = snap.lastRegenAt;
    engine.instanceCounter = snap.instanceCounter;
    engine.castTokenCounter = snap.castTokenCounter;
    engine.npcCounter = snap.npcCounter;
    engine.scheduler = TimerHeap.restore(snap.timers);

    for (const s of snap.units) {
      const unit = new Unit({
        id: s.id,
        kind: s.kind,
        npcDefId: s.npcDefId,
        faction: s.faction,
        level: s.level,
        primaries: s.primaries,
        overrides: s.overrides,
        pos: s.pos,
        facing: s.facing,
        radius: s.radius,
        weaponId: s.weaponId,
        xp: s.xp,
      });
      unit.hp = s.hp;
      unit.mp = s.mp;
      unit.alive = s.alive;
      unit.inCombat = s.inCombat;
      unit.lastCombatAt = s.lastCombatAt;
      unit.postCastUntil = s.postCastUntil;
      unit.cast = s.cast ? { ...s.cast } : undefined;
      unit.cooldowns = new Map(s.cooldowns);
      unit.lastSkillUseAt = s.lastSkillUseAt;
      unit.gcdUntil = s.gcdUntil;
      unit.buffs = s.buffs.map((b) => ({ ...b }));
      unit.autoAttack = s.autoAttack ? { ...s.autoAttack } : undefined;
      unit.mods = new Map(s.mods.map(([k, v]) => [k, v.map((m) => ({ ...m }))]));
      unit.tolerance = new Map(s.tolerance.map(([k, v]) => [k, { ...v }]));
      unit.procGuard = new Map(s.procGuard);
      if (s.npc) {
        unit.npc = {
          home: { x: s.npc.home.x, y: s.npc.home.y },
          moveSpeed: s.npc.moveSpeed,
          fsm: s.npc.fsm,
          targetId: s.npc.targetId,
          lastSkillAt: s.npc.lastSkillAt,
          nextSkillAt: s.npc.nextSkillAt,
          aggro: AggroTable.from(s.npc.aggro),
        };
      }
      engine.unitMap.set(unit.id, unit);
    }
    return engine;
  }
}
