import * as THREE from "three";
import { splitRifleMagazine } from "./rifle-magazine.js";
import { reloadPose, weaponActionPose } from "./reload-presentation.js";
import type { WeaponActionState } from "../src/weapon-action.js";
import { GAME } from "../src/game-config.js";
import { VISUALS } from "../config/visuals.js";
import { acquireWeaponModel, cloneWeaponBundleNode, weaponMuzzle, weaponSource } from "./weapon-loader.js";
import type { AssetLease } from "./shared-gltf-cache.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { WEAPON_CONTACT_FRAMES, type WeaponContactFrame } from "./weapon-contact-frames.js";
import { WEAPONS } from "../src/config.js";

// Legacy (no contact frame) mount offsets from the firing wrist, and support-hand
// corrections on top of the baked hold, both in the pitched actor frame. Fitted to the
// shipped legacy weapons so the firing hand no longer sinks into the grip; the sniper
// support hand leaves the stock and the pistol support hand cups the firing hand.
// Measurement and per-clip table: .inspect/kit-r3/{fit,measure}.ts, AAA-PLAN-KIT Session 7.
const MOUNT_OFFSETS = [[0.029, 0.138, 0.119], [0.045, 0.143, -0.002], [0.031, 0.14, 0.12],
  [0.033, 0.106, -0.026], [0.039, 0.139, 0.078]] as const;
// SMG and shotgun: the baked palm faces up beside the fore-end without touching it; these
// place the palm point on the fore-end underside below the bore (.inspect/kit-r4/socket.ts).
const LEGACY_SUPPORT_OFFSETS = [undefined, [0.057, 0.004, 0.082], [0.037, -0.023, -0.006],
  [0.002, -0.001, -0.025], [-0.007, 0.005, 0.004]] as const;
const CONFIG = (GAME.weaponVis.presentation ?? VISUALS).remote;
const PALM_THICKNESS = .014;
const GRIP_CURL = { thumb: 1.2, indexFinger: -1.2, finger: 1.2 } as const;
const GRIP_RADIUS = [.025, .023, .03, .027, .019] as const;
const DONOR_GRIP_CURL = {
  thumb: [.72, .58, .42],
  index: [.08, .05, .03],
  middle: [1.02, .82, .58],
  ring: [1.08, .88, .62],
  little: [1.12, .92, .66],
} as const;
const PISTOL_HOLD_TRANSLATION = new THREE.Vector3(
  .017734676040467363, .09302355129460912, -.10753385475052857);
const PISTOL_FOREARM_DIRECTION = new THREE.Vector3(
  -.18247163657827833, .9696356401295951, -.162821458152527);
const PISTOL_RIGHT_HAND_SCALE = new THREE.Vector3(
  .809249, .809249, .809249);
