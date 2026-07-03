/**
 * Zone data format — the shared geometry + spawn tables a zone room and the 3D client
 * both read from the SAME module (PLAN-EMBERFALL §2.5/§3: "서버·클라 단일 소스"). No
 * server imports here: the client bundles this file directly to place props and clamp
 * camera bounds, so it must stay plain data with zero `@tikron/server`/DO dependencies.
 */

/** One static obstacle: an axis-aligned box (server collision) plus its client prop. */
export interface ZoneObstacle {
  id: string;
  x: number;
  y: number;
  /** Full width/height (the AABB spans x±w/2, y±h/2) — matches `@tikron/sim`'s Obstacle shape. */
  w: number;
  h: number;
  /** Logical asset id the client resolves via the manifest (e.g. `"prop.tree_a"`). */
  prop: string;
  /** Y-axis rotation for the client's prop placement (radians); purely cosmetic. */
  rotation?: number;
}

/** One monster camp: `count` NPCs of `npcDefId`, scattered around `home`, respawning on death. */
export interface MobCamp {
  id: string;
  npcDefId: string;
  count: number;
  respawnMs: number;
  home: { x: number; y: number };
}

/** The zone's single field-boss spawn (open-tag, long respawn). */
export interface FieldBossSpawn {
  npcDefId: string;
  pos: { x: number; y: number };
  respawnMs: number;
}

/** A portal marker. `kind` names the DESTINATION zone type this portal leads to (not
 *  the zone it's placed in) — M2's zone-transfer flow (PLAN-EMBERFALL-M2 §6) resolves
 *  a touched portal's `kind` alone to a `{zone, party, room}` transfer target, the same
 *  way regardless of which zone room the portal lives in (see `rooms/zone-transition.ts`). */
export interface PortalMarker {
  id: string;
  kind: "village" | "field" | "dungeon";
  pos: { x: number; y: number };
}

/** A non-combat interactable marker: a shop NPC, or a training dummy (PLAN §2.5's
 *  "상점 NPC · 훈련 허수아비"). M2 spawns no engine unit for either — there is no
 *  passive/target-only NpcDef in the content pack yet (adding one is a
 *  `content/emberfall-content.ts` change, out of scope here) — so the client renders
 *  these as static 3D props / click targets. A `"shop"` marker's buy/sell is validated
 *  generically by `registerInventoryIntents()` (Wave B2): any zone that lists one gets
 *  a working shop for free, no per-zone code needed. A `"dummy"` marker is
 *  decorative-only in M2 (no attackable target yet). */
export interface NpcMarker {
  id: string;
  kind: "shop" | "dummy";
  pos: { x: number; y: number };
  /** Logical asset id the client resolves via the manifest. */
  prop?: string;
}

/** One zone's full static layout: bounds, obstacles, spawns, and points of interest. */
export interface ZoneData {
  id: string;
  width: number;
  height: number;
  playerSpawn: { x: number; y: number };
  obstacles: ZoneObstacle[];
  mobCamps: MobCamp[];
  fieldBoss?: FieldBossSpawn;
  portals: PortalMarker[];
  /** Shop/dummy markers (optional — additive; M1's `ashen-fields.ts` predates this
   *  field and simply omits it, meaning "no NPC markers in this zone"). */
  npcs?: NpcMarker[];
}
