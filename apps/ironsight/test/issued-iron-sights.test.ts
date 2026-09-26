// @ts-expect-error Node test I/O; production tsconfig targets Workers.
import { readFile } from 'node:fs/promises';
// @ts-expect-error Node test I/O; no new production Node types dependency.
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { weaponMuzzle } from '../client/weapon-loader.js';
import { ISSUED_SIGHT_LINE_Y, issuedIronSights, stripIssuedSightHousing } from '../client/rifle-sight.js';

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

describe('issued carbine iron sights', () => {
  it('removes only the baked box aperture from a per-view copy and keeps the source geometry', async () => {
    const gltf = await carbine(), root = gltf.scene.getObjectByName('field-carbine')!.clone();
    const body = root.getObjectByName('field-body') as T.Mesh, source = body.geometry;
    const owned = stripIssuedSightHousing(root);
    expect(owned).toHaveLength(1);
    expect(body.geometry).not.toBe(source);
    expect(source.index!.count - body.geometry.index!.count).toBe(3 * 44 * 3); // two uprights and the top bar
    const positions = body.geometry.getAttribute('position'), index = body.geometry.index!;
    let top = -Infinity; for (let i = 0; i < index.count; i++) top = Math.max(top, positions.getY(index.getX(i)));
    expect(top).toBeLessThan(.05); // the base plate stays, nothing drawn above it
  });

  it('puts the blade tip and the notch shoulders on one horizontal line through the bore, clear of the handguard', async () => {
    const gltf = await carbine(), root = gltf.scene.getObjectByName('field-carbine')!.clone();
    stripIssuedSightHousing(root);
    const bore = weaponMuzzle(root), sights = issuedIronSights(bore.x, new T.MeshBasicMaterial());
    const tip = sights.object.getObjectByName('reflex-dot')!;
    expect(tip.position.x).toBeCloseTo(bore.x, 9);
    expect(tip.position.y).toBe(ISSUED_SIGHT_LINE_Y);
    const box = new T.Box3().setFromObject(sights.object);
    expect(box.max.y).toBeCloseTo(ISSUED_SIGHT_LINE_Y, 6); // nothing of the sights rises above the line
    // Nothing of the carbine crosses the sight line between the notch and the blade.
    const ray = new T.Raycaster(new T.Vector3(bore.x, ISSUED_SIGHT_LINE_Y, .24), new T.Vector3(0, 0, 1), 0, .455);
    expect(ray.intersectObject(root, true)).toHaveLength(0);
    sights.geometry.forEach(g => g.dispose());
  });
});
