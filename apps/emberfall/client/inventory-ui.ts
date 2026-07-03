/**
 * Inventory/equipment/gold + shop panels (PLAN-EMBERFALL-M2 §3/§7). Renders entirely
 * from the room's owner-only `"inv"` message (`net.ts`'s `InventoryView`) — never from
 * synced `EmberState`, per §7 ("다른 플레이어에게 내 인벤 노출 불필요"). The pure
 * helpers (`toSlotGrid`/`itemLabel`) are covered by `test/client-m2.test.ts`.
 */
import type { ItemInstance, EquipSlot } from "../src/types.js";
import { INVENTORY_SLOTS } from "../src/types.js";
import { ITEMS } from "../src/content/items.js";
import { shopListing } from "../src/content/shop.js";
import { el } from "./dom.js";
import type { InventoryView } from "./net.js";

// --- pure helpers ---------------------------------------------------------------------

/** Pads/truncates `inventory` to a fixed `slots`-length grid (empty = `null`) — the
 *  server may send either a compact array or an already-padded one (PLAN §3 leaves the
 *  wire shape ambiguous), so this normalizes either into what the grid UI renders. */
export function toSlotGrid(inventory: readonly ItemInstance[], slots: number = INVENTORY_SLOTS): (ItemInstance | null)[] {
  const grid: (ItemInstance | null)[] = inventory.slice(0, slots);
  while (grid.length < slots) grid.push(null);
  return grid;
}

/** Resolves `defId`'s display name from the real catalog (`content/items.ts`); falls
 *  back to a humanized kebab-case rendering ("iron-sword" -> "Iron Sword") for any
 *  defId the catalog doesn't recognize (stale save data, a content authoring gap). */
export function itemLabel(defId: string): string {
  const name = ITEMS[defId]?.name;
  if (name) return name;
  return defId
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

const EQUIP_SLOT_LABEL: Readonly<Record<EquipSlot, string>> = { weapon: "무기", armor: "방어구", trinket: "장신구" };
const EQUIP_SLOTS: readonly EquipSlot[] = ["weapon", "armor", "trinket"];

export function equipSlotLabel(slot: EquipSlot): string {
  return EQUIP_SLOT_LABEL[slot];
}

const EMPTY_VIEW: InventoryView = { inventory: [], equipment: {}, gold: 0 };

// --- DOM: inventory + equipment panel --------------------------------------------------

export interface InventoryCallbacks {
  onEquip(slotIndex: number): void;
  onUnequip(slot: EquipSlot): void;
  onUseItem(slotIndex: number): void;
  onMoveItem(from: number, to: number): void;
}

export class InventoryPanel {
  private view: InventoryView = EMPTY_VIEW;
  private selected: number | null = null;

  private readonly panelEl: HTMLElement;
  private readonly goldEl: HTMLElement;
  private readonly equipEl: HTMLElement;
  private readonly gridEl: HTMLElement;
  private readonly actionsEl: HTMLElement;

  constructor(
    root: HTMLElement,
    private readonly callbacks: InventoryCallbacks,
  ) {
    this.panelEl = el("div", "inv-panel hud-hidden");
    const header = el("div", "inv-header");
    const title = el("div", "inv-title");
    title.textContent = "인벤토리";
    this.goldEl = el("div", "inv-gold");
    const closeBtn = el("button", "panel-close");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => this.toggle(false));
    header.append(title, this.goldEl, closeBtn);

    this.equipEl = el("div", "inv-equip-row");
    this.gridEl = el("div", "inv-grid");
    this.actionsEl = el("div", "inv-actions hud-hidden");

    this.panelEl.append(header, this.equipEl, this.gridEl, this.actionsEl);
    root.appendChild(this.panelEl);
  }

  toggle(force?: boolean): void {
    if (force === undefined) this.panelEl.classList.toggle("hud-hidden");
    else this.panelEl.classList.toggle("hud-hidden", !force);
  }

  isOpen(): boolean {
    return !this.panelEl.classList.contains("hud-hidden");
  }

  setView(view: InventoryView): void {
    this.view = view;
    if (this.selected !== null && !toSlotGrid(view.inventory)[this.selected]) this.selected = null;
    this.goldEl.textContent = `${view.gold} G`;
    this.renderEquip();
    this.renderGrid();
    this.renderActions();
  }

  private renderEquip(): void {
    this.equipEl.innerHTML = "";
    for (const slot of EQUIP_SLOTS) {
      const item = this.view.equipment[slot];
      const btn = document.createElement("button");
      btn.className = "inv-equip-slot";
      btn.title = equipSlotLabel(slot);
      btn.textContent = item ? itemLabel(item.defId) : `(${equipSlotLabel(slot)})`;
      if (item) btn.addEventListener("click", () => this.callbacks.onUnequip(slot));
      else btn.disabled = true;
      this.equipEl.appendChild(btn);
    }
  }

  private renderGrid(): void {
    this.gridEl.innerHTML = "";
    const grid = toSlotGrid(this.view.inventory);
    grid.forEach((item, index) => {
      const cell = document.createElement("button");
      cell.className =
        "inv-slot" + (item ? "" : " inv-slot-empty") + (this.selected === index ? " inv-slot-selected" : "");
      if (item) {
        cell.textContent = item.qty > 1 ? `${itemLabel(item.defId)} x${item.qty}` : itemLabel(item.defId);
        cell.draggable = true;
        cell.addEventListener("dragstart", (e) => e.dataTransfer?.setData("text/plain", String(index)));
        cell.addEventListener("click", () => this.selectSlot(index));
      }
      cell.addEventListener("dragover", (e) => e.preventDefault());
      cell.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer?.getData("text/plain"));
        if (Number.isInteger(from) && from !== index) this.callbacks.onMoveItem(from, index);
      });
      this.gridEl.appendChild(cell);
    });
  }

  private selectSlot(index: number): void {
    this.selected = this.selected === index ? null : index;
    this.renderGrid();
    this.renderActions();
  }

  private renderActions(): void {
    this.actionsEl.innerHTML = "";
    const slot = this.selected;
    if (slot === null) {
      this.actionsEl.classList.add("hud-hidden");
      return;
    }
    this.actionsEl.classList.remove("hud-hidden");
    const equipBtn = document.createElement("button");
    equipBtn.className = "inv-action-btn";
    equipBtn.textContent = "장착";
    equipBtn.addEventListener("click", () => this.callbacks.onEquip(slot));
    const useBtn = document.createElement("button");
    useBtn.className = "inv-action-btn";
    useBtn.textContent = "사용";
    useBtn.addEventListener("click", () => this.callbacks.onUseItem(slot));
    this.actionsEl.append(equipBtn, useBtn);
  }
}

