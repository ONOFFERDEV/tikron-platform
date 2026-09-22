import * as THREE from "three";

/** Identity palm basis: +Y toward the wrist, +Z across the knuckles, +X normal. */
export function addWeaponPalm(hand: THREE.Bone, suffix: string): void {
  for (const [name, z] of [["thumb", 0], ["indexFinger", -.025], ["finger", .025]] as const) {
    const joint = new THREE.Bone();
    joint.name = `${name}_01_${suffix.toLowerCase()}`;
    joint.position.set(0, -.045, z);
    hand.add(joint);
  }
}
