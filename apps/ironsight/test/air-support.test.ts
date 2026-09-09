import { expect, it, afterEach, vi } from 'vitest';
import { AirSupport, RECON, type SupportView } from '../src/air-support.js';
import { ArenaSchema, type ArenaState, type ArenaPlayer } from '../src/schema.js';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';

const player = (team: number, x = 10): ArenaPlayer => ({ x, y: 0, z: 11, team, hp: 100, alive: true, prot: false,
  yaw: 0, pitch: 0, crouch: false, k: 0, d: 0, weapon: 0, nades: 2, reloadEnd: 0 });
const state = (): ArenaState => ({ players: { red: player(0), ally: player(0), blue: player(1, 90.4), shield: { ...player(1), prot: true },
  dead: { ...player(1), alive: false } }, mode: 0, phase: 'live', seed: 1, redScore: 0, blueScore: 0,
  signalAt: 0, coreOpen: false, warmupEndMs: 0, matchEndMs: 1e9, capA: 100, capB: 100, capC: 100 });

it('earns on the exact third kill; pulses only living unshielded enemies, freezes snapshots and keeps them team-private', () => {
  const a = new AirSupport(), s = state();
  a.earn('red', 2, s); a.tick(s, 1000, false); expect(a.view('red', 2, s, 1000).flights).toHaveLength(0);
  a.earn('red', 3, s); a.tick(s, 1000, false);
  expect(a.view('blue', 0, s, 1000).flights).toHaveLength(1);
  expect(a.tick(s, 2999, false)).toBe(false);
  a.tick(s, 3000, false);
  const scan = a.view('red', 3, s, 3000).scan!;
  expect(scan.contacts).toEqual([{ x: 90, z: 11 }]);
  expect(a.view('ally', 0, s, 3000).scan).toEqual(scan);
  expect(a.view('blue', 0, s, 3000).scan).toBeNull();
  s.players.blue!.x = 70; expect(scan.contacts[0]!.x).toBe(90);
  expect(a.view('red', 3, s, 5200).scan).toBeNull();
  a.tick(s, 7000, false); expect(a.view('red', 3, s, 7000).scan!.contacts[0]!.x).toBe(70);
  a.tick(s, 11000, false); expect(a.view('red', 3, s, 11000).scan!.sampledAt).toBe(11000);
  a.tick(s, 13000, false); expect(a.view('red', 3, s, 13000).flights).toHaveLength(0);
  a.earn('red', 4, s); a.tick(s, 31000, false); expect(a.view('red', 4, s, 31000).flights).toHaveLength(0);
});

it('caps shared airspace without extending flights; queued lives cancel on death, owner death ends radar, and a new round clears cooldown', () => {
  const a = new AirSupport(), s = state();
  a.earn('red', 3, s); a.tick(s, 1000, false); a.earn('ally', 3, s); a.tick(s, 2000, false);
  expect(a.view('ally', 3, s, 2000)).toMatchObject({ queued: true, readyAt: 31000 });
  expect(a.view('red', 3, s, 2000).flights[0]!.endsAt).toBe(13000);
  s.players.red!.alive = false; a.tick(s, 3000, false);
  expect(a.view('ally', 3, s, 3000).flights).toHaveLength(0);
  a.tick(s, 30999, false); expect(a.view('ally', 3, s, 30999).queued).toBe(true);
  s.players.ally!.alive = false; a.tick(s, 31000, false);
  s.players.ally!.alive = true; a.tick(s, 32000, false); expect(a.view('ally', 0, s, 32000).flights).toHaveLength(0);
  s.phase = 'ended'; a.tick(s, 33000, false); s.phase = 'live'; a.earn('ally', 3, s); a.tick(s, 33001, false);
  expect(a.view('ally', 3, s, 33001).flights).toHaveLength(1);
});

it('consumes blocked/skipped pulses without a replay; defers queued launch during blackout; reconnect only gets the old snapshot', () => {
  const a = new AirSupport(), s = state();
  a.earn('red', 3, s); a.tick(s, 1000, true); expect(a.view('red', 3, s, 1000).queued).toBe(true);
  a.tick(s, 2000, false); a.tick(s, 4000, false); expect(a.view('red', 3, s, 4500).scan!.sampledAt).toBe(4000);
  a.tick(s, 4500, true); expect(a.view('red', 3, s, 4500).scan).toBeNull();
  a.tick(s, 8000, true); a.tick(s, 8500, false); expect(a.view('red', 3, s, 8500).scan).toBeNull();
  a.tick(s, 12500, false); expect(a.view('red', 3, s, 12500).scan!.sampledAt).toBe(12500);
  s.players.blue!.x = 50;
  expect(a.view('red', 3, s, 12600).scan!.contacts[0]!.x).toBe(90);
  expect(a.tick(s, 12600, false)).toBe(false);
});

