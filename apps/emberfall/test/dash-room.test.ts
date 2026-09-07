import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestRoomHandle, type TestConnection } from "@tikron/server/testing";
import { FieldRoomImpl } from "../src/rooms/field-room.js";
import { EmberSchema, type EmberState, PLAYER_RADIUS } from "../src/rooms/ember-schema.js";
import { ASHEN_FIELDS } from "../src/zones/ashen-fields.js";

/**
 * Space-dash server-intent tests — drive FieldRoomImpl's `handleDash` through the in-process
 * harness with fake timers (seeded engine → deterministic). They target the intent's five
 * guarantees: distance cap, cooldown, wall clamp, dead no-op, and world-bounds clamp. Geometry
 * comes from `zones/ashen-fields.ts` directly so the tests stay honest if the layout changes.
 */

type Handle = TestRoomHandle<EmberState>;
const DASH_DISTANCE = 5; // mirrors ember-room-base.ts DASH_DISTANCE
const BOSS_SLOT = `boss:${ASHEN_FIELDS.fieldBoss!.npcDefId}`;
/** rock-4 sits just east of the player spawn column; its west face is the wall a dash must stop at. */
const ROCK = ASHEN_FIELDS.obstacles.find((o) => o.id === "rock-4")!;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function makeRoom(): Promise<Handle> {
  return createTestRoom(FieldRoomImpl, { codec: EmberSchema }) as unknown as Promise<Handle>;
}

/** Send a move intent, then advance until the unit settles at (or very near) `target`. */
async function walkTo(h: Handle, conn: TestConnection, id: string, target: { x: number; y: number }): Promise<void> {
  await conn.send("move", target);
  for (let elapsed = 0; elapsed < 20000; elapsed += 500) {
    await h.advance(500);
    const u = h.snapshot().units[id];
    if (u && Math.hypot(u.x - target.x, u.y - target.y) < 0.3) return;
  }
}

function pos(h: Handle, id: string): { x: number; y: number } {
  const u = h.snapshot().units[id]!;
  return { x: u.x, y: u.y };
}

describe("FieldRoomImpl — Space dash intent", () => {
  it("caps a far request at DASH_DISTANCE and broadcasts a dash event; a near request lands at the point", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    const start = pos(h, "p1");

    // Far east (100 units) — direction trusted, distance capped at DASH_DISTANCE.
    await p1.send("dash", { x: start.x + 100, y: start.y });
    await h.advance(200);
    const far = pos(h, "p1");
    expect(Math.hypot(far.x - start.x, far.y - start.y)).toBeCloseTo(DASH_DISTANCE, 1);

    // The dasher receives the "dash" broadcast for its trail/snap.
    const dashFrame = p1.frames().find((f) => f.type === "dash");
    expect(dashFrame).toBeDefined();
    expect((dashFrame!.payload as { unit: string }).unit).toBe("p1");

    // A separate client requesting a point only 3 units away lands at the point (< the cap).
    const p2 = await h.connect("p2");
    const s2 = pos(h, "p2");
    await p2.send("dash", { x: s2.x + 3, y: s2.y });
    await h.advance(200);
    const near = pos(h, "p2");
    expect(Math.hypot(near.x - s2.x, near.y - s2.y)).toBeCloseTo(3, 1);
  });

  it("ignores a second dash inside the cooldown window, then allows one after it expires", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    const start = pos(h, "p1");

    await p1.send("dash", { x: start.x + 100, y: start.y }); // dash #1
    await h.advance(200);
    const afterFirst = pos(h, "p1");
    expect(afterFirst.x).toBeGreaterThan(start.x);

    await p1.send("dash", { x: afterFirst.x + 100, y: afterFirst.y }); // #2, well inside 4s
    await h.advance(200);
    const afterSecond = pos(h, "p1");
    expect(afterSecond.x).toBeCloseTo(afterFirst.x, 3); // blocked — no movement

    await h.advance(4200); // let the cooldown expire
    await p1.send("dash", { x: afterSecond.x + 100, y: afterSecond.y }); // #3
    await h.advance(200);
    const afterThird = pos(h, "p1");
    expect(afterThird.x).toBeGreaterThan(afterSecond.x); // allowed again
  });

  it("stops a dash short of a wall instead of crossing it", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    // Stand just west of rock-4, inside its vertical span, then dash east through it.
    await walkTo(h, p1, "p1", { x: ROCK.x - 5, y: ROCK.y });
    const before = pos(h, "p1");
    const westFace = ROCK.x - ROCK.w / 2;

    await p1.send("dash", { x: before.x + DASH_DISTANCE, y: before.y });
    await h.advance(200);
    const after = pos(h, "p1");

    expect(after.x).toBeGreaterThan(before.x); // moved east
    expect(after.x + PLAYER_RADIUS).toBeLessThanOrEqual(westFace + 1e-3); // circle never enters the rock
  });

  it("is a no-op while dead", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    await walkTo(h, p1, "p1", ASHEN_FIELDS.fieldBoss!.pos);

    await p1.send("attack", { unitId: BOSS_SLOT });
    let dead = false;
    for (let i = 0; i < 30 && !dead; i++) {
      await h.advance(2000);
      dead = h.snapshot().units["p1"]?.alive === false;
    }
    expect(dead).toBe(true);
    const atDeath = pos(h, "p1");

    await p1.send("dash", { x: atDeath.x + 100, y: atDeath.y });
    await h.advance(200);
    const after = pos(h, "p1");
    expect(h.snapshot().units["p1"]!.alive).toBe(false); // still dead
    expect(after.x).toBeCloseTo(atDeath.x, 3); // did not move
    expect(after.y).toBeCloseTo(atDeath.y, 3);
  });

  it("clamps a dash landing to the world bounds", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    // Move next to the west edge (closer than DASH_DISTANCE) so a westward dash would overshoot 0.
    await walkTo(h, p1, "p1", { x: 2, y: 100 });
    const before = pos(h, "p1");

    await p1.send("dash", { x: before.x - 100, y: before.y }); // aim off the west edge
    await h.advance(200);
    const after = pos(h, "p1");

    expect(after.x).toBeGreaterThanOrEqual(0); // never leaves the world
    expect(after.x).toBeLessThan(before.x); // did move west
    expect(after.x).toBeLessThanOrEqual(ASHEN_FIELDS.width);
  });
});
