import * as T from 'three';
import { createPropLibrary } from './prop-library.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tiles, ATLAS_W, ATLAS_H } from './relay-service-geometry.js';
import { FIELDWORKS_ATLAS } from './relay-fieldworks.js';

/** Freight awaiting collection on the exterior rail bank, clear of both tracks. */
export const RELAY_YARD_SUPPLIES = [24, 25.1, 28, 29.1, 120.9, 122, 124.9, 126].map(x => ({ x, y: 3.9, z: 100.4 }));

/** Signs and old blast scars on intact faces; merged into the resident atlas
 * draw. No sign or decal pretends the ground-level breach is still a wall. */
export function relayYardDetail(): T.BufferGeometry {
  const parts: T.BufferGeometry[] = [];
  const face = (tile: readonly number[], x: number, y: number, z: number, w: number, h: number, yaw = 0) => {
    const g = new T.PlaneGeometry(w, h), uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (tile[0]! + 2 + uv.getX(i) * (tile[2]! - 4)) / ATLAS_W,
      1 - (tile[1]! + 2 + (1 - uv.getY(i)) * (tile[3]! - 4)) / ATLAS_H);
    g.rotateY(yaw).translate(x, y, z); parts.push(g);
  };
  for (const east of [false, true]) {
    const x = (n: number) => east ? 150 - n : n;
    face(east ? tiles.freight : tiles.workshop, x(35.5), 2.1, 81.012, 5.7, 1.05);
    face(FIELDWORKS_ATLAS.spall, x(26), 1.5, 81.012, 3.8, 2.6);
    face(FIELDWORKS_ATLAS.chips, x(35.5), 1.0, 79.988, 2.7, 1.7, Math.PI);
    face(tiles.case, x(26.5), .55, 83.012, 1.1, .85);
    face(tiles.freight, x(58), 2.1, 86.988, 4.8, .9, Math.PI);
    face(tiles.case, x(58.5), .55, 85.012, 1.1, .85);
  }
  const geometry = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); return geometry;
}

/** Distant, inaccessible supplies retain source silhouettes and baked albedo
 * at their vertices. One static draw, no additional resident texture. All
 * sampling/merging happens once during loading, before renderer preparation. */
export async function loadRelayYardSupplies(scene: T.Scene): Promise<void> {
  const crates = RELAY_YARD_SUPPLIES.map(p => ({ min: {x:p.x-.531171/2,y:p.y,z:p.z-.598316/2},
    max: {x:p.x+.531171/2,y:p.y+1.15,z:p.z+.598316/2} }));
  const geometry = new T.BoxGeometry(1, 1, 1);
  const material = new T.MeshStandardMaterial({ color: 0x4c5140, roughness: .86, metalness: .08 });
  const fallback = new T.InstancedMesh(geometry, material, crates.length);
  fallback.name = 'relay-yard-supply-fallback'; fallback.userData.architectureExclude = true;
  const matrix = new T.Matrix4();
  for (const [i, b] of crates.entries()) {
    matrix.makeScale(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
    matrix.setPosition((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
    fallback.setMatrixAt(i, matrix);
  }
  fallback.castShadow = fallback.receiveShadow = true; fallback.computeBoundingSphere(); scene.add(fallback);
  const library = createPropLibrary(), parts: T.BufferGeometry[] = [];
  const pixels = new Map<T.Texture, ImageData>();
  const uv = new T.Vector2(), color = new T.Color();
  try {
    const roots = await Promise.all(crates.map(async b => {
      const root = await library.load('ammo-crate-stack');
      root.position.set((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
      return root;
    }));
    for (const root of roots) {
      root.updateMatrixWorld(true);
      root.traverse(node => {
        if (!(node instanceof T.Mesh)) return;
        // The frozen crate has one opaque standard material per mesh. Fail
        // to the visible fallback if a future library revision changes that.
        const source = node.material;
        if (!(source instanceof T.MeshStandardMaterial) || source.transparent)
          throw Error('Unsupported Relay supply material');
        const g = node.geometry.clone(), coords = g.getAttribute('uv');
        parts.push(g);
        const colors = new Float32Array(g.getAttribute('position').count * 3);
        const texture = source.map;
        let bitmap: ImageData | undefined;
        if (texture) {
          bitmap = pixels.get(texture);
          if (!bitmap) {
            const sourceImage = texture.image;
            if (!(sourceImage instanceof ImageBitmap) && !(sourceImage instanceof HTMLImageElement)
              && !(sourceImage instanceof HTMLCanvasElement))
              throw Error('Unsupported Relay supply albedo image');
            if (sourceImage.width <= 0 || sourceImage.height <= 0)
              throw Error('Relay supply albedo image is empty');
            const canvas = document.createElement('canvas');
            canvas.width = sourceImage.width; canvas.height = sourceImage.height;
            const ctx = canvas.getContext('2d')!; ctx.drawImage(sourceImage, 0, 0);
            bitmap = ctx.getImageData(0, 0, canvas.width, canvas.height); pixels.set(texture, bitmap);
          }
          texture.updateMatrix();
          if (!coords) throw Error('Relay supply albedo has no UV coordinates');
        }
        for (let i = 0; i < colors.length / 3; i++) {
          color.copy(source.color);
          if (texture && bitmap) {
            uv.set(coords.getX(i), coords.getY(i)); texture.transformUv(uv);
            const x = Math.min(bitmap.width - 1, Math.max(0, Math.floor(uv.x * bitmap.width)));
            const y = Math.min(bitmap.height - 1, Math.max(0, Math.floor(uv.y * bitmap.height)));
            const k = (y * bitmap.width + x) * 4;
            color.setRGB(bitmap.data[k]! / 255, bitmap.data[k + 1]! / 255, bitmap.data[k + 2]! / 255, texture.colorSpace).multiply(source.color);
          }
          color.toArray(colors, i * 3);
        }
        for (const attribute of Object.keys(g.attributes)) if (attribute !== 'position' && attribute !== 'normal') g.deleteAttribute(attribute);
        g.setAttribute('color', new T.BufferAttribute(colors, 3)); g.clearGroups(); g.applyMatrix4(node.matrixWorld);
      });
    }
    const merged = mergeGeometries(parts);
    if (!merged) throw Error('Relay supply geometry could not be batched');
    const finish = new T.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: .08 });
    const supplies = new T.Mesh(merged, finish); supplies.name = 'relay-yard-issued-supplies';
    supplies.userData.architectureExclude = true;
    supplies.castShadow = supplies.receiveShadow = true; scene.add(supplies);
    scene.remove(fallback); geometry.dispose(); material.dispose(); fallback.dispose();
  } catch (error) {
    console.warn('Relay yard detail unavailable; retaining exterior crate envelopes.', error);
  } finally {
    parts.forEach(g => g.dispose()); library.dispose();
  }
}
