import * as T from "three";
import type { WeaponKey } from "../src/weapon-contract.js";
import type { WeaponActionState } from "../src/weapon-action.js";
import { weaponActionPose } from "./reload-presentation.js";
import { VIEWMODEL_WEAPON_SCALE, WEAPON_CONTACT_FRAMES } from "./weapon-contact-frames.js";

const WEAPON_INDEX: Readonly<Record<WeaponKey, number>> = {
  automatic_rifle: 0, trench_smg: 1, pump_shotgun: 2,
  bolt_service_rifle: 3, service_pistol: 4,
};

const COMMON = ["grip_r", "grip_l", "muzzle", "eject", "sight_rear", "sight_front"] as const;
const CONTRACTS: Readonly<Record<WeaponKey, {
  readonly parts: readonly string[];
  readonly contacts: readonly string[];
}>> = {
  automatic_rifle: { parts: ["magazine", "bolt"], contacts: ["magwell", "chamber"] },
  trench_smg: { parts: ["magazine", "bolt"], contacts: ["magwell", "chamber"] },
  pump_shotgun: { parts: ["pump", "shell"], contacts: ["chamber"] },
  bolt_service_rifle: { parts: ["bolt", "clip"], contacts: ["chamber", "clip_mount"] },
  service_pistol: { parts: ["slide", "magazine"], contacts: ["magwell", "chamber"] },
};

type Baseline = {
  readonly node: T.Object3D;
  readonly position: T.Vector3;
  readonly quaternion: T.Quaternion;
  readonly scale: T.Vector3;
  readonly visible: boolean;
};

export type WeaponPresentationSockets = {
  readonly gripRight: T.Object3D;
  readonly gripLeft: T.Object3D;
  readonly muzzle: T.Object3D;
  readonly eject: T.Object3D;
  readonly sightRear: T.Object3D;
  readonly sightFront: T.Object3D;
};

export type WeaponPresentationFrame = {
  readonly mode: "contract" | "fallback";
  readonly active: boolean;
  readonly phase: string;
  readonly authoritativeEndsAt: number | null;
  readonly leftHandTarget: string;
  readonly rightHandTarget: string;
  readonly partVisibility: Readonly<Record<string, boolean>>;
  readonly animationClip: "ready" | "reload";
  readonly animationProgress: number;
};

const FALLBACK_FRAME: WeaponPresentationFrame = Object.freeze({
  mode: "fallback", active: false, phase: "idle", authoritativeEndsAt: null,
  leftHandTarget: "procedural", rightHandTarget: "procedural", partVisibility: Object.freeze({}),
  animationClip: "ready", animationProgress: 0,
});

export function resolveWeaponContractRoot(wrapper: T.Object3D, key: WeaponKey): T.Object3D | null {
  const matches: T.Object3D[] = [];
  wrapper.traverse(node => { if (node.name === key) matches.push(node); });
  return matches.length === 1 ? matches[0]! : null;
}

export class WeaponPresentation {
  readonly sockets: WeaponPresentationSockets | null;
  private readonly key: WeaponKey;
  private readonly nodes: ReadonlyMap<string, T.Object3D>;
  private readonly handTargets: ReadonlyMap<string, T.Object3D>;
  private readonly baselines: readonly Baseline[];
  private latestSerial = -1;
  private activeSerial: number | null = null;

