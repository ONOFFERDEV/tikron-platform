import * as THREE from "three";
import { GAME } from "../src/game-config.js";
import { VISUALS } from "../config/visuals.js";
import { cloneWeaponBundleNode, loadWeaponModel, weaponMuzzle } from "./weapon-loader.js";

const CONFIG = (GAME.weaponVis.presentation ?? VISUALS).remote;

/** Owns only instance objects and fallback resources; GLB buffers remain cached. */
export class RemoteWeapon {
  readonly mount = new THREE.Group();
  readonly muzzle = new THREE.Object3D();
  loaded = false;
  private index = -1;
  private generation = 0;
  private fallback?: THREE.Mesh;
  private readonly hand?: THREE.Object3D;
  private readonly arms: { upper: THREE.Object3D; lower: THREE.Object3D; hand: THREE.Object3D;
    side: number; upperPose: THREE.Quaternion; lowerPose: THREE.Quaternion }[] = [];
  private overridden = false;
  private readonly pitchAxis = new THREE.Vector3(1, 0, 0);
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly shoulder = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly pole = new THREE.Vector3();
  private readonly elbow = new THREE.Vector3();
  private readonly wrist = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly parentQ = new THREE.Quaternion();

  constructor(private readonly group: THREE.Group, root?: THREE.Object3D) {
    this.hand = root?.getObjectByName("Hand_R");
    group.updateWorldMatrix(true, true);
    if (this.hand) {
      this.hand.add(this.mount);
      // The asset faces +Z: its anatomical RIGHT is -X, LEFT is +X.
      // Solve the gun arm first, then derive support reach from the actual gun.
      for (const [side, suffix] of [[-1, "R"], [1, "L"]] as const) {
        const upper = root?.getObjectByName(`UpperArm_${suffix}`);
        const lower = root?.getObjectByName(`lowerarm_${suffix.toLowerCase()}`);
        const hand = root?.getObjectByName(`Hand_${suffix}`);
        if (upper && lower && hand) this.arms.push({ upper, lower, hand, side,
          upperPose: upper.quaternion.clone(), lowerPose: lower.quaternion.clone() });
      }
      this.orientMount(0);
      this.hand.getWorldScale(this.a);
      this.mount.scale.setScalar(1 / Math.max(0.001, this.a.x));
    } else group.add(this.mount);
    this.mount.add(this.muzzle);
  }

  setWeapon(index: number): void {
    if (this.index === index) return;
    this.loaded = false;
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
      this.loaded = true;
      this.muzzle.position.copy(tip).multiplyScalar(scale);
    });
  }

  /** Undo last frame before mixer.update, including bones absent from a clip. */
  beforeAnimation(): void {
    if (!this.overridden) return;
    for (const arm of this.arms) {
      arm.upper.quaternion.copy(arm.upperPose);
      arm.lower.quaternion.copy(arm.lowerPose);
    }
    this.overridden = false;
  }

  update(height: number, pitch: number, holding: boolean, holdBlend = CONFIG.holdBlend, arms = true): void {
    if (!this.hand) {
      this.mount.position.set(0.22, height - 0.3, 0.24);
      this.mount.rotation.x = -pitch;
      return;
    }
    // Only the attachment cancels hand orientation; never force a wrist into bind roll.
    const blend = holding && arms ? THREE.MathUtils.clamp(holdBlend, 0, 0.9) : 0;
    if (blend) {
      for (const arm of this.arms) {
        arm.upperPose.copy(arm.upper.quaternion);
        arm.lowerPose.copy(arm.lower.quaternion);
        if (arm.side < 0) {
          this.target.set(-0.20, height - 0.34, 0.28);
          this.target.y += Math.sin(pitch) * 0.28;
          this.group.localToWorld(this.target);
        } else {
          // Outside/below the fore-end, measured in the fitted weapon's metre space.
          this.orientMount(pitch);
          const length = CONFIG.lengths[this.index] ?? CONFIG.lengths[0]!;
          this.target.set(0.035, -0.045, length * 0.38);
          this.mount.localToWorld(this.target);
        }
        this.reach(arm, blend);
      }
      this.overridden = true;
    }
    this.orientMount(pitch);
  }

  private orientMount(pitch: number): void {
    if (!this.hand) return;
    this.group.getWorldQuaternion(this.q);
    this.parentQ.setFromAxisAngle(this.pitchAxis, -pitch);
    this.q.multiply(this.parentQ);
    this.hand.getWorldQuaternion(this.parentQ).invert();
    this.mount.quaternion.copy(this.parentQ).multiply(this.q);
    this.hand.getWorldScale(this.a);
    this.mount.scale.set(1 / Math.max(0.001, this.a.x), 1 / Math.max(0.001, this.a.y), 1 / Math.max(0.001, this.a.z));
    this.mount.updateWorldMatrix(true, true);
  }

  private reach(arm: (typeof this.arms)[number], blend: number): void {
    arm.upper.getWorldPosition(this.shoulder);
    arm.lower.getWorldPosition(this.elbow);
    arm.hand.getWorldPosition(this.wrist);
    const upper = this.shoulder.distanceTo(this.elbow), lower = this.elbow.distanceTo(this.wrist);
    if (upper < 0.001 || lower < 0.001) return;
    this.direction.subVectors(this.target, this.shoulder);
    // Law of cosines: keep elbow flexion in [25, 135] degrees, never hyperextend.
    const reachAt = (degrees: number) => Math.sqrt(upper * upper + lower * lower +
      2 * upper * lower * Math.cos(THREE.MathUtils.degToRad(degrees)));
    const distance = THREE.MathUtils.clamp(this.direction.length(), reachAt(135), reachAt(25));
    this.direction.normalize();
    this.wrist.copy(this.shoulder).addScaledVector(this.direction, distance);
    this.group.getWorldQuaternion(this.q);
    this.pole.set(arm.side * 0.65, -1, -0.15).applyQuaternion(this.q);
    this.pole.addScaledVector(this.direction, -this.pole.dot(this.direction)).normalize();
    const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
    this.elbow.copy(this.shoulder).addScaledVector(this.direction, along)
      .addScaledVector(this.pole, Math.sqrt(Math.max(0, upper * upper - along * along)));
    this.aim(arm.upper, arm.lower, this.elbow, blend);
    this.aim(arm.lower, arm.hand, this.wrist, blend);
  }

  /** Minimal world-space swing composed onto CURRENT animation preserves its axial roll.
   * No absolute look quaternion, no bind-pose inversion, and no hand-bone writes. */
  private aim(bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3, blend: number): void {
    bone.getWorldPosition(this.a);
    child.getWorldPosition(this.b).sub(this.a).normalize();
    this.a.subVectors(target, this.a).normalize();
    this.q.setFromUnitVectors(this.b, this.a);
    bone.getWorldQuaternion(this.parentQ);
    this.q.multiply(this.parentQ);
    bone.parent!.getWorldQuaternion(this.parentQ).invert();
    this.q.premultiply(this.parentQ);
    bone.quaternion.slerp(this.q, blend);
    bone.updateWorldMatrix(false, true);
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
