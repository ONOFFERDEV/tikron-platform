import { describe, it, expect } from "vitest";
import { parseInventoryMessage, parseTransferPayload, parseLootOverflow, ZONE_PARTY, FIELD_PARTY, toUnitData } from "../client/net.js";
import { toSlotGrid, itemLabel, equipSlotLabel } from "../client/inventory-ui.js";
import { bootReducer, INITIAL_BOOT_STATE, type BootState } from "../client/start-screen.js";
import { projectToMinimap } from "../client/minimap.js";
import type { EmberUnit } from "../src/rooms/ember-schema.js";
import type { ItemInstance, SavedCharacter } from "../src/types.js";

/**
 * Pure-logic coverage for Wave B3's M2 additions: the owner-only inventory message ->
 * view-model, the zone-transfer payload parser, the inventory grid/equip-slot/item-label
 * helpers, the create/continue boot state machine, and the minimap projection. No
 * DOM/three — the DOM-owning pieces (StartScreen, InventoryPanel, ShopPanel, Minimap,
 * NetSession) are exercised visually / by the E2E smoke, same split as client-net.test.ts.
 */

function unit(overrides: Partial<EmberUnit> = {}): EmberUnit {
  return {
    x: 10,
    y: 20,
    facing: 0,
    hp: 80,
    maxHp: 100,
    mp: 30,
    maxMp: 50,
    level: 3,
    class: "warrior",
    kind: "player",
    alive: true,
    cast: "",
    castEnd: 0,
    ...overrides,
  };
}

describe("ZONE_PARTY (SavedZone -> Durable Object party)", () => {
  it("maps every saved zone to its kebab-case room binding", () => {
    expect(ZONE_PARTY.emberhold).toBe("village-room");
    expect(ZONE_PARTY["ashen-fields"]).toBe(FIELD_PARTY);
    expect(ZONE_PARTY["ember-depths"]).toBe("dungeon-room");
  });
});

describe("parseInventoryMessage (owner-only \"inv\" message -> InventoryView)", () => {
  it("parses a well-formed payload", () => {
    const raw = {
      inventory: [{ defId: "iron-sword", qty: 1 }, { defId: "health-potion", qty: 3, uid: "abc" }],
      equipment: { weapon: { defId: "rusty-sword", qty: 1 } },
      gold: 42,
    };
    expect(parseInventoryMessage(raw)).toEqual({
      inventory: raw.inventory,
      equipment: { weapon: { defId: "rusty-sword", qty: 1 } },
      gold: 42,
    });
  });

  it("defaults equipment to {} when absent", () => {
    const view = parseInventoryMessage({ inventory: [], gold: 0 });
    expect(view).toEqual({ inventory: [], equipment: {}, gold: 0 });
  });

  it("drops unrecognized equipment slot keys but keeps valid ones", () => {
    const view = parseInventoryMessage({
      inventory: [],
      equipment: { weapon: { defId: "sword", qty: 1 }, bogus: { defId: "x", qty: 1 } },
      gold: 0,
    });
    expect(view?.equipment).toEqual({ weapon: { defId: "sword", qty: 1 } });
  });

  it("rejects a payload whose inventory isn't an array", () => {
    expect(parseInventoryMessage({ inventory: "nope", gold: 0 })).toBeNull();
  });

  it("rejects a payload with a malformed item instance", () => {
    expect(parseInventoryMessage({ inventory: [{ defId: "x" }], gold: 0 })).toBeNull(); // missing qty
  });

  it("rejects a payload missing gold", () => {
    expect(parseInventoryMessage({ inventory: [] })).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(parseInventoryMessage(null)).toBeNull();
    expect(parseInventoryMessage("inv")).toBeNull();
  });
});

describe("parseTransferPayload (\"transfer\" message -> TransferTarget)", () => {
  it("parses a well-formed payload", () => {
    expect(parseTransferPayload({ zone: "emberhold", party: "village-room", room: "emberhold-1" })).toEqual({
      zone: "emberhold",
      party: "village-room",
      room: "emberhold-1",
    });
  });

  it("rejects an unrecognized zone id", () => {
    expect(parseTransferPayload({ zone: "moon-base", party: "village-room", room: "x" })).toBeNull();
  });

  it("rejects a missing/empty party or room", () => {
    expect(parseTransferPayload({ zone: "emberhold", party: "", room: "x" })).toBeNull();
    expect(parseTransferPayload({ zone: "emberhold", party: "village-room", room: "" })).toBeNull();
    expect(parseTransferPayload({ zone: "emberhold" })).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(parseTransferPayload(undefined)).toBeNull();
  });
});

describe("parseLootOverflow (\"lootOverflow\" message -> overflow count, PLAN-EMBERFALL-M2-SECFIX FIX-5)", () => {
  it("returns the overflow count from a well-formed payload", () => {
    expect(parseLootOverflow({ overflow: 3 })).toBe(3);
  });

  it("rejects a zero or negative overflow (nothing was actually dropped)", () => {
    expect(parseLootOverflow({ overflow: 0 })).toBeNull();
    expect(parseLootOverflow({ overflow: -1 })).toBeNull();
  });

  it("rejects a non-numeric overflow or non-object input", () => {
    expect(parseLootOverflow({ overflow: "3" })).toBeNull();
    expect(parseLootOverflow({})).toBeNull();
    expect(parseLootOverflow(null)).toBeNull();
    expect(parseLootOverflow(undefined)).toBeNull();
  });
});

