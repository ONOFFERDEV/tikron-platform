import { describe, it, expect } from "vitest";
import {
  addItem,
  buyItem,
  canAfford,
  equipItem,
  moveItem,
  sellItem,
  sellPrice,
  unequipItem,
  useConsumable,
} from "../src/systems/inventory.js";
import { ITEMS } from "../src/content/items.js";
import { SHOP_ITEM_IDS, shopListing } from "../src/content/shop.js";
import { INVENTORY_SLOTS, type ItemInstance } from "../src/types.js";

/** Pure `systems/inventory.ts` coverage (PLAN-EMBERFALL-M2 §8): stack merge/split,
 *  16-slot overflow, equip/unequip modifier round trip, buy/sell gold math + gates. */

describe("inventory — addItem (stack/merge/overflow)", () => {
  it("merges into an existing stack up to its cap, opening no new slot", () => {
    const inv: ItemInstance[] = [{ defId: "potion-hp", qty: 5 }];
    const res = addItem(inv, "potion-hp", 10, ITEMS);
    expect(res.inventory).toHaveLength(1);
    expect(res.inventory[0]).toEqual({ defId: "potion-hp", qty: 15 });
    expect(res.added).toBe(10);
    expect(res.overflow).toBe(0);
  });

  it("spills into a new slot once the existing stack hits its cap (99)", () => {
    const inv: ItemInstance[] = [{ defId: "potion-hp", qty: 95 }];
    const res = addItem(inv, "potion-hp", 10, ITEMS);
    expect(res.inventory).toHaveLength(2);
    expect(res.inventory[0]!.qty).toBe(99);
    expect(res.inventory[1]).toEqual({ defId: "potion-hp", qty: 6 });
    expect(res.added).toBe(10);
  });

  it("never merges equip items (stack cap 1) — each unit gets its own slot", () => {
    const inv: ItemInstance[] = [{ defId: "armor-leather", qty: 1 }];
    const res = addItem(inv, "armor-leather", 1, ITEMS);
    expect(res.inventory).toHaveLength(2);
    expect(res.inventory.every((it) => it.qty === 1)).toBe(true);
  });

  it("reports overflow once INVENTORY_SLOTS (16) is full and no stack can absorb more", () => {
    const inv: ItemInstance[] = Array.from({ length: INVENTORY_SLOTS }, (_, i) => ({
      defId: "material-goblin-ear",
      qty: 1,
      uid: `slot-${i}`,
    }));
    // Different defId than what's in every slot, so nothing can merge — the array is
    // already at capacity, so the whole request overflows.
    const res = addItem(inv, "potion-hp", 3, ITEMS);
    expect(res.inventory).toHaveLength(INVENTORY_SLOTS);
    expect(res.added).toBe(0);
    expect(res.overflow).toBe(3);
  });
});

describe("inventory — moveItem (reorder / merge+split)", () => {
  it("swaps two different-item slots", () => {
    const inv: ItemInstance[] = [{ defId: "potion-hp", qty: 1 }, { defId: "potion-mp", qty: 1 }];
    const res = moveItem(inv, 0, 1, ITEMS);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.inventory[0]!.defId).toBe("potion-mp");
    expect(res.inventory[1]!.defId).toBe("potion-hp");
  });

  it("merges same-defId stackable slots fully when under the cap", () => {
    const inv: ItemInstance[] = [{ defId: "potion-hp", qty: 5 }, { defId: "potion-hp", qty: 3 }];
    const res = moveItem(inv, 0, 1, ITEMS);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.inventory).toHaveLength(1);
    expect(res.inventory[0]).toEqual({ defId: "potion-hp", qty: 8 });
  });

  it("merging over the stack cap fills the destination and leaves the leftover behind (a split)", () => {
    const inv: ItemInstance[] = [{ defId: "potion-hp", qty: 60 }, { defId: "potion-hp", qty: 50 }];
    const res = moveItem(inv, 0, 1, ITEMS);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.inventory).toHaveLength(2);
    expect(res.inventory[1]!.qty).toBe(99); // destination filled to cap
    expect(res.inventory[0]!.qty).toBe(11); // 110 - 99 leftover stays in the source slot
  });

  it("rejects an out-of-range slot index", () => {
    const inv: ItemInstance[] = [{ defId: "potion-hp", qty: 1 }];
    const res = moveItem(inv, 0, 99, ITEMS);
    expect(res.ok).toBe(false);
  });
});

