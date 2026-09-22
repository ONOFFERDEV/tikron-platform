import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { WaistTraversal, launchRoute } from '../src/traversal.js';
import { ARENA3 as map } from '../src/map/arena3.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { MOVE, PLAYER, TICK_MS } from '../src/config.js';
import { canStand, type Vec3 } from '../src/physics.js';

const jump = { mx: 0, mz: 1, crouch: false, sprint: false, jump: true };
const formerPads = [
  { id: 'west-fixture', from: { x: 60, y: 0, z: 55 }, to: { x: 70, y: 3, z: 55 } },
  { id: 'east-fixture', from: { x: 90, y: 0, z: 43 }, to: { x: 80, y: 3, z: 43 } },
] as const;

describe('Switchyard launch removal', () => {
  it('rejects required launch route while keeping generic launch collision gates', () => {
    // Given: the former paths as isolated traversal fixtures.
    for (const pad of formerPads) {
      const yaw = Math.atan2(pad.to.x - pad.from.x, pad.to.z - pad.from.z);
      // When: generic launch collision is evaluated with and without an authored pad.
      const generic = launchRoute(pad.from, yaw, [pad], map.boxes, map.bounds, map.ramps ?? []);
      const authored = launchRoute(pad.from, yaw, map.launchPads ?? [], map.boxes, map.bounds, map.ramps ?? []);
      // Then: the safe generic adapter still works, while Switchyard grants no launch.
      expect(generic).not.toBeNull();
      expect(authored).toBeNull();
      const traversal = new WaistTraversal();
      let pos: Vec3 = { ...pad.from };
      for (let step = 0; step < 24; step += 1) {
        const result = traversal.step(TICK_MS, step === 0 ? jump : { ...jump, jump: false, mz: 0 },
          step === 0, pos, yaw, map.boxes, map.bounds, map.ramps ?? [], [pad]);
        if (result === null) throw new TypeError('generic launch fixture ended early');
        pos = result.pos;
      }
      expect(pos).toEqual(pad.to);
      expect(traversal.active).toBe(false);
    }
    expect(map.launchPads ?? []).toHaveLength(0);
  });

  it('retains distance, facing, air, intent, obstruction, ceiling, support, and bounds rejection', () => {
    // Given: one former route used only as a generic collision fixture.
    const pad = formerPads[0];
    const yaw = Math.PI / 2;
    const thin = { min: { x: 64, y: 2, z: 53 }, max: { x: 64.001, y: 10, z: 57 } };
    // When: each unsafe activation class is evaluated.
    const rejected = [
      launchRoute({ ...pad.from, x: pad.from.x - 1.51 }, yaw, [pad], map.boxes, map.bounds, map.ramps ?? []),
      launchRoute({ ...pad.from, y: 0.1 }, yaw, [pad], map.boxes, map.bounds, map.ramps ?? []),
      launchRoute(pad.from, -yaw, [pad], map.boxes, map.bounds, map.ramps ?? []),
      launchRoute(pad.from, yaw, [pad], [...map.boxes, thin], map.bounds, map.ramps ?? []),
      launchRoute(pad.from, yaw, [pad], map.boxes, { ...map.bounds, ceiling: 7 }, map.ramps ?? []),
      launchRoute(pad.from, yaw, [{ ...pad, to: { x: 61, y: 3, z: 55 } }], map.boxes, map.bounds, map.ramps ?? []),
      launchRoute(pad.from, yaw, [{ ...pad, to: { x: 151, y: 0, z: 55 } }], map.boxes, map.bounds, map.ramps ?? []),
    ];
    const traversalRejected = [{ jump: false }, { mz: 0 }, { ads: true }, { crouch: true }].map((extra) =>
      new WaistTraversal().step(TICK_MS, { ...jump, ...extra }, true, pad.from, yaw, map.boxes, map.bounds, map.ramps ?? [], [pad]));
    traversalRejected.push(new WaistTraversal().step(TICK_MS, jump, false, pad.from, yaw,
      map.boxes, map.bounds, map.ramps ?? [], [pad]));
    // Then: every old safety gate remains closed.
    expect([...rejected, ...traversalRejected].every((route) => route === null)).toBe(true);
  });
});

class TestArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
}

afterEach(() => vi.useRealTimers());

it('room ignores forged launch fields and applies ordinary grounded movement', async () => {
  // Given: an FFA player at a former induction-pad coordinate.
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  const harness = await createTestRoom(TestArena, { id: 'arena-ffa', codec: ArenaSchema, sync: 'throttled' });
  const client = await harness.connect();
  const player = (harness.room as unknown as { state: ArenaState }).state.players[client.id]!;
  Object.assign(player, formerPads[0].from, { yaw: Math.PI / 2 });
  // When: a client forges the removed launch fields.
  await client.send('move', { ...jump, launch: true, target: { x: 149, y: 14, z: 99 }, durationMs: 1 });
  await harness.advance(TICK_MS);
  // Then: only ordinary walk/jump physics applies and no traversal is announced.
  expect(player.x - formerPads[0].from.x).toBeCloseTo(MOVE.walk * TICK_MS / 1_000);
  expect(player.y).toBeGreaterThan(0);
  expect(canStand(player.x, player.y, player.z, PLAYER.radius, PLAYER.standHeight, map.boxes, map.bounds)).toBe(true);
  expect(client.frames().filter((frame) => frame.type === 'traversal')).toHaveLength(0);
});
