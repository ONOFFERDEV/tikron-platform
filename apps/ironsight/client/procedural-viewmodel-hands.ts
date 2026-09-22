import * as T from "three";
import { equipmentFinish } from "./equipment-finish.js";
import { cuffGeometry, gloveGeometry, sleeveGeometry } from "./hand-geometry.js";
import { reloadPose } from "./reload-presentation.js";

const WRISTS = [
  { right: [0.021, -0.057, -0.17], left: [-0.014, -0.043, -0.51] },
  { right: [0.021, -0.057, -0.28], left: [-0.014, -0.043, -0.40] },
  { right: [0.021, -0.057, -0.28], left: [-0.014, -0.043, -0.43] },
  { right: [0.021, -0.057, -0.28], left: [-0.014, -0.043, -0.45] },
  { right: [0.021, -0.057, -0.28], left: [-0.020, -0.058, -0.30] },
] as const;
const WEAPON_SCALES = [0.65, 0.75, 0.5, 0.38, 0.85] as const;
const RELOAD_CONTACTS = [[-0.014, -0.07, -0.435], [0.01, -0.02, -0.28],
  [-0.014, -0.045, -0.377], [-0.014, -0.105, -0.26]] as const;
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
          this.wrist.lerp(this.elbow.set(-.014, -.085, -.355), pose.reach);
          this.wrist.x += pose.magazine * .052;
          this.wrist.y -= pose.magazine * .221;
          this.wrist.lerp(this.elbow.set(.035, .012, -.14 + pose.bolt * .045), pose.chargeReach);
        }
      }
      if (!right && index > 0) {
        const contact = RELOAD_CONTACTS[index - 1]!;
        this.wrist.lerp(this.elbow.fromArray(contact), pose.reach);
        const scale = WEAPON_SCALES[index]!;
        this.wrist.x += pose.magazine * (index === 2 ? .32 : .08) * scale;
        this.wrist.y -= pose.magazine * (index === 2 ? .04 : .34) * scale;
        this.wrist.lerp(this.elbow.set(index === 4 ? -.025 : .035, .045, -.3 + pose.bolt * .05), pose.bolt);
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
