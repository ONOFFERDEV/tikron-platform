// @ts-expect-error Node test I/O; production tsconfig targets Workers.
import { readFile } from 'node:fs/promises';
// @ts-expect-error Node test I/O; no new production Node types dependency.
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GAME } from '../src/game-config.js';
import { weaponMuzzle, weaponSource } from '../client/weapon-loader.js';
import { remoteWeaponTemplate } from '../client/remote-weapon.js';
import { splitRifleMagazine } from '../client/rifle-magazine.js';

/** Read actual geometry without browser image decoding or changing the asset. */
async function carbine() {
  const source = await readFile('public/assets/weapons/field-carbine.glb');
  const length = source.readUInt32LE(12);
  const doc = JSON.parse(source.subarray(20, 20 + length).toString());
  expect(doc.images).toHaveLength(2);
  for (const material of doc.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.pbrMetallicRoughness.metallicRoughnessTexture;
    delete material.normalTexture; delete material.occlusionTexture;
  }
  doc.images = []; doc.textures = [];
  const raw = Buffer.from(JSON.stringify(doc)), json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
  raw.copy(json);
  const tail = source.subarray(20 + length), glb = Buffer.alloc(20 + json.length + tail.length);
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(json.length, 12); glb.writeUInt32LE(0x4e4f534a, 16);
  json.copy(glb, 20); tail.copy(glb, 20 + json.length);
  return new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
}

describe('issued carbine asset and held-view loading', () => {
  it('selects the same independent replacement for both views and preserves other source choices', () => {
    expect(weaponSource(GAME.weaponVis, 0)).toEqual({ url: '/assets/weapons/field-carbine.glb', nodeName: 'field-carbine' });
    expect(weaponSource(GAME.weaponVis, 1)).toEqual({ url: '/assets/models/weapons-vm.glb', nodeName: 'wep_smg' });
    const procedural = { recoil: [], swapDownMs: 0, swapUpMs: 0 };
    expect(weaponSource(procedural, 0)).toBeUndefined();
    expect(weaponSource({ ...procedural, models: { 0: '/legacy.glb' } }, 0)).toEqual({ url: '/legacy.glb' });
  });

  it('keeps the actual reload parts independent and cached source buffers immutable', async () => {
    const gltf = await carbine(), source = gltf.scene.getObjectByName('field-carbine')!;
    const bounds = new T.Box3().setFromObject(source), tip = weaponMuzzle(source);
    const template = remoteWeaponTemplate(gltf, 'field-carbine', 0)!;
    expect(remoteWeaponTemplate(gltf, 'field-carbine', 0)).toBe(template);
    expect(source.getObjectByName('rifle-magazine')).toBeUndefined();
    const clone = source.clone(), parts = splitRifleMagazine(clone);
    expect(parts.owned).toHaveLength(0);
    const rest = new T.Box3().setFromObject(clone);
    expect(rest.min.distanceTo(bounds.min) + rest.max.distanceTo(bounds.max)).toBeLessThan(1e-6);
    const original = source.getObjectByName('field-magazine') as T.Mesh;
    const moving = clone.getObjectByName('field-magazine') as T.Mesh;
    expect(moving.geometry).toBe(original.geometry);
    const before = moving.getWorldPosition(new T.Vector3());
    parts.magazine.position.set(-.08, -.34, 0); clone.updateMatrixWorld(true);
    expect(moving.getWorldPosition(new T.Vector3()).sub(before).distanceTo(new T.Vector3(-.08, -.34, 0))).toBeLessThan(1e-6);
    expect(template.object.getObjectByName('rifle-magazine')!.position.length()).toBe(0);
    expect(weaponMuzzle(source).distanceTo(tip)).toBeLessThan(1e-6);
    parts.magazine.position.set(0, 0, 0); clone.updateMatrixWorld(true);
    expect(new T.Box3().setFromObject(clone).min.distanceTo(bounds.min)).toBeLessThan(1e-6);
  });

  it('retains a clear sight ray, bounded geometry, and a barrel-derived muzzle on the shipped asset', async () => {
    const gltf = await carbine(), root = gltf.scene.getObjectByName('field-carbine')!;
    const tip = weaponMuzzle(root), box = new T.Box3().setFromObject(root);
    expect(box.max.z - box.min.z).toBeCloseTo(1.2, 5);
    expect(tip.z).toBeCloseTo(box.max.z, 6);
    expect(new T.Raycaster(new T.Vector3(tip.x, Number(root.userData.sightY), -1), new T.Vector3(0, 0, 1)).intersectObject(root, true)).toHaveLength(0);
    let triangles = 0;
    root.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      triangles += (node.geometry.index?.count ?? node.geometry.getAttribute('position').count) / 3;
      expect(Array.from(node.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    });
    expect(triangles).toBeLessThan(4000);
  });
});