const PISTOL_RIGHT_FINGER_POSE: Readonly<Record<string, {
  position: readonly [number, number, number];
  quaternion: readonly [number, number, number, number];
  scale?: readonly [number, number, number];
}>> = {
  thumb_1_r: { position: [4.8e-8, -.028000137, .035000133], quaternion: [.9358968183, -.3522742475, -1.08e-6, 1.2e-6], scale: [1, 1, 1] },
  thumb_2_r: { position: [1.2625342327154954e-8, .014760008643213363, .01148001654576894], quaternion: [9.211707948254783e-7, -6.226615292723873e-7, .28595221811388444, .9582438775982413] },
  thumb_3_r: { position: [-3.6103613432203474e-9, .012299922442727762, .009020022351430124], quaternion: [2.0197285460967696e-7, -3.654505409537573e-7, .20845989984570196, .9780309147241438] },
  index_1_r: { position: [8.9e-8, -.055000061, .027000132], quaternion: [.7065400017, -.028277179, .028276296, .7065423402], scale: [1, 1, 1] },
  index_2_r: { position: [1.7329557011613872e-8, .029000049045081105, 6.542572639212096e-8], quaternion: [8.714948527587401e-7, -5.6333978204238715e-8, .024997388621840352, .999687516457681] },
  index_3_r: { position: [-4.094269423493557e-9, .025000090052719692, 4.470369452391765e-8], quaternion: [1.6320784245059964e-8, -2.6110594604458177e-8, .014999437506296917, .9998875021093592] },
  middle_1_r: { position: [2.3e-8, -.055000080, .009000125], quaternion: [.8727445002, -.4881772602, -1.25e-6, 1.25e-6], scale: [1, 1, 1] },
  middle_2_r: { position: [-2.312799063375337e-9, .030739977134921936, 7.143506386420029e-8], quaternion: [1.1638829218417881e-6, -1.1321805209599115e-6, .39860932129268445, .9171208257236061] },
  middle_3_r: { position: [-1.5314909118657738e-8, .02649998287882971, 4.470386860688791e-8], quaternion: [3.111418685162924e-7, -4.97776513237311e-7, .28595222510423374, .958243875512697] },
  ring_1_r: { position: [6.5e-8, -.055000035, -.008999875], quaternion: [.8577086735, -.5141360047, -1.287e-6, 1.211e-6], scale: [1, 1, 1] },
  ring_2_r: { position: [-2.603667259570841e-8, .027840037397155126, 5.908404721033378e-8], quaternion: [1.180144183431642e-6, -1.2014598897412357e-6, .42593945846423803, .9047516663263767] },
  ring_3_r: { position: [-6.612671876737863e-8, .024000013546866428, 3.91159361567972e-8], quaternion: [3.3193137428784857e-7, -5.310364418875798e-7, .3050586364428012, .9523335698857132] },
  little_1_r: { position: [1.19e-7, -.055000056, -.026999874], quaternion: [.8472551029, -.5311862108, -1.312e-6, 1.186e-6], scale: [1, 1, 1] },
  little_2_r: { position: [3.410101179213143e-8, .023780046663986587, 4.710785134198758e-8], quaternion: [1.1903970966272901e-6, -1.2470498496379104e-6, .4439481004271536, .8960525007632921] },
  little_3_r: { position: [5.154936610907157e-8, .020499974877288718, 3.492522804293685e-8], quaternion: [3.5258816295167774e-7, -5.640839122444296e-7, .32404302839419563, .9460423435283836] },
};
const PUMP_CHAIN_PROFILE = {
  l: { thumb: [.18, .18, -.45, .22, -.055, 0], indexFinger: [.45, 0, 0, 0, .055, -.11, 0, 0, 0],
    finger: [.45, 0, .22, -.055, 0, -.055, 0, 0, 0] },
  r: { thumb: [-.18, -.18, 0, -.22, .78, 0], indexFinger: [-.45, -.45, 0, 0, 0, 0, 0, 0, 0],
    finger: [.45, .45, 0, .45, 0, 0, 0, 0, 0] },
} as const;

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
  for (const childName of ["fp", "LOD1", "LOD2"]) {
    const child = object.getObjectByName(childName);
    child?.removeFromParent();
  }
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  const template = { object, tip: weaponMuzzle(object), length: Math.max(0.001, bounds.max.z - bounds.min.z) };
  const authoredParts = object.getObjectByName("LOD0") && object.getObjectByName("grip_l")
    && object.getObjectByName("grip_r");
  if (!authoredParts) splitRifleMagazine(object, index);
  entries.set(key, template); return template;
}

