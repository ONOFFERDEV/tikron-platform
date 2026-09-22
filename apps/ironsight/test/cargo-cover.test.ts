import { afterEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ARENA3 } from '../src/map/arena3.js';
import { CoreCollision } from '../src/core-gate.js';
import { PLAYER } from '../src/config.js';
import { canStand, nearestBox } from '../src/physics.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it('keeps freight cover authoritative in every core state with two permanent bypasses', () => {
  // Given: the fixed freight stack and collision adapter.
  const collision = new CoreCollision(ARENA3);
  const freight = ARENA3.boxes.find((box) => box.min.x === 124 && box.max.x === 128
    && box.min.z === 46 && box.max.z === 52);
  if (freight === undefined) throw new TypeError('fixed freight collision is missing');
  // When: closed and open compatibility views are queried.
  const states = [collision.boxes(false), collision.boxes(true)];
  // Then: both retain the same cover and north/south capsule bypasses.
  expect(ARENA3.signalCore).toBeUndefined();
  expect(states[0]).toBe(states[1]);
  for (const boxes of states) for (const y of [0.6, 1.65, 2.8])
    expect(nearestBox({ x: 121, y, z: 50 }, { x: 1, y: 0, z: 0 }, boxes, 10)).toBe(3);
  for (const z of [44.5, 53.5]) for (let x = 121; x <= 131; x += 0.25)
    expect(canStand(x, 0, z, PLAYER.radius, PLAYER.standHeight, ARENA3.boxes, ARENA3.bounds)).toBe(true);
});

class FreightRoom extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  protected override spawnProtectMs = 0;
}

it('FFA ignores forged cargo state and fixed cover blocks both analytic and claimed shots', async () => {
  // Given: two unprotected FFA players on opposite sides of the freight stack.
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  const harness = await createTestRoom(FreightRoom, { codec: ArenaSchema, id: 'arena-ffa' });
  const attacker = await harness.connect();
  const victim = await harness.connect();
  await harness.advance(100);
  const state = (harness.room as unknown as { state: ArenaState }).state;
  Object.assign(state.players[attacker.id]!, { x: 121, y: 0, z: 50, prot: false, yaw: Math.PI / 2,
    pitch: Math.atan2(1 - PLAYER.standEye, 10) });
  Object.assign(state.players[victim.id]!, { x: 131, y: 0, z: 50, prot: false });
  // When: cargo state is forged and both shot paths are attempted.
  await attacker.send('move', { mx: 0, mz: 0, coreOpen: true, signalAt: 1 });
  await harness.advance(50);
  await attacker.send('fire');
  await harness.advance(250);
  await attacker.send('fire', { claim: { id: victim.id, part: 'body' } });
  await harness.advance(50);
  // Then: the static state and victim health never change.
  expect(state.coreOpen).toBe(false);
  expect(state.players[victim.id]!.hp).toBe(PLAYER.maxHp);
});
