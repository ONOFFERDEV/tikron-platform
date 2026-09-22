import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRoom, type TestConnection } from "@tikron/server/testing";
import { TICK_MS, WEAPON, WEAPONS } from "../src/config.js";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema } from "../src/schema.js";
import { WeaponActions } from "../src/weapon-action.js";

const ammo = (index: number, mag: number, reserve: number) => {
  const mags = WEAPONS.map(spec => spec.mag);
  const reserves = WEAPONS.map(spec => spec.reserve);
  mags[index] = mag;
  reserves[index] = reserve;
  return { mags, reserves };
};

const pump = () => {
  const spec = WEAPONS[2]!;
  if (spec.reloadKind !== "pump") throw new Error("weapon slot 3 must use pump reload");
  return spec;
};

const bolt = () => {
  const spec = WEAPONS[3]!;
  if (spec.reloadKind !== "stripper_clip") throw new Error("weapon slot 4 must use stripper clips");
  return spec;
};

const messages = (connection: TestConnection, type: string): Record<string, unknown>[] => connection.frames()
  .filter((frame) => frame.t === "s:msg" && frame.type === type)
  .map((frame) => frame.payload as Record<string, unknown>);

class ActionArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;

  forceMatchEnd(now: number): void { this.state.matchEndMs = now; }
  phase(): string { return this.state.phase; }
  reloadEnd(id: string): number | undefined { return this.state.players[id]?.reloadEnd; }
}

