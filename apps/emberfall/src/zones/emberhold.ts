/**
 * Emberhold (마을) — the M2 village zone: 60×60, no hostile spawns, a shop NPC marker,
 * a training-dummy marker, a spawn plaza, building obstacles, and a portal out to Ashen
 * Fields (PLAN-EMBERFALL §2.5/PLAN-EMBERFALL-M2 §6). There is deliberately no direct
 * village->dungeon portal: the dungeon is reached via the field's own `to-dungeon` portal.
 * `playerSpawn` mirrors `persist.ts`'s `STARTING_POS` (30, 30) — update both if this layout
 * ever moves the spawn plaza.
 *
 * World dressing (this wave): the interior is dense with market crates/barrels, a torch-lit
 * "main street" line from the plaza toward the field portal, yard fences around the houses,
 * a fenced training ground, and well-side props. A forested-mountain RING (cosmetic
 * `decorations`, placed at coords OUTSIDE 0..60 — the client renders decorations anywhere,
 * the server clamps movement to the play bounds) encloses the village on all sides EXCEPT a
 * gap on the east edge (around y≈30) so the eye reads an opening toward the fields/portal.
 *
 * Path invariant (zone-transition.test.ts drives a player spawn(30,30)->portal(55,30)):
 * every *obstacle* AABB is kept off the y=30 travel line for x∈[30,55], and clear of the
 * two NPC markers (vendor 35,35 / dummy 22,42). All fine dressing is `decorations` (no
 * server collision), so it never affects movement.
 */

import type { ZoneData, ZoneDecoration } from "./types.js";

/** Forested-mountain ring pieces (two scale aliases of the same GLTF + per-index rotation
 *  break up the repeated silhouette). Coords intentionally sit outside the 0..60 play area. */
const VM = ["prop.mountain_forest", "prop.mountain_forest_lg"];
function vm(edge: string, x: number, y: number, i: number): ZoneDecoration {
  return { id: `ring-${edge}-${i}`, pos: { x, y }, prop: VM[i % VM.length]!, rotation: (i * 1.3) % (Math.PI * 2) };
}

const RING: ZoneDecoration[] = [
  ...[-4, 6, 16, 26, 36, 46, 56, 64].map((x, i) => vm("s", x, -4, i)), // south edge
  ...[-4, 6, 16, 26, 36, 46, 56, 64].map((x, i) => vm("n", x, 63, i)), // north edge
  ...[8, 20, 32, 44, 56].map((y, i) => vm("w", -4, y, i)), // west edge
  ...[8, 20, 46, 58].map((y, i) => vm("e", 64, y, i)), // east edge — gap around y≈30 (portal side)
];

