/**
 * Selected-target ring: a flat, slowly-spinning ring under the current target's feet
 * (client/main.ts's `targetId`), so a target change reads at a glance instead of only
 * living in the HUD name/health card. Follows whatever unit `main.ts` is currently
 * pointed at — click-selected or auto-selected on getting hit — and hides itself the
 * moment that unit dies or leaves the AOI (`UnitRenderer.get` returning `undefined`).
 */
import * as THREE from "three";
import type { UnitRenderer } from "./units.js";

const INNER_RADIUS = 0.55;
const OUTER_RADIUS = 0.75;
const GROUND_OFFSET = 0.03; // above y=0 to avoid z-fighting with the ground plane
const SPIN_RATE = 0.6; // rad/s — slow enough to read as "alive", not distracting

export interface TargetRing {
  setTarget(id: string | null): void;
  tick(dt: number): void;
}

/** `scene` comes from `UnitRenderer.getScene()` — this never touches `scene.ts` directly. */
export function createTargetRing(scene: THREE.Scene, units: UnitRenderer): TargetRing {
  const geometry = new THREE.RingGeometry(INNER_RADIUS, OUTER_RADIUS, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff5533,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2; // lie flat on the ground; spin is then just rotation.z
  mesh.renderOrder = 10;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.visible = false;
  scene.add(mesh);

  let targetId: string | null = null;

  return {
    setTarget(id) {
      targetId = id;
    },
    tick(dt) {
      const unit = targetId ? units.get(targetId) : undefined;
      if (!unit || unit.dead) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      mesh.position.set(unit.x, GROUND_OFFSET, unit.y);
      mesh.rotation.z += SPIN_RATE * dt;
    },
  };
}
