import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { resolvePing } from '../src/ping.js';

class PingArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1000000); });
afterEach(() => vi.useRealTimers());
const frames = (c: { frames(): Record<string, unknown>[] }) => c.frames().filter(f => f.type === 'teamPing');

it('resolves only an unoccluded enemy and stops location marks at cover, ground and map edges', () => {
  const origin = { x: 5, y: 1, z: 5 }, dir = { x: 1, y: 0, z: 0 };
  const bounds = { width: 150, depth: 100, ceiling: 16 };
  const target = { id: 'enemy', x: 15, z: 5, feetY: 0, headY: 1.8, team: 1 };
  expect(resolvePing(origin, dir, 0, [target], [], bounds).kind).toBe('enemy');
  const wall = { min: { x: 10, y: 0, z: 0 }, max: { x: 11, y: 6, z: 10 } };
  expect(resolvePing(origin, dir, 0, [target], [wall], bounds)).toEqual({ kind: 'go', x: 10, z: 5 });
  expect(resolvePing(origin, dir, 1, [target], [], bounds).kind).toBe('go');
  expect(resolvePing({ x: 145, y: 1, z: 5 }, dir, 0, [], [], bounds).x).toBe(150);
  expect(resolvePing(origin, { x: 0, y: -1, z: 0 }, 0, [], [], bounds)).toEqual({ kind: 'go', x: 5, z: 5 });
});

it('stamps sender and location, sends only to allies, limits repeats and rejects inactive/malformed requests', async () => {
  const h = await createTestRoom(PingArena, { codec: ArenaSchema, sync: 'throttled' });
  const a = await h.connect(), enemy = await h.connect(), ally = await h.connect();
  const state = (h.room as unknown as { state: ArenaState }).state;
  await a.send('ping', { yaw: 0, pitch: -.5, from: enemy.id, x: 999, z: 999, kind: 'enemy' });
  await h.advance(100);
  expect(frames(a)).toHaveLength(1); expect(frames(ally)).toHaveLength(1); expect(frames(enemy)).toHaveLength(0);
  const p = frames(a)[0]!.payload as { from: string; x: number; kind: string; expiresAt: number };
  expect(p.from).toBe(a.id); expect(p.x).toBeLessThan(150); expect(p.kind).toBe('go');
  expect(p.expiresAt).toBeGreaterThan(Date.now());
  await a.send('ping', { yaw: 0, pitch: 0 }); await h.advance(100);
  expect(frames(a)).toHaveLength(1);
  await h.advance(2000);
  await a.send('ping', { yaw: 'bad', pitch: 0 }); await h.advance(100);
  expect(frames(a)).toHaveLength(1);
  state.players[a.id]!.alive = false;
  await a.send('ping', { yaw: 0, pitch: 0 }); await h.advance(100);
  expect(frames(a)).toHaveLength(1);
  state.players[a.id]!.alive = true; state.phase = 'ended';
  await a.send('ping', { yaw: 0, pitch: 0 }); await h.advance(100);
  expect(frames(a)).toHaveLength(1);
});

it('does not treat FFA/practice shared team numbers as team communication', async () => {
  for (const mode of [1, 3]) {
    const h = await createTestRoom(PingArena, { codec: ArenaSchema });
    const a = await h.connect(), b = await h.connect();
    const state = (h.room as unknown as { state: ArenaState }).state;
    state.mode = mode; state.players[b.id]!.team = state.players[a.id]!.team;
    await a.send('ping', { yaw: 0, pitch: 0, intent: 'backup' }); await h.advance(100);
    expect(frames(b)).toHaveLength(0); expect(frames(a)).toHaveLength(mode === 3 ? 1 : 0);
  }
});


it('backup snapshots the authoritative caller, shares the contextual budget and rejects unsupported intent', async () => {
  const h = await createTestRoom(PingArena, { codec: ArenaSchema, sync: 'throttled' });
  const a = await h.connect(), enemy = await h.connect(), ally = await h.connect();
  const state = (h.room as unknown as { state: ArenaState }).state;
  const me = state.players[a.id]!;
  const origin = { x: me.x, z: me.z };
  await a.send('ping', { yaw: 0, pitch: 0, intent: 'reveal' }); await h.advance(50);
  expect(frames(a)).toHaveLength(0);
  await a.send('ping', { yaw: 0, pitch: 0, intent: 'backup', x: 999, z: 999, from: enemy.id });
  await h.advance(50);
  expect(frames(a)).toHaveLength(1); expect(frames(ally)).toHaveLength(1); expect(frames(enemy)).toHaveLength(0);
  expect(frames(a)[0]!.payload).toMatchObject({ ...origin, kind: 'backup', from: a.id });
  await a.send('ping', { yaw: 0, pitch: 0 }); await h.advance(50);
  expect(frames(a)).toHaveLength(1);
  me.x += 1;
  expect(frames(a)[0]!.payload).toMatchObject(origin);
  await h.advance(2000);
  await a.send('ping', { yaw: 0, pitch: 0 }); await h.advance(50);
  expect(frames(a)).toHaveLength(2);
  await a.send('ping', { yaw: 0, pitch: 0, intent: 'backup' }); await h.advance(50);
  expect(frames(a)).toHaveLength(2);
  await h.advance(2000); me.alive = false;
  await a.send('ping', { yaw: 0, pitch: 0, intent: 'backup' }); await h.advance(50);
  expect(frames(a)).toHaveLength(2);
  me.alive = true; state.phase = 'ended';
  await a.send('ping', { yaw: 0, pitch: 0, intent: 'backup' }); await h.advance(50);
  expect(frames(a)).toHaveLength(2);
});
