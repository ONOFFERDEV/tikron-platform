import { architectureMeshes } from '../client/site-architecture.js';
import { UNDERTOW_FINISH, undertowBakedFinish } from '../client/undertow-palette.js';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { ARENA2 } from '../src/map/arena2.js';
import { buildUndertowEnvironment } from '../client/undertow-environment.js';

describe('Underpass collision-backed timber revetments', () => {
  it('replaces circular turbine faces on the northern redoubts with timber', () => {
    const scene = new T.Scene();
    buildUndertowEnvironment(scene, ARENA2, true);
    const position = new T.Vector3(), matrix = new T.Matrix4();
    let northernRotors = 0, timberBoards = 0;
    scene.traverse(node => {
      if (!(node instanceof T.InstancedMesh)) return;
      for (let i = 0; i < node.count; i++) {
        node.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
        if (position.x > 0 && position.x < 150 && position.z > 0 && position.z < 44) {
          if (node.geometry instanceof T.CylinderGeometry) northernRotors++;
          const scale = new T.Vector3().setFromMatrixScale(matrix);
          if (['undertow-4-b', 'undertow-5-b'].includes(node.name) && scale.x < .36 && scale.y > 1 && scale.z < .02) {
            timberBoards++;
            expect(ARENA2.boxes.some(b => position.x >= b.min.x && position.x <= b.max.x
              && position.y >= b.min.y && position.y <= b.max.y
              && Math.min(Math.abs(position.z - b.min.z), Math.abs(position.z - b.max.z)) < .02)).toBe(true);
          }
        }
      }
    });
    expect(northernRotors).toBe(0);
    expect(timberBoards).toBeGreaterThan(100);
  });
  it('keeps every timber ground board supported instead of spanning the drain', () => {
    const scene = new T.Scene();
    buildUndertowEnvironment(scene, ARENA2, true);
    const matrix = new T.Matrix4();
    const supported = ARENA2.boxes.filter(box => box.max.y === 0);
    let boards = 0;
    scene.traverse(node => {
      if (!(node instanceof T.InstancedMesh) || !['undertow-4-b', 'undertow-5-b'].includes(node.name)) return;
      for (let i = 0; i < node.count; i++) {
        node.getMatrixAt(i, matrix);
        const box = new T.Box3(new T.Vector3(-.5,-.5,-.5), new T.Vector3(.5,.5,.5)).applyMatrix4(matrix);
        if (Math.abs(box.min.y) > .0001 || box.max.y > .011) continue;
        boards++;
        expect(supported.some(support => box.min.x >= support.min.x - .0001 && box.max.x <= support.max.x + .0001
          && box.min.z >= support.min.z - .0001 && box.max.z <= support.max.z + .0001)).toBe(true);
      }
    });
    expect(boards).toBeGreaterThan(100);
  });
  it('preserves bake material identities when geometry batches change', () => {
    const scene = new T.Scene();
    buildUndertowEnvironment(scene, ARENA2, true);
    const materials = [...new Set(architectureMeshes(scene).map(mesh => mesh.material))];
    materials.forEach((material, index) => {
      const finish = undertowBakedFinish(`undertow-${index}`);
      expect(finish).toBeDefined();
      expect(material.color.getHex()).toBe(UNDERTOW_FINISH[finish].color);
    });
  });
});
