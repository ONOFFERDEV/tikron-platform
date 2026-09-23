import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneImpact } from '../client/scene-impact.js';

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
  }) }) });
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  vi.spyOn(Math, 'random').mockReturnValue(.7);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const position = { x: 2, y: 3, z: 4 }, direction = { x: 1, y: 0, z: 0 };
function active(scene: THREE.Scene): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] {
  return scene.children.filter((object): object is THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> =>
    object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial && object.visible);
}

describe('surface impact presentation', () => {
  it.each(['mud', 'wood'] as const)('ejects non-emissive fragments when the surface is %s', surface => {
    const scene = new THREE.Scene(), vfx = new SceneImpact(scene);
    vfx.spawn(position, direction, surface);
    expect(active(scene)).toHaveLength(7);
    expect(active(scene).every(p => p.material.blending === THREE.NormalBlending)).toBe(true);
  });

  it('retains a brief hot contact and ricochets when the surface is metal', () => {
    const scene = new THREE.Scene(), vfx = new SceneImpact(scene);
    vfx.spawn(position, direction, 'metal');
    // Hot contact, four sparks and the ring; one faint dust mote.
    expect(active(scene).filter(p => p.material.blending === THREE.AdditiveBlending)).toHaveLength(6);
    vfx.update(1300);
    expect(active(scene)).toHaveLength(1);
    expect(active(scene).every(p => p.material.opacity < .12)).toBe(true);
  });

  it('leaves a bounded dust tail large enough to read when masonry is hit', () => {
    const scene = new THREE.Scene(), vfx = new SceneImpact(scene);
    vfx.spawn(position, direction, 'concrete');
    vfx.update(1300);
    expect(active(scene)).toHaveLength(3);
    for (const particle of active(scene)) {
      expect(particle.scale.x * .07).toBeGreaterThan(.6);
      expect(particle.scale.x * .07).toBeLessThan(1);
      expect(particle.material.depthWrite).toBe(false);
      expect(particle.material.opacity).toBeLessThan(.12);
    }
    vfx.update(1480);
    expect(active(scene)).toHaveLength(0);
  });

  it('keeps shader variants and resources stable when surface and player hits saturate the pool', () => {
    const scene = new THREE.Scene(), vfx = new SceneImpact(scene);
    const objects = [...scene.children];
    const materials = objects.flatMap(o => o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial ? [o.material] : []);
    const keys = materials.map(m => [m.uuid, m.version, m.customProgramCacheKey()]);
    for (const surface of ['wood', 'metal', 'mud', 'gravel', 'concrete'] as const) {
      for (let i = 0; i < 10; i++) vfx.spawn(position, direction, i % 2 === 0 ? 'player' : surface);
    }
    expect(active(scene)).toHaveLength(48);
    expect(scene.children).toEqual(objects);
    expect(materials.map(m => [m.uuid, m.version, m.customProgramCacheKey()])).toEqual(keys);
    vfx.update(1480);
    expect(active(scene)).toHaveLength(0);
  });

  it('uses distinct surface pigments without changing the player-hit response', () => {
    const fragmentColors = new Set<string>();
    const bloodColors = new Set<string>();
    const surfaces = ['wood', 'metal', 'mud', 'gravel', 'concrete', 'brick', 'sandbag'] as const;
    for (const surface of surfaces) {
      const scene = new THREE.Scene(), vfx = new SceneImpact(scene);
      vfx.spawn(position, direction, surface);
      const fragment = active(scene)[1];
      expect(fragment).toBeDefined();
      if (fragment) fragmentColors.add(fragment.material.color.getHexString());
      vfx.update(1800); // the longest surface tail (sandbag puff) is 700ms
      vfx.spawn(position, direction, 'player');
      expect(active(scene)).toHaveLength(5);
      for (const particle of active(scene)) {
        bloodColors.add(particle.material.color.getHexString());
        expect(particle.material.blending).toBe(THREE.NormalBlending);
      }
    }
    expect(fragmentColors.size).toBe(surfaces.length);
    expect(bloodColors.size).toBe(1);
  });

  it('releases the shared impact geometry and materials exactly once on disposal', () => {
    const scene = new THREE.Scene(), vfx = new SceneImpact(scene);
    vfx.spawn(position, direction, 'concrete');
    const particles = active(scene), geometry = particles[0]?.geometry;
    expect(geometry).toBeDefined();
    if (!geometry) throw new Error('Expected active impact geometry');
    expect(new Set(particles.map(p => p.geometry)).size).toBe(1);
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterials = particles.map(p => vi.spyOn(p.material, 'dispose'));
    vfx.dispose();
    vfx.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    for (const dispose of disposeMaterials) expect(dispose).toHaveBeenCalledOnce();
    expect(particles.every(p => !scene.children.includes(p))).toBe(true);
  });

  it('reads masonry as brick only on the brick-built sites', () => {
    const colour = (brickMasonry: boolean) => {
      const scene = new THREE.Scene(), vfx = new SceneImpact(scene, { brickMasonry });
      vfx.spawn(position, direction, 'concrete');
      return active(scene)[1]!.material.color.getHexString();
    };
    expect(colour(true)).not.toBe(colour(false));
  });

  it('keeps every surface to seven pooled particles and stills them under reduced motion', () => {
    for (const surface of ['wood', 'metal', 'mud', 'gravel', 'concrete', 'brick', 'sandbag'] as const) {
      const scene = new THREE.Scene(), vfx = new SceneImpact(scene);
      vfx.spawn(position, direction, surface);
      expect(active(scene)).toHaveLength(7);
      vfx.update(1800);
      vfx.reducedMotion = true;
      vfx.spawn(position, direction, surface);
      vfx.update(1100);
      expect(active(scene).length).toBeGreaterThan(0);
      expect(active(scene).every(p => p.position.toArray().join() === '2,3,4')).toBe(true);
      expect(active(scene).every(p => p.material.blending === THREE.NormalBlending || p.scale.x > 2)).toBe(true);
    }
  });

  it('keeps muzzle-blast dust low and faint so it never hides a torso or acts as cover', () => {
    const scene = new THREE.Scene(), vfx = new SceneImpact(scene);
    const objects = [...scene.children];
    for (let i = 0; i < 40; i++) vfx.muzzleDust({ x: 5, y: 0, z: 5 });
    expect(active(scene)).toHaveLength(12);
    expect(scene.children).toEqual(objects);
    for (const now of [1000, 1200, 1410]) {
      vfx.update(now);
      for (const puff of active(scene)) {
        expect(puff.position.y + puff.scale.y * .035).toBeLessThan(.45);
        expect(puff.material.opacity).toBeLessThanOrEqual(.32);
        expect(puff.material.depthWrite).toBe(false);
      }
    }
    vfx.update(1420); expect(active(scene)).toHaveLength(0);
    vfx.reducedMotion = true; vfx.muzzleDust({ x: 5, y: 0, z: 5 });
    expect(active(scene)).toHaveLength(0);
  });
});
