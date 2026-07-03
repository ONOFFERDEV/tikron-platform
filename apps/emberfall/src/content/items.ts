import type { ItemDef } from "../types.js";

/**
 * Item catalog (PLAN-EMBERFALL-M2 §3) — the single source `ItemInstance.defId` resolves
 * against, keyed by `ItemDef.id` (every key here must equal its own `.id`, asserted in
 * `test/inventory.test.ts`). Equip modifiers use real `@tikron/rpg` `StatKey`s (verified
 * against a runtime allowlist in the same test, since `ItemModifier.stat` is typed
 * `string` in `types.ts` to keep that file free of an `@tikron/rpg` import).
 *
 * Weapon items reference one of the 3 class `WeaponDef` ids already defined in
 * `emberfall-content.ts` (`warrior-sword` / `mage-focus` / `cleric-mace`) — there are no
 * new weapons in M2 (the engine picks a unit's active weapon at `spawnPlayer` time from
 * `CLASS_WEAPON`, and that binding is out of scope to change — "엔진 계약 불변"). A
 * weapon `ItemDef` layers pure stat bonuses on top via `setEquipmentModifiers`; it does
 * not swap the underlying weapon's damage/speed.
 *
 * `visual` ids feed `EmberUnit.weapon`/`.armor` — both `str(16)` in `ember-schema.ts`,
 * which THROWS on overflow. Keep any new visual id well under 16 characters.
 */
export const ITEMS: Readonly<Record<string, ItemDef>> = {
  // --- starter weapons (one per class, common, buyable) ---
  "warrior-sword-basic": {
    id: "warrior-sword-basic",
    name: "Iron Sword",
    kind: "equip",
    slot: "weapon",
    rarity: "common",
    levelReq: 1,
    weaponId: "warrior-sword",
    modifiers: [{ stat: "str", kind: "flat", value: 3 }],
    visual: "wpn.sword",
    buyPrice: 30,
    stack: 1,
  },
  "mage-focus-basic": {
    id: "mage-focus-basic",
    name: "Apprentice Focus",
    kind: "equip",
    slot: "weapon",
    rarity: "common",
    levelReq: 1,
    weaponId: "mage-focus",
    modifiers: [{ stat: "int", kind: "flat", value: 3 }],
    visual: "wpn.focus",
    buyPrice: 30,
    stack: 1,
  },
  "cleric-mace-basic": {
    id: "cleric-mace-basic",
    name: "Acolyte Mace",
    kind: "equip",
    slot: "weapon",
    rarity: "common",
    levelReq: 1,
    weaponId: "cleric-mace",
    modifiers: [{ stat: "spi", kind: "flat", value: 3 }],
    visual: "wpn.mace",
    buyPrice: 30,
    stack: 1,
  },

  // --- armor tiers (common/rare/epic) ---
  "armor-leather": {
    id: "armor-leather",
    name: "Leather Armor",
    kind: "equip",
    slot: "armor",
    rarity: "common",
    levelReq: 1,
    modifiers: [
      { stat: "armor", kind: "flat", value: 5 },
      { stat: "maxHp", kind: "flat", value: 20 },
    ],
    visual: "arm.leather",
    buyPrice: 25,
    stack: 1,
  },
  "armor-chain": {
    id: "armor-chain",
    name: "Chainmail",
    kind: "equip",
    slot: "armor",
    rarity: "rare",
    levelReq: 5,
    modifiers: [
      { stat: "armor", kind: "flat", value: 14 },
      { stat: "maxHp", kind: "flat", value: 50 },
    ],
    visual: "arm.chain",
    buyPrice: 90,
    stack: 1,
  },
  "armor-plate": {
    id: "armor-plate",
    name: "Plate Armor",
    kind: "equip",
    slot: "armor",
    rarity: "epic",
    levelReq: 10,
    modifiers: [
      { stat: "armor", kind: "flat", value: 28 },
      { stat: "maxHp", kind: "flat", value: 100 },
    ],
    visual: "arm.plate",
    buyPrice: 260,
    stack: 1,
  },

  // --- trinket tiers (common/rare/epic) ---
  "trinket-charm": {
    id: "trinket-charm",
    name: "Lucky Charm",
    kind: "equip",
    slot: "trinket",
    rarity: "common",
    levelReq: 1,
    modifiers: [{ stat: "hpRegen", kind: "flat", value: 2 }],
    visual: "trk.charm",
    buyPrice: 20,
    stack: 1,
  },
  "trinket-ring": {
    id: "trinket-ring",
    name: "Band of Precision",
    kind: "equip",
    slot: "trinket",
    rarity: "rare",
    levelReq: 5,
    modifiers: [
      { stat: "meleeCrit", kind: "flat", value: 4 },
      { stat: "spellCrit", kind: "flat", value: 4 },
    ],
    visual: "trk.ring",
    buyPrice: 100,
    stack: 1,
  },
  "trinket-amulet": {
    id: "trinket-amulet",
    name: "Amulet of Fury",
    kind: "equip",
    slot: "trinket",
    rarity: "epic",
    levelReq: 10,
    modifiers: [
      { stat: "meleeDamageMul", kind: "percent", value: 8 },
      { stat: "spellDamageMul", kind: "percent", value: 8 },
    ],
    visual: "trk.amulet",
    buyPrice: 280,
    stack: 1,
  },

  // --- consumables ---
  "potion-hp": {
    id: "potion-hp",
    name: "Health Potion",
    kind: "consumable",
    rarity: "common",
    consume: { hp: 60 },
    buyPrice: 10,
    stack: 99,
  },
  "potion-mp": {
    id: "potion-mp",
    name: "Mana Potion",
    kind: "consumable",
    rarity: "common",
    consume: { mp: 40 },
    buyPrice: 10,
    stack: 99,
  },

  // --- materials (loot filler, sellable but not shop-buyable) ---
  "material-wolf-pelt": {
    id: "material-wolf-pelt",
    name: "Wolf Pelt",
    kind: "material",
    rarity: "common",
    buyPrice: 4,
    stack: 99,
  },
  "material-goblin-ear": {
    id: "material-goblin-ear",
    name: "Goblin Ear",
    kind: "material",
    rarity: "common",
    buyPrice: 3,
    stack: 99,
  },
};
