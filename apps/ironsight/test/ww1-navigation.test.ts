import { expect, it } from 'vitest';
import { BotNavigator } from '../src/rooms/bot-navigation.js';
import type { MapDef, MapNavigationDef } from '../src/map/types.js';
import { MOVE, PLAYER } from '../src/config.js';
import { moveAndSlide } from '../src/physics.js';

const point = (x: number, y: number, z: number) => ({ x, y, z });
const map = (width: number, depth: number, boxes: MapDef['boxes'] = [],
  navigation?: MapNavigationDef): MapDef => ({
  bounds: { width, depth, ceiling: 10 }, boxes, navigation,
  spawns: { red: [point(.5, 0, .5)], blue: [point(width - .5, 0, depth - .5)] },
  caps: { a: point(.5, 0, .5), b: point(width / 2, 0, depth / 2),
    c: point(width - .5, 0, depth - .5) },
});

it('handles node ids above 32767', () => {
  const nav = new BotNavigator(map(182, 182));
  const start = point(181.5, 0, 181.5), goal = point(.5, 0, .5);
  const next = nav.next(start, goal);
  expect(nav.stats.nodes).toBeGreaterThan(32767);
  expect(next).not.toEqual(start);
  expect(next.x + next.z).toBeLessThan(start.x + start.z);
});

it('rejects layer shortcut while preserving bridge under and over routes', () => {
  const bridge = { min: point(8, 2.5, 3), max: point(22, 3, 7) };
  const nav = new BotNavigator(map(30, 10, [bridge]));
  expect(nav.walkable(point(10.5, 0, 5.5), point(20.5, 0, 5.5))).toBe(true);
  expect(nav.walkable(point(10.5, 3, 5.5), point(20.5, 3, 5.5))).toBe(true);
  expect(nav.walkable(point(10.5, 0, 5.5), point(10.5, 3, 5.5))).toBe(false);
  expect(nav.next(point(10.5, 0, 5.5), point(20.5, 3, 5.5))).toEqual(point(10.5, 0, 5.5));
});

it('rejects sub-capsule link', () => {
  const start = point(4.5, 3, 4.5), goal = point(8.5, 0, 4.5);
  const navigation: MapNavigationDef = { anchors: [
    { id: 'start', point: start, layer: 3, role: 'roof' },
    { id: 'goal', point: goal, layer: 0, role: 'route' },
  ], links: [{ id: 'narrow', from: 'start', to: 'goal', traversal: 'drop', bidirectional: false, minWidth: .6 }] };
  const nav = new BotNavigator(map(16, 9, [{ min: point(0, 0, 0), max: point(5, 3, 9) }], navigation));
  expect(nav.next(start, goal)).toEqual(start);
});

it('follows a directed drop and rejects its reverse', () => {
  const high = point(4.5, 3, 4.5), low = point(8.5, 0, 4.5);
  const navigation: MapNavigationDef = { anchors: [
    { id: 'high', point: high, layer: 3, role: 'roof' },
    { id: 'low', point: low, layer: 0, role: 'route' },
  ], links: [{ id: 'drop', from: 'high', to: 'low', traversal: 'drop', bidirectional: false, minWidth: 2 }] };
  const platform = { min: point(0, 0, 0), max: point(5, 3, 9) };
  const dropMap = map(16, 9, [platform], navigation);
  const nav = new BotNavigator(dropMap);
  expect(nav.next(high, low)).not.toEqual(high);
  expect(nav.next(low, high)).toEqual(low);
  let pos = { ...high }, velocityY = 0;
  for (let tick = 0; tick < 100 && Math.hypot(pos.x - low.x, pos.y - low.y, pos.z - low.z) > .35; tick += 1) {
    const next = nav.next(pos, low), dx = next.x - pos.x, dz = next.z - pos.z, distance = Math.hypot(dx, dz);
    const scale = distance ? Math.min(MOVE.walk * .05, distance) / distance : 0;
    velocityY -= MOVE.gravity * .05;
    const result = moveAndSlide(pos, PLAYER.radius, PLAYER.standHeight,
      { x: dx * scale, y: velocityY * .05, z: dz * scale }, velocityY,
      dropMap.boxes, dropMap.bounds, MOVE.stepUp, dropMap.ramps);
    pos = result.pos; velocityY = result.vy;
  }
  expect(Math.hypot(pos.x - low.x, pos.y - low.y, pos.z - low.z)).toBeLessThan(.35);

  const blocked = new BotNavigator(map(16, 9, [platform,
    { min: point(5.1, 0, 0), max: point(5.7, 4, 9) }], navigation));
  expect(blocked.next(high, low)).toEqual(high);
});

it('changes destination fields and recovers when a blocked route opens', () => {
  const start = point(4.5, 0, 4.5), east = point(15.5, 0, 4.5), south = point(4.5, 0, 15.5);
  const wall = { min: point(9.5, 0, 0), max: point(10.5, 4, 20) };
  expect(new BotNavigator(map(20, 20, [wall])).next(start, east)).toEqual(start);

  const recovered = new BotNavigator(map(20, 20));
  const eastStep = recovered.next(start, east), southStep = recovered.next(start, south);
  expect(eastStep.x).toBeGreaterThan(start.x);
  expect(southStep.z).toBeGreaterThan(start.z);
  expect(eastStep).not.toEqual(southStep);
  expect(recovered.stats.fields).toBe(2);
});
