import * as THREE from 'three';
import { GAME } from '../src/game-config.js';
import type { MapSurface } from '../src/map/materials.js';

type Vec3 = { readonly x: number; readonly y: number; readonly z: number };
type ImpactTarget = MapSurface | 'player';
const SURFACES = {
  mud: { fragment: 0x655644, dust: 0x91816a },
  gravel: { fragment: 0x8d887b, dust: 0xb2ad9b },
  wood: { fragment: 0x826548, dust: 0xb09b79 },
  metal: { fragment: GAME.palette.impactSpark, dust: 0x968c7b },
  concrete: { fragment: 0xa6a294, dust: 0xc0baaa },
} as const satisfies Record<MapSurface, { readonly fragment: number; readonly dust: number }>;
const FORWARD = new THREE.Vector3(0, 0, 1);

// Mutable slots are reused for the lifetime of the scene, including shader uniforms.
type Particle = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  softness: { value: number };
  velocity: THREE.Vector3;
  origin: THREE.Vector3;
  size: THREE.Vector3;
  born: number;
  life: number;
  gravity: number;
  dust: boolean;
};

export class SceneImpact {
  private readonly geometry = new THREE.SphereGeometry(.035, 6, 5);
  private readonly particles: Particle[];
  private cursor = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.particles = Array.from({ length: 48 }, () => {
      const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const softness = { value: 0 };
      material.onBeforeCompile = shader => {
        shader.uniforms.impactSoftness = softness;
        shader.vertexShader = `varying vec3 impactNormal;\n${shader.vertexShader}`.replace(
          '#include <begin_vertex>', '#include <begin_vertex>\nimpactNormal = normalMatrix * normal;',
        );
        shader.fragmentShader = `uniform float impactSoftness;\nvarying vec3 impactNormal;\n${shader.fragmentShader}`.replace(
          '#include <color_fragment>',
          '#include <color_fragment>\nfloat edge = smoothstep(0.08, 0.85, abs(normalize(impactNormal).z));\ndiffuseColor.a *= mix(1.0, edge * edge, impactSoftness);',
        );
      };
      material.customProgramCacheKey = () => 'pooled-impact-soft-edge-v1';
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, softness, velocity: new THREE.Vector3(), origin: new THREE.Vector3(),
        size: new THREE.Vector3(), born: 0, life: 0, gravity: 0, dust: false };
    });
  }

  spawn(position: Vec3, direction: Vec3, target: ImpactTarget): void {
    const player = target === 'player';
    const surface = SURFACES[player ? 'concrete' : target];
    const metal = target === 'metal';
    const directionVector = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
    const born = performance.now();
    for (let index = 0; index < (player ? 5 : 7); index++) {
      const slot = this.particles[this.cursor];
      if (!slot) throw new RangeError('Impact pool cursor outside its fixed capacity');
      this.cursor = (this.cursor + 1) % this.particles.length;
      const dust = !player && index >= 4;
      const contact = !player && index === 0;
      const hot = metal && !dust;
      const speed = player ? 1.4 : dust ? .75 : contact ? 0 : metal ? 3.8 : 2.2;
      slot.velocity.copy(directionVector).negate().addScaledVector(
        new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5), .9,
      ).normalize().multiplyScalar(speed * (.5 + Math.random()));
      slot.mesh.position.set(position.x, position.y, position.z);
      slot.origin.copy(slot.mesh.position);
      slot.mesh.material.color.setHex(player ? GAME.palette.impactBlood : dust ? surface.dust
        : hot && contact ? 0xfff0c0 : surface.fragment);
      slot.mesh.material.blending = hot ? THREE.AdditiveBlending : THREE.NormalBlending;
      slot.size.set(player ? .7 : dust ? 4.2 : contact ? 2.4 : metal ? .22 : .8,
        player ? .7 : dust ? 3.3 : contact ? 2.4 : metal ? .22 : .55,
        player ? 1.8 : dust ? 3.8 : contact ? .6 : metal ? 4.8 : 1.5);
      slot.mesh.scale.copy(slot.size);
      if (slot.velocity.lengthSq() > 0) {
        slot.mesh.quaternion.setFromUnitVectors(FORWARD, slot.velocity.clone().normalize());
      } else slot.mesh.quaternion.identity();
      slot.mesh.material.opacity = dust ? .42 : 1;
      slot.softness.value = dust ? 1 : 0;
      slot.life = player ? 340 : dust ? 480 : contact ? 65 : 180 + index * 25;
      slot.gravity = player ? -7 : dust ? -.6 : contact ? 0 : metal ? -4 : -7;
      slot.born = born;
      slot.dust = dust;
      slot.mesh.visible = true;
    }
  }

  update(now: number): void {
    for (const slot of this.particles) {
      if (!slot.mesh.visible) continue;
      const age = Math.max(0, now - slot.born);
      if (age >= slot.life) { slot.mesh.visible = false; continue; }
      const seconds = age / 1000, progress = age / slot.life;
      slot.mesh.position.copy(slot.origin).addScaledVector(slot.velocity, seconds);
      slot.mesh.position.y += .5 * slot.gravity * seconds * seconds;
      slot.mesh.scale.copy(slot.size).multiplyScalar(slot.dust ? 1 + progress * 3 : 1 - progress * .55);
      slot.mesh.material.opacity = slot.dust ? .42 * (1 - progress) ** 2 : (1 - progress) ** 1.5;
    }
  }

  dispose(): void {
    if (this.particles.length === 0) return;
    for (const slot of this.particles) { this.scene.remove(slot.mesh); slot.mesh.material.dispose(); }
    this.particles.length = 0;
    this.geometry.dispose();
  }
}
