import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestRoomHandle, type TestConnection } from "@tikron/server/testing";
import { FieldRoomImpl } from "../src/rooms/field-room.js";
import { EmberSchema, type EmberState } from "../src/rooms/ember-schema.js";
import { ASHEN_FIELDS } from "../src/zones/ashen-fields.js";
import { createCharacter, claimSession } from "../src/persist.js";
import { createFakeD1 } from "./fake-d1.js";
import type { EquipSlot, ItemInstance } from "../src/types.js";

interface InventoryView {
  inventory: ItemInstance[];
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
  gold: number;
}

/**
 * Room-level integration coverage for Wave B2's inventory intents (PLAN-EMBERFALL-M2
 * §8), driven through `EmberRoomBase.registerInventoryIntents()` via the same
 * `createTestRoom` + fake-D1 harness as `char-persist-room.test.ts`. Validates the wire
 * contract end to end: intent in -> `"inv"` message out, and that equip/unequip really
 * drive `engine.setEquipmentModifiers` (observed as a `maxHp` change, not a mock).
 *
 * `IoArenaRoom` sets `queueInputs = true` (tick-aligned dispatch — every developer
 * message, `"buy"`/`"equip"`/`"move"` alike, is queued and only processed on the next
 * `onTick`, same as `field-room.test.ts`'s intents). So every `conn.send(...)` here is
 * followed by `h.advance(...)`, never a bare `h.flush()` — `flush()` only drains
 * microtasks, it does not run a tick.
 */

type Handle = TestRoomHandle<EmberState>;
type RoomWithDb = { db: D1Database | null };

async function makeRoom(db: D1Database | null): Promise<Handle> {
  const h = (await createTestRoom(FieldRoomImpl, { codec: EmberSchema })) as unknown as Handle;
  (h.room as unknown as RoomWithDb).db = db;
  return h;
}

/** Claims a fresh random session for `created`'s character (simulating what
 *  `index.ts`'s `charOnAuth` does in production — PLAN-EMBERFALL-M2-SECFIX Path F;
 *  `createTestRoom` bypasses `onAuth`, so this test suite seeds the claim directly),
 *  then connects a test client under that session id — `client.id`/the engine unit id
 *  is the session, never the raw save token. */
async function connectAsChar(h: Handle, db: D1Database, created: { token: string }): Promise<TestConnection> {
  const sessionId = crypto.randomUUID();
  const claim = await claimSession(db, created.token, sessionId, Date.now());
  expect(claim.ok).toBe(true);
  return h.connect(sessionId);
}

/** Every `"inv"` frame a connection received, in order. */
function invFrames(conn: TestConnection): InventoryView[] {
  return conn
    .frames()
    .filter((f) => f.type === "inv")
    .map((f) => f.payload as InventoryView);
}

/** Send a move intent, then advance until the unit is within melee range (mirrors
 *  `field-room.test.ts`'s helper) — a fixed tick count under/overshoots depending on
 *  distance, so this loops until arrival instead. */
async function moveTo(
  h: Handle,
  conn: TestConnection,
  id: string,
  target: { x: number; y: number },
  maxMs = 40000,
): Promise<void> {
  await conn.send("move", target);
  for (let elapsed = 0; elapsed < maxMs; elapsed += 500) {
    await h.advance(500);
    const u = h.snapshot().units[id];
    if (u && Math.hypot(u.x - target.x, u.y - target.y) < 3) return;
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("inventory intents — buy / sell", () => {
  it("buy deducts gold and grants the item; sell refunds floor(buyPrice*0.25)", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Shopper", class: "warrior" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const h = await makeRoom(db);
    const conn = await connectAsChar(h, db, created);
    await h.flush();

    await conn.send("buy", { defId: "potion-hp", qty: 2 });
    await h.advance(100);
    let last = invFrames(conn).at(-1)!;
    expect(last.gold).toBe(created.character.gold - 20);
    expect(last.inventory).toEqual([{ defId: "potion-hp", qty: 2 }]);

    await conn.send("sell", { slotIndex: 0, qty: 1 });
    await h.advance(100);
    last = invFrames(conn).at(-1)!;
    expect(last.gold).toBe(created.character.gold - 20 + 2); // floor(10*0.25) = 2
    expect(last.inventory).toEqual([{ defId: "potion-hp", qty: 1 }]);
  });

  it("buy silently no-ops on insufficient gold — no inv frame, no gold change", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Broke", class: "mage" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const h = await makeRoom(db);
    const conn = await connectAsChar(h, db, created);
    await h.flush();
    const framesBefore = invFrames(conn).length;

    await conn.send("buy", { defId: "armor-plate", qty: 1 }); // not even shop-listed
    await h.advance(100);
    expect(invFrames(conn).length).toBe(framesBefore);
  });
});

