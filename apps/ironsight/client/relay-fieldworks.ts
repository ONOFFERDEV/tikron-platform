import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapDef } from '../src/map/types.js';

export const FIELDWORKS_ATLAS = {
  spall: [0, 256, 512, 512], chips: [0, 768, 256, 256],
  dust: [256, 768, 256, 256], sacks: [512, 0, 512, 512],
} as const;

/** Shallow blast damage on intact authority-backed walls. No cosmetic opening,
 * floating cover or per-frame work. The seed is local so art cannot affect play. */
export function paintRelayDamage(c: CanvasRenderingContext2D): void {
  let seed = 8907;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const hash = (x: number, y: number) => {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 8907;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx *= fx * (3 - 2 * fx); fy *= fy * (3 - 2 * fy);
    return (hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx) * (1 - fy)
      + (hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx) * fy;
  };
  const pixels = c.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const nx = (x - 249) / 256, ny = (y - 263) / 230;
    const radius = Math.hypot(nx + ny * .13, ny);
    const boundary = .49 + (noise(x / 43, y / 43) - .5) * .34
      + (noise(x / 12, y / 12) - .5) * .085;
    const distance = radius - boundary;
    const grain = hash(x, y), coarse = noise(x / 5, y / 5);
    const index = (y * 512 + x) * 4;
    // Sparse powder outside the chipped area, no outlined starburst or dark hole.
    if (distance > 0 && (distance > .16 || grain > Math.exp(-distance * 26) * .32)) continue;
    const edge = Math.max(0, 1 - Math.abs(distance) / .11);
    const fracture = noise(x / 18, y / 18);
    const stone = coarse > .65 ? 8 : coarse < .26 ? -9 : 0;
    const slope = (noise((x + 2) / 6, (y - 3) / 6) - coarse) * 24;
    const value = distance > 0 ? 120 + coarse * 22
      : 144 + fracture * 13 + (grain - .5) * 13 + stone + slope - edge * 12;
    pixels.data[index] = value;
    pixels.data[index + 1] = value * .984;
    pixels.data[index + 2] = value * .91;
    pixels.data[index + 3] = 255;
  }
  c.putImageData(pixels, 0, 256);
  // Hairline cracks break away from individual facets; never a thick black rim.
  c.save(); c.translate(0, 256); c.strokeStyle = '#66685d'; c.lineWidth = .65;
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + random() * .3;
    let x = 249 + Math.cos(a) * 107, y = 263 + Math.sin(a) * 96;
    c.beginPath(); c.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += Math.cos(a) * (8 + random() * 11) + (random() - .5) * 13;
      y += Math.sin(a) * (7 + random() * 9) + (random() - .5) * 10;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  c.restore();
  c.save(); c.translate(0, 768);
  for (const [x, y] of [[68, 64], [169, 91], [105, 167], [197, 201]]) {
    c.drawImage(c.canvas, 0, 256, 512, 512, x! - 30, y! - 30, 60, 60);
    c.fillStyle = '#696c61'; c.beginPath();
    c.ellipse(x!, y!, 2.7, 2.2, .2, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  c.save(); c.translate(256, 768);
  for (let i = 0; i < 1400; i++) {
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 116;
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
    c.fillStyle = i % 4 ? '#79776b' : '#444940';
    c.globalAlpha = .35 + (1 - r / 116) * .65;
    c.fillRect(x, y, 1 + random() * 4, 1 + random() * 3);
  }
  c.restore();
}

export type DamagePatch = { tile: 'spall' | 'chips' | 'dust'; position: [number, number, number]; width: number; height: number; yaw: number; ground?: boolean };
export function relayDamagePatches(map: MapDef): DamagePatch[] {
  if (map.presentation !== 'relay') return [];
  const patches: DamagePatch[] = [];
  for (const b of map.boxes) {
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
    if (h !== 6 || w < 20 || d !== 6) continue;
    for (const side of [-1, 1]) {
      const z = (side < 0 ? b.min.z : b.max.z) + side * .017;
      const x = side < 0 ? b.min.x + 3.8 : b.max.x - 3.8;
      patches.push({ tile: 'spall', position: [x, 3.15, z], width: 3.9, height: 3.4, yaw: side < 0 ? Math.PI : 0 });
      patches.push({ tile: 'chips', position: [x - side * 4.1, 4.1, z], width: 2, height: 1.8, yaw: side < 0 ? Math.PI : 0 });
      // A narrow powder apron stops before the adjacent lane barriers.
      patches.push({ tile: 'dust', position: [x, .019, z + side * .9], width: 3, height: 1.5, yaw: 0, ground: true });
    }
  }
  return patches;
}

export function relayDamageGeometry(map: MapDef): T.BufferGeometry {
  const parts = relayDamagePatches(map).map(patch => {
    const g = new T.PlaneGeometry(patch.width, patch.height), uv = g.getAttribute('uv');
    const [x, y, w, h] = FIELDWORKS_ATLAS[patch.tile];
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + 2 + uv.getX(i) * (w - 4)) / 1024,
      1 - (y + 2 + (1 - uv.getY(i)) * (h - 4)) / 1024);
    if (patch.ground) g.rotateX(-Math.PI / 2);
    g.rotateY(patch.yaw); g.translate(...patch.position); return g;
  });
  const result = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); return result;
}

/** A perimeter parapet is outside movement bounds. Sacks sit on its existing
 * coping and change only the exterior skyline, never a playable shot boundary. */
