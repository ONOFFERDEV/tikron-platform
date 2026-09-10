import { expect, it } from 'vitest';
import { BotCoverIndex } from '../src/rooms/bot-cover.js';
import type { MapDef } from '../src/map/types.js';
import { canStand, nearestBox } from '../src/physics.js';
import { PLAYER } from '../src/config.js';

const point = { x: 10, y: 0, z: 10 };
const map = (boxes: MapDef['boxes'], ramps: MapDef['ramps'] = []): MapDef => ({
  boxes, ramps, bounds: { width: 30, depth: 30, ceiling: 12 },
  spawns: { red: [point], blue: [point] }, caps: { a: point, b: point, c: point },
});
const self = { ...point, team: 0, alive: true, crouch: false };

it('finds reachable full-height cover that blocks both shoulders and head', () => {
  const geometry = map([{ min: { x: 11, y: 0, z: 12 }, max: { x: 14, y: 3, z: 13 } }]);
  const nav = new BotCoverIndex(geometry), threat = { x: 12, y: 1.65, z: 20 };
  const cover = nav.find(self, threat, 3)!;
  expect(cover).toBeDefined(); expect(cover.crouch).toBe(false);
  expect(nav.reachable(self, cover.point)).toBe(true);
  expect(canStand(cover.point.x, cover.point.y, cover.point.z, PLAYER.radius, PLAYER.standHeight,
    geometry.boxes, geometry.bounds)).toBe(true);
  for (const height of [.6, 1.75]) {
    const to = { x: cover.point.x - threat.x, y: cover.point.y + height - threat.y, z: cover.point.z - threat.z };
    const d = Math.hypot(to.x, to.y, to.z);
    expect(nearestBox(threat, { x: to.x / d, y: to.y / d, z: to.z / d }, geometry.boxes, d)).toBeLessThan(d);
  }
});

it('chooses crouched waist cover, rejects overhead-only cover and unsupported floors', () => {
  const waist = map([{ min: { x: 9, y: 0, z: 11 }, max: { x: 14, y: 1.25, z: 12 } }]);
  expect(new BotCoverIndex(waist).find(self, { x: 12, y: 1.65, z: 25 }, 3)?.crouch).toBe(true);
  const lintel = map([{ min: { x: 9, y: 3, z: 11 }, max: { x: 14, y: 4, z: 12 } }]);
  const nav = new BotCoverIndex(lintel);
  expect(nav.find(self, { x: 12, y: 1.65, z: 25 }, 3)).toBeUndefined();
  expect(nav.reachable(self, { ...point, y: 3 })).toBe(false);
});

it('sweeps through a door under a lintel but rejects a narrow gap and a wall', () => {
  const wall = (gap: number) => map([
    { min: { x: 0, y: 0, z: 12 }, max: { x: 10 - gap / 2, y: 3, z: 12.4 } },
    { min: { x: 10 + gap / 2, y: 0, z: 12 }, max: { x: 30, y: 3, z: 12.4 } },
    { min: { x: 10 - gap / 2, y: 2.2, z: 12 }, max: { x: 10 + gap / 2, y: 3, z: 12.4 } },
  ]);
  const goal = { ...point, z: 15 };
  expect(new BotCoverIndex(wall(1.4)).reachable(self, goal)).toBe(true);
  expect(new BotCoverIndex(wall(.6)).reachable(self, goal)).toBe(false);
});

it('uses the real ramp from its low end to a roof and back; rejects high-side entry', () => {
  const geometry = map([{ min: { x: 8, y: 0, z: 16 }, max: { x: 14, y: 3, z: 20 } }],
    [{ minX: 9, maxX: 13, minZ: 10, maxZ: 16, axis: 'z', dir: 1, topY: 3 }]);
  const nav = new BotCoverIndex(geometry), low = { x: 11, y: 0, z: 9 }, high = { x: 11, y: 3, z: 18 };
  expect(nav.reachable(low, high)).toBe(true);
  expect(nav.reachable(high, low)).toBe(true);
  expect(nav.reachable({ x: 8, y: 0, z: 15 }, { x: 11, y: 2.5, z: 15 })).toBe(false);
});
