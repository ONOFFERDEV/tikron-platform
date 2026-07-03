import { describe, expect, it } from "vitest";
import {
  computeDamage,
  computeHeal,
  rollCrit,
  rollHealCrit,
  rollHitType,
  type StatProvider,
} from "./combat.js";
import { makeRng } from "./rng.js";
import type { StatKey } from "./stats.js";

/** A stat provider with neutral-100 multiplier defaults, overridable per key. */
function sp(level: number, s: Partial<Record<StatKey, number>> = {}): StatProvider {
  const defaults: Partial<Record<StatKey, number>> = {
    meleeAccuracy: 100,
    rangedAccuracy: 100,
    spellAccuracy: 100,
    meleeCritBonus: 50,
    rangedCritBonus: 50,
    spellCritBonus: 50,
    healCritBonus: 50,
    meleeDamageMul: 100,
    rangedDamageMul: 100,
    spellDamageMul: 100,
    healMul: 100,
    incomingMeleeDamageMul: 100,
    incomingRangedDamageMul: 100,
    incomingSpellDamageMul: 100,
    incomingDamageMul: 100,
    incomingHealMul: 100,
  };
  return { level, stat: (k) => s[k] ?? defaults[k] ?? 0 };
}

const rng = () => makeRng(12345).next;

describe("armor mitigation curve", () => {
  const base = { school: "melee" as const, crit: false, useWeapon: false, useLevelDamage: false, multiplier: 1, flat: 0, fixed: { min: 1000, max: 1000 }, pvp: false };

  it("halves damage at armor 5300", () => {
    const dmg = computeDamage(rng(), { attacker: sp(1), defender: sp(1, { armor: 5300 }), ...base });
    expect(dmg).toBe(500);
  });

  it("does nothing at armor 0", () => {
    const dmg = computeDamage(rng(), { attacker: sp(1), defender: sp(1, { armor: 0 }), ...base });
    expect(dmg).toBe(1000);
  });

  it("armor penetration cancels armor", () => {
    const dmg = computeDamage(rng(), { attacker: sp(1, { armorPen: 5300 }), defender: sp(1, { armor: 5300 }), ...base });
    expect(dmg).toBe(1000);
  });

  it("spell uses magicResist not armor", () => {
    const spellBase = { ...base, school: "spell" as const };
    const armored = computeDamage(rng(), { attacker: sp(1), defender: sp(1, { armor: 5300 }), ...spellBase });
    const resisted = computeDamage(rng(), { attacker: sp(1), defender: sp(1, { magicResist: 5300 }), ...spellBase });
    expect(armored).toBe(1000);
    expect(resisted).toBe(500);
  });
});

describe("hit resolution", () => {
  it("frontal dodge triggers", () => {
    expect(rollHitType(rng(), sp(1), sp(1, { dodge: 100 }), "melee", true)).toBe("dodge");
  });

  it("backstab skips dodge/block/parry", () => {
    expect(rollHitType(rng(), sp(1), sp(1, { dodge: 100, block: 100, parry: 100 }), "melee", false)).toBe("hit");
  });

  it("spell school ignores dodge/block/parry", () => {
    expect(rollHitType(rng(), sp(1), sp(1, { dodge: 100, block: 100, parry: 100 }), "spell", true)).toBe("hit");
  });

  it("block wins before parry", () => {
    expect(rollHitType(rng(), sp(1), sp(1, { block: 100, parry: 100 }), "melee", true)).toBe("block");
  });

  it("parry when block absent", () => {
    expect(rollHitType(rng(), sp(1), sp(1, { block: 0, parry: 100 }), "melee", true)).toBe("parry");
  });

  it("zero accuracy always misses", () => {
    expect(rollHitType(rng(), sp(1, { meleeAccuracy: 0 }), sp(1), "melee", true)).toBe("miss");
  });

  it("full accuracy always hits", () => {
    expect(rollHitType(rng(), sp(1), sp(1), "melee", true)).toBe("hit");
  });

  it("bulls-eye reduces defender avoidance rate", () => {
    // dodge 0.1% is below bulls-eye offset, so the roll cannot dodge.
    const hit = rollHitType(rng(), sp(1, { bullsEye: 1000 }), sp(1, { dodge: 0.1 }), "melee", true);
    expect(hit).toBe("hit");
  });
});

