import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { SignalArray } from '../client/signal-array.js';

describe('Signal Station wireless mast', () => {
  it('keeps the open timber aerial below its 1500-triangle landmark budget', () => {
    const scene = new T.Scene();
    new SignalArray(scene, 75);
    let triangles = 0;

    scene.traverse(node => {
      if (node instanceof T.Mesh) triangles += (node.geometry.index?.count ?? node.geometry.getAttribute('position').count) / 3;
    });

    expect(triangles).toBeLessThan(1500);
  });

  it('keeps every solid outside play while signal phases reuse their resources', () => {
    const scene = new T.Scene();
    const signal = new SignalArray(scene, 75);
    const meshes: T.Mesh[] = [];
    scene.traverse(node => { if (node instanceof T.Mesh) meshes.push(node); });
    const resources = meshes.map(mesh => ({ geometry: mesh.geometry, material: mesh.material }));

    for (const phase of ['idle', 'warning', 'blackout', 'recovery'] as const) {
      for (const alignment of [0, 0.5, 1]) {
        signal.update({ phase, alignment, cycle: 1, elapsedMs: 800, remainingMs: 2000 }, false);
        scene.updateMatrixWorld(true);
        for (const [index, mesh] of meshes.entries()) {
          expect(mesh.geometry).toBe(resources[index]?.geometry);
          expect(mesh.material).toBe(resources[index]?.material);
          if (mesh.material instanceof T.Material && !mesh.material.transparent) {
            expect(new T.Box3().setFromObject(mesh).max.z).toBeLessThan(0);
          }
        }
      }
    }
    expect(signal.inspect().textures).toBe(0);
  });
});
