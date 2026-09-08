import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { applyConcreteDetail, createConcreteDetail } from '../client/concrete-detail.js';

describe('Relay concrete detail', () => {
  it('preserves cover geometry and existing paint/AO UVs with metric detail on transformed faces', () => {
    const geometry = new T.BoxGeometry(2, 3, 4);
    const positions = geometry.getAttribute('position').array.slice();
    const normals = geometry.getAttribute('normal').array.slice();
    const uv = geometry.getAttribute('uv').clone();
    geometry.setAttribute('uv1', uv.clone());
    const ao = geometry.getAttribute('uv1').array.slice();
    const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial());
    mesh.rotation.y = Math.PI / 2; mesh.position.set(7, 2, 11);
    const detail = createConcreteDetail();
    applyConcreteDetail(mesh, detail);
    expect(geometry.getAttribute('position').array).toEqual(positions);
    expect(geometry.getAttribute('normal').array).toEqual(normals);
    expect(geometry.getAttribute('uv').array).toEqual(uv.array);
    expect(geometry.getAttribute('uv1').array).toEqual(ao);
    const projected = geometry.getAttribute('uv2');
    expect([...projected.array].every(Number.isFinite)).toBe(true);
    // Every rectangle retains its real size, regardless of its axis/rotation.
    for (let face = 0; face < 6; face++) {
      const a = face * 4, b = a + 1;
      const length = new T.Vector3().fromBufferAttribute(geometry.getAttribute('position'), a)
        .distanceTo(new T.Vector3().fromBufferAttribute(geometry.getAttribute('position'), b));
      expect(Math.hypot(projected.getX(a) - projected.getX(b), projected.getY(a) - projected.getY(b)) * 0.8)
        .toBeCloseTo(length, 5);
    }
  });

  it('shares bounded mipmapped data without touching painted material colors', () => {
    const detail = createConcreteDetail();
    const floor = new T.Mesh(new T.PlaneGeometry(60, 40), new T.MeshStandardMaterial({ map: new T.Texture() }));
    const wall = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial({ color: 0xb4b7ae }));
    const paint = floor.material.map, color = wall.material.color.clone();
    applyConcreteDetail(floor, detail); applyConcreteDetail(wall, detail);
    expect(floor.material.map).toBe(paint);
    expect(wall.material.color).toEqual(color);
    expect(floor.material.normalMap).toBe(wall.material.normalMap);
    expect(floor.material.roughnessMap).toBe(wall.material.roughnessMap);
    let bytes = 0;
    for (const texture of Object.values(detail)) {
      expect(texture.image.data).not.toBeNull();
      bytes += texture.image.data!.byteLength;
      expect(texture.generateMipmaps).toBe(true);
      expect(texture.colorSpace).toBe(T.NoColorSpace);
      expect(texture.channel).toBe(2);
    }
    expect(bytes * 4 / 3).toBeLessThan(0.18 * 1024 * 1024);
  });
});