describe("crit", () => {
  const base = { school: "melee" as const, useWeapon: false, useLevelDamage: false, multiplier: 1, flat: 0, fixed: { min: 1000, max: 1000 }, pvp: false };

  it("applies critBonus with no flexibility", () => {
    const dmg = computeDamage(rng(), { attacker: sp(1, { meleeCritBonus: 50 }), defender: sp(1), crit: true, ...base });
    expect(dmg).toBe(1500);
  });

  it("flexibility shaves crit damage", () => {
    const dmg = computeDamage(rng(), { attacker: sp(1, { meleeCritBonus: 50 }), defender: sp(1, { flexibility: 100 }), crit: true, ...base });
    expect(dmg).toBe(1490);
  });

  it("rollCrit deterministic under seed", () => {
    const a = rollCrit(makeRng(7).next, sp(1, { meleeCrit: 50 }), sp(1), "melee");
    const b = rollCrit(makeRng(7).next, sp(1, { meleeCrit: 50 }), sp(1), "melee");
    expect(a).toBe(b);
  });

  it("100% crit chance always crits, 0% never", () => {
    expect(rollCrit(rng(), sp(1, { meleeCrit: 100 }), sp(1), "melee")).toBe(true);
    expect(rollCrit(rng(), sp(1, { meleeCrit: 0 }), sp(1), "melee")).toBe(false);
  });
});

describe("PvP toughness", () => {
  it("battleResist reduces damage", () => {
    const base = { school: "melee" as const, crit: false, useWeapon: false, useLevelDamage: false, multiplier: 1, flat: 0, fixed: { min: 1000, max: 1000 } };
    const pvp = computeDamage(rng(), { attacker: sp(1), defender: sp(1, { battleResist: 8000 }), pvp: true, ...base });
    const pve = computeDamage(rng(), { attacker: sp(1), defender: sp(1, { battleResist: 8000 }), pvp: false, ...base });
    expect(pvp).toBe(500);
    expect(pve).toBe(1000);
  });
});

describe("damage composition", () => {
  const base = { school: "melee" as const, crit: false, pvp: false };

  it("weapon roll with zero spread is exact", () => {
    const weapon = { id: "w", kind: "melee" as const, dps: 100, speedMs: 1000, damageScalePct: 0 };
    const dmg = computeDamage(rng(), { attacker: sp(1), defender: sp(1), weapon, useWeapon: true, useLevelDamage: false, multiplier: 1, flat: 0, ...base });
    expect(dmg).toBe(100);
  });

  it("dps stat feeds the base", () => {
    const dmg = computeDamage(rng(), { attacker: sp(1, { meleeDps: 40 }), defender: sp(1), useWeapon: false, useLevelDamage: false, multiplier: 1, flat: 0, ...base });
    expect(dmg).toBe(40);
  });

  it("level damage adds level*1.5", () => {
    const dmg = computeDamage(rng(), { attacker: sp(10), defender: sp(1), useWeapon: false, useLevelDamage: true, multiplier: 1, flat: 0, ...base });
    expect(dmg).toBe(15);
  });

  it("incoming multiplier scales", () => {
    const dmg = computeDamage(rng(), { attacker: sp(1), defender: sp(1, { incomingDamageMul: 50 }), useWeapon: false, useLevelDamage: false, multiplier: 1, flat: 1000, ...base });
    expect(dmg).toBe(500);
  });
});

describe("healing", () => {
  it("no crit is flat", () => {
    expect(computeHeal({ healer: sp(1), target: sp(1), crit: false, multiplier: 0, flat: 100 })).toBe(100);
  });

  it("crit adds healCritBonus", () => {
    expect(computeHeal({ healer: sp(1, { healCritBonus: 50 }), target: sp(1), crit: true, multiplier: 0, flat: 100 })).toBe(150);
  });

  it("healPower scales the multiplier term", () => {
    expect(computeHeal({ healer: sp(1, { healPower: 80 }), target: sp(1), crit: false, multiplier: 1, flat: 0 })).toBe(80);
  });

  it("incomingHealMul scales", () => {
    expect(computeHeal({ healer: sp(1), target: sp(1, { incomingHealMul: 50 }), crit: false, multiplier: 0, flat: 100 })).toBe(50);
  });

  it("rollHealCrit honors 0/100", () => {
    expect(rollHealCrit(rng(), sp(1, { healCrit: 100 }))).toBe(true);
    expect(rollHealCrit(rng(), sp(1, { healCrit: 0 }))).toBe(false);
  });
});
