import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { relayDamageGeometry, relayDamagePatches, relaySandbagGeometry } from '../client/relay-fieldworks.js';

describe('Relay fieldworks authority and packing', () => {
  it('backs every vertical scar with one intact collider and keeps residue flat on open ground', () => {
    const patches = relayDamagePatches(ARENA1), geometry = relayDamageGeometry(ARENA1);
    const positions = geometry.getAttribute('position');
    expect(patches.length).toBe(24);
    for (const [i, patch] of patches.entries()) {
      const bounds = new T.Box3();
      for (let j = 0; j < 4; j++) bounds.expandByPoint(new T.Vector3().fromBufferAttribute(positions, i * 4 + j));
      if (patch.ground) {
        expect(bounds.min.y).toBeCloseTo(.019, 6);
        expect(bounds.max.y).toBeCloseTo(.019, 6);
        expect(ARENA1.boxes.some(b => bounds.min.x < b.max.x && bounds.max.x > b.min.x &&
          bounds.min.z < b.max.z && bounds.max.z > b.min.z)).toBe(false);
      } else {
        expect(ARENA1.boxes.some(b => new T.Box3(new T.Vector3(b.min.x, b.min.y, b.min.z),
          new T.Vector3(b.max.x, b.max.y, b.max.z)).expandByScalar(.02).containsBox(bounds))).toBe(true);
        expect(geometry.getAttribute('normal').getZ(i * 4)).toBeCloseTo(Math.cos(patch.yaw));
      }
    }
    expect(relayDamagePatches(ARENA2)).toEqual([]);
    expect(geometry.index!.count / 3).toBe(48);
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThan(0); expect(uv.getX(i)).toBeLessThan(.5);
      expect(uv.getY(i)).toBeGreaterThan(0); expect(uv.getY(i)).toBeLessThan(.75);
    }
    geometry.dispose();
  });

  it('normalizes transformed source geometry onto the coping without entering play or duplicating a material draw', () => {
    const source = new T.Group(), parent = new T.Group();
    parent.position.set(5, -3, 8); parent.rotation.y = .21; source.add(parent);
    const mesh = new T.Mesh(new T.BoxGeometry(.6, .9, 2.4));
    mesh.position.set(2, 3, -2); parent.add(mesh);
    const original = [...mesh.geometry.getAttribute('position').array];
    const g = relaySandbagGeometry(source, 150), box = g.boundingBox!;
    expect(box.max.z).toBeLessThan(-.05);
    expect(box.min.y).toBeCloseTo(2.89, 5);
    expect(box.max.y).toBeLessThanOrEqual(3.941);
    expect(box.max.z - box.min.z).toBeLessThanOrEqual(1.151);
    expect(box.min.x).toBeGreaterThan(60);
    expect(box.max.x).toBeLessThan(90);
    expect(g.groups).toHaveLength(0);
    expect([...mesh.geometry.getAttribute('position').array]).toEqual(original);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(.5); expect(uv.getX(i)).toBeLessThanOrEqual(1);
      expect(uv.getY(i)).toBeGreaterThanOrEqual(.5); expect(uv.getY(i)).toBeLessThanOrEqual(1);
    }
    g.dispose();
  });

  it('rejects empty, flat, or lit sources before adopting geometry', () => {
    expect(() => relaySandbagGeometry(new T.Group(), 150)).toThrow('bounds');
    expect(() => relaySandbagGeometry(new T.Mesh(new T.PlaneGeometry()), 150)).toThrow('bounds');
    const model = new T.Mesh(new T.BoxGeometry()); model.add(new T.PointLight());
    expect(() => relaySandbagGeometry(model, 150)).toThrow('lights');
  });
});
