/**
 * Emberhold (마을) — the M2 village zone: 60×60, no hostile spawns, a shop NPC marker,
 * a training-dummy marker, a spawn plaza, a handful of building/prop obstacles, and a
 * portal out to Ashen Fields (PLAN-EMBERFALL §2.5/PLAN-EMBERFALL-M2 §6). There is
 * deliberately no direct village->dungeon portal: the dungeon is reached via the field's
 * own `to-dungeon` portal (`zones/ashen-fields.ts`), so the village only needs the one
 * portal out. `playerSpawn` mirrors `persist.ts`'s `STARTING_POS` (30, 30) — update both
 * if this layout ever moves the spawn plaza.
 */

import type { ZoneData } from "./types.js";

export const EMBERHOLD: ZoneData = {
  id: "emberhold",
  width: 60,
  height: 60,
  playerSpawn: { x: 30, y: 30 },

  obstacles: [
    { id: "house-1", x: 15, y: 15, w: 6, h: 6, prop: "prop.house_a" },
    { id: "house-2", x: 45, y: 15, w: 6, h: 6, prop: "prop.house_b", rotation: Math.PI },
    { id: "house-3", x: 15, y: 48, w: 6, h: 6, prop: "prop.house_a", rotation: 1.2 },
    { id: "well", x: 30, y: 20, w: 3, h: 3, prop: "prop.well" },
    { id: "fence-1", x: 48, y: 45, w: 8, h: 2, prop: "prop.fence", rotation: Math.PI / 2 },
    // Off the y=30 spawn->portal travel line (obstacles must never block a straight
    // path between a zone's own spawn and portal points — see zone-transition.test.ts).
    { id: "torch-1", x: 20, y: 24, w: 1, h: 1, prop: "prop.torch" },
    { id: "torch-2", x: 40, y: 36, w: 1, h: 1, prop: "prop.torch" },
  ],

  // Safe zone — no hostile spawns (PLAN §2.5: "몹 없음").
  mobCamps: [],

  npcs: [
    { id: "shop-1", kind: "shop", pos: { x: 35, y: 35 }, prop: "npc.shopkeeper" },
    { id: "dummy-1", kind: "dummy", pos: { x: 22, y: 42 }, prop: "prop.training_dummy" },
  ],

  portals: [{ id: "to-field", kind: "field", pos: { x: 55, y: 30 } }],
};
