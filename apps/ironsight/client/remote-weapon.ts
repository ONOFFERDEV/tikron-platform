import * as THREE from "three";
import { splitRifleMagazine } from "./rifle-magazine.js";
import { reloadPose } from "./reload-presentation.js";
import { GAME } from "../src/game-config.js";
import { VISUALS } from "../config/visuals.js";
import { cloneWeaponBundleNode, loadWeaponModel, weaponMuzzle } from "./weapon-loader.js";

const MOUNT_OFFSETS = [[0.025, 0.14, 0.12], [0.025, 0.14, 0], [0.025, 0.14, 0.12],
  [0.025, 0.10, -0.02], [0.025, 0.12, 0.08]] as const;
const CONFIG = (GAME.weaponVis.presentation ?? VISUALS).remote;

/** Like the source GLB cache, templates retain immutable buffers for the page.
 * Instances share geometry but own magazine/bolt transforms. Prepare once, not
 * eleven geometry splits in the first visible multiplayer frame. */
const templates = new WeakMap<THREE.Object3D, Map<string, { object: THREE.Object3D; tip: THREE.Vector3; length: number }>>();
export function remoteWeaponTemplate(gltf: Parameters<typeof cloneWeaponBundleNode>[0], name: string, index: number) {
  let entries = templates.get(gltf.scene);
  if (!entries) { entries = new Map(); templates.set(gltf.scene, entries); }
  const key = `${name}:${index}`;
  const cached = entries.get(key); if (cached) return cached;
  const object = cloneWeaponBundleNode(gltf, name); if (!object) return undefined;
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  const template = { object, tip: weaponMuzzle(object), length: Math.max(0.001, bounds.max.z - bounds.min.z) };
  splitRifleMagazine(object, index);
  entries.set(key, template); return template;
}

/** Owns only instance objects and fallback resources; GLB buffers remain cached. */
export class RemoteWeapon {
  readonly mount = new THREE.Group();
  readonly muzzle = new THREE.Object3D();
  readonly scopeLens = new THREE.Object3D();
  loaded = false;
  private index = -1;
  private parts?: { magazine: THREE.Object3D; bolt: THREE.Object3D };
  private generation = 0;
  private fallback?: THREE.Mesh;
  private readonly hand?: THREE.Object3D;
  private readonly arms: { upper: THREE.Object3D; lower: THREE.Object3D; hand: THREE.Object3D;
    side: number; upperPose: THREE.Quaternion; lowerPose: THREE.Quaternion; upperPosition: THREE.Vector3; handPose: THREE.Quaternion; handWorld: THREE.Quaternion; contact: THREE.Vector3; elbowContact: THREE.Vector3 }[] = [];
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
  private readonly aimPivot = new THREE.Vector3();
  private readonly aimRotation = new THREE.Quaternion();

