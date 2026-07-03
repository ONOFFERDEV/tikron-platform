import { ITEMS } from "./items.js";

/**
 * Emberhold village shop (PLAN-EMBERFALL-M2 §3) — potions + common-tier gear only;
 * rare/epic items are loot-only (still sellable back through any `ItemDef.buyPrice`,
 * just never buyable here — `systems/inventory.ts`'s `sellItem` doesn't consult this
 * list, only `buyItem` does). Buy price is read straight from `ItemDef.buyPrice`; sell
 * price is `floor(buyPrice * 0.25)`, computed in `systems/inventory.ts`.
 */
export const SHOP_ITEM_IDS: readonly string[] = [
  "warrior-sword-basic",
  "mage-focus-basic",
  "cleric-mace-basic",
  "armor-leather",
  "trinket-charm",
  "potion-hp",
  "potion-mp",
];

export interface ShopListing {
  defId: string;
  name: string;
  buyPrice: number;
}

/** The shop's buyable catalog, resolved from `ITEMS`. Throws if a listed id is missing
 *  or has no `buyPrice` — a content-authoring mistake, not a runtime condition to
 *  tolerate silently. */
export function shopListing(): ShopListing[] {
  return SHOP_ITEM_IDS.map((defId) => {
    const def = ITEMS[defId];
    if (!def || def.buyPrice === undefined) {
      throw new Error(`shop.ts: "${defId}" is not in items.ts or has no buyPrice`);
    }
    return { defId, name: def.name, buyPrice: def.buyPrice };
  });
}
