import * as T from 'three';
import { createPropLibrary } from './prop-library.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tiles, ATLAS_W, ATLAS_H } from './relay-service-geometry.js';
import { FIELDWORKS_ATLAS } from './relay-fieldworks.js';
import { ARENA1 } from '../src/map/arena1.js';
import type { MapDef } from '../src/map/types.js';

/** Freight awaiting collection on the exterior rail bank, clear of both tracks. */
export const RELAY_YARD_SUPPLIES = [24, 25.1, 28, 29.1, 120.9, 122, 124.9, 126].map(x => ({ x, y: 3.9, z: 100.4 }));

/** Spare filters/crates staged on the repair hall's solid exterior roof slab.
 * Same library template and merged draw as the rail supplies. */
export const RELAY_WORKSHOP_SUPPLIES = [50, 51.1, 53.3, 54.4].map(z => ({ x: -.8, y: 11.24, z }));

type FieldPiece = { x: number; y: number; z: number; w: number; h: number; d: number; color: number; yaw?: number; pitch?: number };

/** Human-scale signs of occupation on the yard floor: ammunition boxes and spent
 * sandbags at the foot of existing cover, duckboard walks and a field telephone
 * line to the signal post. Every piece is at most 0.5 m tall and touches an
 * existing solid or lies flat, so it never reads as cover the collision map
 * lacks; poles are 0.12 m thick. Vertex colour only: merged into the existing
 * supplies draw, no texture, material or program. */
