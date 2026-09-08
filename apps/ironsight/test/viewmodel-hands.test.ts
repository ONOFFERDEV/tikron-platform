import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { ViewmodelHands } from '../client/viewmodel-hands.js';

describe('tailored first-person hands', () => {
  it('keeps finite outward sleeve surfaces within six texture-free draws', () => {
    const hands = new ViewmodelHands(), meshes: T.Mesh[] = [];
    hands.group.traverse(o => { if (o instanceof T.Mesh) meshes.push(o); });
    expect(meshes).toHaveLength(6);
    let triangles = 0;
    for (const mesh of meshes) {
      const g = mesh.geometry, p = g.getAttribute('position');
      expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
      expect(g.getAttribute('color').count).toBe(p.count);
      expect((mesh.material as T.MeshStandardMaterial).map).toBeNull();
      triangles += (g.index?.count ?? p.count) / 3;
    }
    expect(triangles).toBeLessThan(4000);
    const sleeve = meshes[1]!.geometry, p = sleeve.getAttribute('position'), n = sleeve.getAttribute('normal');
    for (let i = 0; i < p.count; i++)
      expect(p.getX(i) * n.getX(i) + p.getZ(i) * n.getZ(i)).toBeGreaterThan(0);
  });

  it.each([0, 1, 2, 3, 4])('keeps slot %s wrists continuous and buffers stable through reload and cancellation', weapon => {
    const hands = new ViewmodelHands();
    hands.update(weapon, null);
    const palms = hands.group.children.filter(o => o instanceof T.Group);
    const idle = palms.map(p => p.position.clone());
    const buffers: T.BufferGeometry[] = [];
    hands.group.traverse(o => { if (o instanceof T.Mesh) buffers.push(o.geometry); });
    let previous = palms[1]!.position.clone();
    for (let frame = 0; frame <= 240; frame++) {
      hands.update(weapon, frame / 240);
      expect(palms[0]!.position.distanceTo(idle[0]!)).toBeLessThan(1e-10);
      expect(palms[1]!.position.distanceTo(previous)).toBeLessThan(.035);
      previous.copy(palms[1]!.position);
      hands.group.updateMatrixWorld(true);
      hands.group.traverse(o => expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true));
    }
    hands.update(weapon, .4); hands.update(weapon, null);
    palms.forEach((p, i) => expect(p.position.distanceTo(idle[i]!)).toBeLessThan(1e-10));
    const after: T.BufferGeometry[] = [];
    hands.group.traverse(o => { if (o instanceof T.Mesh) after.push(o.geometry); });
    after.forEach((g, i) => expect(g).toBe(buffers[i]));
  });
});