/** Owns only instance objects and fallback resources; GLB buffers remain cached. */
export class RemoteWeapon {
  readonly mount = new THREE.Group();
  readonly muzzle = new THREE.Object3D();
  readonly scopeLens = new THREE.Object3D();
  loaded = false;
  private index = -1;
  private parts?: { magazine?: THREE.Object3D; bolt?: THREE.Object3D; pump?: THREE.Object3D;
    shell?: THREE.Object3D; clip?: THREE.Object3D; gripR?: THREE.Object3D; gripL?: THREE.Object3D };
  private generation = 0;
  private weaponLease?: AssetLease<GLTF>;
  private readonly partOrigins = new WeakMap<THREE.Object3D, THREE.Vector3>();
  private readonly mountMatrix = new THREE.Matrix4();
  private fallback?: THREE.Mesh;
  private readonly hand?: THREE.Object3D;
  private readonly arms: { upper: THREE.Object3D; lower: THREE.Object3D; hand: THREE.Object3D;
    side: number; upperPose: THREE.Quaternion; lowerPose: THREE.Quaternion; upperPosition: THREE.Vector3;
    handPosition: THREE.Vector3; handPose: THREE.Quaternion; handScale: THREE.Vector3;
    handWorld: THREE.Quaternion; palmInWrist: THREE.Matrix4; contact: THREE.Vector3; elbowContact: THREE.Vector3 }[] = [];
  private readonly fingers: { bone: THREE.Object3D; child: THREE.Object3D;
    side: number; family: keyof typeof GRIP_CURL; pose: THREE.Quaternion }[] = [];
  private readonly donorFingers: { bone: THREE.Object3D; side: number;
    family: keyof typeof DONOR_GRIP_CURL; segment: number; position: THREE.Vector3;
    pose: THREE.Quaternion; scale: THREE.Vector3 }[] = [];
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
  private readonly m = new THREE.Matrix4();
  private readonly n = new THREE.Matrix4();

