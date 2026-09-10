import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { cloneWeaponBundleNode } from '../client/weapon-loader.js';
import { remoteWeaponTemplate } from '../client/remote-weapon.js';
import { splitRifleMagazine } from '../client/rifle-magazine.js';

describe('issued equipment resource ownership', () => {
  it('shares secondary finishes in both held views without recolouring the source or generated replacements', () => {
    const scene = new T.Group(), map = new T.Texture();
    const source = new T.MeshStandardMaterial({ map, color: 0xffffff, roughness: .5 });
    const geometry = new T.BoxGeometry(.05,.2,.3);
    for (const name of ['wep_smg','wep_pistol','field-carbine']) {
      const node = new T.Group(); node.name = name;
      node.add(new T.Mesh(geometry,source)); scene.add(node);
    }
    const gltf = { scene } as Parameters<typeof cloneWeaponBundleNode>[0];
    const first = cloneWeaponBundleNode(gltf,'wep_smg')!.children[0] as T.Mesh;
    const remote = remoteWeaponTemplate(gltf,'wep_smg',1)!.object.children[0] as T.Mesh;
    const other = cloneWeaponBundleNode(gltf,'wep_pistol')!.children[0] as T.Mesh;
    const carbine = cloneWeaponBundleNode(gltf,'field-carbine')!.children[0] as T.Mesh;
    expect(first.material).toBe(remote.material);
    expect(first.material).toBe(other.material);
    expect(first.material).not.toBe(source);
    expect((first.material as T.MeshStandardMaterial).map).toBe(map);
    expect(first.geometry).toBe(geometry);
    expect(carbine.material).toBe(source);
    expect((scene.children[0]!.children[0] as T.Mesh).material).toBe(source);
    expect(source.roughness).toBe(.5);
    expect(source.color.getHex()).toBe(0xffffff);
    const material = first.material as T.MeshStandardMaterial;
    expect(material.transparent).toBe(false);
    expect(material.depthTest && material.depthWrite).toBe(true);
    geometry.dispose(); source.dispose(); map.dispose();
  });

  it('keeps finish coordinates and material sharing intact when the magazine moves', () => {
    const scene = new T.Group(), node = new T.Group(); node.name = 'wep_smg'; scene.add(node);
    const geometry = new T.BoxGeometry(.025,.17,.06).translate(0,-.08,.18);
    const source = new T.MeshStandardMaterial(); node.add(new T.Mesh(geometry,source));
    const sourcePositions = geometry.getAttribute('position').array.slice();
    const gltf = { scene } as Parameters<typeof cloneWeaponBundleNode>[0];
    const object = cloneWeaponBundleNode(gltf,node.name)!;
    const material = (object.children[0] as T.Mesh).material;
    const { magazine, owned } = splitRifleMagazine(object,1);
    const mesh = magazine.children[0] as T.Mesh;
    const positions = mesh.geometry.getAttribute('position').array.slice();
    magazine.position.y = -.34;
    object.updateMatrixWorld(true);
    expect(mesh.material).toBe(material);
    expect(mesh.geometry.getAttribute('position').array).toEqual(positions);
    expect(geometry.getAttribute('position').array).toEqual(sourcePositions);
    expect((node.children[0] as T.Mesh).material).toBe(source);
    expect(magazine.children).toHaveLength(1);
    owned.forEach(g => g.dispose()); geometry.dispose(); source.dispose();
  });
});
