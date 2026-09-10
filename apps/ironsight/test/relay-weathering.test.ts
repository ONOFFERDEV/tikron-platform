import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { applyRelayWeathering } from '../client/relay-weathering.js';

describe('Relay panel weathering', () => {
  it('uses original ledges across tessellation while preserving the rendered surface', () => {
    const original = new T.PlaneGeometry(2, 4);
    const tessellated = new T.PlaneGeometry(2, 4, 1, 2);
    const expected = tessellated.toNonIndexed();
    const mesh = new T.Mesh(tessellated);
    mesh.position.y = 6;
    applyRelayWeathering(mesh, {
      position: original.getAttribute('position') as T.BufferAttribute,
      index: original.index!,
      parents: new T.Uint16BufferAttribute([0, 1, 0, 1], 1),
    });
    for (const attribute of ['position', 'normal', 'uv'])
      expect(mesh.geometry.getAttribute(attribute).array).toEqual(expected.getAttribute(attribute).array);
    const elevation = mesh.geometry.getAttribute('relayElevation');
    // Each small triangle keeps the entire panel's 4..8m extent, including
    // those whose own vertices only span half its height.
    expect(elevation.count).toBe(12);
    for (let i = 0; i < elevation.count; i++) {
      expect(elevation.getX(i)).toBe(4);
      expect(elevation.getY(i)).toBe(8);
    }
    expect(tessellated.getAttribute('relayElevation')).toBeUndefined();
  });

  it('supports a fresh unsubdivided bake without parent metadata', () => {
    const mesh = new T.Mesh(new T.BoxGeometry(2, 4, 2));
    mesh.position.y = 2;
    applyRelayWeathering(mesh);
    const elevation = mesh.geometry.getAttribute('relayElevation');
    const normals = mesh.geometry.getAttribute('normal');
    for (let i = 0; i < elevation.count; i++) {
      if (normals.getY(i) === 0) {
        expect(elevation.getX(i)).toBe(0);
        expect(elevation.getY(i)).toBe(4);
      } else expect(elevation.getX(i)).toBe(elevation.getY(i));
    }
  });
});
