import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { ARENA2 } from '../src/map/arena2.js';
import { buildUndertowEnvironment } from '../client/undertow-environment.js';

function instances(name) {
  const scene = new T.Scene();
  buildUndertowEnvironment(scene, ARENA2, true);
  const result = [], matrix = new T.Matrix4();
  scene.traverse(node => {
    if (!(node instanceof T.InstancedMesh) || node.name !== name) return;
    for (let i = 0; i < node.count; i++) {
      node.getMatrixAt(i, matrix);
      result.push(new T.Box3(new T.Vector3(-.5, -.5, -.5), new T.Vector3(.5, .5, .5)).applyMatrix4(matrix));
    }
  });
  return result;
}

describe('Underpass trench use', () => {
  it('replaces service-bay lamp strips on the deployment trench walls with sandbags', () => {
    const screens = ARENA2.boxes.filter(b => b.min.y === 0 && b.max.y - b.min.y === 3 && b.max.z - b.min.z > 8);
    expect(screens).toHaveLength(4);
    const near = (box, wall) => box.max.x >= wall.min.x - .02 && box.min.x <= wall.max.x + .02
      && box.max.z >= wall.min.z - .02 && box.min.z <= wall.max.z + .02 && box.max.y <= wall.max.y + .02;
    const lamps = instances('undertow-6-b').filter(box => screens.some(wall => near(box, wall)));
    expect(lamps).toEqual([]);
    const bags = instances('undertow-3-b').filter(box => screens.some(wall => near(box, wall)) && box.min.y > 2.2);
    expect(bags.length).toBeGreaterThan(100);
  });

  it('lays drain duckboards on the real -3 m floor, clear of the pump baffles', () => {
    const floor = ARENA2.terrain.faces.find(face => face.y === -3);
    const baffles = ARENA2.boxes.filter(b => b.min.y <= -3 && !ARENA2.terrain.boxes.includes(b));
    const boards = [...instances('undertow-4-b'), ...instances('undertow-5-b')]
      .filter(box => Math.abs(box.min.y + 3) < .0001 && box.max.y < -2.98);
    expect(boards.length).toBeGreaterThan(100);
    for (const box of boards) {
      expect(box.min.x >= floor.minX && box.max.x <= floor.maxX && box.min.z >= floor.minZ && box.max.z <= floor.maxZ).toBe(true);
      expect(baffles.some(b => box.max.x > b.min.x && box.min.x < b.max.x && box.max.z > b.min.z && box.min.z < b.max.z)).toBe(false);
    }
  });
});
