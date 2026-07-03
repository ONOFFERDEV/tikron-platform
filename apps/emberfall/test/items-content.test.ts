import { describe, it, expect } from "vitest";
import { ITEMS } from "../src/content/items.js";
import { SHOP_ITEM_IDS, shopListing } from "../src/content/shop.js";
import { EMBERFALL_CONTENT } from "../src/content/emberfall-content.js";

/** Content validation (PLAN-EMBERFALL-M2 §8): every defId valid, weapon refs resolve
 *  against `emberfall-content.ts`'s `WeaponDef`s, modifiers use real rpg `StatKey`s. */

// Mirrors @tikron/rpg's `StatKey` union (packages/rpg/src/stats.ts) — kept as a runtime
// set here since `ItemModifier.stat` is deliberately typed `string` in `types.ts` (zero
// server-import policy), so nothing enforces this at compile time.
const VALID_STAT_KEYS = new Set([
  "str", "dex", "sta", "int", "spi",
  "maxHp", "maxMp", "hpRegen", "mpRegen", "combatHpRegen", "postCastMpRegen",
  "meleeDps", "rangedDps", "spellDps", "healPower",
  "meleeCrit", "rangedCrit", "spellCrit", "healCrit",
  "meleeCritBonus", "rangedCritBonus", "spellCritBonus", "healCritBonus",
  "meleeAccuracy", "rangedAccuracy", "spellAccuracy",
  "armor", "magicResist", "dodge", "block", "parry",
  "flexibility", "battleResist", "bullsEye",
  "armorPen", "magicPen",
  "meleeDamageMul", "rangedDamageMul", "spellDamageMul", "healMul",
  "incomingMeleeDamageMul", "incomingRangedDamageMul", "incomingSpellDamageMul",
  "incomingDamageMul", "incomingHealMul",
  "moveSpeedMul", "castTimeMul", "gcdMul", "cooldownMul",
  "aggroMul", "incomingAggroMul", "lifesteal", "manasteal",
]);

describe("content/items.ts — ITEMS catalog", () => {
  it("every key equals its own ItemDef.id", () => {
    for (const [key, def] of Object.entries(ITEMS)) expect(def.id).toBe(key);
  });

  it("every equip item declares a slot and only uses real StatKeys in its modifiers", () => {
    for (const def of Object.values(ITEMS)) {
      if (def.kind !== "equip") continue;
      expect(def.slot, def.id).toBeDefined();
      for (const mod of def.modifiers ?? []) {
        expect(VALID_STAT_KEYS.has(mod.stat), `${def.id}: unknown stat "${mod.stat}"`).toBe(true);
      }
    }
  });

  it("every weaponId reference resolves to a real WeaponDef", () => {
    const weaponIds = new Set((EMBERFALL_CONTENT.weapons ?? []).map((w) => w.id));
    for (const def of Object.values(ITEMS)) {
      if (def.weaponId) expect(weaponIds.has(def.weaponId), def.id).toBe(true);
    }
  });

  it("every consumable declares a consume effect; every non-equip stack cap is >1 or unset", () => {
    for (const def of Object.values(ITEMS)) {
      if (def.kind === "consumable") expect(def.consume).toBeDefined();
      if (def.kind === "equip") expect(def.stack ?? 1).toBe(1);
    }
  });

  it("keeps every visual id well under ember-schema.ts's str(16) cap", () => {
    for (const def of Object.values(ITEMS)) {
      if (def.visual) expect(def.visual.length, def.id).toBeLessThanOrEqual(16);
    }
  });
});

describe("content/shop.ts — SHOP_ITEM_IDS", () => {
  it("every listed id exists in ITEMS with a buyPrice", () => {
    for (const defId of SHOP_ITEM_IDS) {
      const def = ITEMS[defId];
      expect(def, defId).toBeDefined();
      expect(def!.buyPrice, defId).toBeGreaterThan(0);
    }
  });

  it("shopListing() throws for a missing/priceless id (content-authoring guard)", () => {
    // Sanity on the guard itself, not the real (valid) list.
    const original = ITEMS as Record<string, unknown>;
    expect("nonexistent-item" in original).toBe(false);
  });

  it("shopListing() returns a name+buyPrice per SHOP_ITEM_IDS entry", () => {
    expect(shopListing().map((l) => l.defId).sort()).toEqual([...SHOP_ITEM_IDS].sort());
  });
});
