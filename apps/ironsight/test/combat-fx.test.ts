import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
// @ts-expect-error Node test I/O; production tsconfig targets Workers.
import { readFile } from "node:fs/promises";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CombatCuePool, CombatFx, GRENADE_VISUAL_TOLERANCE_M, IMPACT_PROFILES, nearMissDistance } from "../client/combat-fx.js";
import { GRENADE } from "../src/config.js";

describe("bounded combat cue pool", () => {
  it("reuses the oldest impact and near-miss slots without dropping authority data", () => {
    const pool = new CombatCuePool({ impactCapacity: 2, nearMissCapacity: 1 });
    pool.impact({ shotId: "a", material: "mud", x: 0, y: 0, z: 0 }, 10);
    pool.impact({ shotId: "b", material: "wood", x: 1, y: 0, z: 0 }, 11);
    pool.impact({ shotId: "c", material: "metal", x: 2, y: 0, z: 0 }, 12);
    pool.nearMiss({ shotId: "d", distance: 1.5 }, 13);
    pool.nearMiss({ shotId: "e", distance: 0.5 }, 14);

    expect(pool.active(14)).toEqual([
      expect.objectContaining({ kind: "impact", shotId: "b", material: "wood" }),
      expect.objectContaining({ kind: "impact", shotId: "c", material: "metal" }),
      expect.objectContaining({ kind: "near_miss", shotId: "e", distance: 0.5 }),
    ]);
    expect(pool.inspect()).toEqual({ impacts: 2, nearMisses: 1 });
  });

  it("expires cues by absolute age and makes reduced motion presentation-only", () => {
    const pool = new CombatCuePool({ impactCapacity: 1, nearMissCapacity: 1, reducedMotion: true });
    pool.impact({ shotId: "a", material: "concrete", x: 0, y: 0, z: 0 }, 100);
    pool.nearMiss({ shotId: "b", distance: 0.25 }, 100);
    expect(pool.active(100).map(cue => cue.intensity)).toEqual([0.45, 0.35]);
    pool.setReducedMotion(false);
    pool.impact({ shotId: "c", material: "mud", x: 0, y: 0, z: 0 }, 101);
    expect(pool.active(101).find(cue => cue.shotId === "c")?.intensity).toBe(1);
    expect(pool.active(700)).toEqual([]);
  });

  it("deduplicates repeated authoritative cue ids", () => {
    const pool = new CombatCuePool({ impactCapacity: 2, nearMissCapacity: 2 });
    expect(pool.impact({ shotId: "a", material: "mud", x: 0, y: 0, z: 0 }, 0)).toBe(true);
    expect(pool.impact({ shotId: "a", material: "metal", x: 1, y: 1, z: 1 }, 1)).toBe(false);
    expect(pool.nearMiss({ shotId: "a", distance: 0.2 }, 2)).toBe(true);
    expect(pool.nearMiss({ shotId: "a", distance: 0.3 }, 3)).toBe(false);
  });
});

it("measures near misses against the finite authoritative shot segment", () => {
  expect(nearMissDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }, 10, { x: 0.5, y: 0, z: 5 })).toBe(.5);
  expect(nearMissDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, 2, { x: 0, y: 0, z: 5 })).toBe(3);
  expect(nearMissDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 2, { x: 0, y: 0, z: 1 })).toBe(Infinity);
});

it("gives every canonical surface a distinct material response", () => {
  expect(Object.keys(IMPACT_PROFILES).sort()).toEqual(["concrete", "gravel", "metal", "mud", "wood"]);
  expect(IMPACT_PROFILES.metal.sparks).toBeGreaterThan(IMPACT_PROFILES.wood.sparks);
  expect(IMPACT_PROFILES.mud.dust).toBeGreaterThan(IMPACT_PROFILES.metal.dust);
  expect(new Set(Object.values(IMPACT_PROFILES).map(profile => profile.color)).size).toBe(5);
});

it("keeps the pooled procedural grenade fallback while the authored asset is unaccepted", () => {
  const scene = new THREE.Scene();
  const acquire = vi.fn();
  const fx = new CombatFx(scene, { acquireWeaponModel: acquire });
  const grenades = scene.children.filter((child): child is THREE.Mesh =>
    child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry);
  expect(grenades).toHaveLength(32);
  expect(acquire).not.toHaveBeenCalled();
  expect(new Set(grenades.map(grenade => grenade.geometry))).toHaveLength(1);
  fx.spawnNade({ id: "nade:1", x: 1, y: 2, z: 3, vx: 4, vy: 5, vz: 6 });
  expect(fx.inspect().grenades).toBe(1);
  expect(grenades.filter(grenade => grenade.visible)).toHaveLength(1);
  fx.boom({ id: "nade:1", x: 1, y: 2, z: 3 }, performance.now());
  expect(fx.inspect().grenades).toBe(0);
});

const gltfWith = (name: string): GLTF => {
  const scene = new THREE.Group();
  const node = new THREE.Mesh(new THREE.BoxGeometry(.1, .2, .1), new THREE.MeshStandardMaterial());
  node.name = name;
  scene.add(node);
  return { scene, scenes: [scene] } as unknown as GLTF;
};

const admittedGrenade = async (): Promise<GLTF> => {
  const bytes = await readFile("public/assets/ww1/weapons/grenade.glb");
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
};

const maxVertexDistance = (root: THREE.Object3D, center = new THREE.Vector3()): number => {
  root.updateMatrixWorld(true);
  const point = new THREE.Vector3();
  let radius = 0;
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const position = node.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
      radius = Math.max(radius, point.distanceTo(center));
    }
  });
  return radius;
};

