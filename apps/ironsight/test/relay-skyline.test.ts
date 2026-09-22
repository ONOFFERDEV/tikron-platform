import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildRelaySkyline } from '../client/relay-skyline.js';
import { ARENA1 } from '../src/map/arena1.js';

function meshes(root: T.Object3D): T.Mesh[] {
  const result: T.Mesh[] = [];
  root.traverse(node => { if (node instanceof T.Mesh) result.push(node); });
  return result;
}

describe('Signal Station exterior village', () => {
  it('keeps every sector wholly outside playable collision bounds', () => {
    const skyline = buildRelaySkyline(ARENA1.bounds);
    const sectors = meshes(skyline);

    expect(sectors).toHaveLength(4);
    for (const mesh of sectors) {
      const b = new T.Box3().setFromObject(mesh);
      expect(b.max.x < 0 || b.min.x > ARENA1.bounds.width
        || b.max.z < 0 || b.min.z > ARENA1.bounds.depth).toBe(true);
      expect(b.min.y).toBeGreaterThanOrEqual(-0.01);
      expect(b.max.y).toBeLessThanOrEqual(32);
    }
  });

  it('bounds static geometry without adding textures, lights or animation', () => {
    const skyline = buildRelaySkyline(ARENA1.bounds);
    const sectors = meshes(skyline);
    let triangles = 0;
    let lights = 0;
    const materials = new Set<T.Material>();
    skyline.traverse(node => { if (node instanceof T.Light) lights++; });
    for (const mesh of sectors) {
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(mat);
        expect(mat).toBeInstanceOf(T.MeshStandardMaterial);
        if (!(mat instanceof T.MeshStandardMaterial)) continue;
        expect(mat.vertexColors).toBe(true);
        expect(mat.map).toBe(null);
        expect(mat.normalMap).toBe(null);
        expect(mat.transparent).toBe(false);
        expect(mat.metalness).toBe(0);
      }
    }
    expect(triangles).toBeGreaterThan(1000);
    expect(triangles).toBeLessThan(14000);
    expect(materials.size).toBe(1);
    expect(lights).toBe(0);
    expect(skyline.animations).toHaveLength(0);
  });

  it('builds repeatable geometry while leaving the room map unchanged', () => {
    const before = JSON.stringify(ARENA1);
    const first = meshes(buildRelaySkyline(ARENA1.bounds));
    const second = meshes(buildRelaySkyline(ARENA1.bounds));

    expect(first).toHaveLength(4);
    expect(first.map(mesh => Array.from(mesh.geometry.getAttribute('position').array)))
      .toEqual(second.map(mesh => Array.from(mesh.geometry.getAttribute('position').array)));
    expect(JSON.stringify(ARENA1)).toBe(before);
  });
});
