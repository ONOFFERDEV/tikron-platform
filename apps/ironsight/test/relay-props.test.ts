import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { placeRelayUplinks } from '../client/relay-props.js';

describe('generated Relay uplink placement', () => {
  it('grounds offset/rotated source bounds and keeps both shared instances outside play', () => {
    const source = new T.Group();
    const mesh = new T.Mesh(new T.BoxGeometry(3, 6, 2), new T.MeshStandardMaterial());
    mesh.position.set(12, -7, 4); mesh.rotation.y = 0.35; source.add(mesh);
    source.position.set(-9, 3, 2); source.scale.setScalar(0.7);
    const groups = placeRelayUplinks(source);
    expect(groups).toHaveLength(2);
    for (const [i, group] of groups.entries()) {
      const box = new T.Box3().setFromObject(group), size = box.getSize(new T.Vector3());
      expect(box.min.y).toBeCloseTo(0, 6);
      expect(box.getCenter(new T.Vector3()).x).toBeCloseTo([25, 37][i]!, 6);
      expect(box.max.z).toBeLessThanOrEqual(-3.9 + 1e-6);
      expect(size.x).toBeLessThanOrEqual(7 + 1e-6);
      expect(size.y).toBeLessThanOrEqual(11 + 1e-6);
      group.traverse(node => {
        expect(node instanceof T.Light).toBe(false);
        if (node instanceof T.Mesh) {
          expect(node.geometry).toBe(mesh.geometry);
          expect(node.material).toBe(mesh.material);
          expect(node.castShadow && node.receiveShadow).toBe(true);
        }
      });
    }
  });

  it('rejects empty/flat geometry and embedded lights before placement', () => {
    expect(() => placeRelayUplinks(new T.Group())).toThrow('bounds');
    expect(() => placeRelayUplinks(new T.Mesh(new T.PlaneGeometry()))).toThrow('bounds');
    const lit = new T.Group(); lit.add(new T.PointLight());
    expect(() => placeRelayUplinks(lit)).toThrow('lights');
  });
});