describe("authoritative weapon actions", () => {
  it.each(WEAPONS)("$name exposes only its configured independent cycle", spec => {
    const actions = new WeaponActions();
    const state = actions.beginCycle(spec.slot - 1, spec, 1000);
    if (spec.reloadKind === "magazine") {
      expect(state).toBeNull();
      expect(actions.canFire(spec.slot - 1, 1000)).toBe(true);
    } else {
      expect(state).toMatchObject({ kind: "cycle", endsAt: 1000 + spec.cycleMs });
      expect(actions.canFire(spec.slot - 1, 1000 + spec.cycleMs - 1)).toBe(false);
      expect(actions.canFire(spec.slot - 1, 1000 + spec.cycleMs)).toBe(true);
    }
  });

  it("preserves a bolt cycle through a switch away and back", () => {
    const actions = new WeaponActions();
    const spec = bolt();
    actions.beginCycle(3, spec, 100);
    actions.switchWeapon(4, 200);
    expect(actions.view(3, 100 + spec.cycleMs - 1)).toMatchObject({ kind: "cycle" });
    expect(actions.canFire(3, 100 + spec.cycleMs - 1)).toBe(false);
    expect(actions.canFire(3, 100 + spec.cycleMs)).toBe(true);
  });

  it.each([0, 1, 4])("magazine reload with %i rounds commits once at its deadline", initial => {
    const actions = new WeaponActions();
    const spec = WEAPONS[0]!;
    const { mags, reserves } = ammo(0, initial, spec.mag);
    actions.startReload(0, spec, 100, mags, reserves);
    actions.advance(100 + spec.reloadMs - 1, WEAPONS, mags, reserves);
    expect(mags[0]).toBe(initial);
    actions.advance(100 + spec.reloadMs, WEAPONS, mags, reserves);
    expect(mags[0]).toBe(spec.mag);
    expect(reserves[0]).toBe(initial);
  });

  it("pump reload commits exactly at shell 1, 3, and 5 boundaries", () => {
    const actions = new WeaponActions();
    const spec = pump();
    const { mags, reserves } = ammo(2, 0, 5);
    actions.startReload(2, spec, 0, mags, reserves);
    const insert = (count: number) => spec.reloadStartMs + spec.reloadInsertMs * count;
    for (const count of [1, 3, 5]) {
      actions.advance(insert(count) - 1, WEAPONS, mags, reserves);
      expect(mags[2]).toBe(count - 1);
      actions.advance(insert(count), WEAPONS, mags, reserves);
      expect(mags[2]).toBe(count);
    }
    expect(actions.view(2, insert(5))).toMatchObject({ phase: "reload_end", endsAt: spec.reloadMs });
  });

  it("pump reload stops after partial reserve and keeps committed shells", () => {
    const actions = new WeaponActions();
    const spec = pump();
    const { mags, reserves } = ammo(2, 1, 2);
    actions.startReload(2, spec, 0, mags, reserves);
    actions.advance(spec.reloadStartMs + spec.reloadInsertMs * 2, WEAPONS, mags, reserves);
    expect({ mag: mags[2], reserve: reserves[2] }).toEqual({ mag: 3, reserve: 0 });
    expect(actions.view(2, 1300)).toMatchObject({ phase: "reload_end" });
  });

  it("stripper clip commits up to five rounds only at the end", () => {
    const actions = new WeaponActions();
    const spec = bolt();
    const { mags, reserves } = ammo(3, 1, 3);
    actions.startReload(3, spec, 50, mags, reserves);
    actions.advance(50 + spec.reloadMs - 1, WEAPONS, mags, reserves);
    expect({ mag: mags[3], reserve: reserves[3] }).toEqual({ mag: 1, reserve: 3 });
    actions.advance(50 + spec.reloadMs, WEAPONS, mags, reserves);
    expect({ mag: mags[3], reserve: reserves[3] }).toEqual({ mag: 4, reserve: 0 });
  });

  it("rejects full or reserve-zero reloads", () => {
    const actions = new WeaponActions();
    const spec = pump();
    let rounds = ammo(2, spec.mag, 5);
    expect(actions.startReload(2, spec, 0, rounds.mags, rounds.reserves)).toBeNull();
    rounds = ammo(2, 2, 0);
    expect(actions.startReload(2, spec, 0, rounds.mags, rounds.reserves)).toBeNull();
  });

  it("cancels one millisecond before a pump insert without granting the shell", () => {
    const actions = new WeaponActions();
    const spec = pump();
    const { mags, reserves } = ammo(2, 1, 4);
    actions.startReload(2, spec, 0, mags, reserves);
    const beforeInsert = spec.reloadStartMs + spec.reloadInsertMs - 1;
    actions.advance(beforeInsert, WEAPONS, mags, reserves);
    expect(actions.requestFire(2, spec, beforeInsert, mags)).toBe("closing");
    expect(mags[2]).toBe(1);
    expect(actions.view(2, beforeInsert)).toMatchObject({ phase: "reload_end", endsAt: beforeInsert + spec.reloadEndMs });
  });

  it("buffers an empty-pump press until one shell commits, then closes", () => {
    const actions = new WeaponActions();
    const spec = pump();
    const { mags, reserves } = ammo(2, 0, 5);
    actions.startReload(2, spec, 0, mags, reserves);
    expect(actions.requestFire(2, spec, 100, mags)).toBe("buffered");
    actions.advance(spec.reloadStartMs + spec.reloadInsertMs, WEAPONS, mags, reserves);
    expect(mags[2]).toBe(1);
    expect(actions.view(2, 850)).toMatchObject({ phase: "reload_end", fireBuffered: true });
  });

  it("death clears reload and all per-weapon cycles", () => {
    const actions = new WeaponActions();
    const shotgun = pump();
    const boltSpec = bolt();
    const { mags, reserves } = ammo(2, 1, 4);
    actions.beginCycle(3, boltSpec, 0);
    actions.startReload(2, shotgun, 0, mags, reserves);
    actions.clear();
    expect(actions.view(2, 1)).toBeNull();
    expect(actions.canFire(3, 1)).toBe(true);
  });

  it("reconnect and late sync observe the current serial and deadline", () => {
    const actions = new WeaponActions();
    const spec = pump();
    const { mags, reserves } = ammo(2, 0, 5);
    const started = actions.startReload(2, spec, 100, mags, reserves);
    actions.advance(100 + spec.reloadStartMs + spec.reloadInsertMs, WEAPONS, mags, reserves);
    const reconnect = actions.view(2, 1000);
    expect(reconnect).toMatchObject({ serial: started?.serial, committed: 1, phase: "reload_insert" });
    expect(actions.view(2, 1000)).toEqual(reconnect);
  });

  it("forged animation markers never commit ammunition", () => {
    const actions = new WeaponActions();
    const spec = pump();
    const { mags, reserves } = ammo(2, 0, 5);
    actions.startReload(2, spec, 0, mags, reserves);
    actions.observeAnimationMarker("shell_insert");
    actions.observeAnimationMarker("bolt_close");
    expect({ mag: mags[2], reserve: reserves[2] }).toEqual({ mag: 0, reserve: 5 });
  });
});