// --- DOM: shop panel ---------------------------------------------------------------------
//
// Buy renders the real village catalog (`content/shop.ts`'s `shopListing()` — static,
// computed once). Sell lists straight from the owned inventory, wired via the `"inv"`
// message. Opens via `main.ts`'s proximity check (near a `"shop"` NpcMarker) or a
// hotkey/menu button fallback for zones without one.

export interface ShopCallbacks {
  onBuy(defId: string, qty: number): void;
  onSell(slotIndex: number, qty: number): void;
  onClose(): void;
}

export class ShopPanel {
  private view: InventoryView = EMPTY_VIEW;

  private readonly panelEl: HTMLElement;
  private readonly goldEl: HTMLElement;
  private readonly sellListEl: HTMLElement;

  constructor(
    root: HTMLElement,
    private readonly callbacks: ShopCallbacks,
  ) {
    this.panelEl = el("div", "shop-panel hud-hidden");
    const header = el("div", "shop-header");
    const title = el("div", "shop-title");
    title.textContent = "상점";
    this.goldEl = el("div", "shop-gold");
    const closeBtn = el("button", "panel-close");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => this.callbacks.onClose());
    header.append(title, this.goldEl, closeBtn);

    const buyListEl = el("div", "shop-buy-row");
    for (const listing of shopListing()) {
      const row = el("div", "shop-sell-row");
      const label = el("span", "shop-sell-label");
      label.textContent = `${listing.name} — ${listing.buyPrice}G`;
      const btn = document.createElement("button");
      btn.className = "shop-buy-btn";
      btn.textContent = "구매";
      btn.addEventListener("click", () => this.callbacks.onBuy(listing.defId, 1));
      row.append(label, btn);
      buyListEl.appendChild(row);
    }

    this.sellListEl = el("div", "shop-sell-list");

    this.panelEl.append(header, buyListEl, this.sellListEl);
    root.appendChild(this.panelEl);
  }

  toggle(force?: boolean): void {
    if (force === undefined) this.panelEl.classList.toggle("hud-hidden");
    else this.panelEl.classList.toggle("hud-hidden", !force);
  }

  isOpen(): boolean {
    return !this.panelEl.classList.contains("hud-hidden");
  }

  setView(view: InventoryView): void {
    this.view = view;
    this.goldEl.textContent = `${view.gold} G`;
    this.renderSellList();
  }

  private renderSellList(): void {
    this.sellListEl.innerHTML = "";
    this.view.inventory.forEach((item, index) => {
      const row = el("div", "shop-sell-row");
      const label = el("span", "shop-sell-label");
      label.textContent = item.qty > 1 ? `${itemLabel(item.defId)} x${item.qty}` : itemLabel(item.defId);
      const btn = document.createElement("button");
      btn.className = "shop-sell-btn";
      btn.textContent = "판매 1개";
      btn.addEventListener("click", () => this.callbacks.onSell(index, 1));
      row.append(label, btn);
      this.sellListEl.appendChild(row);
    });
  }
}
