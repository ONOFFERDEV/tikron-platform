/**
 * @tikron/rpg — isomorphic, deterministic RPG combat core for Tikron. Data-driven skills,
 * buffs, effects, stats, and combat math as pure reducers plus a single timer-heap-driven
 * {@link RpgEngine}. No timers, no `Date.now`, no `Math.random`, no DOM/Workers globals:
 * time is the `now` you pass into every entry point and randomness is one seeded stream,
 * so the same seed and the same call sequence always produce the same event stream.
 *
 * A Tikron room owns one engine, feeds it intents, and broadcasts what {@link
 * RpgEngine.tick} returns. See the package README for the room loop contract.
 */

// Engine (public driver)
export {
  RpgEngine,
  type RpgEngineOptions,
  type SpawnPlayerSpec,
  type RpgSnapshot,
} from "./engine.js";

// Content model
export type {
  ContentPack,
  ContentIndex,
  SkillDef,
  SkillEffectBinding,
  EffectDef,
  ChannelDef,
  AoeDef,
  BuffDef,
  BuffTickDef,
  BuffCcDef,
  BuffImmunityDef,
  BuffRemoveOnDef,
  BuffTrigger,
  BuffToleranceDef,
  WeaponDef,
  NpcDef,
  NpcSkillSlot,
  AiProfile,
  TargetRelation,
} from "./content.js";
export { validateContent, indexContent, factionsHostile } from "./content.js";

// Events
export type { CombatEvent, HitType, TargetRef } from "./events.js";

// Stats
export type { StatKey, DamageSchool, Modifier, ModifierSet, Primaries } from "./stats.js";
export { computeStat, StatSheet, defaultDerived, resolveBaseStats, DEFAULT_PRIMARIES } from "./stats.js";

// Combat math
export type { StatProvider, DamageInput, HealInput } from "./combat.js";
export {
  rollHitType,
  rollCrit,
  rollHealCrit,
  computeDamage,
  computeHeal,
  schoolDamageMulKey,
  LEVEL_DPS_FACTOR,
  ARMOR_HALF,
} from "./combat.js";

// RNG
export type { Rng, SeededRng } from "./rng.js";
export { makeRng, rollChance, rollRange, pickWeighted } from "./rng.js";

// Scheduler
export { TimerHeap } from "./scheduler.js";
export type { TimerNode, TimerHeapSnapshot } from "./scheduler.js";

// Aggro
export { AggroTable, HEAL_THREAT_WEIGHT } from "./aggro.js";
export type { AggroEntry } from "./aggro.js";

// XP
export { killExp, levelForXp, defaultLevelCurve, DEFAULT_KILL_EXP_PER_LEVEL, DEFAULT_MAX_LEVEL } from "./xp.js";

// Unit
export { Unit } from "./unit.js";
export type { UnitView, CcFlags, BuffView, BuffInstance, CastState, CastPhase, NpcState, AiFsmState, UnitInit } from "./unit.js";

// Buff CC / immunity predicates (buffId-agnostic queries over a unit's active buffs)
export {
  isStunned,
  isRooted,
  isSilenced,
  isDisarmed,
  isSleeping,
  isImmuneSchool,
  isKnockbackImmune,
  hasBuffTag,
} from "./buffs.js";

// Effects
export { applyEffect } from "./effects.js";
export type { ApplyCtx, EffectTarget, CustomEffectFn } from "./effects.js";

// Cast
export type { SkillResult } from "./cast.js";

// Targeting
export { gatherAoe, resolveInitialTarget, inAoe } from "./targeting.js";
export type { Relation, InitialTarget, GatherParams } from "./targeting.js";

// Sample content pack
export { sampleContent } from "./sample-content.js";