describe("integrated authoritative weapon action timeline", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("publishes pump inserts, late sync, completion and insert-minus-one cancellation", async () => {
    const harness = await createTestRoom(ActionArena, { codec: ArenaSchema, sync: "throttled" });
    const owner = await harness.connect();
    const spec = pump();
    await owner.send("switch", { slot: spec.slot });
    await harness.advance(WEAPON.swapMs + TICK_MS * 2);
    await owner.send("fire", { fireSeq: 1 });
    await harness.advance(spec.cycleMs);
    await owner.send("reload", {});
    await harness.advance(TICK_MS);

    const started = messages(owner, "weaponAction").at(-1)?.state as Record<string, unknown>;
    expect(started).toMatchObject({ kind: "pump_reload", phase: "reload_start", committed: 0 });
    const late = await harness.connect();
    await late.send("syncView", {});
    await harness.advance(TICK_MS);
    expect(messages(late, "weaponAction").some((event) => event.id === owner.id &&
      (event.state as Record<string, unknown> | undefined)?.serial === started.serial)).toBe(true);

    const insertAt = Number(started.startedAt) + spec.reloadStartMs + spec.reloadInsertMs;
    await harness.advance(insertAt - Date.now() - 1);
    expect(messages(owner, "ammo").at(-1)).toMatchObject({ mag: spec.mag - 1, reserve: spec.reserve });
    await harness.advance(1);
    expect(messages(owner, "ammo").at(-1)).toMatchObject({ mag: spec.mag, reserve: spec.reserve - 1 });
    const ending = messages(owner, "weaponAction").at(-1)?.state as Record<string, unknown>;
    expect(ending).toMatchObject({ phase: "reload_end", committed: 1 });
    await harness.advance(Number(ending.endsAt) - Date.now());
    expect(messages(owner, "weaponAction").at(-1)).toMatchObject({ state: null, weaponIndex: 2 });

    await owner.send("fire", { fireSeq: 2 });
    await harness.advance(spec.cycleMs);
    await owner.send("reload", {});
    await harness.advance(TICK_MS);
    const secondStart = messages(owner, "weaponAction").at(-1)?.state as Record<string, unknown>;
    const secondInsertAt = Number(secondStart.startedAt) + spec.reloadStartMs + spec.reloadInsertMs;
    await harness.advance(secondInsertAt - Date.now() - 1);
    const ammoBeforeCancel = messages(owner, "ammo").at(-1);
    await owner.send("fire", { fireSeq: 3 });
    await harness.advance(TICK_MS);
    expect(messages(owner, "ammo").at(-1)).toEqual(ammoBeforeCancel);
    expect(messages(owner, "weaponAction").at(-1)?.state).toMatchObject({ phase: "reload_end", committed: 0 });
    console.log(JSON.stringify({
      tag: "weaponActionAuthoritativeTimeline",
      weaponActions: messages(owner, "weaponAction"),
      ammo: messages(owner, "ammo"),
      lateSync: messages(late, "weaponAction"),
    }));
  });

  it("clears a staged reload before any shell can commit after match end", async () => {
    const harness = await createTestRoom(ActionArena, { codec: ArenaSchema, sync: "throttled" });
    const room = harness.room as ActionArena;
    const owner = await harness.connect();
    const spec = pump();
    await owner.send("switch", { slot: spec.slot });
    await harness.advance(WEAPON.swapMs + TICK_MS * 2);
    await owner.send("fire", { fireSeq: 1 });
    await harness.advance(spec.cycleMs);
    await owner.send("reload", {});
    await harness.advance(TICK_MS);

    const ammoAtStart = messages(owner, "ammo").at(-1);
    expect(messages(owner, "weaponAction").at(-1)?.state).toMatchObject({ phase: "reload_start" });
    room.forceMatchEnd(Date.now());
    await harness.advance(TICK_MS);

    expect(room.phase()).toBe("ended");
    expect(messages(owner, "weaponAction").at(-1)).toMatchObject({ id: owner.id, state: null });
    expect(room.reloadEnd(owner.id)).toBe(0);
    await harness.advance(spec.reloadStartMs + spec.reloadInsertMs + TICK_MS);
    expect(messages(owner, "ammo").at(-1)).toEqual(ammoAtStart);
  });
});