it('keeps FFA/warmup disabled and practice private despite shared team numbers', () => {
  const a = new AirSupport(), s = state();
  s.mode = 1; a.earn('red', 3, s); a.tick(s, 1000, false); expect(a.view('red', 3, s, 1000).flights).toHaveLength(0);
  s.mode = 0; s.phase = 'warmup'; a.earn('red', 3, s); a.tick(s, 1000, false); expect(a.view('red', 3, s, 1000).flights).toHaveLength(0);
  s.phase = 'live'; s.mode = 3; a.earn('red', 3, s); a.tick(s, 2000, false); a.tick(s, 4000, false);
  expect(a.view('red', 3, s, 4000).scan!.contacts).toHaveLength(2);
  expect(a.view('ally', 0, s, 4000)).toMatchObject({ flights: [], scan: null });
});

class ReconRoom extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  protected override spawnProtectMs = 0;
  protected override respawnMs = 200;
  restoreFixture() { this.onRestore(); }
}
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
const latest = (c: { frames(): Record<string, unknown>[] }) => c.frames().filter(f => f.type === 'support').at(-1)?.payload as SupportView | undefined;

it('real room awards only confirmed kills, rejects forged rewards, snapshots reconnects and cancels on death/restore', async () => {
  vi.useFakeTimers(); vi.setSystemTime(1000000);
  const h = await createTestRoom(ReconRoom, { id: 'arena-tdm', codec: ArenaSchema });
  const red = await h.connect(), blue = await h.connect(), ally = await h.connect();
  const s = (h.room as unknown as { state: ArenaState }).state;
  for (const type of ['support', 'recon', 'streak']) await red.send(type, { count: 3, flights: [{ owner: red.id }] });
  await red.send('move', { mz: 0, count: 3, recon: true }); await red.send('syncView', {}); await h.advance(100);
  expect(latest(red)?.count).toBe(0); expect(latest(red)?.flights).toHaveLength(0);
  Object.assign(s.players[ally.id]!, { x: 45, z: 11 });
  // Fixture placement only; every kill then uses the ordinary validated fire handler.
  for (let kill = 0; kill < 3; kill++) {
    Object.assign(s.players[red.id]!, { x: 6, y: 0, z: 11, yaw: Math.PI / 2, pitch: Math.atan2(1 - 1.65, 10), prot: false });
    Object.assign(s.players[blue.id]!, { x: 16, y: 0, z: 11, alive: true, hp: 100, prot: false });
    await h.advance(350);
    for (let shot = 0; shot < 4; shot++) { await red.send('fire', {}); await h.advance(110); }
    expect(s.players[red.id]!.k).toBe(kill + 1);
    await h.advance(400);
  }
  const flight = latest(red)!.flights[0]!;
  expect(latest(red)!.count).toBe(3); expect(flight.owner).toBe(red.id);
  expect(latest(ally)!.flights).toEqual(latest(red)!.flights);
  await h.advance(2100);
  expect(latest(red)!.scan).not.toBeNull(); expect(latest(blue)!.scan).toBeNull();
  const sampledAt = latest(red)!.scan!.sampledAt;
  await ally.send('syncView', { owner: red.id }); await h.advance(50);
  expect(latest(ally)!.scan!.sampledAt).toBe(sampledAt);
  await blue.send('syncView', { team: 0 }); await h.advance(50); expect(latest(blue)!.scan).toBeNull();
  // Death goes through the same authoritative damage routine (grenade/self death included).
  (h.room as unknown as { applyDamage(id: string, damage: number, killer: string, part: string): void }).applyDamage(red.id, 100, red.id, 'blast');
  expect(latest(red)!.count).toBe(0); expect(latest(ally)!.flights).toHaveLength(0);
  (h.room as ReconRoom).restoreFixture(); await red.send('syncView', {}); await h.advance(50);
  expect(latest(red)).toMatchObject({ count: 0, queued: false, flights: [], scan: null });
});
