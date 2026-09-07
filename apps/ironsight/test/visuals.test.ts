import * as THREE from "three";
import { describe, it, expect, vi } from "vitest";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RemoteWeapon } from "../client/remote-weapon.js";
import { loadWeaponModel, weaponMuzzle } from "../client/weapon-loader.js";
import { splitRifleMagazine } from '../client/rifle-magazine.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
vi.mock("../client/weapon-loader.js", async importOriginal => ({
  ...await importOriginal<typeof import("../client/weapon-loader.js")>(),
  loadWeaponModel: vi.fn(),
}));
function fixture() {
  const group = new THREE.Group();
  const root = new THREE.Group(); root.scale.setScalar(0.5); group.add(root);
  const hand = new THREE.Bone(); hand.name = "Hand_R"; root.add(hand);
  const geometry = new THREE.BoxGeometry(0.1, 0.12, 2);
  const material = new THREE.MeshStandardMaterial();
  const scene = new THREE.Group();
  for (const name of ["wep_ar", "wep_pistol"]) {
    const gun = new THREE.Mesh(geometry, material); gun.name = name; scene.add(gun);
  }
  return { group, root, hand, geometry, material, gltf: { scene } as GLTF };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
describe("remote weapon presentation", () => {
  it("preserves animated wrists, restores arms, and never accumulates the hold", () => {
    const group = new THREE.Group();
    const bones: THREE.Bone[] = [];
    for (const [side, suffix] of [[-1, "R"], [1, "L"]] as const) {
      const upper = new THREE.Bone(); upper.name = `UpperArm_${suffix}`;
      upper.position.set(side * 0.2, 1.4, 0);
      const lower = new THREE.Bone(); lower.name = `lowerarm_${suffix.toLowerCase()}`;
      lower.position.y = -0.3;
      const hand = new THREE.Bone(); hand.name = `Hand_${suffix}`; hand.position.y = -0.25;
      hand.rotation.set(0.1, 0.2, -0.1);
      group.add(upper); upper.add(lower); lower.add(hand); bones.push(upper, lower, hand);
    }
    const animated = bones.map(b => b.quaternion.clone());
    const weapon = new RemoteWeapon(group, group);
    weapon.update(1.58, 0, true, 0.85);
    const first = bones.map(b => b.quaternion.clone());
    expect(bones[2]!.quaternion.equals(animated[2]!)).toBe(true);
    expect(bones[5]!.quaternion.equals(animated[5]!)).toBe(true);
    expect(bones[2]!.getWorldPosition(new THREE.Vector3()).x).toBeLessThan(0);
    weapon.beforeAnimation();
    bones.forEach((b, i) => expect(b.quaternion.angleTo(animated[i]!)).toBeCloseTo(0));
    weapon.update(1.58, 0, true, 0.85);
    bones.forEach((b, i) => expect(b.quaternion.angleTo(first[i]!)).toBeCloseTo(0));
    weapon.beforeAnimation(); weapon.update(1.58, 0, true, 1, false);
    bones.forEach((b, i) => expect(b.quaternion.angleTo(animated[i]!)).toBeCloseTo(0));
    weapon.dispose();
  });
  it("fits world length independently of player scale, follows the hand, and never becomes a hit target", async () => {
    const f = fixture(); vi.mocked(loadWeaponModel).mockResolvedValue(f.gltf);
    const weapon = new RemoteWeapon(f.group, f.root); weapon.setWeapon(0); await flush();
    const mesh = weapon.mount.getObjectByName("wep_ar")!;
    f.group.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).z).toBeCloseTo(0.72);
    const before = weapon.muzzle.getWorldPosition(new THREE.Vector3());
    f.hand.position.x += 2;
    expect(weapon.muzzle.getWorldPosition(new THREE.Vector3()).x - before.x).toBeCloseTo(1);
    const ray = new THREE.Raycaster(new THREE.Vector3(1, 0, 4), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(mesh, true)).toHaveLength(0);
    const disposeGeometry = vi.spyOn(f.geometry, "dispose");
    const disposeMaterial = vi.spyOn(f.material, "dispose");
    weapon.dispose();
    expect(disposeGeometry).not.toHaveBeenCalled(); expect(disposeMaterial).not.toHaveBeenCalled();
    expect(f.hand.children).toHaveLength(0);
  });
  it("ignores an old load after rapid swaps and after removal", async () => {
    const f = fixture(); const resolves: ((gltf: GLTF) => void)[] = [];
    vi.mocked(loadWeaponModel).mockImplementation(() => new Promise(resolve => resolves.push(resolve)));
    const weapon = new RemoteWeapon(f.group, f.root);
    weapon.setWeapon(0); weapon.setWeapon(4);
    resolves[0]!(f.gltf); await flush();
    expect(weapon.mount.getObjectByName("wep_ar")).toBeUndefined();
    resolves[1]!(f.gltf); await flush();
    expect(weapon.mount.getObjectByName("wep_pistol")).toBeDefined();
    weapon.setWeapon(0); weapon.dispose(); resolves[2]!(f.gltf); await flush();
    expect(weapon.mount.getObjectByName("wep_ar")).toBeUndefined();
  });
  it("capsule fallback muzzle follows crouch height and aim", () => {
    const group = new THREE.Group(); const weapon = new RemoteWeapon(group);
    weapon.setWeapon(0); weapon.update(1.0, Math.PI / 4, true);
    const tip = weapon.muzzle.getWorldPosition(new THREE.Vector3());
    expect(tip.y).toBeGreaterThan(0.7); expect(tip.z).toBeGreaterThan(0.24);
    weapon.dispose(); expect(group.children).toHaveLength(0);
  });
  it("measures the barrel tip rather than the off-axis receiver centre", () => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1)); body.position.y = -1;
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1)); barrel.position.set(0.2, 0.3, 1);
    group.add(body, barrel);
    const tip = weaponMuzzle(group);
    expect(tip.x).toBeCloseTo(0.2); expect(tip.y).toBeCloseTo(0.3); expect(tip.z).toBeCloseTo(1.5);
    body.geometry.dispose(); barrel.geometry.dispose();
  });
});

describe('reload component ownership', () => {
  it('extracts whole drum/bolt components across UV seams without dropping triangles', () => {
    const parts = [new THREE.BoxGeometry(0.15, 0.1, 0.9),
      new THREE.BoxGeometry(0.1, 0.16, 0.10).translate(0, -0.10, 0.18),
      new THREE.BoxGeometry(0.05, 0.02, 0.04).translate(-0.03, 0.07, 0)];
    const source = mergeGeometries(parts)!; const sourceIndices = source.index!.array.slice();
    const group = new THREE.Group(), mesh = new THREE.Mesh(source); group.add(mesh);
    const split = splitRifleMagazine(group);
    expect(split.magazine.children).toHaveLength(1); expect(split.bolt.children).toHaveLength(1);
    expect(split.owned.reduce((count, g) => count + g.index!.count, 0)).toBe(source.index!.count);
    expect(source.index!.array).toEqual(sourceIndices);
    expect((split.magazine.children[0] as THREE.Mesh).geometry.index!.count).toBe(36);
    split.owned.forEach(g => g.dispose()); parts.forEach(g => g.dispose()); source.dispose();
  });
  it('an unfamiliar rifle keeps its complete source geometry', () => {
    const group = new THREE.Group(), source = new THREE.BoxGeometry(1, 1, 1), mesh = new THREE.Mesh(source); group.add(mesh);
    const split = splitRifleMagazine(group);
    expect(split.owned).toHaveLength(0); expect(mesh.geometry).toBe(source);
    source.dispose();
  });
});
