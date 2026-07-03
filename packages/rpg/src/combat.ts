/**
 * Combat math — pure, faithful ports of the AAEmu hardcoded constants (no formula
 * engine). Two-stage hit resolution (avoidance dice, then an independent crit re-roll)
 * and the damage/heal pipelines live here as standalone functions over a minimal
 * {@link StatProvider}, so they unit-test without an engine or timers.
 *
 * Constants reproduced verbatim: armor curve `armor/(armor+5300)`, flexibility
 * `flex/1000*3` (crit chance) and `flex/100` (crit damage), PvP toughness
 * `br/(8000+br)`, bulls-eye `be/1000*3/100`. Block and parry FULLY negate — games that
 * dislike that simply leave those stats at 0.
 */

import type { HitType } from "./events.js";
import type { Rng } from "./rng.js";
import type { DamageSchool, StatKey } from "./stats.js";
import type { WeaponDef } from "./content.js";

/** The read surface combat needs from a unit — its level and effective stats. */
export interface StatProvider {
  level: number;
  stat(key: StatKey): number;
}

const dpsKey: Record<DamageSchool, StatKey> = {
  melee: "meleeDps",
  ranged: "rangedDps",
  spell: "spellDps",
};
const critKey: Record<DamageSchool, StatKey> = {
  melee: "meleeCrit",
  ranged: "rangedCrit",
  spell: "spellCrit",
};
const critBonusKey: Record<DamageSchool, StatKey> = {
  melee: "meleeCritBonus",
  ranged: "rangedCritBonus",
  spell: "spellCritBonus",
};
const accuracyKey: Record<DamageSchool, StatKey> = {
  melee: "meleeAccuracy",
  ranged: "rangedAccuracy",
  spell: "spellAccuracy",
};
const damageMulKey: Record<DamageSchool, StatKey> = {
  melee: "meleeDamageMul",
  ranged: "rangedDamageMul",
  spell: "spellDamageMul",
};
const incomingMulKey: Record<DamageSchool, StatKey> = {
  melee: "incomingMeleeDamageMul",
  ranged: "incomingRangedDamageMul",
  spell: "incomingSpellDamageMul",
};

/** Default per-level damage contribution when `useLevelDamage` is set. */
export const LEVEL_DPS_FACTOR = 1.5;
/** Armor mitigation half-point: at this armor value damage is halved. */
export const ARMOR_HALF = 5300;

/**
 * Stage one of hit resolution: the defender avoidance dice, attacker accuracy last.
 * Returns one of `dodge | block | parry | miss | hit` (never `crit`/`immune` — crit is
 * {@link rollCrit} and immunity is checked by the buff layer before this runs).
 *
 * Backstab (`!isFrontal`) skips all avoidance; the `spell` school skips dodge/block/
 * parry (magic → hit/miss only). Each defender rate is reduced by the attacker's
 * bulls-eye `be/1000*3/100`. Accuracy is attacker-only (no accuracy-vs-evasion
 * contest). Draw budget is fixed per `(isFrontal, school)` so downstream rolls align.
 */
export function rollHitType(
  rng: Rng,
  attacker: StatProvider,
  defender: StatProvider,
  school: DamageSchool,
  isFrontal: boolean,
): Exclude<HitType, "crit" | "immune"> {
  const bullsEyeMod = (attacker.stat("bullsEye") / 1000) * 3 / 100;
  if (isFrontal && school !== "spell") {
    if (rng() * 100 < defender.stat("dodge") - bullsEyeMod) return "dodge";
    if (rng() * 100 < defender.stat("block") - bullsEyeMod) return "block";
    if (rng() * 100 < defender.stat("parry") - bullsEyeMod) return "parry";
  }
  const acc = attacker.stat(accuracyKey[school]);
  return rng() * 100 < acc ? "hit" : "miss";
}

/**
 * Stage two: independent crit roll `rand(0,100) < crit − flexibility/1000*3`. Only
 * meaningful when {@link rollHitType} returned `hit`.
 */