describe("inventory intents — equip / unequip drive real engine stat changes", () => {
  it("equipping armor raises maxHp; unequipping restores it, item returns to inventory", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Geared", class: "warrior" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const h = await makeRoom(db);
    const conn = await connectAsChar(h, db, created);
    await h.flush();
    const baseMaxHp = h.snapshot().units[conn.id]!.maxHp;

    await conn.send("buy", { defId: "armor-leather", qty: 1 });
    await h.advance(100);
    expect(invFrames(conn).at(-1)!.inventory).toEqual([{ defId: "armor-leather", qty: 1 }]);

    await conn.send("equip", { slotIndex: 0 });
    await h.advance(100);
    const geared = h.snapshot().units[conn.id]!;
    expect(geared.maxHp).toBe(baseMaxHp + 20); // armor-leather's flat maxHp modifier
    const equippedFrame = invFrames(conn).at(-1)!;
    expect(equippedFrame.equipment.armor).toEqual({ defId: "armor-leather", qty: 1 });
    expect(equippedFrame.inventory).toEqual([]);

    await conn.send("unequip", { slot: "armor" });
    await h.advance(100);
    expect(h.snapshot().units[conn.id]!.maxHp).toBe(baseMaxHp);
    const unequippedFrame = invFrames(conn).at(-1)!;
    expect(unequippedFrame.equipment.armor).toBeUndefined();
    expect(unequippedFrame.inventory).toEqual([{ defId: "armor-leather", qty: 1 }]);
  });

  it("rejects equipping an item that doesn't meet the level requirement", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Underleveled", class: "warrior" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const h = await makeRoom(db);
    const conn = await connectAsChar(h, db, created);
    await h.flush();
    const baseMaxHp = h.snapshot().units[conn.id]!.maxHp;

    // armor-plate has levelReq 10; a fresh level-1 character can't equip it even though
    // it can be placed in the inventory directly (bypassing the shop's own gate).
    const room = h.room as unknown as { charByClient: Map<string, { character: { inventory: unknown[] } }> };
    const session = room.charByClient.get(conn.id)!;
    session.character.inventory = [{ defId: "armor-plate", qty: 1 }];

    await conn.send("equip", { slotIndex: 0 });
    await h.advance(100);
    expect(h.snapshot().units[conn.id]!.maxHp).toBe(baseMaxHp); // unchanged — rejected
  });
});

describe("inventory intents — useItem consumable heal", () => {
  it("healing via a potion is visible on the engine unit's hp after taking damage", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Healer", class: "warrior" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const h = await makeRoom(db);
    const conn = await connectAsChar(h, db, created);
    await h.flush();

    const wolfCamp = ASHEN_FIELDS.mobCamps.find((c) => c.id === "wolf-pack-west")!;
    const wolfSlot = `${wolfCamp.id}#0`;
    const wolfStart = h.snapshot().units[wolfSlot]!;
    await moveTo(h, conn, conn.id, { x: wolfStart.x, y: wolfStart.y });

    await conn.send("attack", { unitId: wolfSlot });
    // Stop at the FIRST tick the player is hurt-but-still-alive, rather than running a
    // fixed duration — the west camp is a 3-wolf pack-aggro pull (dps=10 each), so
    // leaving the player unhealed for too long reliably kills them outright, which
    // isn't this test's scenario (see the dead-unit case in the next test, FIX-3).
    let hurt = h.snapshot().units[conn.id];
    for (let i = 0; i < 20 && (!hurt || !hurt.alive || hurt.hp >= hurt.maxHp); i++) {
      await h.advance(500);
      hurt = h.snapshot().units[conn.id];
    }
    expect(hurt).toBeDefined();
    expect(hurt!.alive).toBe(true);
    expect(hurt!.hp).toBeLessThan(hurt!.maxHp); // the wolf pack retaliated

    await conn.send("buy", { defId: "potion-hp", qty: 1 });
    await h.advance(100);
    await conn.send("useItem", { slotIndex: 0 });
    await h.advance(100);

    const healed = h.snapshot().units[conn.id]!;
    expect(healed.hp).toBeGreaterThan(hurt!.hp);
    expect(invFrames(conn).at(-1)!.inventory).toEqual([]);
  });

  it("a dead unit can't self-revive via a potion (FIX-3): stays dead, item isn't consumed", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Doomed", class: "warrior" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const h = await makeRoom(db);
    const conn = await connectAsChar(h, db, created);
    await h.flush();

    await conn.send("buy", { defId: "potion-hp", qty: 1 });
    await h.advance(100);
    expect(invFrames(conn).at(-1)!.inventory).toEqual([{ defId: "potion-hp", qty: 1 }]);

    // The field boss reliably kills a solo level-1 player (field-room.test.ts's own
    // "player death at the field boss" test relies on the same fact).
    const boss = ASHEN_FIELDS.fieldBoss!;
    const bossSlot = `boss:${boss.npcDefId}`;
    await moveTo(h, conn, conn.id, boss.pos, 40000);
    await conn.send("attack", { unitId: bossSlot });
    let dead = false;
    for (let i = 0; i < 30 && !dead; i++) {
      await h.advance(2000);
      dead = h.snapshot().units[conn.id]?.alive === false;
    }
    expect(dead).toBe(true);

    const framesBeforeUseItem = invFrames(conn).length;
    await conn.send("useItem", { slotIndex: 0 });
    await h.advance(100);

    expect(h.snapshot().units[conn.id]!.alive).toBe(false); // still dead — no self-revive
    expect(invFrames(conn).length).toBe(framesBeforeUseItem); // no new "inv" frame — item not consumed
  });
});