  constructor(key: WeaponKey, root: T.Object3D) {
    this.key = key;
    const contract = CONTRACTS[key];
    const names = [...COMMON, ...contract.parts, ...contract.contacts];
    const found = new Map<string, T.Object3D>();
    let valid = root.name === key;
    for (const name of names) {
      const matches: T.Object3D[] = [];
      root.traverse(node => { if (node.name === name) matches.push(node); });
      if (matches.length !== 1) valid = false;
      else found.set(name, matches[0]!);
    }
    this.nodes = valid ? found : new Map();
    this.baselines = valid ? contract.parts.map(name => {
      const node = found.get(name)!;
      return { node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(), visible: node.visible };
    }) : [];
    this.sockets = valid ? {
      gripRight: found.get("grip_r")!, gripLeft: found.get("grip_l")!,
      muzzle: found.get("muzzle")!, eject: found.get("eject")!,
      sightRear: found.get("sight_rear")!, sightFront: found.get("sight_front")!,
    } : null;
    const handTargets = new Map<string, T.Object3D>();
    if (valid) {
      for (const [name, frame] of Object.entries(WEAPON_CONTACT_FRAMES[key])) {
        const source = frame.source === "root" ? root : found.get(frame.source);
        if (source === undefined) continue;
        const target = new T.Object3D();
        target.name = `presentation_${name}`;
        target.position.fromArray(frame.position);
        const surface = new T.Quaternion().fromArray(frame.quaternion);
        if (name === "grip_r") {
          target.position.x *= -1;
          surface.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI));
        }
        if (name === "clip")
          surface.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI));
        const clearance = name === "grip_l" && key !== "trench_smg" ? .025 : .019;
        const supportDrop = key === "service_pistol" && name === "grip_l" ? -.04 : 0;
        const wristReach = name === "shell" ? .045 : .025;
        target.position.add(new T.Vector3(clearance / VIEWMODEL_WEAPON_SCALE[key],
          wristReach / VIEWMODEL_WEAPON_SCALE[key], supportDrop / VIEWMODEL_WEAPON_SCALE[key])
          .applyQuaternion(surface));
        target.quaternion.copy(surface);
        source.add(target);
        handTargets.set(name, target);
      }
      for (const [name, sourceName, x] of [["grip_r", "grip_r", .035], ["grip_l", "grip_l", -.035],
        ["magwell", "magwell", -.03], ["chamber", "chamber", -.03], ["magazine", "magazine", -.035],
        ["pump", "pump", -.035], ["shell", "shell", -.018], ["clip", "clip", -.02], ["bolt_hand", "bolt", .095]] as const) {
        if (handTargets.has(name)) continue;
        const source = found.get(sourceName);
        if (source === undefined) continue;
        const target = new T.Object3D(); target.name = `presentation_${name}`; target.position.x = x;
        source.add(target); handTargets.set(name, target);
      }
    }
    this.handTargets = handTargets;
  }

  update(state: WeaponActionState | null, serverNow: number): WeaponPresentationFrame {
    this.restoreParts();
    if (this.sockets === null) return FALLBACK_FRAME;
    if (!Number.isFinite(serverNow) || state === null) {
      this.cancelActive();
      return this.idleFrame();
    }
    if (state.serial < this.latestSerial || (state.serial === this.latestSerial && this.activeSerial === null)) return this.idleFrame();
    if (state.weaponIndex !== WEAPON_INDEX[this.key] || state.endsAt <= serverNow) {
      this.latestSerial = Math.max(this.latestSerial, state.serial); this.activeSerial = null;
      return this.idleFrame();
    }
    this.latestSerial = state.serial; this.activeSerial = state.serial;
    const pose = weaponActionPose(state, serverNow);
    const visibility: Record<string, boolean> = {};
    this.move("magazine", 0, -0.16 * pose.magazine, 0);
    this.move("bolt", 0, 0, -0.085 * pose.bolt);
    const relock = pose.boltLock > 0 ? 1 - pose.boltLock : 0;
    this.rotate("bolt", 0, 0, -1.05 * Math.max(pose.boltLift, pose.boltPull, pose.boltReturn, relock));
    this.move("slide", 0, 0, -0.055 * Math.max(pose.bolt, pose.chargeReach));
    this.move("pump", 0, 0, -0.12 * pose.pump);
    this.move("shell", 0.028 * pose.shell, 0.055 * pose.shell, -0.018 * pose.shell);
    this.move("clip", 0, -0.07 * pose.clip, -0.012 * pose.clip);
    this.setVisible("magazine", true, visibility);
    this.setVisible("shell", pose.shell > 0.02, visibility);
    this.setVisible("clip", pose.clip > 0.02, visibility);
    const left = this.leftContact(state, pose);
    const boltHand = Math.max(pose.bolt, pose.boltLift, pose.boltPull, pose.boltReturn, pose.boltLock);
    const right = this.key === "bolt_service_rifle" && boltHand > .02 && pose.clip <= .02
      ? "bolt_hand" : "grip_r";
    return Object.freeze({
      mode: "contract" as const, active: true, phase: pose.phase,
      authoritativeEndsAt: state.endsAt, leftHandTarget: left,
      rightHandTarget: right, partVisibility: Object.freeze(visibility),
      animationClip: "reload", animationProgress: pose.progress,
    });
  }

  reset(): void { this.restoreParts(); this.cancelActive(); }

  target(name: string): T.Object3D | null { return this.handTargets.get(name) ?? this.nodes.get(name) ?? null; }

  private idleFrame(): WeaponPresentationFrame {
    return Object.freeze({
      mode: "contract", active: false, phase: "idle", authoritativeEndsAt: null,
      leftHandTarget: "grip_l", rightHandTarget: "grip_r", partVisibility: Object.freeze(this.currentVisibility()),
      animationClip: "ready", animationProgress: .5,
    });
  }

  private leftContact(state: WeaponActionState, pose: ReturnType<typeof weaponActionPose>): string {
    if (this.key === "pump_shotgun") return state.kind === "cycle" ? "pump" : pose.shell > 0.02 ? "shell" : state.phase === "reload_insert" ? "chamber" : "grip_l";
    if (this.key === "bolt_service_rifle") return state.kind === "cycle" ? "grip_l" : pose.clip > 0.02 ? "clip" : "grip_l";
    if (pose.bolt > 0.02 || pose.chargeReach > 0.02) return this.key === "service_pistol" ? "slide" : "chamber";
    if (pose.magazine > 0.02) return "magazine";
    return pose.reach > 0.02 ? "magwell" : "grip_l";
  }

  private move(name: string, x: number, y: number, z: number): void {
    const node = this.nodes.get(name);
    if (node !== undefined) { node.position.x += x; node.position.y += y; node.position.z += z; }
  }

  private rotate(name: string, x: number, y: number, z: number): void {
    const node = this.nodes.get(name);
    if (node === undefined) return;
    node.rotateX(x); node.rotateY(y); node.rotateZ(z);
  }

  private setVisible(name: string, visible: boolean, output: Record<string, boolean>): void {
    const node = this.nodes.get(name);
    if (node === undefined) return;
    node.visible = visible; output[name] = visible;
  }

  private currentVisibility(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const baseline of this.baselines) result[baseline.node.name] = baseline.node.visible;
    return result;
  }

  private restoreParts(): void {
    for (const baseline of this.baselines) {
      baseline.node.position.copy(baseline.position);
      baseline.node.quaternion.copy(baseline.quaternion);
      baseline.node.scale.copy(baseline.scale);
      baseline.node.visible = baseline.visible;
    }
  }

  private cancelActive(): void {
    if (this.activeSerial !== null) this.latestSerial = Math.max(this.latestSerial, this.activeSerial);
    this.activeSerial = null;
  }
}
