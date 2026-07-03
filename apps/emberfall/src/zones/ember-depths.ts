/**
 * Ember Depths (잉걸불 심연) — the M2 dungeon zone: 120×120, a linear corridor along the
 * x-axis (PLAN-EMBERFALL §2.5: "선형"). M2 is wave/boss SKELETON only — every `mobCamps`
 * entry below is a **stand-in** using an existing Ashen Fields species (no dungeon-only
 * content exists yet: real skeletons/wraiths/golems and the two scripted boss phases are
 * M3, `PLAN-EMBERFALL-M2` §9's explicit scope line). Reusing `content/emberfall-content.ts`
 * ids unchanged keeps this zone playable today without touching that file (out of this
 * wave's boundary) and without adding new species `content.test.ts` would then have to
 * account for.
 *
 * Layout (entrance at x=0 -> end at x=120): spawn -> wave 1 -> mid-boss -> wave 2 ->
 * wave 3 -> end-boss. The exit portal sits a few units off the spawn point (not on top
 * of it) so a freshly-joined player doesn't immediately re-trigger a transfer.
 */

import type { ZoneData } from "./types.js";

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
  ],

  mobCamps: [
    // Wave 1 ("skeleton" stand-in — see docblock).
    { id: "wave-1", npcDefId: "goblin_scout", count: 2, respawnMs: 15000, home: { x: 35, y: 60 } },
    // Mid-point boss (single spawn slot, long respawn). Stand-in for M3's real mid-boss.
    { id: "mid-boss", npcDefId: "boss_chief", count: 1, respawnMs: 300000, home: { x: 55, y: 60 } },
    // Wave 2 ("skeleton archer" stand-in).
    { id: "wave-2", npcDefId: "goblin_thrower", count: 2, respawnMs: 15000, home: { x: 75, y: 60 } },
    // Wave 3 ("elite/golem" stand-in).
    { id: "wave-3", npcDefId: "boar", count: 3, respawnMs: 15000, home: { x: 95, y: 60 } },
    // End boss (single spawn slot, long respawn). Stand-in for M3's 잉걸불 군주.
    { id: "end-boss", npcDefId: "boss_chief", count: 1, respawnMs: 600000, home: { x: 112, y: 60 } },
  ],

  portals: [{ id: "to-village", kind: "village", pos: { x: 5, y: 60 } }],
};
