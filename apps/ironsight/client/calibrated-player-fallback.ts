import * as THREE from "three";

import type { HitRigPoseSample } from "../src/hit-rig-pose.js";
import type { Stage33Faction } from "../src/stage33-hit-calibration.js";

export interface CalibratedPlayerFallbackOptions {
  readonly id: string;
  readonly faction: Stage33Faction;
  readonly bodyRadius: number;
}

export interface CalibratedPlayerFallback {
  readonly group: THREE.Group;
  readonly body: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  readonly head: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  update(sample: HitRigPoseSample): boolean;
  dispose(): void;
}

const FACTION_COLORS = {
  khaki: { uniform: 0x6f6843, helmet: 0x535437, equipment: 0x3f3a27 },
  fieldgrey: { uniform: 0x59615b, helmet: 0x454d48, equipment: 0x353b37 },
} as const satisfies Record<Stage33Faction, Readonly<Record<string, number>>>;
const SKIN_COLOR = new THREE.Color(0xb58a67);

function nonRaycast(mesh: THREE.Mesh): void {
  mesh.raycast = () => undefined;
}

function makeHead(faction: Stage33Faction): THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> {
  const geometry = new THREE.SphereGeometry(1, 16, 12);
  const positions = geometry.getAttribute("position");
  const helmet = new THREE.Color(FACTION_COLORS[faction].helmet);
  const colors: number[] = [];
  for (let vertex = 0; vertex < positions.count; vertex += 1) {
    const color = positions.getY(vertex) > 0.18 ? helmet : SKIN_COLOR;
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  return new THREE.Mesh(geometry, material);
}

function makeCosmetic(
  geometry: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
  name: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  nonRaycast(mesh);
  return mesh;
}

function validSample(sample: HitRigPoseSample): boolean {
  const { headCenter, bodyTopY } = sample.hitVolume;
  return [headCenter.x, headCenter.y, headCenter.z, bodyTopY, sample.headRadius,
    sample.bodyRadiusUpperBound, sample.groundOffsetY].every(Number.isFinite)
    && bodyTopY > 0 && sample.headRadius > 0 && sample.bodyRadiusUpperBound >= 0;
}

export function createCalibratedPlayerFallback(
  options: CalibratedPlayerFallbackOptions,
): CalibratedPlayerFallback | undefined {
  if (options.id.trim().length === 0 || !Number.isFinite(options.bodyRadius) || options.bodyRadius <= 0)
    return undefined;
  const colors = FACTION_COLORS[options.faction];
  if (colors === undefined) return undefined;

  const group = new THREE.Group();
  group.name = `calibrated-fallback:${options.id}`;
  group.visible = false;
  const uniform = new THREE.MeshStandardMaterial({ color: colors.uniform, roughness: 0.9 });
  const equipment = new THREE.MeshStandardMaterial({ color: colors.equipment, roughness: 0.96 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), uniform);
  const head = makeHead(options.faction);
  body.name = "calibrated-fallback-body";
  head.name = "calibrated-fallback-head";
  body.userData.victimId = options.id;
  body.userData.part = "body";
  head.userData.victimId = options.id;
  head.userData.part = "head";

  const leftLeg = makeCosmetic(new THREE.CylinderGeometry(0.07, 0.075, 1, 6), uniform,
    "calibrated-fallback-leg-left");
  const rightLeg = makeCosmetic(new THREE.CylinderGeometry(0.07, 0.075, 1, 6), uniform,
    "calibrated-fallback-leg-right");
  const leftArm = makeCosmetic(new THREE.CylinderGeometry(0.05, 0.055, 1, 6), uniform,
    "calibrated-fallback-arm-left");
  const rightArm = makeCosmetic(new THREE.CylinderGeometry(0.05, 0.055, 1, 6), uniform,
    "calibrated-fallback-arm-right");
  const pack = makeCosmetic(new THREE.BoxGeometry(0.22, 1, 0.07), equipment,
    "calibrated-fallback-equipment");
  const topCap = makeCosmetic(new THREE.CircleGeometry(1, 16), uniform,
    "calibrated-fallback-body-cap");
  topCap.rotation.x = -Math.PI / 2;
  group.add(body, head, leftLeg, rightLeg, leftArm, rightArm, pack, topCap);

  let disposed = false;
  return {
    group,
    body,
    head,
    update(sample) {
      if (disposed || !validSample(sample)) return false;
      const top = sample.hitVolume.bodyTopY;
      body.position.set(0, top / 2, 0);
      body.scale.set(options.bodyRadius, top, options.bodyRadius);
      head.position.set(sample.hitVolume.headCenter.x, sample.hitVolume.headCenter.y,
        sample.hitVolume.headCenter.z);
      head.scale.setScalar(sample.headRadius);

      const legHeight = Math.min(0.68, top * 0.48);
      leftLeg.position.set(-options.bodyRadius * 0.3, legHeight / 2, -options.bodyRadius * 0.72);
      rightLeg.position.set(options.bodyRadius * 0.3, legHeight / 2, -options.bodyRadius * 0.72);
      leftLeg.scale.set(1, legHeight, 1);
      rightLeg.scale.set(1, legHeight, 1);
      const armHeight = Math.min(0.72, top * 0.5);
      leftArm.position.set(-options.bodyRadius * 0.6, top * 0.63, -options.bodyRadius * 0.6);
      rightArm.position.set(options.bodyRadius * 0.6, top * 0.63, -options.bodyRadius * 0.6);
      leftArm.scale.set(1, armHeight, 1);
      rightArm.scale.set(1, armHeight, 1);
      pack.position.set(0, top * 0.58, options.bodyRadius * 0.87);
      pack.scale.set(1, Math.min(0.48, top * 0.34), 1);
      topCap.position.set(0, top, 0);
      topCap.scale.setScalar(options.bodyRadius);
      group.visible = true;
      group.updateMatrixWorld(true);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        const owned = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of owned) materials.add(material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      group.clear();
      group.visible = false;
    },
  };
}