describe("loot on kill — inventory overflow notice (FIX-5)", () => {
  it("sends a lootOverflow message to the killer when a full inventory can't hold the drop", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Packrat", class: "warrior" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const h = await makeRoom(db);
    const conn = await connectAsChar(h, db, created);
    await h.flush();

    // Fill the inventory to capacity with 16 non-matching slots so ANY item drop has
    // nowhere to land, regardless of stacking rules.
    const room = h.room as unknown as {
      charByClient: Map<string, { character: { inventory: { defId: string; qty: number }[] } }>;
      grantLoot(killerId: string, npcDefId: string): void;
    };
    const session = room.charByClient.get(conn.id)!;
    session.character.inventory = Array.from({ length: 16 }, (_, i) => ({ defId: `filler-${i}`, qty: 1 }));

    // Drive `grantLoot` directly (same private-method-cast idiom this file already uses
    // for `saveNow`/`charByClient`) rather than through a full boss-kill combat sim —
    // `boss_chief`'s loot table always grants one guaranteed-rare item (never
    // chance-gated — see `systems/loot.ts`'s `LOOT_TABLES`), so this deterministically
    // overflows the now-full inventory without depending on RNG chance rolls.
    room.grantLoot(conn.id, "boss_chief");
    await h.flush();

    const overflowFrames = conn.frames().filter((f) => f.type === "lootOverflow");
    expect(overflowFrames.length).toBe(1);
    expect((overflowFrames[0]!.payload as { overflow: number }).overflow).toBeGreaterThan(0);
  });
});

describe("loot on kill", () => {
  it("grants the killer gold (and possibly items) via an owner-only inv message", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Looter", class: "warrior" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const h = await makeRoom(db);
    const conn = await connectAsChar(h, db, created);
    await h.flush();

    // The goblin shaman never retaliates (its only skill is a self-anchored friendly
    // heal — see field-room.test.ts's AOI test), so a solo level-1 warrior can kill it
    // reliably without a survivability race, unlike the wolf pack.
    const shamanCamp = ASHEN_FIELDS.mobCamps.find((c) => c.id === "goblin-shaman-camp")!;
    const shamanSlot = `${shamanCamp.id}#0`;
    const shamanStart = h.snapshot().units[shamanSlot]!;
    await moveTo(h, conn, conn.id, { x: shamanStart.x, y: shamanStart.y });

    await conn.send("attack", { unitId: shamanSlot });
    let killed = false;
    for (let i = 0; i < 30 && !killed; i++) {
      await conn.send("cast", { skillId: "warrior-strike", target: { unitId: shamanSlot } });
      await h.advance(2600);
      killed = h.snapshot().units[shamanSlot] === undefined;
    }
    expect(killed).toBe(true);

    // goblin_shaman's loot table always rolls 5-10 gold on any kill, regardless of the
    // (seeded but uncontrollable-from-here) item chance rolls.
    const gains = invFrames(conn).filter((f) => f.gold > created.character.gold);
    expect(gains.length).toBeGreaterThan(0);
    expect(gains.at(-1)!.gold).toBeGreaterThanOrEqual(created.character.gold + 5);
  });
});
