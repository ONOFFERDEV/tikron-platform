/**
 * Ashen Fields (잿빛들판) — the M1 field zone: 200×200, 6 monster camps, one field boss,
 * a player spawn, and inert portal markers back to the village / on to the dungeon
 * (both wired for real in M2). PLAN-EMBERFALL §2.3/§2.5. Obstacle ids double as the
 * client's prop-placement key — this module is the single geometry source for both
 * the room's collision (`pushOutOfObstacles`) and the 3D scene's static props.
 */

import type { ZoneData } from "./types.js";

export const ASHEN_FIELDS: ZoneData = {
  id: "ashen-fields",
  width: 200,
  height: 200,
  playerSpawn: { x: 20, y: 100 },

  obstacles: [
    { id: "tree-1", x: 40, y: 40, w: 4, h: 4, prop: "prop.tree_a" },
    { id: "tree-2", x: 40, y: 160, w: 4, h: 4, prop: "prop.tree_a" },
    { id: "tree-3", x: 90, y: 20, w: 4, h: 4, prop: "prop.tree_b" },
    { id: "tree-4", x: 90, y: 180, w: 4, h: 4, prop: "prop.tree_b" },
    { id: "tree-5", x: 170, y: 130, w: 4, h: 4, prop: "prop.tree_a" },
    { id: "tree-6", x: 170, y: 170, w: 4, h: 4, prop: "prop.tree_b" },
    { id: "rock-1", x: 60, y: 90, w: 6, h: 6, prop: "prop.rock_a" },
    { id: "rock-2", x: 120, y: 110, w: 6, h: 6, prop: "prop.rock_a" },
    { id: "rock-3", x: 150, y: 50, w: 5, h: 5, prop: "prop.rock_b" },
    { id: "rock-4", x: 25, y: 60, w: 5, h: 5, prop: "prop.rock_a" },
    { id: "rock-5", x: 25, y: 140, w: 5, h: 5, prop: "prop.rock_a" },
    { id: "tent-1", x: 108, y: 35, w: 5, h: 5, prop: "prop.goblin_tent", rotation: 0.3 },
    { id: "tent-2", x: 112, y: 165, w: 5, h: 5, prop: "prop.goblin_tent", rotation: -0.4 },
  ],

  // 6 camps total (PLAN §2.5): a two-camp wolf pack (aggro-link within a camp, per
  // NpcDef.ai.helpRadius in the content pack) plus one camp per remaining field species.
  mobCamps: [
    { id: "wolf-pack-west", npcDefId: "wolf", count: 3, respawnMs: 8000, home: { x: 70, y: 60 } },
    { id: "wolf-pack-south", npcDefId: "wolf", count: 2, respawnMs: 8000, home: { x: 70, y: 140 } },
    { id: "goblin-scout-camp", npcDefId: "goblin_scout", count: 2, respawnMs: 9000, home: { x: 110, y: 40 } },
    { id: "goblin-thrower-camp", npcDefId: "goblin_thrower", count: 2, respawnMs: 9000, home: { x: 110, y: 160 } },
    { id: "boar-wallow", npcDefId: "boar", count: 2, respawnMs: 10000, home: { x: 140, y: 100 } },
    { id: "goblin-shaman-camp", npcDefId: "goblin_shaman", count: 1, respawnMs: 12000, home: { x: 160, y: 70 } },
  ],

  // Open-tagging field boss, 3-minute respawn (PLAN §2.3).
  fieldBoss: { npcDefId: "boss_chief", pos: { x: 180, y: 100 }, respawnMs: 180000 },

  portals: [
    { id: "to-village", kind: "village", pos: { x: 10, y: 100 } },
    { id: "to-dungeon", kind: "dungeon", pos: { x: 190, y: 100 } },
  ],
};
