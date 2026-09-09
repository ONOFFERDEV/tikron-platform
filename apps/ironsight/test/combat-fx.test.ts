import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CombatFx } from '../client/combat-fx.js';

afterEach(() => vi.restoreAllMocks());
const origin = { x: 2, y: 3, z: 4 }, dir = { x: 0, y: 0, z: 1 };

it('reuses the same GPU resources across saturation, expiry and a second firefight', () => {
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  const scene = new THREE.Scene(), fx = new CombatFx(scene);
  const objects = [...scene.children] as THREE.Mesh[];
  const geometries = objects.map(o => o.geometry), materials = objects.map(o => o.material);
  const disposals = [...new Set(geometries)].map(g => vi.spyOn(g, 'dispose'));
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 1000; i++) {
      fx.spawnNade({ ...origin, id: String(i), vx: 0, vy: 2, vz: 1 });
      fx.boom({ ...origin, id: String(i) }, 1000);
      fx.addTracer(origin, dir, 40, i % 2 === 0, 800, 1000);
    }
    expect(fx.inspect()).toEqual({ grenades: 0, explosions: 12, tracers: 96 });
    fx.update(1650); fx.updateTracers(1650);
    expect(fx.inspect()).toEqual({ grenades: 0, explosions: 0, tracers: 0 });
  }
  expect(scene.children).toEqual(objects);
  expect(objects.map(o => o.geometry)).toEqual(geometries);
  expect(new Set(geometries).size).toBe(4);
  expect(objects.map(o => o.material)).toEqual(materials);
  expect(disposals.every(spy => spy.mock.calls.length === 0)).toBe(true);
  expect(objects.every(o => !o.visible)).toBe(true);
});

it('grows the tracer from its bore, preserves its endpoint and expires on arrival', () => {
  const scene = new THREE.Scene(), fx = new CombatFx(scene);
  fx.addTracer(origin, dir, 40, false, 800, 1000);
  fx.updateTracers(1005);
  const tracer = scene.children.find(o => o.visible) as THREE.Mesh;
  expect(tracer.position.z).toBe(6); // head=4m, tail=0m, center=2m from origin
  expect(tracer.scale.z).toBe(4);
  fx.updateTracers(1040);
  expect(tracer.position.z + tracer.scale.z / 2).toBe(36); // head=32m
  fx.updateTracers(1050);
  expect(tracer.visible).toBe(false);
  expect(fx.inspect().tracers).toBe(0);
});

it('routes bounce/boom by grenade id and ignores events for a replaced slot', () => {
  const scene = new THREE.Scene(), fx = new CombatFx(scene);
  for (let i = 0; i < 33; i++) fx.spawnNade({ ...origin, id: String(i), vx: 0, vy: 0, vz: 0 });
  expect(fx.inspect().grenades).toBe(32);
  fx.bounceNade({ id: '0', x: 99, y: 99, z: 99, vx: 0, vy: 0, vz: 0 });
  expect(scene.children.some(o => o.position.x === 99)).toBe(false);
  fx.boom({ ...origin, id: '0' }, 1000);
  expect(fx.inspect().grenades).toBe(32);
  fx.bounceNade({ id: '32', x: 6, y: 7, z: 8, vx: 0, vy: 0, vz: 0 });
  expect(scene.children.some(o => o.position.x === 6 && o.position.y === 7)).toBe(true);
  fx.boom({ ...origin, id: '32' }, 1000);
  expect(fx.inspect().grenades).toBe(31);
});
