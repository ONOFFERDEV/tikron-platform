// @ts-expect-error Node test I/O; production tsconfig targets Workers.
import { readFile } from 'node:fs/promises';
// @ts-expect-error Node test I/O; no new production Node types dependency.
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { weaponMuzzle } from '../client/weapon-loader.js';
import { periodServiceArm } from '../client/rifle-period.js';

/** Read actual geometry without browser image decoding or changing the asset. */
async function bundle() {
  const source = await readFile('public/assets/models/weapons-vm.glb');
  const length = source.readUInt32LE(12);
  const doc = JSON.parse(source.subarray(20, 20 + length).toString());
  
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

describe('period service arms', () => {
  it.each(['wep_smg', 'wep_shotgun', 'wep_sniper', 'wep_pistol'])('keeps the muzzle and removes only detail parts on %s', async name => {
    const gltf = await bundle(), source = gltf.scene.getObjectByName(name)!;
    const copy = source.clone(), sourceGeometry = (source.getObjectByProperty('type', 'Mesh') as T.Mesh).geometry;
    const tip = weaponMuzzle(copy);
    const result = periodServiceArm(copy, name)!;
    expect(result.geometry.length).toBeGreaterThan(0);
    expect(weaponMuzzle(copy).distanceTo(tip), name).toBeLessThan(1e-9);
    expect((source.getObjectByProperty('type', 'Mesh') as T.Mesh).geometry).toBe(sourceGeometry); // cache untouched
    const parts = copy.getObjectByName('period-parts')!;
    parts.traverse(n => { if (n instanceof T.Mesh) expect(n.raycast).not.toBe(T.Mesh.prototype.raycast); });
  });

  it('drops the rifle optic for open sights', async () => {
    const gltf = await bundle(), copy = gltf.scene.getObjectByName('wep_sniper')!.clone();
    const before = new T.Box3().setFromObject(copy).max.y;
    periodServiceArm(copy, 'wep_sniper');
    const mesh = copy.getObjectByProperty('type', 'Mesh') as T.Mesh, pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.index!;
    const body = new T.Box3(); for (let i = 0; i < idx.count; i++) body.expandByPoint(new T.Vector3().fromBufferAttribute(pos, idx.getX(i)).applyMatrix4(mesh.matrix));
    expect(body.max.y).toBeLessThan(before - .05);
  });
});
