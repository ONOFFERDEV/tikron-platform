import { afterAll, expect, it, vi } from 'vitest';
vi.hoisted(() => vi.stubGlobal('location', { search: '' }));
afterAll(() => vi.unstubAllGlobals());
import * as THREE from 'three';
import { BlastTrauma, BLAST_TRAUMA } from '../client/blast-trauma.js';
import { SceneRig } from '../client/scene.js';
import { CoreCollision } from '../src/core-gate.js';
import { ARENA1 } from '../src/map/arena1.js';

const eye = { x: 0, y: 1.65, z: 0 }, point = { x: 0, y: 1.65, z: 3 };
it('caps stacked blasts at two degrees, squares trauma, and fully settles in two seconds', () => {
  const fx = new BlastTrauma();
  for (let i = 0; i < 100; i++) fx.impact(point, eye, [], 1000);
  expect(fx.inspect().trauma).toBe(1);
  let peak = 0;
  for (let now = 1000; now <= 3000; now++) peak = Math.max(peak, Math.abs(fx.sample(now)));
  expect(peak).toBeGreaterThan(.02); expect(peak).toBeLessThanOrEqual(BLAST_TRAUMA.maxRoll);
  expect(fx.inspect().trauma).toBe(0); expect(fx.sample(3001)).toBe(0);
  const full = new BlastTrauma(), half = new BlastTrauma();
  full.impact(point, eye, [], 1000, 1); half.impact(point, eye, [], 1000, .5);
  // At the same age, response uses the square of the remaining trauma.
  const ratio = half.sample(1030) / full.sample(1030);
  expect(ratio).toBeCloseTo((.485 / .985) ** 2);
});
it('is frame-rate independent, ADS attenuated, and cannot rewind its decay clock', () => {
  const fast = new BlastTrauma(), slow = new BlastTrauma();
  for (const fx of [fast, slow]) fx.impact(point, eye, [], 1000);
  for (let now = 1000; now < 1400; now += 7) fast.sample(now);
  expect(fast.sample(1400)).toBeCloseTo(slow.sample(1400), 12);
  const normal = slow.sample(1430); expect(slow.sample(1430, 1)).toBeCloseTo(normal * .35);
  const trauma = slow.inspect().trauma; slow.sample(1000);
  expect(slow.inspect().trauma).toBe(trauma);
  slow.sample(10000); expect(slow.inspect().trauma).toBe(0);
});
it('attenuates distance, rejects invalid/out-of-range events, and respects current Relay shutters', () => {
  const fx = new BlastTrauma();
  for (const z of [30, 100, NaN, Infinity]) fx.impact({ ...point, z }, eye, [], 1000);
  expect(fx.inspect().trauma).toBe(0);
  fx.impact({ ...point, z: 17 }, eye, [], 1000, 1); expect(fx.inspect().trauma).toBe(.5);
  const core = new CoreCollision(ARENA1), viewer = { x: 67, y: 1.65, z: 50 }, blast = { x: 83, y: 1.65, z: 50 };
  fx.clear(); fx.impact(blast, viewer, core.closedHits, 1000); expect(fx.inspect().trauma).toBe(0);
  fx.impact(blast, viewer, core.hits(true), 1000); expect(fx.inspect().trauma).toBeGreaterThan(0);
});
it('rolls only during submission and preserves eye, center ray and exact quaternion even on a render failure', () => {
  const fx = new BlastTrauma(), camera = new THREE.PerspectiveCamera(), scene = new THREE.Scene();
  camera.position.set(4, 2, 9); camera.rotation.set(.4, 1.2, .03, 'YXZ'); camera.updateMatrixWorld(true);
  const pos = camera.position.clone(), rotation = camera.quaternion.clone(), forward = camera.getWorldDirection(new THREE.Vector3());
  const target = pos.clone().addScaledVector(forward, 20);
  fx.impact(pos, pos, [], 1000, 1);
  let observedRoll = false;
  const renderer = { render: () => {
    camera.updateMatrixWorld(true);
    observedRoll = camera.quaternion.angleTo(rotation) > .01;
    expect(camera.position.equals(pos)).toBe(true);
    expect(camera.getWorldDirection(new THREE.Vector3()).distanceTo(forward)).toBeLessThan(1e-12);
    const projected = target.clone().project(camera); expect(Math.hypot(projected.x, projected.y)).toBeLessThan(1e-12);
    throw Error('test renderer failure');
  } } as unknown as THREE.WebGLRenderer;
  expect(() => fx.render(camera, renderer, scene, 1030, 0)).toThrow('test renderer failure');
  expect(observedRoll).toBe(true); expect(camera.quaternion.equals(rotation)).toBe(true);
  expect(camera.position.equals(pos)).toBe(true);
});
it('clears immediately for Reduced motion or inactive play, without storing a burst for resume', () => {
  // Exercise production SceneRig routing without constructing a WebGL/DOM renderer.
  const scene = Object.create(SceneRig.prototype) as SceneRig;
  Object.assign(scene, { blastTrauma: new BlastTrauma(), blastFeedback: true, motionReduced: false,
    camera: new THREE.PerspectiveCamera(), hitBoxes: [] });
  scene.blastImpact(point, 1, 1000); expect(scene.inspectBlast().trauma).toBeGreaterThan(0);
  scene.reducedMotion = true; expect(scene.inspectBlast().trauma).toBe(0);
  scene.blastImpact(point, 1, 1010); scene.reducedMotion = false; expect(scene.inspectBlast().trauma).toBe(0);
  scene.blastImpact(point, 1, 1020); scene.setBlastFeedback(false); expect(scene.inspectBlast().trauma).toBe(0);
  scene.blastImpact(point, 1, 1030); scene.setBlastFeedback(true); expect(scene.inspectBlast().trauma).toBe(0);
});
