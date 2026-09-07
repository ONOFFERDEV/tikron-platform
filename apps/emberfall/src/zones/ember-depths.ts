/**
 * Ember Depths (잉걸불 심연) — the M3 dungeon zone: 120×120, a linear corridor along the
 * x-axis (PLAN-EMBERFALL §2.5: "선형"). The `mobCamps` below are the real M3 roster from
 * `content/emberfall-content.ts` — skeletons, wraiths, stone guardians, and the two scripted
 * bosses (Ser Valen the mid-boss, The Ember Lord the end-boss). A camp holds ONE species, so
 * the mixed encounters (§2.5's warrior+archer opener, the archer+wraith spell gauntlet) are
 * expressed as two co-located camps sharing a home line; `dungeon-room.ts` drives the two
 * bosses' hp-phase scripts (engage/threshold/summon/eruption/enrage/defeated) off their spawn.
 *
 * Layout (entrance x=0 -> end x=120): spawn -> wave 1 (warriors+archer) -> mid-boss (Valen) ->
 * wave 2 (wraiths+archer) -> wave 3 (guardians) -> end-boss (Ember Lord). The exit portal sits
 * a few units off spawn so a fresh join doesn't re-trigger.
 *
 * World dressing (this wave): both corridor walls are LINED with wall/broken-wall segments
 * (cosmetic `decorations` at y≈47 and y≈73, i.e. ±13 off the y=60 travel line), lit by
 * mounted wall torches, with columns, rubble, crates/barrels, and scattered battle-remains
 * (broken sword+shield) standing in for the "잔해·유골". The end-boss room (112,60) gets
 * banners, chests, and rubble framing the star-heart crystal (116,66). All dressing is
 * collision-free `decorations`: it never blocks the spawn(10,60)->portal(5,60) exit line and
 * is kept clear of the wave/boss home points on the y=60 centerline.
 */

import type { ZoneData, ZoneDecoration } from "./types.js";

/** Corridor wall lining — segments run along X natively (no rotation). Mostly intact with a
 *  fraction ruined (wall_broken) for a decayed-keep look. */
const WKIND = ["prop.dungeon_wall", "prop.dungeon_wall", "prop.dungeon_wall_broken"];
function wall(side: string, x: number, i: number, y: number): ZoneDecoration {
  return { id: `wall-${side}-${i}`, pos: { x, y }, prop: WKIND[i % WKIND.length]! };
}

const WALL_X = [22, 31, 40, 49, 58, 67, 76, 85, 94, 103];
const WALLS: ZoneDecoration[] = [
  ...WALL_X.map((x, i) => wall("n", x, i, 47)), // north wall line
  ...WALL_X.map((x, i) => wall("s", x, i, 73)), // south wall line
];