  constructor(private readonly group: THREE.Group, private readonly root?: THREE.Object3D,
    private readonly candidatePreview = false) {
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
        const lowerSuffix = suffix.toLowerCase();
        const palmInWrist = hand ? this.palmFrame(lowerSuffix) : undefined;
        if (upper && lower && hand && palmInWrist) this.arms.push({ upper, lower, hand, side,
          upperPose: upper.quaternion.clone(), lowerPose: lower.quaternion.clone(), upperPosition: upper.position.clone(),
          handPosition: hand.position.clone(), handPose: hand.quaternion.clone(), handScale: hand.scale.clone(),
          handWorld: new THREE.Quaternion(), palmInWrist, contact: new THREE.Vector3(), elbowContact: new THREE.Vector3() });
        for (const [family, count] of [["thumb", 3], ["indexFinger", 4], ["finger", 4]] as const) {
          for (let number = 1; number < count; number++) {
            const bone = root?.getObjectByName(`${family}_${String(number).padStart(2, "0")}_${lowerSuffix}`);
            const child = root?.getObjectByName(`${family}_${String(number + 1).padStart(2, "0")}_${lowerSuffix}`);
            if (bone && child) this.fingers.push({ bone, child, side, family, pose: bone.quaternion.clone() });
          }
        }
        for (const family of ["thumb", "index", "middle", "ring", "little"] as const) {
          for (let segment = 1; segment <= 3; segment++) {
            const bone = root?.getObjectByName(`${family}_${segment}_${lowerSuffix}`);
            if (bone) this.donorFingers.push({ bone, side, family, segment: segment - 1,
              position: bone.position.clone(), pose: bone.quaternion.clone(), scale: bone.scale.clone() });
          }
        }
      }
      this.orientMount(0);
      this.hand.getWorldScale(this.a);
      this.mount.scale.setScalar(1 / Math.max(0.001, this.a.x));
    } else group.add(this.mount);
    this.mount.add(this.muzzle, this.scopeLens);
  }

  setWeapon(index: number): void {
    if (this.index === index) return;
    this.beforeAnimation();
    this.loaded = false;
    this.index = index;
    const generation = ++this.generation;
    this.clear();
    this.releaseWeaponLease();
    const length = CONFIG.lengths[index] ?? CONFIG.lengths[0]!;
    this.fallback = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, length),
      new THREE.MeshStandardMaterial({ color: GAME.palette.viewmodel.metal, roughness: 0.55, metalness: 0.35 }));
    this.fallback.position.z = length * 0.3;
    this.fallback.raycast = () => {}; // cosmetic attachment is never a hit target
    this.mount.add(this.fallback);
    this.muzzle.position.set(0, 0, length * 0.8);
    this.placeScope(length);
    const source = weaponSource(GAME.weaponVis, index, { candidatePreview: this.candidatePreview });
    const name = source?.nodeName;
    if (!source || !name || !this.hand) return;
    const lease = acquireWeaponModel(source.url);
    this.weaponLease = lease;
    void lease.value.then(gltf => {
      if (generation !== this.generation) return;
      if (!gltf) { this.releaseWeaponLease(); return; }
      const template = remoteWeaponTemplate(gltf, name, index);
      if (!template) { this.releaseWeaponLease(); return; }
      const mesh = template.object.clone();
      const tip = template.tip;
      const scale = length / template.length;
      this.clear();
      this.parts = {
        magazine: mesh.getObjectByName("rifle-magazine") ?? mesh.getObjectByName("magazine") ?? undefined,
        bolt: mesh.getObjectByName("rifle-bolt") ?? mesh.getObjectByName("bolt") ?? undefined,
        pump: mesh.getObjectByName("pump") ?? undefined,
        shell: mesh.getObjectByName("shell") ?? undefined,
        clip: mesh.getObjectByName("clip") ?? undefined,
        gripL: mesh.getObjectByName("grip_l") ?? undefined,
      };
      for (const part of [this.parts.magazine, this.parts.bolt, this.parts.pump]) {
        if (part) this.partOrigins.set(part, part.position.clone());
      }
      mesh.scale.multiplyScalar(scale);
      mesh.position.multiplyScalar(scale); // preserve grip-origin asset convention
      mesh.traverse(n => { n.raycast = () => {}; });
      this.mount.add(mesh);
      const key = WEAPONS[index]!.key;
      const frames = mesh.name === key ? WEAPON_CONTACT_FRAMES[key] : undefined;
      const gripR = this.contactNode(mesh, frames?.grip_r, "remote-grip-r");
      const gripL = this.contactNode(mesh, frames?.grip_l, "remote-grip-l");
      if (gripR) this.parts.gripR = gripR;
      if (gripL) this.parts.gripL = gripL;
      if (gripR) this.alignLoadedMount(gripR);
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
      arm.hand.position.copy(arm.handPosition);
      arm.hand.quaternion.copy(arm.handPose);
      arm.hand.scale.copy(arm.handScale);
    }
    for (const finger of this.fingers) finger.bone.quaternion.copy(finger.pose);
    for (const finger of this.donorFingers) {
      finger.bone.position.copy(finger.position);
      finger.bone.quaternion.copy(finger.pose);
      finger.bone.scale.copy(finger.scale);
    }
    this.overridden = false;
  }

  update(height: number, pitch: number, holding: boolean, holdBlend = CONFIG.holdBlend, arms = true, reloadProgress: number | null = null, action: WeaponActionState | null = null, now = 0): void {
    if (this.parts?.gripR) {
      this.mount.matrix.copy(this.mountMatrix);
      this.mount.matrixAutoUpdate = false;
      this.mount.updateWorldMatrix(false, true);
    }
    const reload = action === null
      ? { ...reloadPose(holding ? reloadProgress : null), pump: 0, shell: 0, clip: 0 }
      : weaponActionPose(holding ? action : null, now);
    if (this.parts) {
      const magazine = this.parts.magazine;
      const magazineOrigin = magazine ? this.partOrigins.get(magazine) : undefined;
      if (magazine && magazineOrigin) magazine.position.copy(magazineOrigin)
        .add(this.b.set(-reload.magazine * (this.index === 2 ? 0.32 : 0.08), -reload.magazine * (this.index === 2 ? 0.04 : 0.34), 0));
      const bolt = this.parts.bolt;
      const boltOrigin = bolt ? this.partOrigins.get(bolt) : undefined;
      if (bolt && boltOrigin) bolt.position.copy(boltOrigin).add(this.b.set(0, 0, -reload.bolt * .07));
      const pump = this.parts.pump;
      const pumpOrigin = pump ? this.partOrigins.get(pump) : undefined;
      if (pump && pumpOrigin) pump.position.copy(pumpOrigin).add(this.b.set(0, 0, -reload.pump * .09));
      if (this.parts.shell) this.parts.shell.visible = reload.shell > 0.05;
      if (this.parts.clip) this.parts.clip.visible = reload.clip > 0.05;
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
        arm.upperPosition.copy(arm.upper.position); arm.handPosition.copy(arm.hand.position);
        arm.handPose.copy(arm.hand.quaternion); arm.handScale.copy(arm.hand.scale);
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
        if (arm.side > 0 && this.parts?.gripL) {
          this.parts.gripL.getWorldPosition(this.target);
          this.parts.gripL.getWorldQuaternion(this.q);
          this.target.add(this.b.set(PALM_THICKNESS, 0, 0).applyQuaternion(this.q));
          arm.hand.getWorldScale(this.a);
          this.n.copy(arm.palmInWrist);
          if (this.index === 4) this.n.multiply(this.m.makeTranslation(0, 0, -.02));
          this.m.compose(this.target, this.q, this.a).multiply(this.n.invert());
          this.m.decompose(this.target, this.q, this.a);
          arm.handWorld.copy(this.q);
        }
        const legacySupport = arm.side > 0 && !this.parts?.gripL && !this.parts?.gripR
          ? LEGACY_SUPPORT_OFFSETS[this.index] : undefined;
        if (legacySupport) {
          this.group.getWorldQuaternion(this.q);
          this.target.add(this.b.fromArray(legacySupport).applyQuaternion(this.q).applyQuaternion(this.aimRotation));
        }
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
        if (Math.abs(aim) > 0.0001 || reload.reach > 0 || reload.chargeReach > 0
          || (arm.side > 0 && this.parts?.gripL) || legacySupport) this.reach(arm, 1, true);
        if (arm.side > 0 && this.parts?.gripL) this.q.copy(arm.handWorld);
        else this.q.copy(this.aimRotation).multiply(arm.handWorld);
        arm.hand.parent!.getWorldQuaternion(this.parentQ).invert();
        arm.hand.quaternion.copy(this.parentQ).multiply(this.q);
        arm.hand.updateWorldMatrix(false, true);
      }
      if (this.index === 4 && this.parts?.gripR
        && this.donorFingers.filter(finger => finger.side < 0).length === 15) {
        this.applyAcceptedPistolRightGrip(firing, this.parts.gripR);
      }
      for (const finger of this.fingers) {
        finger.pose.copy(finger.bone.quaternion);
        // Legacy support fingers already wrap the baked fore-end. Only a
        // measured surface frame can resolve a different curl without drift.
        if (finger.side > 0 && !this.parts?.gripL) continue;
        this.a.set(0, 0, 1);
        this.q.setFromAxisAngle(this.a, GRIP_CURL[finger.family]);
        finger.bone.quaternion.multiply(this.q);
        finger.bone.updateWorldMatrix(false, true);
      }
      const radius = GRIP_RADIUS[this.index] ?? GRIP_RADIUS[0];
      for (const arm of this.arms) {
        const grip = arm.side > 0 ? this.parts?.gripL : this.parts?.gripR;
        if (!grip) continue;
        grip.getWorldPosition(this.target);
        grip.getWorldQuaternion(this.q);
        for (const [family, offset] of [
          ["thumb", [0, radius * .35, -radius]],
          ["indexFinger", [0, radius * .2, radius]],
          ["finger", [0, -radius * .65, radius * .25]],
        ] as const) {
          this.b.fromArray(offset).applyQuaternion(this.q).add(this.target);
          const chain = this.fingers.filter(finger => finger.side === arm.side && finger.family === family);
          this.solveFinger(chain, this.b);
          if (this.index === 2) this.applyJointProfile(chain,
            PUMP_CHAIN_PROFILE[arm.side > 0 ? "l" : "r"][family]);
        }
      }
      for (const finger of this.donorFingers) {
        finger.pose.copy(finger.bone.quaternion);
        finger.position.copy(finger.bone.position);
        finger.scale.copy(finger.bone.scale);
        const accepted = this.index === 4 && finger.side < 0
          ? PISTOL_RIGHT_FINGER_POSE[finger.bone.name] : undefined;
        if (accepted) {
          finger.bone.position.fromArray(accepted.position);
          finger.bone.quaternion.fromArray(accepted.quaternion);
          if (accepted.scale) finger.bone.scale.fromArray(accepted.scale);
          else finger.bone.scale.set(1, 1, 1);
        } else {
          const angle = DONOR_GRIP_CURL[finger.family][finger.segment]!;
          this.q.setFromAxisAngle(this.a.set(0, 0, 1), -angle);
          finger.bone.quaternion.multiply(this.q);
        }
        finger.bone.updateWorldMatrix(false, true);
      }
      this.overridden = true;
      if (!this.parts?.gripR) this.orientMount(aim);
      return;
    }
    // Legacy diagnostic reach is opt-in only; attachment-only remains fallback.
    const blend = holding && arms ? THREE.MathUtils.clamp(holdBlend, 0, 0.9) : 0;
    if (blend) {
      for (const arm of this.arms) {
        arm.upperPose.copy(arm.upper.quaternion);
        arm.lowerPose.copy(arm.lower.quaternion);
        arm.handPosition.copy(arm.hand.position); arm.handPose.copy(arm.hand.quaternion);
        arm.handScale.copy(arm.hand.scale); arm.upperPosition.copy(arm.upper.position);
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
    this.mount.matrixAutoUpdate = true;
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
    this.releaseWeaponLease();
    this.mount.removeFromParent();
  }

  private solveFinger(chain: (typeof this.fingers), target: THREE.Vector3): void {
    const tip = chain.at(-1)?.child;
    if (!tip) return;
    for (let pass = 0; pass < 3; pass++) {
      for (let index = chain.length - 1; index >= 0; index--) {
        const bone = chain[index]?.bone;
        if (!bone?.parent) continue;
        bone.getWorldPosition(this.a);
        tip.getWorldPosition(this.direction); this.direction.sub(this.a).normalize();
        this.wrist.copy(target).sub(this.a).normalize();
        this.q.setFromUnitVectors(this.direction, this.wrist);
        bone.getWorldQuaternion(this.parentQ); this.q.multiply(this.parentQ);
        bone.parent.getWorldQuaternion(this.parentQ).invert();
        bone.quaternion.copy(this.parentQ.multiply(this.q));
        bone.updateWorldMatrix(false, true);
      }
    }
  }

  private applyAcceptedPistolRightGrip(arm: (typeof this.arms)[number], grip: THREE.Object3D): void {
    this.mount.updateWorldMatrix(true, true);
    const desiredMountWorld = this.mount.matrixWorld.clone();
    this.group.getWorldQuaternion(this.q);
    this.b.copy(PISTOL_HOLD_TRANSLATION).applyQuaternion(this.q);
    desiredMountWorld.elements[12]! += this.b.x;
    desiredMountWorld.elements[13]! += this.b.y;
    desiredMountWorld.elements[14]! += this.b.z;

    grip.getWorldPosition(this.target).add(this.b);
    grip.getWorldQuaternion(arm.handWorld);
    arm.upper.getWorldPosition(this.shoulder);
    arm.lower.getWorldPosition(this.elbow);
    arm.hand.getWorldPosition(this.wrist);
    const lowerLength = this.elbow.distanceTo(this.wrist);
    this.direction.copy(PISTOL_FOREARM_DIRECTION).applyQuaternion(arm.handWorld).normalize();
    arm.elbowContact.copy(this.target).addScaledVector(this.direction, -lowerLength);
    this.reach(arm, 1, true);
    arm.hand.parent!.getWorldQuaternion(this.parentQ).invert();
    arm.hand.quaternion.copy(this.parentQ).multiply(arm.handWorld);
    arm.hand.scale.copy(PISTOL_RIGHT_HAND_SCALE);
    arm.hand.updateWorldMatrix(false, true);

    this.n.copy(arm.hand.matrixWorld).invert().multiply(desiredMountWorld);
    this.n.decompose(this.mount.position, this.mount.quaternion, this.mount.scale);
    this.mount.matrix.copy(this.n);
    this.mount.matrixAutoUpdate = false;
    this.mount.updateWorldMatrix(true, true);
  }

  private applyJointProfile(chain: (typeof this.fingers), angles: readonly number[]): void {
    for (let joint = 0; joint < chain.length; joint++) {
      const bone = chain[joint]?.bone;
      if (!bone) continue;
      for (let axis = 0; axis < 3; axis++) {
        this.a.set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
        this.q.setFromAxisAngle(this.a, angles[joint * 3 + axis] ?? 0);
        bone.quaternion.multiply(this.q);
      }
      bone.updateWorldMatrix(false, true);
    }
  }

  private contactNode(root: THREE.Object3D, frame: WeaponContactFrame | undefined,
    name: string): THREE.Object3D | undefined {
    if (!frame) return undefined;
    const parent = frame.source === "root" ? root : root.getObjectByName(frame.source);
    if (!parent) return undefined;
    const node = new THREE.Object3D();
    node.name = name;
    node.position.fromArray(frame.position);
    node.quaternion.fromArray(frame.quaternion);
    parent.add(node);
    return node;
  }

  private alignLoadedMount(grip: THREE.Object3D): void {
    if (!this.hand) return;
    const firing = this.arms.find(arm => arm.side < 0);
    if (!firing) return;
    this.mount.updateWorldMatrix(true, true);
    this.m.makeTranslation(-PALM_THICKNESS, 0, 0)
      .premultiply(firing.palmInWrist)
      .premultiply(this.hand.matrixWorld);
    if (this.index === 4 && this.donorFingers.filter(finger => finger.side < 0).length === 15) {
      this.m.decompose(this.target, this.q, this.a);
      this.m.compose(this.target, this.q, this.a.setScalar(.85));
    }
    this.n.copy(this.m).multiply(this.aMatrix(grip.matrixWorld).invert()).multiply(this.mount.matrixWorld);
    this.n.premultiply(this.aMatrix(this.hand.matrixWorld).invert());
    this.n.decompose(this.mount.position, this.mount.quaternion, this.mount.scale);
    this.mount.matrix.copy(this.n);
    this.mount.matrixAutoUpdate = false;
    this.mount.updateWorldMatrix(true, true);
    this.mountMatrix.copy(this.n);
  }

  private aMatrix(source: THREE.Matrix4): THREE.Matrix4 {
    return new THREE.Matrix4().copy(source);
  }

  private palmFrame(suffix: string): THREE.Matrix4 | undefined {
    const thumb = this.root?.getObjectByName(`thumb_01_${suffix}`);
    const index = this.root?.getObjectByName(`indexFinger_01_${suffix}`);
    const fingers = this.root?.getObjectByName(`finger_01_${suffix}`);
    if (!thumb || !index || !fingers) return undefined;
    const origin = thumb.position.clone().add(index.position).add(fingers.position).multiplyScalar(1 / 3);
    const towardWrist = origin.clone().normalize().multiplyScalar(-1);
    const tangent = fingers.position.clone().sub(index.position)
      .addScaledVector(towardWrist, -fingers.position.clone().sub(index.position).dot(towardWrist)).normalize();
    const normal = towardWrist.clone().cross(tangent).normalize();
    tangent.crossVectors(normal, towardWrist).normalize();
    return new THREE.Matrix4().makeBasis(normal, towardWrist, tangent).setPosition(origin);
  }

  private releaseWeaponLease(): void {
    this.weaponLease?.release();
    this.weaponLease = undefined;
  }
}
