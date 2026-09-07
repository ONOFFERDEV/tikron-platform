import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { remoteWeaponTemplate } from '../client/remote-weapon.js';
import { splitRifleMagazine } from '../client/rifle-magazine.js';

describe('reload geometry ownership', () => {
  it.each([1, 2, 3])('extracts the complete slot %s insert without changing cached geometry', weapon => {
    const object = new T.Group();
    const centers = [[0, -0.08, 0.18], [0, 0, -0.045], [0, -0.09, 0.20]] as const;
    const sizes = [[0.025, 0.17, 0.06], [0.09, 0.12, 0.12], [0.025, 0.10, 0.07]] as const;
    const size = sizes[weapon - 1]!, center = centers[weapon - 1]!;
    const source = new T.BoxGeometry(size[0], size[1], size[2]).translate(center[0], center[1], center[2]);
    const before = source.index!.array.slice();
    object.add(new T.Mesh(source, new T.MeshStandardMaterial()));
    const split = splitRifleMagazine(object, weapon);
    expect(split.magazine.children).toHaveLength(1);
    const part = split.magazine.children[0] as T.Mesh;
    expect(part.geometry.index!.count).toBe(before.length);
    expect(source.index!.array).toEqual(before);
    split.magazine.position.y = -0.34;
    expect(source.index!.array).toEqual(before);
    split.owned.forEach(g => g.dispose()); source.dispose();
  });
  it('adds a pistol insert while preserving an integrated frame', () => {
    const object = new T.Group(), source = new T.BoxGeometry(0.05, 0.20, 0.30);
    const mesh = new T.Mesh(source, new T.MeshStandardMaterial()); object.add(mesh);
    const split = splitRifleMagazine(object, 4);
    expect(split.magazine.children).toHaveLength(1);
    expect(mesh.geometry).toBe(source);
    expect(split.owned).not.toContain(source);
    split.owned.forEach(g => g.dispose()); source.dispose();
  });
});

it('shares prepared remote buffers while reload transforms belong to each operator', () => {
  const scene = new T.Group(), node = new T.Group(); node.name = 'test-pistol'; scene.add(node);
  const source = new T.BoxGeometry(0.05, 0.2, 0.3); node.add(new T.Mesh(source));
  const gltf = { scene } as Parameters<typeof remoteWeaponTemplate>[0];
  const template = remoteWeaponTemplate(gltf, node.name, 4)!;
  expect(remoteWeaponTemplate(gltf, node.name, 4)).toBe(template);
  const a = template.object.clone(), b = template.object.clone();
  const magA = a.getObjectByName('rifle-magazine')!, magB = b.getObjectByName('rifle-magazine')!;
  magA.position.y = -0.3;
  expect(magB.position.y).toBe(0);
  expect(template.object.getObjectByName('rifle-magazine')!.position.y).toBe(0);
  expect((magA.children[0] as T.Mesh).geometry).toBe((magB.children[0] as T.Mesh).geometry);
  expect(node.getObjectByName('rifle-magazine')).toBeUndefined();
});