export function relaySandbagGeometry(model: T.Object3D, width: number): T.BufferGeometry {
  const normalized = new T.Group(); normalized.add(model);
  model.updateMatrixWorld(true);
  let bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3());
  if (![size.x, size.y, size.z].every(n => Number.isFinite(n) && n > 0)) throw Error('Invalid sandbag bounds');
  if (size.z > size.x) { normalized.rotation.y = Math.PI / 2; normalized.updateMatrixWorld(true); }
  bounds = new T.Box3().setFromObject(normalized); size = bounds.getSize(new T.Vector3());
  const source: T.BufferGeometry[] = [];
  normalized.traverse(node => {
    if (node instanceof T.Light) throw Error('Fieldworks cannot contain lights');
    if (!(node instanceof T.Mesh)) return;
    const g = node.geometry.clone().applyMatrix4(node.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.getAttribute('normal') || !g.getAttribute('uv')) throw Error('Sandbags need normals and UVs');
    if (!g.index) g.setIndex(Array.from({ length: g.getAttribute('position').count }, (_, i) => i));
    g.translate(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -bounds.max.z);
    // One soft generated sack, fitted to a believable filled-sack envelope.
    // Controlled assembly avoids accepting a generated wall's weak stacking.
    g.scale(.67 / size.x, .235 / size.y, .44 / size.z);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, .5 + uv.getX(i) * .5, 1 - uv.getY(i) * .5);
    source.push(g);
  });
  const sack = mergeGeometries(source)!; source.forEach(g => g.dispose());
  const courses: T.BufferGeometry[] = [];
  for (let row = 0; row < 3; row++) for (let column = 0; column < 4; column++) {
    const bag = sack.clone();
    if ((row + column) % 2) { bag.rotateY(Math.PI); bag.translate(0, 0, -.44); }
    bag.translate((column - 1.5) * .635 + (row % 2 ? .16 : -.08), row * .205, row === 2 ? -.015 : 0);
    courses.push(bag);
  }
  sack.dispose();
  const module = mergeGeometries(courses)!; courses.forEach(g => g.dispose());
  const parts: T.BufferGeometry[] = [];
  for (const offset of [-12, -9.35, -6.7, -4.05, 4.05, 6.7, 9.35, 12]) {
    parts.push(module.clone().translate(width / 2 + offset, 2.89, -.07));
  }
  module.dispose();
  const result = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); result.computeBoundingBox();
  if (!result.boundingBox || result.boundingBox.max.z >= -.05) throw Error('Sandbags crossed the exterior boundary');
  return result;
}

/** Load only on Relay and finish before prepare(). One enlarged existing atlas
 * and one existing draw; source PBR images are never uploaded to WebGL. */
export async function loadRelayFieldworks(scene: T.Scene, map: MapDef): Promise<void> {
  const detail = scene.getObjectByName('relay-service-detail');
  if (!(detail instanceof T.Mesh) || !(detail.material instanceof T.MeshStandardMaterial)) throw Error('Relay detail missing');
  const atlas = detail.material.map;
  if (!(atlas instanceof T.CanvasTexture)) throw Error('Relay atlas missing');
  const { scene: model } = await new GLTFLoader().loadAsync('/assets/props/relay-field-sandbags.glb');
  const textures = new Set<T.Texture>(), materials = new Set<T.Material>();
  let albedo: T.Texture | undefined;
  let sacks: T.BufferGeometry | undefined;
  try {
    const albedos = new Set<T.Texture>();
    model.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
        if (material instanceof T.MeshStandardMaterial && material.map) albedos.add(material.map);
      }
    });
    if (albedos.size !== 1) throw Error('Sandbags must share one albedo');
    albedo = [...albedos][0];
    if (!albedo) throw Error('Sandbag albedo missing');
    sacks = relaySandbagGeometry(model, map.bounds.width);
    const canvas = atlas.image as HTMLCanvasElement, c = canvas.getContext('2d')!;
    c.drawImage(albedo.image as CanvasImageSource, 512, 0, 512, 512);
    // Preserve the source folds/creases while dyeing its pale fabric dusty khaki.
    // This is one loading-time pixel pass, with no CSS filter or new GPU image.
    const cloth = c.getImageData(512, 0, 512, 512);
    for (let i = 0; i < cloth.data.length; i += 4) {
      const value = (.3 * cloth.data[i]! + .59 * cloth.data[i + 1]! + .11 * cloth.data[i + 2]!) / 255;
      const shade = .48 + .7 * value;
      cloth.data[i] = 155 * shade; cloth.data[i + 1] = 150 * shade; cloth.data[i + 2] = 126 * shade;
    }
    c.putImageData(cloth, 512, 0);
    atlas.needsUpdate = true;
    const next = mergeGeometries([detail.geometry, sacks]);
    if (!next) throw Error('Fieldworks merge failed');
    detail.geometry.dispose(); detail.geometry = next;
    detail.userData.fieldworks = { modules: 8, sacks: 96, exterior: true, sandbagBounds: sacks.boundingBox,
      damagePatches: relayDamagePatches(map).length, atlas: [1024, 1024], drawsAdded: 0 };
  } finally {
    sacks?.dispose();
    model.traverse(node => { if (node instanceof T.Mesh) node.geometry.dispose(); });
    materials.forEach(m => m.dispose());
    const images = new Set([...textures].map(t => t.image as { close?: () => void }));
    textures.forEach(t => t.dispose());
    images.forEach(image => { if (typeof image?.close === 'function') image.close(); });
  }
}
