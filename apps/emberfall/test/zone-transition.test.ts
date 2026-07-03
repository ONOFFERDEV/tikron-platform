import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestRoomHandle, type TestConnection } from "@tikron/server/testing";
import { VillageRoomImpl, VILLAGE_ZONE } from "../src/rooms/village-room.js";
import { DungeonRoomImpl, DUNGEON_ZONE } from "../src/rooms/dungeon-room.js";
import { FieldRoomImpl } from "../src/rooms/field-room.js";
import { EmberSchema, type EmberState } from "../src/rooms/ember-schema.js";
import { ASHEN_FIELDS } from "../src/zones/ashen-fields.js";
import { EMBERHOLD } from "../src/zones/emberhold.js";
import { EMBER_DEPTHS } from "../src/zones/ember-depths.js";
import { EMBERFALL_CONTENT } from "../src/content/emberfall-content.js";
import {
  PortalTracker,
  resolveTransfer,
  mintDungeonCode,
  VILLAGE_ROOM_ID,
  FIELD_ROOM_ID,
} from "../src/rooms/zone-transition.js";
import { createCharacter, loadCharacter, claimSession } from "../src/persist.js";
import { createFakeD1 } from "./fake-d1.js";

/**
 * Zone-transition coverage (PLAN-EMBERFALL-M2 §6): portal touch -> saveNow + transfer
 * message, dungeon instance isolation, village safety, and zone-data sanity. Follows
 * `field-room.test.ts`/`char-persist-room.test.ts`'s established `createTestRoom` +
 * fake-timers idiom.
 */

type Handle = TestRoomHandle<EmberState>;
type RoomWithDb = { db: D1Database | null };
type Ctor = new (init: never) => unknown;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function makeRoom(RoomClass: Ctor, db: D1Database | null, id?: string): Promise<Handle> {
  const h = (await createTestRoom(RoomClass as never, { codec: EmberSchema, id })) as unknown as Handle;
  (h.room as unknown as RoomWithDb).db = db;
  return h;
}

/** Claims a fresh random session for `created`'s character (simulating what
 *  `index.ts`'s `charOnAuth` does in production — PLAN-EMBERFALL-M2-SECFIX Path F),
 *  then connects a test client under that session id — `client.id`/the engine unit id
 *  is the session, never the raw save token. */
async function connectAsChar(h: Handle, db: D1Database, created: { token: string }): Promise<TestConnection> {
  const sessionId = crypto.randomUUID();
  const claim = await claimSession(db, created.token, sessionId, Date.now());
  expect(claim.ok).toBe(true);
  return h.connect(sessionId);
}

/** Send a move intent, then advance until the unit is within `eps` of the target (bounded). */
async function moveTo(
  h: Handle,
  conn: TestConnection,
  id: string,
  target: { x: number; y: number },
  maxMs = 30000,
): Promise<void> {
  await conn.send("move", target);
  for (let elapsed = 0; elapsed < maxMs; elapsed += 200) {
    await h.advance(200);
    const u = h.snapshot().units[id];
    if (u && Math.hypot(u.x - target.x, u.y - target.y) < 1) return;
  }
}

function transferMessages(conn: TestConnection): { zone: string; party: string; room: string }[] {
  return conn
    .frames()
    .filter((f) => f.type === "transfer")
    .map((f) => f.payload as { zone: string; party: string; room: string });
}

describe("zone-transition — pure helpers", () => {
  it("resolveTransfer maps each portal kind to the right fixed destination", () => {
    expect(resolveTransfer("village")).toEqual({ zone: "emberhold", party: "village-room", room: VILLAGE_ROOM_ID });
    expect(resolveTransfer("field")).toEqual({ zone: "ashen-fields", party: "field-room", room: FIELD_ROOM_ID });
    const dungeon = resolveTransfer("dungeon");
    expect(dungeon.zone).toBe("ember-depths");
    expect(dungeon.party).toBe("dungeon-room");
    expect(dungeon.room.length).toBeGreaterThan(0);
  });

  it("mintDungeonCode mints unique, non-empty codes each call", () => {
    const a = mintDungeonCode();
    const b = mintDungeonCode();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(8);
  });

  it("PortalTracker fires once per continuous stay (debounced), then again after leaving and re-entering", () => {
    const tracker = new PortalTracker();
    const portals = [{ id: "p1", kind: "village" as const, pos: { x: 0, y: 0 } }];

    expect(tracker.check("c1", { x: 0, y: 0 }, portals)?.id).toBe("p1");
    expect(tracker.check("c1", { x: 0.5, y: 0 }, portals)).toBeUndefined(); // still inside — debounced
    expect(tracker.check("c1", { x: 50, y: 50 }, portals)).toBeUndefined(); // left the radius
    expect(tracker.check("c1", { x: 0, y: 0 }, portals)?.id).toBe("p1"); // re-entered — fires again

    tracker.forget("c1");
    expect(tracker.check("c1", { x: 0, y: 0 }, portals)?.id).toBe("p1"); // forgotten — fires as a fresh entry
  });
});

