import { expect, it } from 'vitest';
import * as THREE from 'three';
import { ScopeGlints, scopeGlintStrength, GLINT } from '../client/scope-glint.js';
import { scopeGlintTexture, weaponFlashTexture } from '../client/weapon-flash.js';
import { CoreCollision } from '../src/core-gate.js';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';
import { rampOccluderBoxes } from '../src/map/tilemap.js';
import type { Box } from '../src/physics.js';

const threat = { alive: true, weapon: 3, yaw: 0, pitch: 0 };
const eye = { x: 0, y: 1.65, z: 0 }, lens = { x: .15, y: 1.55, z: .4 };
const viewer = { x: 0, y: 1.65, z: 40 };
it('warns about a held sniper including hip fire; releases immediately on reload/death/swap', () => {
  expect(scopeGlintStrength(threat, eye, lens, viewer, [], 1000)).toBe(1);
  for (const changed of [{ alive: false }, { weapon: 0 }, { weapon: 1 }, { weapon: 2 }, { weapon: 4 }, { reloadEnd: 1001 }])
    expect(scopeGlintStrength({ ...threat, ...changed }, eye, lens, viewer, [], 1000)).toBe(0);
  expect(scopeGlintStrength({ ...threat, reloadEnd: 1000 }, eye, lens, viewer, [], 1000)).toBe(1);
});
it('uses a smooth 3D aim cone and bounded range; no side/rear or wrong-floor warning', () => {
  const strength = (yaw: number, pitch = 0, z = 40) => scopeGlintStrength({ ...threat, yaw, pitch }, eye, lens, { ...viewer, z }, [], 1000);
  expect(strength(4 * Math.PI / 180)).toBeCloseTo(1);
  expect(strength(9 * Math.PI / 180)).toBeGreaterThan(0);
  expect(strength(9 * Math.PI / 180)).toBeLessThan(1);
  expect(strength(14 * Math.PI / 180)).toBe(0);
  expect(strength(Math.PI)).toBe(0);
  expect(strength(0, .4)).toBe(0);
  expect(strength(0, 0, 1)).toBe(0);
  expect(strength(0, 0, 110)).toBeCloseTo(.5);
  expect(strength(0, 0, 120)).toBe(0);
  const above = { ...viewer, y: 15 };
  expect(scopeGlintStrength({ ...threat, pitch: Math.atan2(13.35, 40) }, eye, lens, above, [], 1000)).toBe(1);
});
it('tests both eye and attachment rays, so a protruding or submerged lens cannot leak through cover', () => {
  const wall: Box = { min: { x: -1, y: 0, z: 10 }, max: { x: 1, y: 3, z: 11 } };
  expect(scopeGlintStrength(threat, eye, lens, viewer, [wall], 1000)).toBe(0);
  // Lens pokes beyond the wall, eye still behind it.
  expect(scopeGlintStrength(threat, eye, { ...lens, z: 12 }, viewer, [wall], 1000)).toBe(0);
  // A thin cover lip hides only the lower lens; eye alone would pass.
  const lip = { min: { x: -1, y: 0, z: 1 }, max: { x: 1, y: 1.6, z: 2 } };
  expect(scopeGlintStrength(threat, eye, lens, viewer, [lip], 1000)).toBe(0);
  expect(scopeGlintStrength(threat, eye, lens, viewer, [], 1000)).toBe(1);
});
it('uses actual Relay shutter state and real ramp/cover volumes on all maps', () => {
  const core = new CoreCollision(ARENA1);
  const e = { x: 83, y: 1.65, z: 50 }, l = { x: 82.6, y: 1.55, z: 50 }, v = { x: 67, y: 1.65, z: 50 };
  const p = { ...threat, yaw: -Math.PI / 2 };
  expect(scopeGlintStrength(p, e, l, v, core.closed, 1000)).toBe(0);
  expect(scopeGlintStrength(p, e, l, v, core.open, 1000)).toBe(1);
  for (const map of [ARENA1, ARENA2, ARENA3]) {
    for (const b of [...map.boxes, ...(map.ramps ?? []).flatMap(rampOccluderBoxes)]) {
      const y = (b.min.y + b.max.y) / 2, x = (b.min.x + b.max.x) / 2;
      const a = { x, y, z: b.min.z - 2 }, c = { x, y, z: b.max.z + 2 };
      expect(scopeGlintStrength(threat, a, a, c, [b], 1000)).toBe(0);
    }
  }
});
it('keeps sixteen slots, buffers, atlas allocation and one depth-tested draw through saturation/removal', () => {
  const scene = new THREE.Scene(), glints = new ScopeGlints(scene), camera = new THREE.PerspectiveCamera();
  camera.position.copy(viewer);
  const mesh = glints.mesh, matrix = mesh.instanceMatrix, color = mesh.instanceColor;
  const geometry = mesh.geometry, material = mesh.material;
  for (let frame = 0; frame < 1000; frame++) {
    glints.begin(); for (let i = 0; i < 30; i++) glints.add(lens, 1, camera); glints.end();
    expect(mesh.count).toBe(GLINT.capacity);
  }
  glints.begin(); glints.end(); expect(mesh.count).toBe(0);
  expect(mesh.instanceMatrix).toBe(matrix); expect(mesh.instanceColor).toBe(color);
  expect(mesh.geometry).toBe(geometry); expect(mesh.material).toBe(material);
  expect(scene.children).toEqual([mesh]); expect(material.depthTest).toBe(true); expect(material.depthWrite).toBe(false);
  expect(scopeGlintTexture().source).toBe(weaponFlashTexture(0).source);
});
