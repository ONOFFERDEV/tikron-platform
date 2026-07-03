import { describe, it, expect } from "vitest";
import { VillageRoomImpl } from "../src/rooms/village-room.js";
import { FieldRoomImpl } from "../src/rooms/field-room.js";
import { DungeonRoomImpl } from "../src/rooms/dungeon-room.js";

describe("ember-rooms", () => {
  it("exports the three zone room classes", () => {
    expect(typeof VillageRoomImpl).toBe("function");
    expect(typeof FieldRoomImpl).toBe("function");
    expect(typeof DungeonRoomImpl).toBe("function");
  });
});
