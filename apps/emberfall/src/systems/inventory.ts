import type { EquipSlot, ItemDef, ItemInstance } from "../types.js";
import { INVENTORY_SLOTS } from "../types.js";

/**
 * Pure inventory/equipment/shop logic (PLAN-EMBERFALL-M2 §3) — no engine, no room, no
 * D1. Every function takes the current `ItemInstance[]`/`equipment`/`gold` and returns
 * a NEW value; callers (`ember-room-base.ts`'s inventory intents) own applying the
 * result to a `CharSession` and to the `RpgEngine` (`setEquipmentModifiers`).
 *
 * Inventory shape: a COMPACT array (no `null` gaps) capped at `INVENTORY_SLOTS` (16) —
 * `SavedCharacter.inventory` is typed `ItemInstance[]` in `types.ts` (Wave A), which
 * rules out a sparse fixed-length array. A "slot index" below is therefore an index into
 * this compact array, not a fixed grid position; it shifts when an earlier item is
 * removed, same as the array it indexes.
 */

function inRange(inventory: readonly ItemInstance[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < inventory.length;
}

function stackCap(def: ItemDef | undefined): number {
  if (!def || def.kind === "equip") return 1;
  return def.stack ?? 99;
}

// --- add/remove/stack ---------------------------------------------------------------

export interface AddItemResult {
  inventory: ItemInstance[];
  /** How many of `qty` were actually placed. */
  added: number;
  /** How many of `qty` didn't fit (inventory full of non-mergeable stacks). */
  overflow: number;
}

/** Add `qty` of `defId`, merging into existing stacks up to their cap before opening new
 *  slots. Equip items (`stack` cap 1) never merge — each unit gets its own slot. Stops
 *  and reports `overflow` once `INVENTORY_SLOTS` is reached. */
export function addItem(
  inventory: readonly ItemInstance[],
  defId: string,
  qty: number,
  defs: Readonly<Record<string, ItemDef>>,
): AddItemResult {
  const def = defs[defId];
  const cap = stackCap(def);
  const next = [...inventory];
  let remaining = Math.max(0, Math.floor(qty));
  let added = 0;

  if (cap > 1) {
    for (let i = 0; i < next.length && remaining > 0; i++) {
      const it = next[i]!;
      if (it.defId !== defId) continue;
      const room = cap - it.qty;
      if (room <= 0) continue;
      const take = Math.min(room, remaining);
      next[i] = { ...it, qty: it.qty + take };
      remaining -= take;
      added += take;
    }
  }
  while (remaining > 0 && next.length < INVENTORY_SLOTS) {
    const take = Math.min(cap, remaining);
    next.push({ defId, qty: take });
    remaining -= take;
    added += take;
  }
  return { inventory: next, added, overflow: remaining };
}

export type RemoveResult =
  | { ok: true; inventory: ItemInstance[]; removed: number }
  | { ok: false; error: "invalid_slot" | "insufficient_qty" };

/** Remove up to `qty` from the stack at `slotIndex`; the slot is spliced out (compacting
 *  the array) once its quantity reaches zero. */
export function removeItem(inventory: readonly ItemInstance[], slotIndex: number, qty: number): RemoveResult {
  if (!inRange(inventory, slotIndex)) return { ok: false, error: "invalid_slot" };
  const item = inventory[slotIndex]!;
  if (!Number.isInteger(qty) || qty <= 0 || qty > item.qty) return { ok: false, error: "insufficient_qty" };
  const next = [...inventory];
  if (item.qty > qty) next[slotIndex] = { ...item, qty: item.qty - qty };
  else next.splice(slotIndex, 1);
  return { ok: true, inventory: next, removed: qty };
}

export type MoveResult =
  | { ok: true; inventory: ItemInstance[] }
  | { ok: false; error: "invalid_slot" };

/** Reorder/merge two slots. Same-`defId` stackable items merge up to their cap (leftover
 *  stays behind in `from`, i.e. a merge that overflows the cap "splits" back into two
 *  stacks); otherwise the two slots swap. `to` may be one past the end (append). */
export function moveItem(
  inventory: readonly ItemInstance[],
  from: number,
  to: number,
  defs: Readonly<Record<string, ItemDef>>,
): MoveResult {
  if (!inRange(inventory, from)) return { ok: false, error: "invalid_slot" };
  if (!Number.isInteger(to) || to < 0 || to > inventory.length || to >= INVENTORY_SLOTS) {
    return { ok: false, error: "invalid_slot" };
  }
  if (from === to) return { ok: true, inventory: [...inventory] };

  const src = inventory[from]!;
  const next = [...inventory];

  if (to < next.length) {
    const dst = next[to]!;
    const def = defs[src.defId];
    const cap = stackCap(def);
    if (dst.defId === src.defId && cap > 1) {
      const merged = Math.min(cap, dst.qty + src.qty);
      const leftover = dst.qty + src.qty - merged;
      next[to] = { ...dst, qty: merged };
      if (leftover > 0) {
        next[from] = { ...src, qty: leftover };
      } else {
        next.splice(from, 1);
      }
      return { ok: true, inventory: next };
    }
    // Different items (or non-stackable) — swap positions.
    next[from] = dst;
    next[to] = src;
    return { ok: true, inventory: next };
  }
  // `to` is the trailing append position — move to the end.
  next.splice(from, 1);
  next.push(src);
  return { ok: true, inventory: next };
}

// --- equip/unequip --------------------------------------------------------------------

export interface EquipOk {
  ok: true;
  inventory: ItemInstance[];
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
  slot: EquipSlot;
  /** The newly-equipped item's modifier bundle — pass to `setEquipmentModifiers`. */
  modifiers: NonNullable<ItemDef["modifiers"]>;
}
export interface EquipErr {
  ok: false;
  error: "invalid_slot" | "not_equippable" | "level_too_low";
}

/** Equip the item at `slotIndex`: it moves into `equipment[def.slot]`, and whatever was
 *  previously equipped there (if anything) swaps back into the now-vacated inventory
 *  slot — a strict swap, so this never needs extra inventory room. */
export function equipItem(
  inventory: readonly ItemInstance[],
  equipment: Partial<Record<EquipSlot, ItemInstance>>,
  slotIndex: number,
  defs: Readonly<Record<string, ItemDef>>,
  level: number,
): EquipOk | EquipErr {
  if (!inRange(inventory, slotIndex)) return { ok: false, error: "invalid_slot" };
  const item = inventory[slotIndex]!;
  const def = defs[item.defId];
  if (!def || def.kind !== "equip" || !def.slot) return { ok: false, error: "not_equippable" };
  if (def.levelReq !== undefined && level < def.levelReq) return { ok: false, error: "level_too_low" };

  const slot = def.slot;
  const next = [...inventory];
  const previous = equipment[slot];
  if (previous) next[slotIndex] = previous;
  else next.splice(slotIndex, 1);

  return {
    ok: true,
    inventory: next,
    equipment: { ...equipment, [slot]: item },
    slot,
    modifiers: def.modifiers ?? [],
  };
}

export interface UnequipOk {
  ok: true;
  inventory: ItemInstance[];
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
}
export interface UnequipErr {
  ok: false;
  error: "not_equipped" | "inventory_full";
}

/** Unequip `slot`: the item moves back into a new trailing inventory slot. Fails if the
 *  inventory is already at `INVENTORY_SLOTS` capacity. */
export function unequipItem(
  inventory: readonly ItemInstance[],
  equipment: Partial<Record<EquipSlot, ItemInstance>>,
  slot: EquipSlot,
  _defs: Readonly<Record<string, ItemDef>>,
): UnequipOk | UnequipErr {
  const item = equipment[slot];
  if (!item) return { ok: false, error: "not_equipped" };
  if (inventory.length >= INVENTORY_SLOTS) return { ok: false, error: "inventory_full" };
  const nextEquipment = { ...equipment };
  delete nextEquipment[slot];
  return { ok: true, inventory: [...inventory, item], equipment: nextEquipment };
}

// --- consumables ------------------------------------------------------------------------

export interface UseConsumableOk {
  ok: true;
  inventory: ItemInstance[];
  heal: { hp: number; mp: number };
}
export interface UseConsumableErr {
  ok: false;
  error: "invalid_slot" | "not_consumable";
}

/** Consume one unit of the stack at `slotIndex`; returns the flat hp/mp restore to apply
 *  engine-side (the caller applies it — this module never touches the engine). */
export function useConsumable(
  inventory: readonly ItemInstance[],
  slotIndex: number,
  defs: Readonly<Record<string, ItemDef>>,
): UseConsumableOk | UseConsumableErr {
  if (!inRange(inventory, slotIndex)) return { ok: false, error: "invalid_slot" };
  const item = inventory[slotIndex]!;
  const def = defs[item.defId];
  if (!def || def.kind !== "consumable" || !def.consume) return { ok: false, error: "not_consumable" };
  const next = [...inventory];
  if (item.qty > 1) next[slotIndex] = { ...item, qty: item.qty - 1 };
  else next.splice(slotIndex, 1);
  return { ok: true, inventory: next, heal: { hp: def.consume.hp ?? 0, mp: def.consume.mp ?? 0 } };
}

// --- shop (buy/sell) ------------------------------------------------------------------

export function canAfford(gold: number, price: number, qty = 1): boolean {
  return gold >= price * qty;
}

/** Sell-back price for one unit of an item with the given `buyPrice` (PLAN §3: "판매
 *  환수=floor(buyPrice*0.25)"). */
export function sellPrice(buyPrice: number): number {
  return Math.floor(buyPrice * 0.25);
}

export interface BuyOk {
  ok: true;
  inventory: ItemInstance[];
  gold: number;
}
export interface BuyErr {
  ok: false;
  error: "not_for_sale" | "cannot_afford" | "level_too_low" | "inventory_full";
}

/** Buy `qty` of `defId` from the shop's curated `shopItemIds` list. Validates gold,
 *  level gate, and inventory room server-side — the client's request is never trusted. */
export function buyItem(
  inventory: readonly ItemInstance[],
  gold: number,
  defId: string,
  qty: number,
  defs: Readonly<Record<string, ItemDef>>,
  shopItemIds: readonly string[],
  level: number,
): BuyOk | BuyErr {
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: "not_for_sale" };
  if (!shopItemIds.includes(defId)) return { ok: false, error: "not_for_sale" };
  const def = defs[defId];
  if (!def || def.buyPrice === undefined) return { ok: false, error: "not_for_sale" };
  if (def.levelReq !== undefined && level < def.levelReq) return { ok: false, error: "level_too_low" };
  const cost = def.buyPrice * qty;
  if (!canAfford(gold, def.buyPrice, qty)) return { ok: false, error: "cannot_afford" };
  const added = addItem(inventory, defId, qty, defs);
  if (added.overflow > 0) return { ok: false, error: "inventory_full" };
  return { ok: true, inventory: added.inventory, gold: gold - cost };
}

