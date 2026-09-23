import * as T from "three";
import { equipmentFinish } from "./equipment-finish.js";
import { cuffGeometry, gloveGeometry, sleeveGeometry } from "./hand-geometry.js";
import { reloadPose } from "./reload-presentation.js";

// Wrist and reload contacts are fitted to the shipped legacy meshes (field-carbine,
// wep_*): each glove touches its grip, foregrip, magazine or bolt with <= 2 mm overlap.
// Measurement and fitter: .inspect/kit-r2/{measure,fit}.ts (Session 6).
const WRISTS = [
  { right: [0.017, -0.065, -0.176], left: [-0.014, -0.043, -0.51] },
  { right: [0.045, -0.060, -0.28], left: [-0.014, -0.052, -0.38] },
  { right: [0.036, -0.058, -0.28], left: [-0.034, -0.059, -0.43] },
  { right: [0.011, -0.058, -0.281], left: [-0.019, -0.047, -0.45] },
  { right: [0.043, -0.057, -0.28], left: [-0.031, -0.064, -0.304] },
] as const;
const WEAPON_SCALES = [0.65, 0.75, 0.5, 0.38, 0.85] as const;
const RELOAD_CONTACTS = [[-0.027, -0.072, -0.445], [0.033, -0.03, -0.27],
  [-0.007, -0.045, -0.38], [-0.025, -0.105, -0.28]] as const;
/** Support hand on the bolt/slide at full bolt travel, slots 1-4. */
const BOLT_CONTACTS = [[0.035, 0.044, -0.244], [0.059, 0.061, -0.242],
  [0.041, 0.052, -0.246], [-0.056, 0.050, -0.244]] as const;
/** Mid-travel detour for the support hand, per slot: applied with 4t(1-t) of each travel
 * (reach and bolt) so both ends of every reach are unchanged and the hand
 * passes below/outside the receiver instead of through it (.inspect/kit-r4/detour.ts). */
const TRAVEL_DETOURS = [[0, 0, 0], [-0.06, -0.09, 0], [0, -0.06, 0.04],
  [-0.03, -0.03, 0], [-0.03, -0.09, 0]] as const;
const bump = (t: number): number => 4 * t * (1 - t);
const CARBINE_MAGAZINE: readonly [number, number, number] = [-0.014, -0.061, -0.319];
const CARBINE_CHARGE: readonly [number, number, number] = [0.068, -0.012, -0.14];
const gloveMaterial = equipmentFinish(new T.MeshStandardMaterial({ vertexColors: true }), "glove");
const sleeveMaterial = equipmentFinish(new T.MeshStandardMaterial({ vertexColors: true }), "fabric");
const cuffMaterial = equipmentFinish(new T.MeshStandardMaterial({ vertexColors: true }), "fabric");

export class ViewmodelHands {
  readonly group = new T.Group();
  private readonly hands: { palm: T.Group; sleeve: T.Mesh; cuff: T.Mesh; side: number }[] = [];
  private readonly wrist = new T.Vector3();
  private readonly elbow = new T.Vector3();
  private readonly delta = new T.Vector3();
  private readonly up = new T.Vector3(0, 1, 0);

  constructor() {
    for (const side of [1, -1]) {
      const palm = new T.Group();
      const glove = new T.Mesh(gloveGeometry(side), gloveMaterial);
      palm.add(glove);
      const sleeve = new T.Mesh(sleeveGeometry(), sleeveMaterial);
      const cuff = new T.Mesh(cuffGeometry(), cuffMaterial);
      this.group.add(palm, sleeve, cuff);
      this.hands.push({ palm, sleeve, cuff, side });
    }
  }

  update(index: number, progress: number | null, issuedCarbine = false): void {
    const pose = reloadPose(progress);
    for (const { palm, sleeve, cuff, side } of this.hands) {
      const right = side === 1;
      const fit = WRISTS[index] ?? WRISTS[0]!;
      const wrist = right ? fit.right : fit.left;
      this.wrist.set(wrist[0], wrist[1], wrist[2]);
      if (!right && index === 0) {
        this.wrist.z += pose.reach * .15 + pose.bolt * .28;
        this.wrist.y -= pose.reach * .07 + pose.magazine * .2;
        this.wrist.x += pose.magazine * .052;
        this.wrist.y += pose.bolt * .13;
        if (issuedCarbine) {
          this.wrist.set(fit.left[0], fit.left[1], fit.left[2]);
          this.wrist.lerp(this.elbow.fromArray(CARBINE_MAGAZINE), pose.reach);
          this.wrist.x += pose.magazine * .052;
          this.wrist.y -= pose.magazine * .221;
          this.wrist.lerp(this.elbow.set(CARBINE_CHARGE[0], CARBINE_CHARGE[1], CARBINE_CHARGE[2] + pose.bolt * .045), pose.chargeReach);
        }
      }
      if (!right && index > 0) {
        const contact = RELOAD_CONTACTS[index - 1]!;
        this.wrist.lerp(this.elbow.fromArray(contact), pose.reach);
        const scale = WEAPON_SCALES[index]!;
        this.wrist.x += pose.magazine * (index === 2 ? .32 : .08) * scale;
        this.wrist.y -= pose.magazine * (index === 2 ? .04 : .34) * scale;
        const bolt = BOLT_CONTACTS[index - 1]!;
        this.wrist.lerp(this.elbow.set(bolt[0], bolt[1], bolt[2] - (1 - pose.bolt) * .05), pose.bolt);
      }
      if (!right) {
        const detour = TRAVEL_DETOURS[index] ?? TRAVEL_DETOURS[0]!;
        // Carbine: no detour. Its charge-handle return runs a narrow corridor past the magazine;
        // every detour that fits the frame-continuity bound made some sample worse (Session 8).
        const travel = bump(pose.reach) + bump(pose.bolt);
        this.wrist.x += detour[0] * travel; this.wrist.y += detour[1] * travel; this.wrist.z += detour[2] * travel;
      }
      palm.position.copy(this.wrist);
      palm.rotation.set(right ? -.18 : -.25, 0, right ? -.1 : .45);
      this.elbow.set(side * .27, -.35, .08);
      this.delta.subVectors(this.wrist, this.elbow);
      const length = this.delta.length();
      sleeve.position.copy(this.elbow).addScaledVector(this.delta, .5 - .018 / length);
      sleeve.scale.y = length - .036;
      sleeve.quaternion.setFromUnitVectors(this.up, this.delta.normalize());
      cuff.position.copy(this.wrist).addScaledVector(this.delta, -.035);
      cuff.quaternion.copy(sleeve.quaternion);
    }
  }
}
