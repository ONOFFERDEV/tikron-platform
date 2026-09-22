import { expect, it } from 'vitest';
import * as THREE from 'three';
import { SentryDrone } from '../client/sentry-drone.js';
import { readDrone } from '../client/drone-view.js';

const corridor = { start: { x: 45, y: 0, z: 50 }, end: { x: 105, y: 0, z: 50 }, width: 4 };
const flights = [0, 1].map(team => {
  const lane = team === 0 ? corridor : { start: corridor.end, end: corridor.start, width: 4 };
  return { protocol: 2, owner: String(team), team, kind: 'attack_biplane' as const,
    x: lane.start.x, y: 8, z: lane.start.z, startedAt: 1_000, warningEndsAt: 4_000, endsAt: 6_000,
    lock: null, corridor: lane };
});
const view = { protocol: 2 as const, kind: 'fixed_linear_strafe' as const, queued: false, readyAt: 61_000, flights };

it('accepts and copies fixed biplane corridors while rejecting hover, homing, forged deadlines and malformed paths', () => {
  const read = readDrone(view, 1_600, 150, 100)!;
  expect(read).toEqual(view); expect(read.flights[0]!.corridor).not.toBe(flights[0]!.corridor);
  for (const bad of [null, {}, { ...view, protocol: 1 }, { ...view, kind: 'hover' },
    { ...view, flights: [...flights, ...flights] }, { ...view, readyAt: NaN }, { ...view, readyAt: -1 },
    { ...view, flights: [{ ...flights[0], x: Infinity }] },
    { ...view, flights: [{ ...flights[0], x: 46 }] },
    { ...view, flights: [{ ...flights[0], warningEndsAt: 3_999 }] },
    { ...view, flights: [{ ...flights[0], endsAt: 6_001 }] },
    { ...view, flights: [{ ...flights[0], lock: { point: { x: 16, y: 1, z: 50 }, fireAt: 2_500 } }] },
    { ...view, flights: [{ ...flights[0], corridor: { ...corridor, width: 8 } }] },
    { ...view, flights: [{ ...flights[0], corridor: { ...corridor, end: { x: 104, y: 0, z: 50 } } }] }])
    expect(readDrone(bad, 1_600, 150, 100)).toBeNull();
});

it('shows the immutable ground warning, moves the biplane linearly only during the pass, and fully drains', () => {
  const scene = new THREE.Scene(), view3d = new SentryDrone(scene), objects: THREE.Object3D[] = [];
  scene.traverse(object => objects.push(object));
  view3d.update(flights, 2_000); expect(view3d.inspect()).toMatchObject({ bodies: 0, corridors: 4, draws: 1,
    assetUrl: '/assets/ww1/support/biplane.glb', pilotable: false,
    presentation: ['observation', 'fixed-linear-strafing'] });
  view3d.update(flights, 4_500); const normal = view3d.inspect();
  expect(normal).toMatchObject({ bodies: 2, corridors: 4, draws: 3 });
  expect(normal.positions[0]).toEqual([60, 8, 50]);
  view3d.update(flights, 4_500, true); expect(view3d.inspect().positions).toEqual(normal.positions);
  view3d.update(flights, 6_000); expect(view3d.inspect()).toMatchObject({ bodies: 0, corridors: 0, draws: 0 });
  const final: THREE.Object3D[] = []; scene.traverse(object => final.push(object));
  expect(final).toEqual(objects); expect(objects.some(object => object instanceof THREE.Light)).toBe(false);
});
