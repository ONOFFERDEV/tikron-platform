import { afterEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaPlayer, type ArenaState } from '../src/schema.js';
import { DRONE, DroneSupport, type DroneView } from '../src/drone.js';
import { HIT_ANIMATION_NONE } from '../src/hit-state-bucket.js';

const player = (team = 0, x = 75): ArenaPlayer => ({ x, y: 0, z: 50, yaw: Math.PI / 2, pitch: 0,
  hp: 100, alive: true, prot: false, team, crouch: false, k: 0, d: 0, weapon: 0, nades: 2, reloadEnd: 0,
  hitClipIndex: HIT_ANIMATION_NONE, hitClipStartedAt: 0, hitBlendSources: [], hitReactionKind: 0, hitReactionStartedAt: 0, hitReactionSeq: 0,
  hitSegmentSeq: 0, hitSegmentStartedAt: 0 });
const state = (): ArenaState => ({ players: { owner: player(), west: player(1, 52.5), ally: player(0, 95) },
  seed: 1, redScore: 0, blueScore: 0, phase: 'live', mode: 0, matchEndMs: 1e9, signalAt: 0,
  coreOpen: false, warmupEndMs: 0, capA: 100, capB: 100, capC: 100 });
const bounds = { width: 150, depth: 100, ceiling: 16 };
const tick = (support: DroneSupport, match: ArenaState, now: number) =>
  support.tick(match, now, [], bounds, new Map([['west', {}]]));

it('keeps the legacy wire name while emitting only a fixed linear attack-biplane pass', () => {
  const support = new DroneSupport(), match = state();
  support.earn('owner', DRONE.kills, match); tick(support, match, 1_000);
  expect(support.view('owner', match)).toMatchObject({ protocol: 2, kind: 'fixed_linear_strafe', flights: [{
    kind: 'attack_biplane', warningEndsAt: 4_000, endsAt: 6_000, lock: null,
    corridor: { start: { x: 45, z: 50 }, end: { x: 105, z: 50 }, width: 4 },
  }] });
  expect(tick(support, match, 3_999).shots).toEqual([]);
  expect(tick(support, match, 4_000).shots.map(shot => shot.victim)).toEqual(['west']);
});

it('has no hover target lock, homing tether, laser damage, or operator-death catch-up score', () => {
  const support = new DroneSupport(), match = state();
  support.earn('owner', DRONE.kills, match); tick(support, match, 1_000);
  match.players.owner!.yaw = -Math.PI / 2;
  expect(support.view('owner', match).flights[0]!.lock).toBeNull();
  expect(support.shutdown('owner', 'west', match, 2_000)).toBe(0);
  expect(support.view('owner', match).flights).toHaveLength(1);
});

it('preserves team airspace, FFA exclusion, private practice, and lifecycle cancellation', () => {
  const support = new DroneSupport(), match = state();
  support.earn('owner', 7, match); tick(support, match, 1_000);
  support.earn('ally', 7, match); tick(support, match, 1_100);
  expect(support.view('ally', match).queued).toBe(true);
  support.forget('owner'); expect(support.view('ally', match).flights).toEqual([]);
  match.phase = 'ended'; expect(tick(support, match, 4_000).shots).toEqual([]);
  match.phase = 'live'; match.mode = 1; support.earn('owner', 7, match); tick(support, match, 5_000);
  expect(support.view('owner', match).flights).toEqual([]);
  support.clear(); match.mode = 3; support.earn('owner', 7, match); tick(support, match, 6_000);
  expect(support.view('ally', match).flights).toEqual([]);
});

class SupportRoom extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  protected override spawnProtectMs = 0;
}
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });
const latest = <T>(client: { frames(): Record<string, unknown>[] }, type: string) =>
  client.frames().filter(frame => frame.type === type).at(-1)?.payload as T;

it('real room ignores forged activation and cancels the server-earned pass when its owner leaves', async () => {
  vi.useFakeTimers(); vi.setSystemTime(1_000_000);
  const room = await createTestRoom(SupportRoom, { id: 'arena-tdm', codec: ArenaSchema });
  const owner = await room.connect(), enemy = await room.connect();
  await owner.send('drone', { count: 7, target: enemy.id, damage: 999_999, deadline: 0 });
  await owner.send('syncView', {}); await room.advance(50);
  expect(latest<DroneView>(owner, 'drone').flights).toEqual([]);
  const runtime = room.room as unknown as { state: ArenaState; droneSupport: DroneSupport; onSeatExpired(client: unknown): void };
  runtime.droneSupport.earn(owner.id, 7, runtime.state); await room.advance(50);
  expect(latest<DroneView>(enemy, 'drone').flights[0]).toMatchObject({ kind: 'attack_biplane', lock: null });
  runtime.onSeatExpired({ id: owner.id });
  expect(latest<DroneView>(enemy, 'drone').flights).toEqual([]);
  await room.advance(DRONE.warningMs + DRONE.passMs);
  expect(runtime.state.players[enemy.id]!.hp).toBe(100);
});