export const EMBER_DEPTHS: ZoneData = {
  id: "ember-depths",
  width: 120,
  height: 120,
  playerSpawn: { x: 10, y: 60 },

  obstacles: [
    { id: "pillar-1", x: 30, y: 45, w: 3, h: 3, prop: "prop.dungeon_pillar" },
    { id: "pillar-2", x: 30, y: 75, w: 3, h: 3, prop: "prop.dungeon_pillar" },
    { id: "pillar-3", x: 90, y: 45, w: 3, h: 3, prop: "prop.dungeon_pillar" },
    { id: "pillar-4", x: 90, y: 75, w: 3, h: 3, prop: "prop.dungeon_pillar" },
    { id: "brazier-1", x: 55, y: 50, w: 2, h: 2, prop: "prop.brazier" },
    { id: "brazier-2", x: 55, y: 70, w: 2, h: 2, prop: "prop.brazier" },
    // Boss-room centerpiece: the pulsing star-heart crystal, off-axis so it clears both the
    // end-boss home (112,60) and the straight spawn(10,60)->portal(5,60) exit line.
    { id: "star-heart", x: 116, y: 66, w: 4, h: 4, prop: "prop.star_heart" },
  ],

  mobCamps: [
    // Wave 1 — the warrior+archer opener, split across two co-located camps (a camp is
    // single-species). The archer sits a few units back off the centerline to read as ranged support.
    { id: "wave-1", npcDefId: "skeleton_warrior", count: 2, respawnMs: 15000, home: { x: 35, y: 60 } },
    { id: "wave-1-archer", npcDefId: "skeleton_archer", count: 1, respawnMs: 15000, home: { x: 35, y: 66 } },
    // Mid-boss — Ser Valen (wraith_commander). Long respawn; the room scripts his hp-phase (engage/half/defeated).
    { id: "mid-boss", npcDefId: "wraith_commander", count: 1, respawnMs: 300000, home: { x: 55, y: 60 } },
    // Wave 2 — spell/slow gauntlet: two wraiths (Spectral Bolt + Soul Chill) plus a trailing archer.
    { id: "wave-2", npcDefId: "wraith", count: 2, respawnMs: 15000, home: { x: 75, y: 60 } },
    { id: "wave-2-archer", npcDefId: "skeleton_archer", count: 1, respawnMs: 15000, home: { x: 75, y: 54 } },
    // Wave 3 — the elite gate: two Stone Guardians (high armor, slow slam).
    { id: "wave-3", npcDefId: "golem", count: 2, respawnMs: 15000, home: { x: 95, y: 60 } },
    // End-boss — The Ember Lord (ember_lord). Long respawn; the room scripts his full phase ladder
    // (engage/phase_summon/phase_aoe/enrage/defeated).
    { id: "end-boss", npcDefId: "ember_lord", count: 1, respawnMs: 600000, home: { x: 112, y: 60 } },
  ],

  portals: [{ id: "to-village", kind: "village", pos: { x: 5, y: 60 } }],

  decorations: [
    // Rune arch framing the exit portal, 1.5 units beyond it (toward the west wall).
    { id: "gate-village", pos: { x: 3.5, y: 60 }, prop: "prop.portal_gate", rotation: Math.PI / 2 },

    // Corridor wall lining (both sides).
    ...WALLS,

    // Mounted wall torches lighting the corridor (just inside the wall lines).
    { id: "torch-n1", pos: { x: 27, y: 49 }, prop: "prop.wall_torch" },
    { id: "torch-n2", pos: { x: 54, y: 49 }, prop: "prop.wall_torch" },
    { id: "torch-n3", pos: { x: 81, y: 49 }, prop: "prop.wall_torch" },
    { id: "torch-n4", pos: { x: 104, y: 49 }, prop: "prop.wall_torch" },
    { id: "torch-s1", pos: { x: 40, y: 71 }, prop: "prop.wall_torch" },
    { id: "torch-s2", pos: { x: 67, y: 71 }, prop: "prop.wall_torch" },
    { id: "torch-s3", pos: { x: 94, y: 71 }, prop: "prop.wall_torch" },
    { id: "torch-s4", pos: { x: 18, y: 71 }, prop: "prop.wall_torch" },

    // Stout columns interspersed for structure.
    { id: "col-1", pos: { x: 45, y: 52 }, prop: "prop.dungeon_column" },
    { id: "col-2", pos: { x: 70, y: 52 }, prop: "prop.dungeon_column", rotation: 0.4 },
    { id: "col-3", pos: { x: 60, y: 68 }, prop: "prop.dungeon_column" },
    { id: "col-4", pos: { x: 85, y: 68 }, prop: "prop.dungeon_column", rotation: 0.6 },
    { id: "col-5", pos: { x: 52, y: 68 }, prop: "prop.dungeon_column" },
    { id: "col-6", pos: { x: 78, y: 52 }, prop: "prop.dungeon_column", rotation: 0.2 },

    // Corridor debris — rubble, crates/barrels, and battle-remains, off the y=60 home points.
    { id: "deb-1", pos: { x: 28, y: 56 }, prop: "prop.dungeon_barrel" },
    { id: "deb-2", pos: { x: 28, y: 64 }, prop: "prop.rubble_small", rotation: 0.7 },
    { id: "deb-3", pos: { x: 42, y: 64 }, prop: "prop.battle_remains", rotation: 1.2 },
    { id: "deb-4", pos: { x: 48, y: 56 }, prop: "prop.rubble", rotation: 2.0 },
    { id: "deb-5", pos: { x: 58, y: 66 }, prop: "prop.dungeon_crate", rotation: 0.5 },
    { id: "deb-6", pos: { x: 66, y: 57 }, prop: "prop.dungeon_crate", rotation: 1.1 },
    { id: "deb-7", pos: { x: 66, y: 63 }, prop: "prop.dungeon_barrel" },
    { id: "deb-8", pos: { x: 72, y: 66 }, prop: "prop.rubble_small", rotation: 1.6 },
    { id: "deb-9", pos: { x: 84, y: 56 }, prop: "prop.rubble", rotation: 0.3 },
    { id: "deb-10", pos: { x: 84, y: 64 }, prop: "prop.dungeon_crate", rotation: 2.4 },
    { id: "deb-11", pos: { x: 90, y: 54 }, prop: "prop.battle_remains", rotation: 0.9 },
    { id: "deb-12", pos: { x: 101, y: 55 }, prop: "prop.battle_remains", rotation: 2.7 },

    // End-boss room (112,60) drama, framing the star-heart (116,66).
    { id: "boss-banner-1", pos: { x: 108, y: 50 }, prop: "prop.banner", rotation: 0 },
    { id: "boss-banner-2", pos: { x: 120, y: 50 }, prop: "prop.banner", rotation: 0 },
    { id: "boss-banner-3", pos: { x: 118, y: 72 }, prop: "prop.banner", rotation: Math.PI },
    { id: "boss-chest-1", pos: { x: 110, y: 72 }, prop: "prop.dungeon_chest", rotation: 0.5 },
    { id: "boss-chest-2", pos: { x: 120, y: 66 }, prop: "prop.dungeon_chest", rotation: -0.6 },
    { id: "boss-remains-1", pos: { x: 106, y: 66 }, prop: "prop.battle_remains", rotation: 1.3 },
    { id: "boss-remains-2", pos: { x: 118, y: 54 }, prop: "prop.battle_remains", rotation: 2.2 },
    { id: "boss-rubble-1", pos: { x: 104, y: 54 }, prop: "prop.rubble", rotation: 1.0 },
    { id: "boss-rubble-2", pos: { x: 122, y: 60 }, prop: "prop.rubble_small", rotation: 0.4 },
  ],
};
