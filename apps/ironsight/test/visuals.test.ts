import * as THREE from "three";
import { describe, it, expect, vi } from "vitest";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RemoteWeapon } from "../client/remote-weapon.js";
import { loadWeaponModel, weaponMuzzle } from "../client/weapon-loader.js";
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