describe("zone-transition — portal touch triggers save + transfer", () => {
  it("village -> field: saves the character then sends transfer{zone, party, room}", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Portalgoer", class: "warrior" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const h = await makeRoom(VillageRoomImpl, db);
    const conn = await connectAsChar(h, db, created);
    await h.flush();

    const portal = VILLAGE_ZONE.portals.find((p) => p.kind === "field")!;
    await moveTo(h, conn, conn.id, portal.pos);
    await h.advance(200);

    const msgs = transferMessages(conn);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({ zone: "ashen-fields", party: "field-room", room: FIELD_ROOM_ID });

    const saved = await loadCharacter(db, created.token);
    expect(saved).not.toBeNull();
    expect(saved!.updatedAt).toBeGreaterThanOrEqual(created.character.updatedAt);
  });

  it("field -> village and field -> dungeon: both portals resolve correctly from the same room", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "FieldWalker", class: "mage" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    // Start this character already in the field so onJoin doesn't fight moveTo's target.
    await import("../src/persist.js").then(({ saveCharacter }) =>
      saveCharacter(db, created.token, { ...created.character, zone: "ashen-fields", x: 100, y: 100 }),
    );

    const h = await makeRoom(FieldRoomImpl, db);
    const conn = await connectAsChar(h, db, created);
    await h.flush();

    const toVillage = ASHEN_FIELDS.portals.find((p) => p.kind === "village")!;
    await moveTo(h, conn, conn.id, toVillage.pos, 40000);
    await h.advance(200);

    const toDungeon = ASHEN_FIELDS.portals.find((p) => p.kind === "dungeon")!;
    await moveTo(h, conn, conn.id, toDungeon.pos, 60000);
    await h.advance(200);

    const msgs = transferMessages(conn);
    expect(msgs.some((m) => m.zone === "emberhold" && m.party === "village-room" && m.room === VILLAGE_ROOM_ID)).toBe(
      true,
    );
    expect(msgs.some((m) => m.zone === "ember-depths" && m.party === "dungeon-room" && m.room.length > 0)).toBe(true);
  });

  it("dungeon -> village: portal back to the village always resolves to the fixed village room", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Delver", class: "cleric" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const h = await makeRoom(DungeonRoomImpl, db, "invite-code-1");
    const conn = await connectAsChar(h, db, created);
    await h.flush();

    const portal = DUNGEON_ZONE.portals.find((p) => p.kind === "village")!;
    await moveTo(h, conn, conn.id, portal.pos);
    await h.advance(200);

    const msgs = transferMessages(conn);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({ zone: "emberhold", party: "village-room", room: VILLAGE_ROOM_ID });
  });

  it("does not re-fire the transfer message every tick while the player lingers on the portal", async () => {
    const h = await makeRoom(VillageRoomImpl, null);
    const conn = await h.connect("p1");
    const portal = VILLAGE_ZONE.portals[0]!;
    await moveTo(h, conn, "p1", portal.pos);
    await h.advance(2000); // linger well past several ticks

    expect(transferMessages(conn)).toHaveLength(1);
  });
});

