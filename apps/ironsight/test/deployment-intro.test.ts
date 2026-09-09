import { expect, it } from 'vitest';
import * as THREE from 'three';
import { DeploymentIntro, INTRO, introPose, type IntroPose } from '../client/deployment-intro.js';
import { IntroCamera } from '../client/deployment-intro-view.js';
import type { ArenaState } from '../src/schema.js';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';

const state = (overrides: Partial<ArenaState> = {}) => ({ mode:0, phase:'warmup', warmupEndMs:11000, ...overrides }) as ArenaState;
const pose = (): IntroPose => ({ eye:{x:0,y:0,z:0}, target:{x:0,y:0,z:0}, fov:0 });

it('fits arrival into existing warmup and releases before countdown without inferring live', () => {
  const intro = new DeploymentIntro();
  expect(intro.update(state(), 1000, 100, false, false)).toBe(false);
  expect(intro.update(state(), 2000, 1100, true, false)).toBe(true);
  expect(intro.inspect().endsAt).toBe(1100 + INTRO.durationMs);
  expect(intro.update(state(), 6499, 5599, true, false)).toBe(true);
  expect(intro.update(state(), 6500, 5600, true, false)).toBe(false);
  expect(intro.update(state({warmupEndMs:99999}), 7000, 6000, true, false)).toBe(false);
  const late = new DeploymentIntro();
  expect(late.update(state(), 6000, 0, true, false)).toBe(true);
  expect(late.inspect().endsAt).toBe(1500);
  expect(late.update(state(), 7500, 1500, true, false)).toBe(false);
  expect(new DeploymentIntro().update(state(), 7000, 0, true, false)).toBe(false);
});

it('never plays in training or live/ended joins; cancels on live, death/pause, disconnect and rearm', () => {
  for (const initial of [state({mode:3}), state({phase:'live'}), state({phase:'ended'})]) {
    const intro = new DeploymentIntro();
    expect(intro.update(initial, 1000, 0, true, false)).toBe(false);
    expect(intro.update(state(), 1001, 1, true, false)).toBe(false);
  }
  const waiting = new DeploymentIntro();
  expect(waiting.update(state({warmupEndMs:0}), 1000, 0, true, false)).toBe(false);
  expect(waiting.update(state(), 1100, 100, true, false)).toBe(false);
  for (const [next, available] of [[state({phase:'live'}),true], [state(),false],
    [state({warmupEndMs:0}),true], [state({warmupEndMs:12000}),true]] as const) {
    const intro = new DeploymentIntro();
    expect(intro.update(state(), 1000, 0, true, false)).toBe(true);
    expect(intro.update(next, 1100, 100, available, false)).toBe(false);
    expect(intro.update(state(), 1200, 200, true, false)).toBe(false);
  }
});

it('clock corrections cannot reverse or extend the flight, background gaps end it', () => {
  const intro = new DeploymentIntro();
  intro.update(state(), 1000, 1000, true, false);
  intro.update(state(), 2000, 2000, true, false);
  const p = intro.inspect().progress;
  intro.update(state(), 1500, 1500, true, false);
  expect(intro.inspect().progress).toBe(p);
  expect(intro.update(state(), 1100, 5500, true, false)).toBe(false);
  const gap = new DeploymentIntro(); gap.update(state(), 1000, 0, true, false);
  expect(gap.update(state(), 100000, 99000, true, false)).toBe(false);
  const corrected = new DeploymentIntro(); corrected.update(state(), 1000, 0, true, false);
  expect(corrected.update(state(), 7600, 10, true, false)).toBe(false);
});

it('Reduced motion is a still with identical timing, toggling freezes and skip is consumed once', () => {
  const intro = new DeploymentIntro(); intro.update(state(), 1000, 0, true, true);
  const start = structuredClone(intro.pose(ARENA1, pose()));
  intro.update(state(), 2000, 1000, true, true);
  expect(intro.pose(ARENA1, pose())).toEqual(start);
  expect(intro.skip()).toBe(true); expect(intro.skip()).toBe(false);
  expect(intro.update(state(), 3000, 2000, true, false)).toBe(false);
  const toggled = new DeploymentIntro(); toggled.update(state(), 1000, 0, true, false);
  toggled.update(state(), 2000, 1000, true, false);
  const progress = toggled.inspect().progress;
  toggled.update(state(), 2500, 1500, true, true);
  toggled.update(state(), 3000, 2000, true, false);
  expect(toggled.inspect().progress).toBe(progress);
  expect(toggled.update(state(), 5500, 4500, true, true)).toBe(false);
});

it('all three flight paths stay inside bounds and clear authoritative cover with finite views', () => {
  for (const map of [ARENA1, ARENA2, ARENA3]) for (let i=0; i<=100; i++) {
    const p = introPose(map, i/100, pose());
    expect(Object.values(p.eye).every(Number.isFinite)).toBe(true);
    expect(p.eye.x).toBeGreaterThan(0); expect(p.eye.x).toBeLessThan(map.bounds.width);
    expect(p.eye.z).toBeGreaterThan(0); expect(p.eye.z).toBeLessThan(map.bounds.depth);
    for (const b of map.boxes) if (p.eye.x >= b.min.x && p.eye.x <= b.max.x && p.eye.z >= b.min.z && p.eye.z <= b.max.z)
      expect(p.eye.y).toBeGreaterThan(b.max.y + 2);
  }
});

it('render override restores eye, aiming ray, projection and weapon even if renderer throws; light count is constant', () => {
  const camera = new THREE.PerspectiveCamera(78,16/9,.1,500), weapon = new THREE.Group();
  camera.position.set(8,1.65,11); camera.lookAt(30,2,18); camera.updateMatrixWorld(true);
  const light = new THREE.PointLight(); camera.add(weapon,light);
  const before = { eye:camera.position.clone(), q:camera.quaternion.clone(), projection:camera.projectionMatrix.clone() };
  const view = new IntroCamera();
  for (const throws of [false,true]) {
    const draw = () => view.draw(camera,weapon,introPose(ARENA1,.5,pose()),()=>{
      expect(weapon.visible).toBe(false); expect(light.visible).toBe(true);
      expect(camera.position.y).toBeGreaterThan(20); expect(camera.fov).toBe(68);
      if (throws) throw Error('renderer failure');
    });
    if (throws) expect(draw).toThrow('renderer failure'); else draw();
    expect(camera.position).toEqual(before.eye); expect(camera.quaternion.toArray()).toEqual(before.q.toArray());
    expect(camera.projectionMatrix).toEqual(before.projection); expect(weapon.visible).toBe(true);
    expect(light.visible).toBe(true); expect(camera.fov).toBe(78);
  }
});