export function rollCrit(
  rng: Rng,
  attacker: StatProvider,
  defender: StatProvider,
  school: DamageSchool,
): boolean {
  const flexMod = (defender.stat("flexibility") / 1000) * 3;
  return rng() * 100 < attacker.stat(critKey[school]) - flexMod;
}

/** Inputs to {@link computeDamage} — the resolved hit and the effect's damage shape. */
export interface DamageInput {
  attacker: StatProvider;
  defender: StatProvider;
  school: DamageSchool;
  /** Avoidance already resolved to a landing hit; crit toggles the crit multiplier. */
  crit: boolean;
  weapon?: WeaponDef;
  useWeapon: boolean;
  useLevelDamage: boolean;
  multiplier: number;
  flat: number;
  fixed?: { min: number; max: number };
  pvp: boolean;
}

/**
 * Post-mitigation damage integer for one landing hit (pre-shield; the buff layer then
 * consumes shields/mana-shield and reduces hp). Order: weapon-roll + dps stat + level
 * term → ×multiplier + flat (or `fixed` override) → crit → PvP toughness → armor/resist
 * mitigation → incoming-school × incoming-all multipliers → floor at ≥ 0.
 */
export function computeDamage(rng: Rng, input: DamageInput): number {
  const { attacker, defender, school } = input;

  let base: number;
  if (input.fixed) {
    base = rollRangeLocal(rng, input.fixed.min, input.fixed.max);
    base = base * input.multiplier + input.flat;
  } else {
    let raw = 0;
    if (input.useWeapon && input.weapon) {
      const w = input.weapon;
      const spread = (w.damageScalePct ?? 25) / 100;
      const mid = (w.dps * w.speedMs) / 1000;
      raw += rollRangeLocal(rng, mid * (1 - spread), mid * (1 + spread));
    }
    raw += attacker.stat(dpsKey[school]);
    if (input.useLevelDamage) raw += attacker.level * LEVEL_DPS_FACTOR;
    base = raw * input.multiplier + input.flat;
  }

  if (input.crit) {
    const critBonus = attacker.stat(critBonusKey[school]);
    base *= 1 + (critBonus - defender.stat("flexibility") / 100) / 100;
  }

  if (input.pvp) {
    const br = defender.stat("battleResist");
    base *= 1 - br / (8000 + br);
  }

  const pen = school === "spell" ? attacker.stat("magicPen") : attacker.stat("armorPen");
  const armorRaw = school === "spell" ? defender.stat("magicResist") : defender.stat("armor");
  const armorEff = Math.max(0, armorRaw - pen);
  base *= 1 - armorEff / (armorEff + ARMOR_HALF);

  base *= defender.stat(incomingMulKey[school]) / 100;
  base *= defender.stat("incomingDamageMul") / 100;

  return Math.max(0, Math.floor(base));
}

/** Inputs to {@link computeHeal}. */
export interface HealInput {
  healer: StatProvider;
  target: StatProvider;
  crit: boolean;
  multiplier: number;
  flat: number;
}

/**
 * Heal amount integer. No hit roll or armor: `healPower*mult + flat`, ×(1 +
 * healCritBonus/100) on crit (default bonus 50 → ×1.5, no flexibility), then
 * ×healMul/100 ×incomingHealMul/100.
 */
export function computeHeal(input: HealInput): number {
  const { healer, target } = input;
  let base = healer.stat("healPower") * input.multiplier + input.flat;
  if (input.crit) base *= 1 + healer.stat("healCritBonus") / 100;
  base *= healer.stat("healMul") / 100;
  base *= target.stat("incomingHealMul") / 100;
  return Math.max(0, Math.floor(base));
}

/** Independent heal crit roll `rand(0,100) < healCrit` (no flexibility term). */
export function rollHealCrit(rng: Rng, healer: StatProvider): boolean {
  return rng() * 100 < healer.stat("healCrit");
}

// Local copy so combat has no import cycle back through rng helpers it does not need.
function rollRangeLocal(rng: Rng, min: number, max: number): number {
  if (min >= max) return min;
  return min + rng() * (max - min);
}

/** Damage-multiplier stat key for a school — exposed for aggro/effect scaling. */
export function schoolDamageMulKey(school: DamageSchool): StatKey {
  return damageMulKey[school];
}
