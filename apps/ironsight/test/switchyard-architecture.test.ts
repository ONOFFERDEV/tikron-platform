import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { ARENA3 } from '../src/map/arena3.js';
import { buildSwitchyardEnvironment } from '../client/switchyard-environment.js';

/** Independent envelope checks: changes to dressing must never add invisible
 * cover, punch a hole through an existing solid, or move the playable boundary. */
describe('Switchyard presentation preserves authoritative cover', () => {
  const scene = new T.Scene();
  buildSwitchyardEnvironment(scene, ARENA3, true);
  const colliders = ARENA3.boxes.filter(b=>!ARENA3.signalCore?.doors.includes(b)).map(b => new T.Box3(
    new T.Vector3(b.min.x, b.min.y, b.min.z), new T.Vector3(b.max.x, b.max.y, b.max.z)));
  function instances(prefix: string): T.Box3[] {
    const boxes: T.Box3[] = [];
    scene.traverse(node => {
      if (!(node instanceof T.InstancedMesh) || !node.name.startsWith(prefix)) return;
      node.geometry.computeBoundingBox();
      for (let i = 0; i < node.count; i++) {
        const matrix = new T.Matrix4(); node.getMatrixAt(i, matrix);
        boxes.push(node.geometry.boundingBox!.clone().applyMatrix4(matrix));
      }
    });
    return boxes;
  }
  it('renders every permanent solid exactly and leaves the retractable freight footprint clear', () => {
    const shells = instances('switchyard-shell-');
    expect(shells).toHaveLength(colliders.length);
    for (const collider of colliders) expect(shells.some(shell =>
      shell.min.distanceTo(collider.min) < 0.00001 && shell.max.distanceTo(collider.max) < 0.00001)).toBe(true);
    const weight=ARENA3.signalCore!.chamber;
    const footprint=new T.Box3(new T.Vector3(weight.min.x,.1,weight.min.z),new T.Vector3(weight.max.x,weight.max.y,weight.max.z));
    for(const part of [...shells,...instances('switchyard-cladding-')])expect(part.intersectsBox(footprint)).toBe(false);
  });
  it('keeps every machinery face within 2 cm of an existing collider', () => {
    const envelopes = colliders.map(b => b.clone().expandByScalar(0.02));
    for (const face of instances('switchyard-cladding-'))
      expect(envelopes.some(b => b.containsBox(face)), JSON.stringify(face)).toBe(true);
  });
  it('keeps all skyline and boundary detail outside the playable rectangle', () => {
    for (const b of instances('switchyard-exterior-'))
      expect(b.max.x <= 0 || b.min.x >= ARENA3.bounds.width || b.max.z <= 0 || b.min.z >= ARENA3.bounds.depth,
        JSON.stringify(b)).toBe(true);
  });
  it('uses no lights or animated machinery in the kit', () => {
    const lights: T.Object3D[] = [];
    scene.traverse(node => { if (node instanceof T.Light) lights.push(node); });
    expect(lights).toHaveLength(0);
    expect(scene.animations).toHaveLength(0);
  });
});