export interface SellOk {
  ok: true;
  inventory: ItemInstance[];
  gold: number;
}
export interface SellErr {
  ok: false;
  error: "invalid_slot" | "not_sellable" | "insufficient_qty";
}

/** Sell `qty` from the stack at `slotIndex` back for `floor(buyPrice*0.25)` gold each.
 *  Any item with a `buyPrice` is sellable, whether or not the shop currently buys it
 *  (loot rarities offload this way even when absent from `SHOP_ITEM_IDS`). */
export function sellItem(
  inventory: readonly ItemInstance[],
  gold: number,
  slotIndex: number,
  qty: number,
  defs: Readonly<Record<string, ItemDef>>,
): SellOk | SellErr {
  if (!inRange(inventory, slotIndex)) return { ok: false, error: "invalid_slot" };
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: "insufficient_qty" };
  const item = inventory[slotIndex]!;
  const def = defs[item.defId];
  if (!def || def.buyPrice === undefined) return { ok: false, error: "not_sellable" };
  if (item.qty < qty) return { ok: false, error: "insufficient_qty" };
  const refund = sellPrice(def.buyPrice) * qty;
  const next = [...inventory];
  if (item.qty > qty) next[slotIndex] = { ...item, qty: item.qty - qty };
  else next.splice(slotIndex, 1);
  return { ok: true, inventory: next, gold: gold + refund };
}
