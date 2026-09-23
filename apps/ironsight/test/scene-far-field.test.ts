import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { createFarField } from '../client/scene-far-field.js';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';

const outside = (map: typeof ARENA1, x: number, z: number) =>
  Math.hypot(Math.max(0, -x, x - map.bounds.width), Math.max(0, -z, z - map.bounds.depth));

describe('far field beyond the boundary', () => {
  it.each([ARENA1, ARENA2])('stays well outside the playable rectangle, low near it, in three static unlit-shadow draws', map => {
    const group = createFarField(map)!;
    group.updateMatrixWorld(true);
    let draws = 0, triangles = 0, nearest = Infinity, tallestNear = -Infinity;
    const v = new T.Vector3(), m = new T.Matrix4(), box = new T.Box3();
    group.traverse(node => {
      expect(node).not.toBeInstanceOf(T.Light);
      if (!(node instanceof T.Mesh)) return;
      draws++;
      expect(node.castShadow || node.receiveShadow).toBe(false);
      const positions = node.geometry.getAttribute('position');
      const count = node instanceof T.InstancedMesh ? node.count : 1;
      triangles += positions.count / (node.geometry.index ? 1 : 3) * (node.geometry.index ? node.geometry.index.count / positions.count / 3 : 1) * count;
      if (!(node instanceof T.InstancedMesh)) {
        const normals = node.geometry.getAttribute('normal');
        let up = 0;
        for (let i = 0; i < positions.count; i++) {
          v.fromBufferAttribute(positions, i);
          const o = outside(map, v.x, v.z); nearest = Math.min(nearest, o);
          if (o < 40) tallestNear = Math.max(tallestNear, v.y);
          up += normals.getY(i);
        }
        if (node.name === 'far-field-ground') expect(up / positions.count).toBeGreaterThan(.9); // ground faces the sky
        return;
      }
      for (let i = 0; i < count; i++) {
        node.getMatrixAt(i, m);
        box.setFromBufferAttribute(positions as T.BufferAttribute).applyMatrix4(m);
        for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) {
          const o = outside(map, x, z); nearest = Math.min(nearest, o);
          if (o < 40) tallestNear = Math.max(tallestNear, box.max.y);
        }
      }
    });
    expect(draws).toBe(3);
    expect(triangles).toBeLessThan(20000);
    expect(nearest).toBeGreaterThan(20);   // nothing on or near the boundary
    expect(tallestNear).toBeLessThan(1.5);  // below eye height where it is close
  });

  it('leaves Switchyard and unauthored maps alone', () => {
    expect(createFarField(ARENA3)).toBeUndefined();
  });
});
