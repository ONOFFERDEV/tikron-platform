import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { buildUndertowEnvironment } from '../client/undertow-environment.js';
import { assertVisualScene } from '../client/site-architecture.js';
import { ARENA2 } from '../src/map/arena2.js';

function exteriorInstances(scene) {
  const instances = [];
  scene.updateMatrixWorld(true);
  scene.traverse(node => {
    if (!(node instanceof T.InstancedMesh)) return;
    node.geometry.computeBoundingBox();
    if (!node.geometry.boundingBox) return;
    for (let index = 0; index < node.count; index++) {
      const matrix = new T.Matrix4();
      node.getMatrixAt(index, matrix);
      matrix.premultiply(node.matrixWorld);
      const bounds = node.geometry.boundingBox.clone().applyMatrix4(matrix);
      if (bounds.max.x <= .02 || bounds.min.x >= 149.98 || bounds.max.z <= .02 || bounds.min.z >= 99.98)
        instances.push({ mesh: node, bounds, triangles: (node.geometry.index?.count ?? 0) / 3 });
    }
  });
  return instances;
}

describe('Underpass period skyline', () => {
  it('replaces external cylindrical process vessels with original masonry and timber silhouettes', () => {
    const scene = new T.Scene();

    buildUndertowEnvironment(scene, ARENA2, true);

    const cylinders = exteriorInstances(scene).filter(({ mesh, bounds }) =>
      mesh.geometry instanceof T.CylinderGeometry && bounds.max.y > 5);
    expect(cylinders).toEqual([]);
  });

  it('preserves the authoritative shell and keeps roof damage outside the play volume', () => {
    const scene = new T.Scene();

    buildUndertowEnvironment(scene, ARENA2, true);

    expect(() => assertVisualScene(ARENA2, scene)).not.toThrow();
    const exterior = exteriorInstances(scene);
    expect(exterior.reduce((total, part) => total + part.triangles, 0)).toBeLessThan(14000);
    for (const part of exterior) expect(part.bounds.isEmpty()).toBe(false);
  });

  it('keeps distinct north and west landmarks above the enclosing buildings without new lights or textures', () => {
    const scene = new T.Scene();

    buildUndertowEnvironment(scene, ARENA2, true);

    const exterior = exteriorInstances(scene);
    expect(exterior.some(({ bounds }) => bounds.max.z < 0 && bounds.min.x < 75 && bounds.max.x > 75 && bounds.max.y > 23)).toBe(true);
    expect(exterior.some(({ bounds }) => bounds.max.x < 0 && bounds.max.y > 18)).toBe(true);
    scene.traverse(node => {
      expect(node instanceof T.Light).toBe(false);
      if (node instanceof T.Mesh && node.material instanceof T.MeshStandardMaterial) expect(node.material.map).toBeNull();
    });
  });
});
