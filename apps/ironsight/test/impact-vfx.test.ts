import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
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
// Impact particles live in two instanced draws; read them through the pool's view.
const visibleParticles = (vfx: Vfx) => vfx.impactParticles().map(p => ({ position: p.position, scale: p.scale,
  quaternion: p.quaternion, material: { blending: p.additive ? THREE.AdditiveBlending : THREE.NormalBlending } }));

describe("pooled impact presentation", () => {
  it("keeps construction resources and lights constant through saturation and expiry", () => {
    const scene = new THREE.Scene(), acquire = vi.fn();
    const vfx = new Vfx(scene, () => 0, { acquireWeaponModel: acquire });
    const objects = [...scene.children];
    const geometries = objects.filter(o => o instanceof THREE.Mesh).map(o => o.geometry);
    for (let i = 0; i < 100; i++) vfx.spawnImpact(pos, dir, i % 2 === 0);
    expect(visibleParticles(vfx)).toHaveLength(48);
    vfx.update(1600);
    expect(visibleParticles(vfx)).toHaveLength(0);
    expect(scene.children).toEqual(objects);
    expect(objects.filter(o => o instanceof THREE.Mesh).map(o => o.geometry)).toEqual(geometries);
    expect(objects.filter(o => o instanceof THREE.Light).every(o => o.visible)).toBe(true);
    expect(acquire).not.toHaveBeenCalled();
  });

  it("produces the same ballistic pose at the same age across frame cadences", () => {
    const a = new THREE.Scene(), b = new THREE.Scene();
    const va = new Vfx(a), vb = new Vfx(b);
    va.spawnImpact(pos, dir, false); vb.spawnImpact(pos, dir, false);
    for (let now = 1010; now <= 1200; now += 10) va.update(now);
    vb.update(1200);
    const pose = (v: Vfx) => visibleParticles(v).map(p => [...p.position, ...p.scale]);
    expect(pose(va)).toEqual(pose(vb));
    expect(pose(va).flat().every(Number.isFinite)).toBe(true);
  });

  it("separates the contact flash, spark flight and dust tail without leaving residue", () => {
    const scene = new THREE.Scene(), vfx = new Vfx(scene);
    vfx.spawnImpact(pos, dir, false);
    vfx.update(1001); expect(visibleParticles(vfx)).toHaveLength(7);
    vfx.update(1070); expect(visibleParticles(vfx)).toHaveLength(6);
    vfx.update(1300); expect(visibleParticles(vfx)).toHaveLength(3);
    vfx.update(1480); expect(visibleParticles(vfx)).toHaveLength(0);
    vfx.spawnImpact(pos, { x: 0, y: 1, z: 0 }, true);
    vfx.update(1100);
    expect(visibleParticles(vfx).every(p => p.material.blending === THREE.NormalBlending && Number.isFinite(p.quaternion.w))).toBe(true);
    vfx.update(1500); expect(visibleParticles(vfx)).toHaveLength(0);
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

const casingGltf = (): GLTF => {
  const scene = new THREE.Group();
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .08), new THREE.MeshStandardMaterial());
  casing.name = "casing";
  scene.add(casing);
  return { scene, scenes: [scene] } as unknown as GLTF;
};

it("strictly opts into one retained authored casing lease with independent fade materials", async () => {
  const scene = new THREE.Scene();
  const template = casingGltf();
  const templateMesh = template.scene.getObjectByName("casing") as THREE.Mesh;
  const release = vi.fn(() => {
    expect(scene.children.filter(child => child.name === "casing")).toHaveLength(0);
  });
  const acquire = vi.fn(() => ({ value: Promise.resolve(template), release }));
  const vfx = new Vfx(scene, () => 0, { candidatePreview: true, acquireWeaponModel: acquire,
    cloneWeaponBundleNode: (gltf, nodeName) => gltf.scene.getObjectByName(nodeName)?.clone() });
  await vfx.ready();

  expect(acquire).toHaveBeenCalledOnce();
  expect(acquire).toHaveBeenCalledWith("/assets/ww1/weapons/clip-shell-casing.glb");
  const casings = scene.children.filter(child => child.name === "casing");
  expect(casings).toHaveLength(32);
  const materials = casings.map(object => (object as THREE.Mesh).material);
  expect(new Set(materials)).toHaveLength(32);
  expect(materials).not.toContain(templateMesh.material);
  expect(release).not.toHaveBeenCalled();

  vfx.spawnCasing(pos, dir);
  expect((casings[0] as THREE.Mesh).material).toMatchObject({ opacity: 1, transparent: true });
  vfx.dispose();
  expect(release).toHaveBeenCalledOnce();
  expect(scene.children.filter(child => child.name === "casing")).toHaveLength(0);
});

it("keeps procedural casings when the authored lease resolves unavailable", async () => {
  const scene = new THREE.Scene();
  const release = vi.fn();
  const vfx = new Vfx(scene, () => 0, { candidatePreview: true,
    acquireWeaponModel: () => ({ value: Promise.resolve(undefined), release }),
    cloneWeaponBundleNode: () => undefined });
  await vfx.ready();

  expect(scene.children.filter(child => child instanceof THREE.Mesh
    && child.geometry instanceof THREE.CylinderGeometry)).toHaveLength(32);
  expect(release).toHaveBeenCalledOnce();
});

it("rolls back the whole casing pool when an Nth authored clone fails", async () => {
  const scene = new THREE.Scene();
  const release = vi.fn();
  let calls = 0;
  const vfx = new Vfx(scene, () => 0, { candidatePreview: true,
    acquireWeaponModel: () => ({ value: Promise.resolve(casingGltf()), release }),
    cloneWeaponBundleNode: (gltf, nodeName) => ++calls === 7 ? undefined : gltf.scene.getObjectByName(nodeName)?.clone() });
  await vfx.ready();

  expect(calls).toBe(7);
  expect(scene.children.filter(child => child instanceof THREE.Mesh
    && child.geometry instanceof THREE.CylinderGeometry)).toHaveLength(32);
  expect(release).toHaveBeenCalledOnce();
});

it("cancels a pending casing lease without installing late clones", async () => {
  const scene = new THREE.Scene();
  const release = vi.fn();
  let resolve!: (value: GLTF | undefined) => void;
  const value = new Promise<GLTF | undefined>(done => { resolve = done; });
  const vfx = new Vfx(scene, () => 0, { candidatePreview: true,
    acquireWeaponModel: () => ({ value, release }),
    cloneWeaponBundleNode: (gltf, nodeName) => gltf.scene.getObjectByName(nodeName)?.clone() });

  vfx.dispose();
  resolve(casingGltf());
  await vfx.ready();
  expect(release).toHaveBeenCalledOnce();
  expect(scene.children.filter(child => child.name === "casing")).toHaveLength(0);
});

it('ignores shots that arrive after teardown instead of throwing', () => {
  const vfx = new Vfx(new THREE.Scene());
  vfx.dispose();
  expect(() => { vfx.spawnCasing(pos, dir); vfx.spawnMuzzleFlash(pos, dir); vfx.spawnImpact(pos, dir, false); }).not.toThrow();
});