describe("inventory — equip / unequip", () => {
  const level10 = 10;

  it("equips into the item's slot, freeing the source inventory index", () => {
    const inv: ItemInstance[] = [{ defId: "armor-leather", qty: 1 }];
    const res = equipItem(inv, {}, 0, ITEMS, level10);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.slot).toBe("armor");
    expect(res.equipment.armor).toEqual({ defId: "armor-leather", qty: 1 });
    expect(res.inventory).toHaveLength(0);
    expect(res.modifiers).toEqual(ITEMS["armor-leather"]!.modifiers);
  });

  it("swaps a previously-equipped item back into the vacated inventory slot", () => {
    const inv: ItemInstance[] = [{ defId: "armor-chain", qty: 1 }];
    const equipment = { armor: { defId: "armor-leather", qty: 1 } };
    const res = equipItem(inv, equipment, 0, ITEMS, level10);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.equipment.armor).toEqual({ defId: "armor-chain", qty: 1 });
    expect(res.inventory).toEqual([{ defId: "armor-leather", qty: 1 }]);
  });

  it("rejects equipping below the item's level requirement", () => {
    const inv: ItemInstance[] = [{ defId: "armor-plate", qty: 1 }]; // levelReq 10
    const res = equipItem(inv, {}, 0, ITEMS, 3);
    expect(res).toEqual({ ok: false, error: "level_too_low" });
  });

  it("rejects equipping a non-equip item", () => {
    const inv: ItemInstance[] = [{ defId: "potion-hp", qty: 1 }];
    const res = equipItem(inv, {}, 0, ITEMS, level10);
    expect(res).toEqual({ ok: false, error: "not_equippable" });
  });

  it("unequip moves the item back into a fresh inventory slot", () => {
    const equipment = { weapon: { defId: "warrior-sword-basic", qty: 1 } };
    const res = unequipItem([], equipment, "weapon", ITEMS);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.inventory).toEqual([{ defId: "warrior-sword-basic", qty: 1 }]);
    expect(res.equipment.weapon).toBeUndefined();
  });

  it("unequip fails when there's nothing equipped in that slot", () => {
    const res = unequipItem([], {}, "trinket", ITEMS);
    expect(res).toEqual({ ok: false, error: "not_equipped" });
  });

  it("unequip fails when the inventory has no room", () => {
    const full: ItemInstance[] = Array.from({ length: INVENTORY_SLOTS }, () => ({ defId: "potion-hp", qty: 1 }));
    const equipment = { armor: { defId: "armor-leather", qty: 1 } };
    const res = unequipItem(full, equipment, "armor", ITEMS);
    expect(res).toEqual({ ok: false, error: "inventory_full" });
  });

  it("a full equip -> unequip round trip restores the original inventory contents", () => {
    const original: ItemInstance[] = [{ defId: "armor-leather", qty: 1 }];
    const equipped = equipItem(original, {}, 0, ITEMS, level10);
    expect(equipped.ok).toBe(true);
    if (!equipped.ok) return;
    const restored = unequipItem(equipped.inventory, equipped.equipment, "armor", ITEMS);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.inventory).toEqual(original);
    expect(restored.equipment.armor).toBeUndefined();
  });
});

