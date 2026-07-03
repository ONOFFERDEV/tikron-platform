/**
 * Stat model — the shared attribute vocabulary plus AAEmu-order stat summation.
 *
 * A unit's effective stat is `base + Σflat`, then `+= running * Σpercent/100`
 * (flat before percent, percents summed then applied once). Modifiers are keyed by
 * source (a buff instance id or an equipment key) so removal is source-scoped and
 * idempotent — dropping a source can never leave a dangling bonus. Pure and
 * timer-free; the numbers here are the only thing combat math reads.
 */

/** Damage school — selects which offense/defense stats and gates apply. */
export type DamageSchool = "melee" | "ranged" | "spell";

/**
 * The full stat key space. Additive stats default to 0; the `*Mul` multiplier
 * stats are percentages where 100 is neutral (combat divides them by 100).
 */
export type StatKey =
  // primary
  | "str" | "dex" | "sta" | "int" | "spi"
  // pools & regen
  | "maxHp" | "maxMp" | "hpRegen" | "mpRegen" | "combatHpRegen" | "postCastMpRegen"
  // offense (per school + heal)
  | "meleeDps" | "rangedDps" | "spellDps" | "healPower"
  | "meleeCrit" | "rangedCrit" | "spellCrit" | "healCrit"
  | "meleeCritBonus" | "rangedCritBonus" | "spellCritBonus" | "healCritBonus"
  | "meleeAccuracy" | "rangedAccuracy" | "spellAccuracy"
  // defense
  | "armor" | "magicResist" | "dodge" | "block" | "parry"
  | "flexibility" | "battleResist" | "bullsEye"
  | "armorPen" | "magicPen"
  // multipliers (100 = neutral)
  | "meleeDamageMul" | "rangedDamageMul" | "spellDamageMul" | "healMul"
  | "incomingMeleeDamageMul" | "incomingRangedDamageMul" | "incomingSpellDamageMul"
  | "incomingDamageMul" | "incomingHealMul"
  | "moveSpeedMul" | "castTimeMul" | "gcdMul" | "cooldownMul"
  | "aggroMul" | "incomingAggroMul" | "lifesteal" | "manasteal";

/** A single stat delta: `flat` adds to base, `percent` scales the running total. */
export interface Modifier {
  stat: StatKey;
  kind: "flat" | "percent";
  value: number;
}

/**
 * Source-keyed modifier collection (mirrors AAEmu's bonus Index). The key is a buff
 * instance id (stringified) or an equipment slot key; removing a key removes exactly
 * that source's contribution.
 */
export type ModifierSet = Map<string, Modifier[]>;

/**
 * Effective stat value: `v = base + Σflat`, then `v += v * Σpercent/100`. Percents
 * from every source are summed and applied once to the flat-adjusted total (AAEmu
 * order; static/dynamic bonuses collapsed — no dynamic bonuses in v1).
 */
export function computeStat(base: number, stat: StatKey, sets: ModifierSet): number {
  let flat = 0;
  let percent = 0;
  for (const mods of sets.values()) {
    for (const m of mods) {
      if (m.stat !== stat) continue;
      if (m.kind === "flat") flat += m.value;
      else percent += m.value;
    }
  }
  let v = base + flat;
  v += (v * percent) / 100;
  return v;
}

/** A resolved base map plus its live modifier set; `get` returns the effective value. */
export class StatSheet {
  constructor(
    readonly base: Map<StatKey, number>,
    readonly mods: ModifierSet,
  ) {}

  get(stat: StatKey): number {
    return computeStat(this.base.get(stat) ?? 0, stat, this.mods);
  }
}

/** Primary attributes; the derived defaults are computed from these plus level. */
export interface Primaries {
  str: number;
  dex: number;
  sta: number;
  int: number;
  spi: number;
}

export const DEFAULT_PRIMARIES: Primaries = { str: 10, dex: 10, sta: 10, int: 10, spi: 10 };

/** All multiplier stats that must default to 100 (neutral) rather than 0. */
const MUL_KEYS: readonly StatKey[] = [
  "meleeDamageMul", "rangedDamageMul", "spellDamageMul", "healMul",
  "incomingMeleeDamageMul", "incomingRangedDamageMul", "incomingSpellDamageMul",
  "incomingDamageMul", "incomingHealMul",
  "moveSpeedMul", "castTimeMul", "gcdMul", "cooldownMul",
  "aggroMul", "incomingAggroMul",
];

/**
 * Derived base stats from primaries + level (simplified AAEmu formulas). Defined ONCE
 * here; per-spawn explicit stat overrides win over these. Returns a COMPLETE map —
 * every {@link StatKey} is present so combat never reads an unintended 0 for a
 * neutral-100 multiplier.
 */
export function defaultDerived(level: number, p: Primaries): Map<StatKey, number> {
  const hpRegen = 5 + p.spi * 0.5;
  const mpRegen = 3 + p.spi * 0.8;
  const m = new Map<StatKey, number>();

  // multipliers neutral by default
  for (const k of MUL_KEYS) m.set(k, 100);

  // primaries
  m.set("str", p.str);
  m.set("dex", p.dex);
  m.set("sta", p.sta);
  m.set("int", p.int);
  m.set("spi", p.spi);

  // pools & regen
  m.set("maxHp", 100 + p.sta * 10 + level * 20);
  m.set("maxMp", 50 + p.spi * 10 + p.int * 5 + level * 10);
  m.set("hpRegen", hpRegen);
  m.set("combatHpRegen", hpRegen / 5);
  m.set("mpRegen", mpRegen);
  m.set("postCastMpRegen", mpRegen / 5);

  // offense
  m.set("meleeDps", p.str * 1.0);
  m.set("rangedDps", p.dex * 1.0);
  m.set("spellDps", p.int * 1.0);
  m.set("healPower", p.spi * 1.0);
  m.set("meleeCrit", p.dex * 0.1);
  m.set("rangedCrit", p.dex * 0.1);
  m.set("spellCrit", p.int * 0.1);
  m.set("healCrit", p.spi * 0.1);
  // Crit bonus is +% crit damage, not a neutral multiplier: default 50 → crit ×1.5.
  m.set("meleeCritBonus", 50);
  m.set("rangedCritBonus", 50);
  m.set("spellCritBonus", 50);
  m.set("healCritBonus", 50);
  m.set("meleeAccuracy", 100);
  m.set("rangedAccuracy", 100);
  m.set("spellAccuracy", 100);

  // defense
  m.set("armor", 0);
  m.set("magicResist", 0);
  m.set("dodge", p.dex * 0.1);
  m.set("block", 0);
  m.set("parry", 0);
  m.set("flexibility", 0);
  m.set("battleResist", 0);
  m.set("bullsEye", 0);
  m.set("armorPen", 0);
  m.set("magicPen", 0);

  // steal
  m.set("lifesteal", 0);
  m.set("manasteal", 0);

  return m;
}

/**
 * Resolve the immutable base stat map for a spawn: derived defaults from primaries +
 * level, then explicit overrides layered on top (overrides win). Level-up and NPC
 * spawns both route through here so the base is always reproducible.
 */
export function resolveBaseStats(
  level: number,
  primaries: Primaries,
  overrides?: Partial<Record<StatKey, number>>,
): Map<StatKey, number> {
  const base = defaultDerived(level, primaries);
  if (overrides) {
    for (const k of Object.keys(overrides) as StatKey[]) {
      const v = overrides[k];
      if (v !== undefined) base.set(k, v);
    }
  }
  return base;
}