it("centers the admitted thrown grenade geometry on its authoritative projectile root", async () => {
  const gltf = await admittedGrenade();
  const source = gltf.scene.getObjectByName("grenade")!;
  const sourceBounds = new THREE.Box3().setFromObject(source);
  const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
  expect(sourceCenter.length()).toBeGreaterThan(.18);
  const centeredSource = source.clone();
  centeredSource.position.sub(sourceCenter);
  const rawRadius = maxVertexDistance(centeredSource);
  expect(rawRadius).toBeCloseTo(.186489954, 6);
  const scene = new THREE.Scene();
  const fx = new CombatFx(scene, { candidatePreview: true,
    acquireWeaponModel: () => ({ value: Promise.resolve(gltf), release() {} }),
    cloneWeaponBundleNode: (value, nodeName) => value.scene.getObjectByName(nodeName)?.clone() });
  await fx.ready();
  fx.spawnNade({ id: "real", x: 1, y: 2, z: 3, vx: 0, vy: 0, vz: 0 });

  const visual = scene.children.find(child => child.name === "grenade")!;
  const bounds = new THREE.Box3().setFromObject(visual);
  expect(bounds.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(1, 2, 3))).toBeLessThan(1e-6);
  const allowedRadius = GRENADE.projRadius + GRENADE_VISUAL_TOLERANCE_M;
  const expectedScale = allowedRadius / rawRadius;
  expect(bounds.getSize(new THREE.Vector3()).distanceTo(sourceBounds.getSize(new THREE.Vector3()).multiplyScalar(expectedScale))).toBeLessThan(1e-6);
  const projectile = new THREE.Vector3(1, 2, 3);
  expect(maxVertexDistance(visual, projectile)).toBeCloseTo(allowedRadius, 6);
  for (const rotation of [[.37, .83, 1.19], [Math.PI / 2, 0, Math.PI / 4], [2.7, 1.4, .2]] as const) {
    visual.rotation.set(rotation[0], rotation[1], rotation[2]);
    expect(maxVertexDistance(visual, projectile)).toBeLessThanOrEqual(allowedRadius + 1e-6);
  }
});

it("strictly opts into one retained authored grenade lease and releases it on dispose", async () => {
  const scene = new THREE.Scene();
  const release = vi.fn(() => {
    expect(scene.children.filter(child => child.name === "grenade")).toHaveLength(0);
  });
  const acquire = vi.fn(() => ({ value: Promise.resolve(gltfWith("grenade")), release }));
  const clone = vi.fn((gltf: GLTF, nodeName: string) => gltf.scene.getObjectByName(nodeName)?.clone());
  const fx = new CombatFx(scene, { candidatePreview: true, acquireWeaponModel: acquire, cloneWeaponBundleNode: clone });
  await fx.ready();

  expect(acquire).toHaveBeenCalledOnce();
  expect(acquire).toHaveBeenCalledWith("/assets/ww1/weapons/grenade.glb");
  expect(clone).toHaveBeenCalledTimes(32);
  expect(new Set(clone.mock.calls.map(([, nodeName]) => nodeName))).toEqual(new Set(["grenade"]));
  expect(scene.children.filter(child => child.name === "grenade")).toHaveLength(32);
  expect(scene.children.some(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry)).toBe(false);
  expect(fx.inspect().grenadeModel).toBe("authored");
  expect(release).not.toHaveBeenCalled();

  fx.dispose();
  expect(release).toHaveBeenCalledOnce();
  expect(scene.children.filter(child => child.name === "grenade")).toHaveLength(0);
});

it("retains all procedural grenades and releases a failed authored lease", async () => {
  const scene = new THREE.Scene();
  const release = vi.fn();
  const acquire = vi.fn(() => ({ value: Promise.resolve(gltfWith("wrong-node")), release }));
  const fx = new CombatFx(scene, { candidatePreview: true, acquireWeaponModel: acquire,
    cloneWeaponBundleNode: (gltf, nodeName) => gltf.scene.getObjectByName(nodeName)?.clone() });
  await fx.ready();

  expect(scene.children.filter(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry)).toHaveLength(32);
  expect(fx.inspect().grenadeModel).toBe("procedural");
  expect(release).toHaveBeenCalledOnce();
});

it("rolls back the whole grenade pool when an Nth authored clone fails", async () => {
  const scene = new THREE.Scene();
  const release = vi.fn();
  let calls = 0;
  const fx = new CombatFx(scene, { candidatePreview: true,
    acquireWeaponModel: () => ({ value: Promise.resolve(gltfWith("grenade")), release }),
    cloneWeaponBundleNode: (gltf, nodeName) => ++calls === 7 ? undefined : gltf.scene.getObjectByName(nodeName)?.clone() });
  await fx.ready();

  expect(calls).toBe(7);
  expect(scene.children.filter(child => child instanceof THREE.Mesh
    && child.geometry instanceof THREE.SphereGeometry)).toHaveLength(32);
  expect(fx.inspect().grenadeModel).toBe("procedural");
  expect(release).toHaveBeenCalledOnce();
});

it("cancels a pending grenade lease without installing late clones", async () => {
  const scene = new THREE.Scene();
  const release = vi.fn();
  let resolve!: (value: GLTF | undefined) => void;
  const value = new Promise<GLTF | undefined>(done => { resolve = done; });
  const fx = new CombatFx(scene, { candidatePreview: true,
    acquireWeaponModel: () => ({ value, release }),
    cloneWeaponBundleNode: (gltf, nodeName) => gltf.scene.getObjectByName(nodeName)?.clone() });

  fx.dispose();
  resolve(gltfWith("grenade"));
  await fx.ready();
  expect(release).toHaveBeenCalledOnce();
  expect(scene.children.filter(child => child.name === "grenade")).toHaveLength(0);
});
