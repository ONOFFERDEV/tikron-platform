/**
 * Ashen Fields (잿빛들판) — the M1 field zone: 200×200, 6 monster camps, one field boss,
 * a player spawn, and portals back to the village / on to the dungeon. PLAN-EMBERFALL
 * §2.3/§2.5. Obstacle ids double as the client's prop-placement key — this module is the
 * single geometry source for both the room's collision (`pushOutOfObstacles`) and the 3D
 * scene's static props.
 *
 * World dressing (this wave): a bare grey mountain RING (cosmetic `decorations` at coords
 * OUTSIDE 0..200 — client renders decorations anywhere; the server clamps movement to the
 * bounds), with gaps on the west (village portal) and east (dungeon portal) edges so both
 * portal directions read as open passes. Near the dungeon portal, the toppled ruins of
 * Brandel Keep (broken walls / columns / rubble). The two goblin camps and the shaman camp
 * get tents + a campfire (brazier) + a totem (pillar). Dead stumps and rock outcrops are
 * scattered in loose clusters (empty stretches left between them to keep the wasteland feel).
 *
 * Constraints honored: (1) zone-transition.test.ts walks a player across the whole y=100
 * line (village portal x=10 -> dungeon portal x=190), so NO new *obstacle* is added — every
 * dressing item is a collision-free `decoration`. (2) Nothing is placed within ~6 units of a
 * mob-camp/boss home (combat sightline): homes at wolf (70,60)/(70,140), goblin-scout
 * (110,40), goblin-thrower (110,160), boar (140,100), shaman (160,70), boss (180,100).
 */

import type { ZoneData, ZoneDecoration } from "./types.js";

/** Bare-mountain ring pieces (three GLTF aliases + per-index rotation for a varied skyline).
 *  Coords sit outside the 0..200 play area — pure backdrop the player can never reach. */
const M = ["prop.mountain_a", "prop.mountain_b", "prop.mountain_lg"];
function mtn(edge: string, x: number, y: number, i: number): ZoneDecoration {
  return { id: `ring-${edge}-${i}`, pos: { x, y }, prop: M[i % M.length]!, rotation: (i * 0.9) % (Math.PI * 2) };
}

