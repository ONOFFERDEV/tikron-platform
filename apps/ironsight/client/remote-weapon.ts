import * as THREE from "three";
import { GAME } from "../src/game-config.js";
import { VISUALS } from "../config/visuals.js";
import { cloneWeaponBundleNode, loadWeaponModel, weaponMuzzle } from "./weapon-loader.js";

const CONFIG = (GAME.weaponVis.presentation ?? VISUALS).remote;

/** Owns only instance objects and fallback resources; GLB buffers remain cached. */
export class RemoteWeapon {
  readonly mount = new THREE.Group();
  readonly muzzle = new THREE.Object3D();
  private index = -1;
  private generation = 0;
  private fallback?: THREE.Mesh;
  private readonly hand?: THREE.Object3D;
  private readonly arms: { bone: THREE.Object3D; child: THREE.Object3D; side: number; upper: boolean; saved: THREE.Quaternion }[] = [];
  private readonly handRest = new THREE.Quaternion();
  private readonly animatedHand = new THREE.Quaternion();
  private overridden = false;
  private readonly pitchAxis = new THREE.Vector3(1, 0, 0);
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly parentQ = new THREE.Quaternion();

  constructor(private readonly group: THREE.Group, root?: THREE.Object3D) {
    this.hand = root?.getObjectByName("Hand_R");
    group.updateWorldMatrix(true, true);
    if (this.hand) {
      // Preserve the authored palm orientation, then fit +Z bore in group space.
      this.hand.getWorldQuaternion(this.handRest);
      group.getWorldQuaternion(this.q).invert();
      this.handRest.premultiply(this.q);
      this.mount.quaternion.copy(this.handRest).invert();
      this.hand.add(this.mount);
      for (const [side, suffix] of [[-1, "L"], [1, "R"]] as const) {
        const upper = root?.getObjectByName(`UpperArm_${suffix}`);
        const lower = root?.getObjectByName(`lowerarm_${suffix.toLowerCase()}`);
        const hand = root?.getObjectByName(`Hand_${suffix}`);
        if (upper && lower && hand) {
          this.arms.push({ bone: upper, child: lower, side, upper: true, saved: upper.quaternion.clone() });
          this.arms.push({ bone: lower, child: hand, side, upper: false, saved: lower.quaternion.clone() });
        }
      }
      this.hand.getWorldScale(this.a);
      this.mount.scale.setScalar(1 / Math.max(0.001, this.a.x));
    } else group.add(this.mount);
    this.mount.add(this.muzzle);
  }

  setWeapon(index: number): void {
    if (this.index === index) return;
    this.index = index;
    const generation = ++this.generation;
    this.clear();
    const length = CONFIG.lengths[index] ?? CONFIG.lengths[0]!;
    this.fallback = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, length),
      new THREE.MeshStandardMaterial({ color: GAME.palette.viewmodel.metal, roughness: 0.55, metalness: 0.35 }));
    this.fallback.position.z = length * 0.3;
    this.fallback.raycast = () => {}; // cosmetic attachment is never a hit target
    this.mount.add(this.fallback);
    this.muzzle.position.set(0, 0, length * 0.8);
    const bundle = GAME.weaponVis.bundle;
    const name = bundle?.nodes[index];
    if (!bundle || !name || !this.hand) return;
    void loadWeaponModel(bundle.url).then(gltf => {
      if (!gltf || generation !== this.generation) return;
      const mesh = cloneWeaponBundleNode(gltf, name);
      if (!mesh) return;
      mesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mesh);
      const tip = weaponMuzzle(mesh);
      const scale = length / Math.max(0.001, box.max.z - box.min.z);
      this.clear();
      mesh.scale.multiplyScalar(scale);
      mesh.position.multiplyScalar(scale); // preserve grip-origin asset convention
      mesh.traverse(n => { n.raycast = () => {}; });
      this.mount.add(mesh);
      this.muzzle.position.copy(tip).multiplyScalar(scale);
    });
  }

  /** Undo last frame before mixer.update, including bones absent from a clip. */
  beforeAnimation(): void {
    if (!this.overridden) return;
    for (const arm of this.arms) arm.bone.quaternion.copy(arm.saved);
    this.hand?.quaternion.copy(this.animatedHand);
    this.overridden = false;
  }

  update(height: number, pitch: number, holding: boolean): void {
    if (!this.hand) {
      this.mount.position.set(0.22, height - 0.3, 0.24);
      this.mount.rotation.x = -pitch;
      return;
    }
    const blend = holding ? THREE.MathUtils.clamp(CONFIG.holdBlend, 0, 1) : 0;
    if (!blend) return;
    this.animatedHand.copy(this.hand.quaternion);
    for (const arm of this.arms) {
      arm.saved.copy(arm.bone.quaternion);
      // Modest bent elbows and a support hand under the fore-end, in player space.
      this.target.set(arm.upper ? arm.side * 0.33 : arm.side === 1 ? 0.18 : 0.10,
        height - (arm.upper ? 0.49 : 0.29), arm.upper ? 0.12 : arm.side === 1 ? 0.32 : 0.57);
      this.target.y += Math.sin(pitch) * this.target.z;
      this.group.localToWorld(this.target);
      arm.bone.getWorldPosition(this.a);
      arm.child.getWorldPosition(this.b);
      this.b.sub(this.a).normalize();
      this.target.sub(this.a).normalize();
      this.q.setFromUnitVectors(this.b, this.target);
      arm.bone.getWorldQuaternion(this.parentQ);
      this.q.multiply(this.parentQ);
      arm.bone.parent!.getWorldQuaternion(this.parentQ).invert();
      this.q.premultiply(this.parentQ);
      arm.bone.quaternion.slerp(this.q, blend);
      arm.bone.updateWorldMatrix(false, true);
    }
    this.group.getWorldQuaternion(this.q);
    this.parentQ.setFromAxisAngle(this.pitchAxis, -pitch);
    this.q.multiply(this.parentQ).multiply(this.handRest);
    this.hand.parent!.getWorldQuaternion(this.parentQ).invert();
    this.q.premultiply(this.parentQ);
    this.hand.quaternion.slerp(this.q, blend);
    this.overridden = true;
  }

  private clear(): void {
    if (this.fallback) {
      this.fallback.geometry.dispose();
      (this.fallback.material as THREE.Material).dispose();
      this.fallback = undefined;
    }
    for (const child of [...this.mount.children]) if (child !== this.muzzle) this.mount.remove(child);
  }
  dispose(): void {
    ++this.generation; // invalidate pending loads even when the same slot returns
    this.beforeAnimation();
    this.clear();
    this.mount.removeFromParent();
  }
}