  constructor(private readonly group: THREE.Group, private readonly root?: THREE.Object3D) {
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
          upperPose: upper.quaternion.clone(), lowerPose: lower.quaternion.clone(), upperPosition: upper.position.clone(), handPose: hand.quaternion.clone(), handWorld: new THREE.Quaternion(), contact: new THREE.Vector3(), elbowContact: new THREE.Vector3() });
      }
      this.orientMount(0);
      this.hand.getWorldScale(this.a);
      this.mount.scale.setScalar(1 / Math.max(0.001, this.a.x));
    } else group.add(this.mount);
    this.mount.add(this.muzzle, this.scopeLens);
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
    this.placeScope(length);
    const bundle = GAME.weaponVis.bundle;
    const name = bundle?.nodes[index];
    if (!bundle || !name || !this.hand) return;
    void loadWeaponModel(bundle.url).then(gltf => {
      if (!gltf || generation !== this.generation) return;
      const template = remoteWeaponTemplate(gltf, name, index);
      if (!template) return;
      const mesh = template.object.clone();
      const tip = template.tip;
      const scale = length / template.length;
      this.clear();
      this.parts = { magazine: mesh.getObjectByName('rifle-magazine')!, bolt: mesh.getObjectByName('rifle-bolt')! };
      mesh.scale.multiplyScalar(scale);
      mesh.position.multiplyScalar(scale); // preserve grip-origin asset convention
      mesh.traverse(n => { n.raycast = () => {}; });
      this.mount.add(mesh);
      this.loaded = true;
      this.muzzle.position.copy(tip).multiplyScalar(scale);
      this.placeScope(length);
    });
  }

  private placeScope(length: number): void {
    // Lens sits above and behind the barrel tip in the same animated mount.
    this.scopeLens.position.copy(this.muzzle.position);
    this.scopeLens.position.z -= length * .42;
    this.scopeLens.position.y += .10;
  }

  /** Undo last frame before mixer.update, including bones absent from a clip. */
  beforeAnimation(): void {
    if (!this.overridden) return;
    for (const arm of this.arms) {
      arm.upper.quaternion.copy(arm.upperPose);
      arm.lower.quaternion.copy(arm.lowerPose);
      arm.upper.position.copy(arm.upperPosition);
      arm.hand.quaternion.copy(arm.handPose);
    }
    this.overridden = false;
  }

  update(height: number, pitch: number, holding: boolean, holdBlend = CONFIG.holdBlend, arms = true, reloadProgress: number | null = null): void {
    const reload = reloadPose(holding ? reloadProgress : null);
    if (this.parts) {
      this.parts.magazine.position.set(-reload.magazine * (this.index === 2 ? 0.32 : 0.08), -reload.magazine * (this.index === 2 ? 0.04 : 0.34), 0);
      this.parts.bolt.position.z = -reload.bolt * 0.07;
    }
    pitch = THREE.MathUtils.lerp(pitch, -0.35, reload.tilt * 0.85);
    if (!this.hand) {
      this.mount.position.set(0.22, height - 0.3, 0.24);
      this.mount.rotation.x = -pitch;
      return;
    }
    // The neutral hold is baked. Aim uses its measured wrist contact frame;
    // there are no guessed weapon grip targets. A shorter shoulder arc keeps
    // downward aim in front of the torso, while both hands follow full pitch.
    if (this.root?.userData.rifleHold && holding && arms && this.arms.length === 2) {
      const aim = THREE.MathUtils.clamp(pitch, -Math.PI / 2, Math.PI / 2);
      this.group.getWorldQuaternion(this.q);
      this.direction.copy(this.pitchAxis).applyQuaternion(this.q);
      this.aimRotation.setFromAxisAngle(this.direction, -aim);
      for (const arm of this.arms) {
        arm.upperPose.copy(arm.upper.quaternion); arm.lowerPose.copy(arm.lower.quaternion);
        arm.upperPosition.copy(arm.upper.position); arm.handPose.copy(arm.hand.quaternion);
        arm.hand.getWorldPosition(arm.contact); arm.hand.getWorldQuaternion(arm.handWorld);
        arm.lower.getWorldPosition(arm.elbowContact);
      }
      const firing = this.arms[0]!;
      firing.upper.getWorldPosition(this.shoulder);
      this.q.setFromAxisAngle(this.direction, -aim * (aim > 0 && this.index !== 4 ? 0.08 : 0.35));
      this.aimPivot.copy(firing.contact).sub(this.shoulder).applyQuaternion(this.q).add(this.shoulder);
      // At steep upward aim, carry the stock outside the neck rather than
      // rotating the visible head away from its verified hit silhouette.
      const clearance = this.index === 4 ? 0 : THREE.MathUtils.smoothstep(aim, 0.65, 1.5);
      this.group.getWorldQuaternion(this.q);
      this.b.set(-0.12 * clearance, 0, 0.06 * clearance).applyQuaternion(this.q);
      this.aimPivot.add(this.b);
      this.aimPivot.y += Math.max(0, -Math.sin(aim)) * 0.10;
      for (const arm of this.arms) {
        this.target.copy(arm.contact).sub(firing.contact).applyQuaternion(this.aimRotation).add(this.aimPivot);
        if (arm.side > 0 && reload.reach > 0) {
          // Support hand leaves the fore-end for the magazine well. Keep the
          // firing wrist fixed; cosmetics never move the authoritative head.
          this.b.set(this.index === 2 ? -0.14 : -0.06, -0.12 - reload.magazine * 0.18, -0.16);
          this.group.getWorldQuaternion(this.q);
          this.b.applyQuaternion(this.q).applyQuaternion(this.aimRotation);
          this.target.addScaledVector(this.b, reload.reach);
        }
        if (arm.side > 0 && reload.chargeReach > 0) {
          this.b.set(-0.05, 0.03, -0.20 - reload.bolt * 0.04);
          this.group.getWorldQuaternion(this.q);
          this.b.applyQuaternion(this.q).applyQuaternion(this.aimRotation);
          this.target.addScaledVector(this.b, reload.chargeReach);
        }
        // At zero pitch preserve the authored pose exactly, including elbow roll.
        if (Math.abs(aim) > 0.0001 || reload.reach > 0 || reload.chargeReach > 0) this.reach(arm, 1, true);
        this.q.copy(this.aimRotation).multiply(arm.handWorld);
        arm.hand.parent!.getWorldQuaternion(this.parentQ).invert();
        arm.hand.quaternion.copy(this.parentQ).multiply(this.q);
        arm.hand.updateWorldMatrix(false, true);
      }
      this.overridden = true;
      this.orientMount(aim);
      return;
    }
    // Legacy diagnostic reach is opt-in only; attachment-only remains fallback.
    const blend = holding && arms ? THREE.MathUtils.clamp(holdBlend, 0, 0.9) : 0;
    if (blend) {
      for (const arm of this.arms) {
        arm.upperPose.copy(arm.upper.quaternion);
        arm.lowerPose.copy(arm.lower.quaternion);
        arm.handPose.copy(arm.hand.quaternion); arm.upperPosition.copy(arm.upper.position);
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
    this.mount.position.set(0, 0, 0);
    if (this.root?.userData.rifleHold) {
      this.hand.getWorldPosition(this.target);
      this.group.getWorldQuaternion(this.q);
      this.parentQ.setFromAxisAngle(this.pitchAxis, -pitch); this.q.multiply(this.parentQ);
      this.b.fromArray(MOUNT_OFFSETS[this.index] ?? MOUNT_OFFSETS[0]!).applyQuaternion(this.q);
      this.target.add(this.b); this.hand.worldToLocal(this.target);
      this.mount.position.copy(this.target);
    }
    this.mount.updateWorldMatrix(true, true);
  }

  private reach(arm: (typeof this.arms)[number], blend: number, exact = false): void {
    arm.upper.getWorldPosition(this.shoulder);
    arm.lower.getWorldPosition(this.elbow);
    arm.hand.getWorldPosition(this.wrist);
    const upper = this.shoulder.distanceTo(this.elbow), lower = this.elbow.distanceTo(this.wrist);
    if (upper < 0.001 || lower < 0.001) return;
    this.direction.subVectors(this.target, this.shoulder);
    // Law of cosines: keep elbow flexion in [25, 135] degrees, never hyperextend.
    const reachAt = (degrees: number) => Math.sqrt(upper * upper + lower * lower +
      2 * upper * lower * Math.cos(THREE.MathUtils.degToRad(degrees)));
    const distance = THREE.MathUtils.clamp(this.direction.length(), exact ? Math.abs(upper - lower) + 0.002 : reachAt(135), exact ? upper + lower - 0.002 : reachAt(25));
    this.direction.normalize();
    this.wrist.copy(this.shoulder).addScaledVector(this.direction, distance);
    if (exact) this.pole.subVectors(arm.elbowContact, this.shoulder);
    else {
      this.group.getWorldQuaternion(this.q);
      this.pole.set(arm.side * 0.65, -1, -0.15).applyQuaternion(this.q);
    }
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
    this.parts = undefined;
    if (this.fallback) {
      this.fallback.geometry.dispose();
      (this.fallback.material as THREE.Material).dispose();
      this.fallback = undefined;
    }
    for (const child of [...this.mount.children]) if (child !== this.muzzle && child !== this.scopeLens) this.mount.remove(child);
  }
  dispose(): void {
    ++this.generation; // invalidate pending loads even when the same slot returns
    this.beforeAnimation();
    this.clear();
    this.mount.removeFromParent();
  }
}