export const EMBERHOLD: ZoneData = {
  id: "emberhold",
  width: 60,
  height: 60,
  playerSpawn: { x: 30, y: 30 },

  obstacles: [
    // Houses — a 6-building village (mixed variants). All off the y=30 spawn->portal line
    // and clear of the two NPC markers.
    { id: "house-1", x: 15, y: 15, w: 6, h: 6, prop: "prop.house_a" },
    { id: "house-2", x: 45, y: 15, w: 6, h: 6, prop: "prop.house_b", rotation: Math.PI },
    { id: "house-3", x: 15, y: 48, w: 6, h: 6, prop: "prop.house_a", rotation: 1.2 },
    { id: "house-4", x: 47, y: 48, w: 5, h: 5, prop: "prop.house_c", rotation: Math.PI }, // tavern (SE)
    { id: "house-5", x: 48, y: 22, w: 6, h: 6, prop: "prop.house_a", rotation: -1.0 },
    { id: "house-6", x: 24, y: 13, w: 6, h: 6, prop: "prop.house_b", rotation: 0.6 },
    { id: "windmill", x: 52, y: 52, w: 4, h: 4, prop: "prop.windmill" }, // corner landmark
    { id: "well", x: 30, y: 20, w: 3, h: 3, prop: "prop.well" },
    // The market building stands just behind the Roza vendor marker as her stall. Off the
    // y=30 travel line.
    { id: "market-stall", x: 37.5, y: 37.5, w: 3, h: 3, prop: "npc.shopkeeper" },
    // Village hearth, just south of the spawn plaza (off the travel line).
    { id: "everhearth", x: 30, y: 38, w: 2, h: 2, prop: "prop.everhearth" },
    { id: "torch-1", x: 20, y: 24, w: 1, h: 1, prop: "prop.torch" },
    { id: "torch-2", x: 40, y: 36, w: 1, h: 1, prop: "prop.torch" },
  ],

  // Safe zone — no hostile spawns (PLAN §2.5: "몹 없음").
  mobCamps: [],

  npcs: [
    { id: "shop-1", kind: "shop", pos: { x: 35, y: 35 }, prop: "npc.vendor" },
    { id: "dummy-1", kind: "dummy", pos: { x: 22, y: 42 }, prop: "prop.training_dummy" },
  ],

  portals: [{ id: "to-field", kind: "field", pos: { x: 55, y: 30 } }],

  decorations: [
    // Rune arch framing the field portal, set 1.5 units beyond it (away from spawn).
    { id: "gate-field", pos: { x: 56.5, y: 30 }, prop: "prop.portal_gate", rotation: Math.PI / 2 },

    // Boundary mountain ring (cosmetic, outside play bounds).
    ...RING,

    // Market square dressing — crates/barrels around the stall (37.5,37.5) & vendor (35,35).
    { id: "mkt-crate-1", pos: { x: 40, y: 40 }, prop: "prop.crate", rotation: 0.3 },
    { id: "mkt-barrel-1", pos: { x: 41, y: 37.5 }, prop: "prop.barrel" },
    { id: "mkt-crate-2", pos: { x: 34.5, y: 39.5 }, prop: "prop.crate", rotation: 1.1 },
    { id: "mkt-barrel-2", pos: { x: 39.5, y: 34.5 }, prop: "prop.barrel" },
    { id: "mkt-crate-3", pos: { x: 42, y: 35.5 }, prop: "prop.crate", rotation: 0.8 },
    { id: "mkt-barrel-3", pos: { x: 35.5, y: 41 }, prop: "prop.barrel" },
    { id: "mkt-crate-4", pos: { x: 38, y: 41.5 }, prop: "prop.crate", rotation: 2.0 },

    // "Main street" torch line — flanks the y=30 plaza->portal route at y=27 / y=33 (never
    // on the y=30 line itself), reading as a lit path east.
    { id: "lamp-s1", pos: { x: 34, y: 27 }, prop: "prop.torch" },
    { id: "lamp-s2", pos: { x: 41, y: 27 }, prop: "prop.torch" },
    { id: "lamp-s3", pos: { x: 48, y: 27 }, prop: "prop.torch" },
    { id: "lamp-n1", pos: { x: 34, y: 33 }, prop: "prop.torch" },
    { id: "lamp-n2", pos: { x: 41, y: 33 }, prop: "prop.torch" },
    { id: "lamp-n3", pos: { x: 48, y: 33 }, prop: "prop.torch" },

    // Yard fences around houses (cosmetic; rot 0 runs along Y, PI/2 along X).
    { id: "fence-h1a", pos: { x: 15, y: 19 }, prop: "prop.fence", rotation: Math.PI / 2 },
    { id: "fence-h1b", pos: { x: 19, y: 16 }, prop: "prop.fence" },
    { id: "fence-h2a", pos: { x: 45, y: 19 }, prop: "prop.fence", rotation: Math.PI / 2 },
    { id: "fence-h3a", pos: { x: 15, y: 44 }, prop: "prop.fence", rotation: Math.PI / 2 },
    { id: "fence-h3b", pos: { x: 19, y: 48 }, prop: "prop.fence" },
    { id: "fence-tav", pos: { x: 43, y: 46 }, prop: "prop.fence", rotation: Math.PI / 2 },

    // Training ground border (dummy at 22,42) — low fences on three sides, open to the plaza.
    { id: "train-fence-1", pos: { x: 22, y: 45.5 }, prop: "prop.fence", rotation: Math.PI / 2 },
    { id: "train-fence-2", pos: { x: 26, y: 42 }, prop: "prop.fence" },
    { id: "train-fence-3", pos: { x: 18, y: 42 }, prop: "prop.fence" },
    { id: "train-torch", pos: { x: 26, y: 45 }, prop: "prop.torch" },
    { id: "train-crate", pos: { x: 18, y: 45 }, prop: "prop.crate", rotation: 0.5 },

    // Well-side props (well at 30,20).
    { id: "well-crate-1", pos: { x: 27, y: 22 }, prop: "prop.crate", rotation: 0.9 },
    { id: "well-barrel-1", pos: { x: 33, y: 22 }, prop: "prop.barrel" },
    { id: "well-torch", pos: { x: 30, y: 16 }, prop: "prop.torch" },

    // Plaza/hearth clutter (south of spawn, off the y=30 line).
    { id: "plaza-barrel-1", pos: { x: 27, y: 40 }, prop: "prop.barrel" },
    { id: "plaza-crate-1", pos: { x: 33, y: 40 }, prop: "prop.crate", rotation: 1.4 },
  ],
};