const EDGE_X = [-6, 14, 34, 54, 74, 94, 114, 134, 154, 174, 194, 206];
const RING: ZoneDecoration[] = [
  ...EDGE_X.map((x, i) => mtn("s", x, -6, i)), // south edge
  ...EDGE_X.map((x, i) => mtn("n", x, 206, i)), // north edge
  ...[14, 34, 54, 74, 126, 146, 166, 186].map((y, i) => mtn("w", -6, y, i)), // west — gap ~y88..112 (village portal)
  ...[14, 34, 54, 74, 126, 146, 166, 186].map((y, i) => mtn("e", 206, y, i)), // east — gap ~y88..112 (dungeon portal)
];

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

  // 6 camps total (PLAN §2.5).
  mobCamps: [
    { id: "wolf-pack-west", npcDefId: "wolf", count: 3, respawnMs: 8000, home: { x: 70, y: 60 } },
    { id: "wolf-pack-south", npcDefId: "wolf", count: 2, respawnMs: 8000, home: { x: 70, y: 140 } },
    { id: "goblin-scout-camp", npcDefId: "goblin_scout", count: 2, respawnMs: 9000, home: { x: 110, y: 40 } },
    { id: "goblin-thrower-camp", npcDefId: "goblin_thrower", count: 2, respawnMs: 9000, home: { x: 110, y: 160 } },
    { id: "boar-wallow", npcDefId: "boar", count: 2, respawnMs: 10000, home: { x: 140, y: 100 } },
    { id: "goblin-shaman-camp", npcDefId: "goblin_shaman", count: 1, respawnMs: 12000, home: { x: 160, y: 70 } },
  ],

  fieldBoss: { npcDefId: "boss_chief", pos: { x: 180, y: 100 }, respawnMs: 180000 },

  portals: [
    { id: "to-village", kind: "village", pos: { x: 10, y: 100 } },
    { id: "to-dungeon", kind: "dungeon", pos: { x: 190, y: 100 } },
  ],

  decorations: [
    // Rune arches framing each portal, set 1.5 units outward (away from the field interior).
    { id: "gate-village", pos: { x: 8.5, y: 100 }, prop: "prop.portal_gate", rotation: Math.PI / 2 },
    { id: "gate-dungeon", pos: { x: 191.5, y: 100 }, prop: "prop.portal_gate", rotation: Math.PI / 2 },

    // Boundary mountain ring (cosmetic, outside play bounds).
    ...RING,

    // Brandel Keep ruins, flanking the dungeon portal (190,100) — toppled walls/columns/rubble.
    { id: "fort-wall-1", pos: { x: 180, y: 88 }, prop: "prop.dungeon_wall_broken", rotation: 0.2 },
    { id: "fort-wall-2", pos: { x: 186, y: 86 }, prop: "prop.dungeon_wall_broken", rotation: 1.4 },
    { id: "fort-wall-3", pos: { x: 178, y: 112 }, prop: "prop.dungeon_wall_broken", rotation: 2.7 },
    { id: "fort-col-1", pos: { x: 183, y: 92 }, prop: "prop.dungeon_column" },
    { id: "fort-col-2", pos: { x: 187, y: 108 }, prop: "prop.dungeon_column", rotation: 0.5 },
    { id: "fort-col-3", pos: { x: 173, y: 106 }, prop: "prop.dungeon_column" },
    { id: "fort-rubble-1", pos: { x: 182, y: 110 }, prop: "prop.rubble", rotation: 0.8 },
    { id: "fort-rubble-2", pos: { x: 184, y: 94 }, prop: "prop.rubble", rotation: 2.1 },
    { id: "fort-rubble-3", pos: { x: 174, y: 96 }, prop: "prop.rubble", rotation: 1.5 },

    // Goblin camp #1 (scout, home 110,40) — dressing kept outside the 6-unit home radius.
    { id: "camp1-fire", pos: { x: 110, y: 48 }, prop: "prop.brazier" },
    { id: "camp1-tent", pos: { x: 115, y: 45 }, prop: "prop.goblin_tent", rotation: 0.6 },
    { id: "camp1-totem", pos: { x: 104, y: 45 }, prop: "prop.dungeon_pillar" },

    // Goblin camp #2 (thrower, home 110,160).
    { id: "camp2-fire", pos: { x: 110, y: 152 }, prop: "prop.brazier" },
    { id: "camp2-tent", pos: { x: 105, y: 156 }, prop: "prop.goblin_tent", rotation: -0.4 },
    { id: "camp2-totem", pos: { x: 116, y: 156 }, prop: "prop.dungeon_pillar" },

    // Shaman camp (home 160,70).
    { id: "camp3-fire", pos: { x: 160, y: 78 }, prop: "prop.brazier" },
    { id: "camp3-totem", pos: { x: 154, y: 66 }, prop: "prop.dungeon_pillar" },
    { id: "camp3-tent", pos: { x: 166, y: 66 }, prop: "prop.goblin_tent", rotation: 0.8 },

    // Dead-stump / rock-outcrop clusters (loose 2-4 groupings, empty stretches between).
    { id: "cl-a-1", pos: { x: 28, y: 48 }, prop: "prop.dead_tree", rotation: 0.4 },
    { id: "cl-a-2", pos: { x: 31, y: 52 }, prop: "prop.dead_tree_b", rotation: 1.9 },
    { id: "cl-a-3", pos: { x: 26, y: 53 }, prop: "prop.dead_tree", rotation: 2.6 },
    { id: "cl-a-4", pos: { x: 30, y: 55 }, prop: "prop.rock_a" },
    { id: "cl-b-1", pos: { x: 48, y: 148 }, prop: "prop.dead_tree", rotation: 1.1 },
    { id: "cl-b-2", pos: { x: 52, y: 152 }, prop: "prop.dead_tree_b", rotation: 0.7 },
    { id: "cl-b-3", pos: { x: 50, y: 155 }, prop: "prop.rock_b" },
    { id: "cl-c-1", pos: { x: 148, y: 128 }, prop: "prop.dead_tree", rotation: 2.2 },
    { id: "cl-c-2", pos: { x: 152, y: 132 }, prop: "prop.dead_tree_b", rotation: 0.3 },
    { id: "cl-c-3", pos: { x: 150, y: 135 }, prop: "prop.rock_a" },
    { id: "cl-d-1", pos: { x: 38, y: 118 }, prop: "prop.dead_tree", rotation: 1.5 },
    { id: "cl-d-2", pos: { x: 42, y: 122 }, prop: "prop.rock_b" },
    { id: "cl-d-3", pos: { x: 40, y: 124 }, prop: "prop.dead_tree_b", rotation: 2.9 },
    { id: "cl-e-1", pos: { x: 88, y: 88 }, prop: "prop.dead_tree", rotation: 0.6 },
    { id: "cl-e-2", pos: { x: 92, y: 92 }, prop: "prop.dead_tree_b", rotation: 1.7 },
    { id: "cl-e-3", pos: { x: 90, y: 94 }, prop: "prop.rock_a" },
    { id: "cl-f-1", pos: { x: 128, y: 58 }, prop: "prop.dead_tree", rotation: 2.0 },
    { id: "cl-f-2", pos: { x: 132, y: 62 }, prop: "prop.dead_tree_b", rotation: 0.9 },
    { id: "cl-g-1", pos: { x: 58, y: 178 }, prop: "prop.dead_tree", rotation: 1.3 },
    { id: "cl-g-2", pos: { x: 62, y: 182 }, prop: "prop.rock_b" },
    { id: "cl-h-1", pos: { x: 168, y: 38 }, prop: "prop.dead_tree", rotation: 0.2 },
    { id: "cl-h-2", pos: { x: 172, y: 42 }, prop: "prop.dead_tree_b", rotation: 2.4 },
    { id: "cl-h-3", pos: { x: 170, y: 45 }, prop: "prop.rock_a" },

    // Sparse stumps near the wolf packs (outside their home radius).
    { id: "wolf-w-1", pos: { x: 78, y: 66 }, prop: "prop.dead_tree", rotation: 1.0 },
    { id: "wolf-w-2", pos: { x: 62, y: 54 }, prop: "prop.dead_tree_b", rotation: 2.3 },
    { id: "wolf-s-1", pos: { x: 78, y: 146 }, prop: "prop.dead_tree", rotation: 0.5 },
    { id: "wolf-s-2", pos: { x: 62, y: 134 }, prop: "prop.dead_tree_b", rotation: 1.8 },
  ],
};