describe("toUnitData gear fields (defensive read ahead of Wave B2's schema fields)", () => {
  it("omits weaponVisual/armorVisual when the unit has no gear fields (current schema)", () => {
    const data = toUnitData("p1", unit(), "p1");
    expect(data).not.toHaveProperty("weaponVisual");
    expect(data).not.toHaveProperty("armorVisual");
  });

  it("picks up weapon/armor if present on the unit object (forward-compat with B2's schema fields)", () => {
    // Simulates the schema gaining `weapon`/`armor: str(16)` (PLAN-EMBERFALL-M2 §7) before
    // this file's type import is updated — a plain object shaped like a future EmberUnit.
    const futureUnit = { ...unit(), weapon: "unit.iron-sword", armor: "" } as EmberUnit;
    const data = toUnitData("p1", futureUnit, "p1");
    expect(data.weaponVisual).toBe("unit.iron-sword");
    expect(data).not.toHaveProperty("armorVisual"); // "" = class default, per the contract
  });
});

describe("toSlotGrid (inventory array -> fixed-size slot grid)", () => {
  const items: ItemInstance[] = [{ defId: "a", qty: 1 }, { defId: "b", qty: 2 }];

  it("pads a short inventory with nulls up to the slot count", () => {
    const grid = toSlotGrid(items, 4);
    expect(grid).toEqual([{ defId: "a", qty: 1 }, { defId: "b", qty: 2 }, null, null]);
  });

  it("defaults to INVENTORY_SLOTS (16) when no count is given", () => {
    expect(toSlotGrid([])).toHaveLength(16);
  });

  it("truncates an inventory longer than the slot count", () => {
    expect(toSlotGrid(items, 1)).toEqual([{ defId: "a", qty: 1 }]);
  });
});

describe("itemLabel / equipSlotLabel", () => {
  it("resolves a real catalog defId to its content/items.ts name", () => {
    expect(itemLabel("warrior-sword-basic")).toBe("Iron Sword");
    expect(itemLabel("potion-hp")).toBe("Health Potion");
  });

  it("falls back to humanizing a kebab-case defId the catalog doesn't recognize", () => {
    expect(itemLabel("iron-sword")).toBe("Iron Sword");
    expect(itemLabel("health-potion")).toBe("Health Potion");
    expect(itemLabel("bow")).toBe("Bow");
  });

  it("labels every equip slot in Korean", () => {
    expect(equipSlotLabel("weapon")).toBe("무기");
    expect(equipSlotLabel("armor")).toBe("방어구");
    expect(equipSlotLabel("trinket")).toBe("장신구");
  });
});

describe("bootReducer (create/continue flow state machine)", () => {
  const character: SavedCharacter = {
    id: "c1",
    nickname: "Tester",
    class: "warrior",
    level: 1,
    xp: 0,
    gold: 50,
    zone: "emberhold",
    x: 30,
    y: 30,
    hp: 100,
    mp: 50,
    inventory: [],
    equipment: {},
    playMs: 0,
    createdAt: 0,
    updatedAt: 0,
  };

  it("starts in the menu with no error", () => {
    expect(INITIAL_BOOT_STATE).toEqual({ phase: "menu", error: null });
  });

  it("moves to pending on a create or continue submit", () => {
    expect(bootReducer(INITIAL_BOOT_STATE, { type: "createSubmit" })).toEqual({ phase: "pending" });
    expect(bootReducer(INITIAL_BOOT_STATE, { type: "continueSubmit" })).toEqual({ phase: "pending" });
  });

  it("ignores a second submit while already pending (no double-submit race)", () => {
    const pending: BootState = { phase: "pending" };
    expect(bootReducer(pending, { type: "createSubmit" })).toBe(pending);
    expect(bootReducer(pending, { type: "continueSubmit" })).toBe(pending);
  });

  it("moves to ready with the token/character on success", () => {
    const pending: BootState = { phase: "pending" };
    expect(bootReducer(pending, { type: "success", token: "tok-1", character })).toEqual({
      phase: "ready",
      token: "tok-1",
      character,
    });
  });

  it("falls back to the menu with an error message on failure", () => {
    const pending: BootState = { phase: "pending" };
    expect(bootReducer(pending, { type: "failure", error: "nickname_taken" })).toEqual({
      phase: "menu",
      error: "nickname_taken",
    });
  });

  it("reset clears back to a fresh menu state", () => {
    const ready: BootState = { phase: "ready", token: "tok-1", character };
    expect(bootReducer(ready, { type: "reset" })).toEqual({ phase: "menu", error: null });
  });
});

describe("projectToMinimap (zone-space -> minimap pixel space)", () => {
  it("maps the zone's top-left/bottom-right corners to the pixel bounds", () => {
    expect(projectToMinimap(0, 0, 200, 200, 160)).toEqual({ x: 0, y: 0 });
    expect(projectToMinimap(200, 200, 200, 200, 160)).toEqual({ x: 160, y: 160 });
  });

  it("scales proportionally for a non-square zone", () => {
    expect(projectToMinimap(30, 30, 60, 120, 160)).toEqual({ x: 80, y: 40 });
  });

  it("clamps an out-of-bounds point to the map edge instead of drawing off-canvas", () => {
    expect(projectToMinimap(-10, 500, 200, 200, 160)).toEqual({ x: 0, y: 160 });
  });

  it("treats a non-positive zone dimension as 1 rather than dividing by zero", () => {
    expect(projectToMinimap(5, 5, 0, -10, 160)).toEqual({ x: 160, y: 160 });
  });
});