describe("inventory — useConsumable", () => {
  it("consumes one unit and returns the def's flat heal amounts", () => {
    const inv: ItemInstance[] = [{ defId: "potion-hp", qty: 3 }];
    const res = useConsumable(inv, 0, ITEMS);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.inventory).toEqual([{ defId: "potion-hp", qty: 2 }]);
    expect(res.heal).toEqual({ hp: 60, mp: 0 });
  });

  it("removes the slot entirely when the last unit is consumed", () => {
    const inv: ItemInstance[] = [{ defId: "potion-mp", qty: 1 }];
    const res = useConsumable(inv, 0, ITEMS);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.inventory).toHaveLength(0);
    expect(res.heal).toEqual({ hp: 0, mp: 40 });
  });

  it("rejects a non-consumable item", () => {
    const inv: ItemInstance[] = [{ defId: "armor-leather", qty: 1 }];
    const res = useConsumable(inv, 0, ITEMS);
    expect(res).toEqual({ ok: false, error: "not_consumable" });
  });
});

describe("inventory — shop (buy/sell gold math + gates)", () => {
  it("canAfford is a simple gold >= price*qty check", () => {
    expect(canAfford(100, 30, 3)).toBe(true);
    expect(canAfford(89, 30, 3)).toBe(false);
  });

  it("sellPrice is floor(buyPrice*0.25)", () => {
    expect(sellPrice(30)).toBe(7);
    expect(sellPrice(25)).toBe(6);
  });

  it("buyItem deducts gold and adds the item, gated by the shop's curated list", () => {
    const res = buyItem([], 100, "potion-hp", 2, ITEMS, SHOP_ITEM_IDS, 1);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.gold).toBe(80);
    expect(res.inventory).toEqual([{ defId: "potion-hp", qty: 2 }]);
  });

  it("buyItem rejects an item not on the shop's list even if it exists in the catalog", () => {
    const res = buyItem([], 1000, "armor-chain", 1, ITEMS, SHOP_ITEM_IDS, 10);
    expect(res).toEqual({ ok: false, error: "not_for_sale" });
  });

  it("buyItem rejects insufficient gold", () => {
    const res = buyItem([], 5, "potion-hp", 1, ITEMS, SHOP_ITEM_IDS, 1);
    expect(res).toEqual({ ok: false, error: "cannot_afford" });
  });

  it("buyItem rejects a full inventory", () => {
    const full: ItemInstance[] = Array.from({ length: INVENTORY_SLOTS }, (_, i) => ({
      defId: "material-goblin-ear",
      qty: 1,
      uid: `slot-${i}`,
    }));
    const res = buyItem(full, 1000, "potion-hp", 1, ITEMS, SHOP_ITEM_IDS, 1);
    expect(res).toEqual({ ok: false, error: "inventory_full" });
  });

  it("sellItem refunds floor(buyPrice*0.25) per unit and removes the sold quantity", () => {
    const inv: ItemInstance[] = [{ defId: "potion-hp", qty: 5 }];
    const res = sellItem(inv, 0, 0, 2, ITEMS);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.gold).toBe(sellPrice(10) * 2);
    expect(res.inventory).toEqual([{ defId: "potion-hp", qty: 3 }]);
  });

  it("sellItem rejects an item with no buyPrice (not sellable)", () => {
    // Every catalog item currently has a buyPrice, so synthesize a defs map with one that doesn't.
    const defs = { junk: { id: "junk", name: "Junk", kind: "material", rarity: "common" } } as const;
    const inv: ItemInstance[] = [{ defId: "junk", qty: 1 }];
    const res = sellItem(inv, 0, 0, 1, defs as never);
    expect(res).toEqual({ ok: false, error: "not_sellable" });
  });

  it("sellItem rejects selling more than the stack holds", () => {
    const inv: ItemInstance[] = [{ defId: "potion-hp", qty: 2 }];
    const res = sellItem(inv, 0, 0, 5, ITEMS);
    expect(res).toEqual({ ok: false, error: "insufficient_qty" });
  });

  it("shopListing() resolves every SHOP_ITEM_IDS entry with a buyPrice", () => {
    const listing = shopListing();
    expect(listing).toHaveLength(SHOP_ITEM_IDS.length);
    for (const entry of listing) expect(entry.buyPrice).toBeGreaterThan(0);
  });
});
