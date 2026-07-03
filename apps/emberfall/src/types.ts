import type { EmberClass } from "./content/hotbar.js";

/**
 * Save-data types — `SavedCharacter`, inventory, equipment, item defs. Zero server
 * imports: `content/hotbar.ts` (the only local import here) is itself pure data with
 * zero imports, so both the server (`persist.ts`, `rooms/ember-room-base.ts`) and the
 * browser client can bundle this file directly. This is the single source of truth
 * for persisted-character and item shapes (PLAN-EMBERFALL-M2 §2/§3) — do not
 * re-declare `SavedCharacter`/`ItemInstance`/etc. elsewhere; import them from here.
 */

/** The last zone a character was in (persisted; restored on reconnect). A character
 *  is never saved mid-dungeon — `"ember-depths"` is normalized to `"emberhold"` at
 *  save time (PLAN-EMBERFALL-M2 §2: "던전이면 마을로 강등"). */
export type SavedZone = "emberhold" | "ashen-fields" | "ember-depths";

/** A server-authoritative character save (PLAN-EMBERFALL-M2 §2). Every field here is
 *  computed/validated server-side — the client only ever presents the save `token`
 *  (see `persist.ts`) and never asserts any of these values directly. */
export interface SavedCharacter {
  /** uuid, D1 primary key. */
  id: string;
  /** Normalized-unique display name, 3-16 chars, `[a-zA-Z0-9가-힣_ ]`. */
  nickname: string;
  class: EmberClass;
  /** 1-15 (PLAN §2.2's level cap). */
  level: number;
  /** Cumulative XP since level 1 (mirrors the `@tikron/rpg` engine's `UnitView.xp`). */
  xp: number;
  gold: number;
  /** Last zone (reconnect lands here); safe-zone-normalized at save time. */
  zone: SavedZone;
  /** Last safe position within `zone`. */
  x: number;
  y: number;
  /** Restored on reconnect (anti "disconnect to heal" exploit) — not refilled to max. */
  hp: number;
  mp: number;
  inventory: ItemInstance[];
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
  /** Cumulative play time in ms. */
  playMs: number;
  createdAt: number;
  updatedAt: number;
}

export type EquipSlot = "weapon" | "armor" | "trinket";
export type ItemRarity = "common" | "rare" | "epic";

/** One stat modifier, fed to `RpgEngine.setEquipmentModifiers` verbatim as a `Modifier`. */
export interface ItemModifier {
  stat: string;
  kind: "flat" | "percent";
  value: number;
}

/** A catalog entry (`content/items.ts` — Wave B2). `ItemInstance.defId` refs `ItemDef.id`. */
export interface ItemDef {
  id: string;
  name: string;
  kind: "equip" | "consumable" | "material";
  /** Set when `kind === "equip"`. */
  slot?: EquipSlot;
  rarity: ItemRarity;
  levelReq?: number;
  /** Equip-only: a `Modifier` bundle applied via `setEquipmentModifiers` on wear. */
  modifiers?: ItemModifier[];
  /** Equip+weapon only: the `WeaponDef` id in `content/emberfall-content.ts`. */
  weaponId?: string;
  /** Client manifest logical id for the worn/held visual (optional — falls back to
   *  the class default when unset). */
  visual?: string;
  /** Consumable-only: use effect. */
  consume?: { hp?: number; mp?: number; skillId?: string };
  /** Shop sell price to the player; present => shop-listed. Buyback = `floor(buyPrice * 0.25)`. */
  buyPrice?: number;
  /** Max stack size (consumable/material default 99; equip is always 1). */
  stack?: number;
}

/** One inventory/equipment slot's contents — a reference into the item catalog plus
 *  a stack count. `uid` is reserved for a future per-roll instance id (M2 doesn't use it). */
export interface ItemInstance {
  defId: string;
  qty: number;
  uid?: string;
}

/** Inventory grid capacity (PLAN-EMBERFALL-M2 §3) — a fixed-size array of 16 slots,
 *  empty slots represented as `null`. */
export const INVENTORY_SLOTS = 16;