export function relayFieldUsePieces(map: MapDef = ARENA1): FieldPiece[] {
  const pieces: FieldPiece[] = [];
  let seed = 1918;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const standing = map.boxes.filter(b => b.min.y === 0 && b.max.y > 0.5 && !map.terrain?.boxes.includes(b)
    && b.min.x >= 0 && b.max.x <= map.bounds.width && b.min.z >= 0 && b.max.z <= map.bounds.depth);
  const reserved = [...Object.values(map.caps), ...map.spawns.red, ...map.spawns.blue];
  const free = (x: number, z: number, hw: number, hd: number) => standing.every(b =>
    x + hw <= b.min.x || x - hw >= b.max.x || z + hd <= b.min.z || z - hd >= b.max.z)
    && !(map.ramps ?? []).some(r => x + hw > r.minX && x - hw < r.maxX && z + hd > r.minZ && z - hd < r.maxZ)
    && !reserved.some(p => Math.hypot(p.x - x, p.z - z) < 3.2);
  const olive = [0x4d4a32, 0x585238, 0x44412c], burlap = [0x7d7257, 0x6f664d, 0x857a5c];
  standing.forEach((b, index) => {
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
    if (w < 3 || d < 1.5 || w > 10 || index % 3 === 1) return;
    // Long face, chosen per box so neighbouring identical boxes differ.
    const side = index % 2 ? -1 : 1, faceZ = side < 0 ? b.min.z : b.max.z;
    const along = b.min.x + 0.6 + random() * (w - 2.2);
    if (h >= 2.5) {
      // Ammunition boxes: a stack of two plus one set down beside it.
      const z = faceZ + side * 0.18;
      if (!free(along + 0.5, z + side * 0.02, 0.9, 0.16)) return;
      for (const [dx, dy, yaw] of [[0, 0, 0], [0.02, 0.25, 0.05], [0.7, 0, -0.18]] as const) {
        const color = olive[(index + dx * 10) % 3 | 0]!;
        pieces.push({ x: along + dx, y: dy + 0.12, z, w: 0.62, h: 0.24, d: 0.34, color, yaw });
        pieces.push({ x: along + dx, y: dy + 0.2, z: z + side * 0.172, w: 0.6, h: 0.05, d: 0.01, color: 0x2e2a1d, yaw });
      }
    } else {
      // Spent sandbags slumped against low cover.
      for (let bag = 0; bag < 3; bag++) {
        const x = along + bag * 0.55 + random() * 0.15, z = faceZ + side * (0.2 + random() * 0.1);
        if (!free(x, z, 0.3, 0.2)) continue;
        pieces.push({ x, y: 0.07 + (bag === 1 ? 0.1 : 0), z, w: 0.56, h: 0.14, d: 0.32,
          color: burlap[bag % 3]!, yaw: (random() - 0.5) * 0.8 });
      }
    }
  });
  // Duckboard walks where the trodden routes leave the deployment gates.
  const duckboard = (x0: number, z0: number, x1: number, z1: number) => {
    const length = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(z1 - z0, x1 - x0);
    for (let at = 0; at + 1.9 <= length; at += 2.05) {
      const cx = x0 + Math.cos(yaw) * (at + 0.95), cz = z0 + Math.sin(yaw) * (at + 0.95);
      if (!free(cx, cz, 1.0, 1.0)) continue;
      const tilt = (random() - 0.5) * 0.08;
      for (const off of [-0.28, 0.28]) pieces.push({ x: cx - Math.sin(yaw) * off, y: 0.03, z: cz + Math.cos(yaw) * off,
        w: 1.9, h: 0.06, d: 0.08, color: 0x3a2e20, yaw: -(yaw + tilt) });
      for (let slat = 0; slat < 9; slat++) {
        const s = -0.85 + slat * 0.212;
        pieces.push({ x: cx + Math.cos(yaw + tilt) * s, y: 0.075, z: cz + Math.sin(yaw + tilt) * s,
          w: 0.11, h: 0.03, d: 0.74, color: slat % 3 ? 0x5a4630 : 0x4c3b28, yaw: -(yaw + tilt) });
      }
    }
  };
  for (const east of [false, true]) {
    const x = (n: number) => east ? map.bounds.width - n : n;
    duckboard(x(6), 53, x(17.5), 54);
    duckboard(x(20), 38, x(20), 26);
    duckboard(x(46), 50, x(58), 51);
  }
  // Field telephone line from the north wall to the signal post: poles against
  // existing solids, a sagging wire above head height and a case on the post wall.
  const line = [[71.6, 1.2], [71.6, 29.8], [71.6, 50.4]] as const;
  for (const [x, z] of line) {
    pieces.push({ x, y: 1.8, z, w: 0.12, h: 3.6, d: 0.12, color: 0x3d3021 });
    pieces.push({ x, y: 3.45, z, w: 0.7, h: 0.08, d: 0.08, color: 0x3d3021 });
    for (const dx of [-0.26, 0.26]) pieces.push({ x: x + dx, y: 3.53, z, w: 0.05, h: 0.08, d: 0.05, color: 0x2a2c28 });
  }
  for (let i = 0; i + 1 < line.length; i++) {
    const [x, z0] = line[i]!, z1 = line[i + 1]![1];
    for (let step = 0; step < 12; step++) {
      const t0 = step / 12, t1 = (step + 1) / 12, sag = (t: number) => 3.55 - Math.sin(t * Math.PI) * 0.45;
      const za = z0 + (z1 - z0) * t0, zb = z0 + (z1 - z0) * t1, ya = sag(t0), yb = sag(t1);
      const length = Math.hypot(zb - za, yb - ya);
      pieces.push({ x: x + 0.26, y: (ya + yb) / 2, z: (za + zb) / 2, w: 0.018, h: 0.018, d: length, color: 0x1e1f1c,
        pitch: -Math.atan2(yb - ya, zb - za) });
    }
  }
  pieces.push({ x: 72.2, y: 1.35, z: 50.5, w: 0.3, h: 0.36, d: 0.16, color: 0x3b3322 });
  pieces.push({ x: 72.2, y: 1.58, z: 50.5, w: 0.32, h: 0.05, d: 0.18, color: 0x22201a });
  pieces.push({ x: 71.9, y: 2.35, z: 50.46, w: 0.018, h: 2.1, d: 0.018, color: 0x1e1f1c });
  return pieces;
}

export function relayFieldUseGeometry(map: MapDef = ARENA1): T.BufferGeometry {
  const parts = relayFieldUsePieces(map).map(p => {
    const g = new T.BoxGeometry(p.w, p.h, p.d).toNonIndexed();
    g.deleteAttribute('uv');
    g.rotateX(p.pitch ?? 0); g.rotateY(p.yaw ?? 0); g.translate(p.x, p.y, p.z);
    const color = new T.Color(p.color), colors = new Float32Array(g.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); return merged;
}

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
  const crates = [...RELAY_YARD_SUPPLIES, ...RELAY_WORKSHOP_SUPPLIES].map(p => ({ min: {x:p.x-.531171/2,y:p.y,z:p.z-.598316/2},
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
    parts.push(relayFieldUseGeometry());
    const flat = parts.map(g => g.index ? g.toNonIndexed() : g);
    const merged = mergeGeometries(flat);
    flat.forEach(g => { if (!parts.includes(g)) g.dispose(); });
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