describe("zone-transition — dungeon private instances", () => {
  it("two different invite codes are two fully independent room instances", async () => {
    const a = await makeRoom(DungeonRoomImpl, null, "code-a");
    const b = await makeRoom(DungeonRoomImpl, null, "code-b");

    expect(a.room.id).toBe("code-a");
    expect(b.room.id).toBe("code-b");

    // Only room A ever saw a join from p1 — its seat/state never crosses into room B
    // (each `createTestRoom` call is a fully independent `Room` instance: separate
    // `records`/`state`, matching how two Durable Object ids are separate objects).
    await a.connect("p1");
    await a.flush();
    expect(Object.keys(a.snapshot().units)).toContain("p1");
    expect(Object.keys(b.snapshot().units)).not.toContain("p1");

    // Room B has its own independent player, at its own zone's spawn point, wholly
    // unaffected by anything happening in room A.
    const p2 = await b.connect("p2");
    await b.flush();
    await p2.send("move", { x: DUNGEON_ZONE.playerSpawn.x + 3, y: DUNGEON_ZONE.playerSpawn.y });
    await b.advance(1000);
    expect(Object.keys(b.snapshot().units)).not.toContain("p1");
    expect(a.snapshot().units["p2"]).toBeUndefined();
    const p2Unit = b.snapshot().units["p2"];
    expect(p2Unit).toBeDefined();
    expect(p2Unit!.x).toBeGreaterThan(DUNGEON_ZONE.playerSpawn.x); // moved within its own room
    // Room A's own player never moved, unaffected by room B's activity above.
    const p1Unit = a.snapshot().units["p1"]!;
    expect(Math.hypot(p1Unit.x - DUNGEON_ZONE.playerSpawn.x, p1Unit.y - DUNGEON_ZONE.playerSpawn.y)).toBeLessThan(1);
  });
});

describe("zone-transition — village safety", () => {
  it("has no hostile spawns: a joined player is the only unit in the room", async () => {
    const h = await makeRoom(VillageRoomImpl, null);
    await h.connect("p1");
    await h.flush();

    const units = h.snapshot().units;
    expect(Object.keys(units)).toEqual(["p1"]);
    expect(VILLAGE_ZONE.mobCamps).toHaveLength(0);
    expect(VILLAGE_ZONE.fieldBoss).toBeUndefined();
  });
});

describe("zone-transition — zone data validity", () => {
  const NPC_IDS = new Set(EMBERFALL_CONTENT.npcs.map((n) => n.id));

  function expectInBounds(zone: typeof EMBERHOLD, pos: { x: number; y: number }): void {
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.x).toBeLessThanOrEqual(zone.width);
    expect(pos.y).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeLessThanOrEqual(zone.height);
  }

  it("emberhold: 60x60, no mob camps, spawn/portal/npc markers all in bounds", () => {
    expect(EMBERHOLD.width).toBe(60);
    expect(EMBERHOLD.height).toBe(60);
    expect(EMBERHOLD.mobCamps).toHaveLength(0);
    expectInBounds(EMBERHOLD, EMBERHOLD.playerSpawn);
    for (const o of EMBERHOLD.obstacles) expectInBounds(EMBERHOLD, o);
    for (const p of EMBERHOLD.portals) expectInBounds(EMBERHOLD, p.pos);
    for (const n of EMBERHOLD.npcs ?? []) expectInBounds(EMBERHOLD, n.pos);
    // The only portal leads to the field; the dungeon is reached via the field's own portal.
    expect(EMBERHOLD.portals.map((p) => p.kind)).toEqual(["field"]);
  });

  it("ember-depths: 120x120, wave/boss camps reference real NpcDef ids, spawn/portal in bounds", () => {
    expect(EMBER_DEPTHS.width).toBe(120);
    expect(EMBER_DEPTHS.height).toBe(120);
    expect(EMBER_DEPTHS.mobCamps.length).toBeGreaterThanOrEqual(3);
    for (const camp of EMBER_DEPTHS.mobCamps) {
      expect(NPC_IDS.has(camp.npcDefId)).toBe(true);
      expect(camp.count).toBeGreaterThan(0);
      expectInBounds(EMBER_DEPTHS, camp.home);
    }
    for (const o of EMBER_DEPTHS.obstacles) expectInBounds(EMBER_DEPTHS, o);
    expectInBounds(EMBER_DEPTHS, EMBER_DEPTHS.playerSpawn);
    expect(EMBER_DEPTHS.portals.map((p) => p.kind)).toEqual(["village"]);
    for (const p of EMBER_DEPTHS.portals) expectInBounds(EMBER_DEPTHS, p.pos);
    // The exit portal must not sit on top of the spawn point, or a fresh join would
    // immediately re-trigger a transfer.
    const exit = EMBER_DEPTHS.portals[0]!;
    expect(Math.hypot(exit.pos.x - EMBER_DEPTHS.playerSpawn.x, exit.pos.y - EMBER_DEPTHS.playerSpawn.y)).toBeGreaterThan(
      2,
    );
  });

  it("every portal kind across every zone resolves to a real, distinct destination", () => {
    for (const zone of [EMBERHOLD, ASHEN_FIELDS, EMBER_DEPTHS]) {
      for (const portal of zone.portals) {
        const dest = resolveTransfer(portal.kind);
        expect(["emberhold", "ashen-fields", "ember-depths"]).toContain(dest.zone);
      }
    }
  });
});
