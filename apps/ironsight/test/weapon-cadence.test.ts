import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestRoom, type TestConnection } from '@tikron/server/testing';
import type { RoomConnection } from '@tikron/server';
import { ClientMessageType } from '@tikron/protocol';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { TICK_MS, WEAPON, WEAPONS } from '../src/config.js';
import { advanceRecoil, emptyRecoil, recoilSample } from '../src/recoil.js';
import { dirFromAngles } from '../src/weapons.js';

class CadenceArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  // Keep the production 20 Hz input queue, handling and rate limit.
}
const messages = (c: TestConnection, type: string) => c.frames()
  .filter(f => f.t === 's:msg' && f.type === type)
  .map(f => f.payload as Record<string, number>);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('weapon cadence through the production input queue', () => {
  it.each(WEAPONS.slice(1))('$name: swap duration starts at receipt and cannot finish inside an early shot queue wait', async spec => {
    const h = await createTestRoom(CadenceArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    await h.advance(17);
    const readyAt = Date.now() + WEAPON.swapMs;
    await c.send('switch', { slot: spec.slot, receivedAt: -1e12, readyAt: 0 });
    await h.advance(WEAPON.swapMs - 1);
    await c.send('fire', { fireSeq: 1 });
    await h.advance(1);
    await c.send('fire', { fireSeq: 2 });
    await h.advance(TICK_MS);
    expect(messages(c, 'recoilSync').map(p => [p.seq, p.count])).toEqual([[1, 0], [2, 1]]);
    expect(messages(c, 'recoilSync').at(-1)?.at).toBe(readyAt);
    expect(messages(c, 'shot')).toHaveLength(1);
  });

  it.each(WEAPONS)('$name: reload and the next shot share the receipt clock', async spec => {
    const h = await createTestRoom(CadenceArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    await c.send('switch', { slot: spec.slot });
    await h.advance(WEAPON.swapMs + TICK_MS * 2);
    const firstAt = Date.now();
    await c.send('fire', { fireSeq: 1 });
    await h.advance(spec.fireIntervalMs + 17);
    const readyAt = Date.now() + spec.reloadMs;
    await c.send('reload', { receivedAt: -1e12, reloadMs: 0 });
    await h.advance(TICK_MS);
    expect(h.snapshot().players[c.id]!.reloadEnd).toBe(readyAt);
    await h.advance(spec.reloadMs - TICK_MS - 1);
    await c.send('fire', { fireSeq: 2 });
    await h.advance(1);
    await c.send('fire', { fireSeq: 3 });
    await h.advance(TICK_MS);
    expect(messages(c, 'recoilSync').map(p => [p.seq, p.at])).toEqual([[1, firstAt], [2, firstAt], [3, readyAt]]);
    expect(messages(c, 'shot')).toHaveLength(2);
    expect(messages(c, 'ammo').at(-1)?.mag).toBe(spec.mag - 1);
    expect(messages(c, 'ammo').at(-1)?.reserve).toBe(spec.reserve - 1);
  });

  it.each(WEAPONS)('$name: ADS eligibility uses arrival time even when early and ready shots drain together', async spec => {
    const h = await createTestRoom(CadenceArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    await c.send('switch', { slot: spec.slot });
    await h.advance(WEAPON.swapMs + TICK_MS * 2 + 17);
    await c.send('move', { ads: true });
    await h.advance(spec.adsMs - 1);
    await c.send('fire', { fireSeq: 1 });
    await h.advance(1);
    await c.send('fire', { fireSeq: 2 });
    await h.advance(TICK_MS);
    expect(messages(c, 'recoilSync').map(p => [p.seq, p.count])).toEqual([[1, 0], [2, 1]]);
    expect(messages(c, 'shot')).toHaveLength(1);
    expect(messages(c, 'ammo').at(-1)?.mag).toBe(spec.mag - 1);
  });

  it.each(WEAPONS)('$name: sprint recovery cannot borrow the queue wait before firing', async spec => {
    const h = await createTestRoom(CadenceArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    await c.send('switch', { slot: spec.slot });
    await h.advance(WEAPON.swapMs + TICK_MS * 2 + 17);
    await c.send('move', { mz: 1, sprint: true });
    await c.send('move', { mz: 1, sprint: false });
    await h.advance(spec.sprintToFireMs - 1);
    await c.send('fire', { fireSeq: 1 });
    await h.advance(1);
    await c.send('fire', { fireSeq: 2 });
    await h.advance(TICK_MS);
    expect(messages(c, 'recoilSync').map(p => [p.seq, p.count])).toEqual([[1, 0], [2, 1]]);
    expect(messages(c, 'shot')).toHaveLength(1);
    expect(messages(c, 'ammo').at(-1)?.mag).toBe(spec.mag - 1);
  });

  it.each(WEAPONS)('$name: keeps every on-cadence intent across tick phases', async spec => {
    const rows = [];
    for (const phase of [1, 17, 49]) {
      const h = await createTestRoom(CadenceArena, { codec: ArenaSchema, sync: 'throttled' });
      const c = await h.connect();
      await c.send('switch', { slot: spec.slot });
      await h.advance(WEAPON.swapMs + TICK_MS * 2 + phase);
      const arrivals: number[] = [], count = Math.min(12, spec.mag);
      for (let n = 0; n < count; n++) {
        arrivals.push(Date.now());
        await c.send('fire', { fireSeq: n + 1, yaw: 0, pitch: 0 });
        await h.advance(spec.fireIntervalMs);
      }
      await h.advance(TICK_MS);
      rows.push({ phase, sent: count, accepted: messages(c, 'shot').length,
        arrivalSpanMs: arrivals.at(-1)! - arrivals[0]!,
        acknowledgedCounts: messages(c, 'recoilSync').map(s => s.count) });
      vi.clearAllTimers();
    }
    console.log(JSON.stringify({ weapon: spec.name, intervalMs: spec.fireIntervalMs, rows }));
    for (const row of rows) expect(row.accepted, JSON.stringify(row)).toBe(row.sent);
  });

  it('uses server receipt for recoil recovery as well as cadence', async () => {
    const h = await createTestRoom(CadenceArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect(), spec = WEAPONS[1]!;
    await c.send('switch', { slot: spec.slot });
    await h.advance(WEAPON.swapMs + TICK_MS * 2 + 17);
    let expected = emptyRecoil();
    for (let n = 0; n < 10; n++) {
      const at = Date.now(), kick = recoilSample(expected, spec, at);
      await c.send('fire', { fireSeq: n + 1, yaw: 0, pitch: 0 });
      expected = advanceRecoil(expected, spec, at);
      await h.advance(spec.fireIntervalMs);
      expect(messages(c, 'recoilSync').at(-1)).toMatchObject(expected);
      const dir = dirFromAngles(kick.yaw, kick.pitch);
      expect(messages(c, 'shot').at(-1)).toMatchObject({ dx: dir.x, dy: dir.y, dz: dir.z });
    }
  });

  it.each(WEAPONS.filter(w => ['AR', 'SMG', 'Pistol'].includes(w.name)))
  ('$name: the advertised close-range body-shot count kills in a queued duel', async spec => {
    const h = await createTestRoom(CadenceArena, { codec: ArenaSchema, sync: 'throttled' });
    const a = await h.connect(), b = await h.connect();
    const state = (h.room as unknown as { state: ArenaState }).state;
    // A static duel fixture in the existing clear lane; normal lag history, hit
    // validation and damage are used. Mouse compensation keeps the aim on chest.
    Object.assign(state.players[a.id]!, { x: 5, y: 0, z: 11, prot: false });
    Object.assign(state.players[b.id]!, { x: 20, y: 0, z: 11, prot: false });
    await a.send('switch', { slot: spec.slot });
    await h.advance(WEAPON.swapMs + TICK_MS * 2 + 17);
    const count = Math.ceil(100 / spec.damageBody);
    let recoil = emptyRecoil();
    for (let i = 0; i < count; i++) {
      const at = Date.now(), kick = recoilSample(recoil, spec, at);
      await a.send('fire', { fireSeq: i + 1, yaw: Math.PI / 2 - kick.yaw,
        pitch: Math.atan2(1 - 1.65, 15) - kick.pitch });
      recoil = advanceRecoil(recoil, spec, at);
      await h.advance(spec.fireIntervalMs);
    }
    expect(state.players[b.id]!.alive).toBe(false);
    expect(messages(a, 'shot')).toHaveLength(count);
  });

  it('rejects a genuinely early arrival even when the drain times are a full interval apart', async () => {
    const h = await createTestRoom(CadenceArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    // AR arrivals 49 and 101 ms: only 52 ms apart, but drained at 50 and 150.
    await h.advance(49); await c.send('fire', { fireSeq: 1 });
    await h.advance(52); await c.send('fire', { fireSeq: 2,
      receivedAt: 9e15, at: 9e15, ts: 9e15, fireIntervalMs: 0 });
    await h.advance(49);
    expect(messages(c, 'shot')).toHaveLength(1);
    expect(messages(c, 'ammo').at(-1)?.mag).toBe(WEAPONS[0]!.mag - 1);
    expect(messages(c, 'fireBlocked').at(-1)).toEqual({ retryMs: TICK_MS, mag: WEAPONS[0]!.mag - 1, weapon: 1 });
    expect(messages(c, 'recoilSync').at(-1)?.count).toBe(1);
    // A rejected request cannot push the accepted shot's deadline forward.
    await c.send('fire', { fireSeq: 3 }); await h.advance(TICK_MS);
    expect(messages(c, 'shot')).toHaveLength(2);
  });

  it('a forged subtick envelope cannot turn client time into firing credit', async () => {
    const h = await createTestRoom(CadenceArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    // The harness's public send() omits the optional subtick envelope. Pass
    // raw bytes through its real connection and the SDK's normal wire parser.
    const conn = (c as unknown as { conn: RoomConnection }).conn;
    const wire = (seq: number, ts: number) => (h.room as unknown as {
      _message(c: RoomConnection, data: string): Promise<void>;
    })._message(conn, JSON.stringify({ t: ClientMessageType.Message, type: 'fire', seq, ts,
      receivedAt: 9e15, payload: { fireSeq: seq, receivedAt: 9e15 } }));
    await h.advance(49); const first = Date.now(); await wire(1, first - 1e12);
    await h.advance(52); await wire(2, Date.now() + 1e12);
    await h.advance(49);
    expect(messages(c, 'shot')).toHaveLength(1);
    expect(messages(c, 'recoilSync').at(-1)).toMatchObject({ seq: 2, count: 1, at: first });
  });

  it('does not generate a retry shot after a denied trigger has been released', async () => {
    const h = await createTestRoom(CadenceArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    await c.send('fire', { fireSeq: 1 }); await h.advance(1);
    await c.send('fire', { fireSeq: 2 }); await h.advance(TICK_MS);
    expect(messages(c, 'fireBlocked').at(-1)).toEqual({ retryMs: 99, mag: WEAPONS[0]!.mag - 1, weapon: 1 });
    const accepted = messages(c, 'recoilSync').at(-1);
    await h.advance(1000); // No more fire intent: never schedule an automatic shot.
    expect(messages(c, 'shot')).toHaveLength(1);
    expect(messages(c, 'recoilSync').at(-1)).toEqual(accepted);
  });
});
