import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Vfx } from "../client/vfx.js";

beforeEach(() => {
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
  }) }) });
  vi.spyOn(performance, "now").mockReturnValue(1000);
  vi.spyOn(Math, "random").mockReturnValue(0.7);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const pos = { x: 2, y: 3, z: 4 }, dir = { x: 1, y: 0, z: 0 };
const visibleParticles = (scene: THREE.Scene) => scene.children.filter(
  (o): o is THREE.Mesh => o instanceof THREE.Mesh && o.visible);

describe("pooled impact presentation", () => {
  it("keeps construction resources and lights constant through saturation and expiry", () => {
    const scene = new THREE.Scene(), vfx = new Vfx(scene);
    const objects = [...scene.children];
    const geometries = objects.filter(o => o instanceof THREE.Mesh).map(o => o.geometry);
    for (let i = 0; i < 100; i++) vfx.spawnImpact(pos, dir, i % 2 === 0);
    expect(visibleParticles(scene)).toHaveLength(48);
    vfx.update(1600);
    expect(visibleParticles(scene)).toHaveLength(0);
    expect(scene.children).toEqual(objects);
    expect(objects.filter(o => o instanceof THREE.Mesh).map(o => o.geometry)).toEqual(geometries);
    expect(objects.filter(o => o instanceof THREE.Light).every(o => o.visible)).toBe(true);
  });

  it("produces the same ballistic pose at the same age across frame cadences", () => {
    const a = new THREE.Scene(), b = new THREE.Scene();
    const va = new Vfx(a), vb = new Vfx(b);
    va.spawnImpact(pos, dir, false); vb.spawnImpact(pos, dir, false);
    for (let now = 1010; now <= 1200; now += 10) va.update(now);
    vb.update(1200);
    const pose = (s: THREE.Scene) => visibleParticles(s).map(p => [...p.position, ...p.scale]);
    expect(pose(a)).toEqual(pose(b));
    expect(pose(a).flat().every(Number.isFinite)).toBe(true);
  });

  it("separates the contact flash, spark flight and dust tail without leaving residue", () => {
    const scene = new THREE.Scene(), vfx = new Vfx(scene);
    vfx.spawnImpact(pos, dir, false);
    vfx.update(1001); expect(visibleParticles(scene)).toHaveLength(7);
    vfx.update(1070); expect(visibleParticles(scene)).toHaveLength(6);
    vfx.update(1300); expect(visibleParticles(scene)).toHaveLength(3);
    vfx.update(1480); expect(visibleParticles(scene)).toHaveLength(0);
    vfx.spawnImpact(pos, { x: 0, y: 1, z: 0 }, true);
    vfx.update(1100);
    expect(visibleParticles(scene).every(p => p.material instanceof THREE.MeshBasicMaterial
      && p.material.blending === THREE.NormalBlending && Number.isFinite(p.quaternion.w))).toBe(true);
    vfx.update(1500); expect(visibleParticles(scene)).toHaveLength(0);
  });
});

it('reuses eight flash slots across weapon switches and keeps all lights present after expiry', () => {
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  const scene = new THREE.Scene(), vfx = new Vfx(scene);
  const objects = [...scene.children];
  const sprites = objects.filter((o): o is THREE.Sprite => o instanceof THREE.Sprite);
  const materials = sprites.map(s => s.material);
  for (let i = 0; i < 100; i++) vfx.spawnMuzzleFlash({ x: 1, y: 2, z: 3 }, { x: 1, y: 0, z: 0 }, i % 5);
  expect(sprites.filter(s => s.visible)).toHaveLength(8);
  expect(new Set(sprites.map(s => s.material.map!.source)).size).toBe(1);
  vfx.update(1065);
  expect(sprites.every(s => !s.visible && s.material.opacity === 0)).toBe(true);
  expect(objects.filter(o => o instanceof THREE.PointLight).every(o => o.visible && o.intensity === 0)).toBe(true);
  expect(scene.children).toEqual(objects);
  expect(sprites.map(s => s.material)).toEqual(materials);
});
