import * as T from 'three';
import type { MapDef } from '../src/map/types.js';
import { buildSiteGround } from './site-ground.js';
import { UNDERTOW_FINISH } from './undertow-palette.js';
import { UNDERTOW_CRATES } from '../src/map/undertow-structures.js';
import { createPropLibrary } from './prop-library.js';

/** Original reclamation kit. The complete box envelope remains visibly solid;
 * turbine faces/windows are flush cladding, never holes or new playable cover.
 * Pipes, basin and skyline equipment live outside the movement rectangle. */
export function buildUndertowEnvironment(scene: T.Scene, map: MapDef, bakeOnly = false): void {
  const { width, depth } = map.bounds;
  const mats: T.Material[] = ['concrete', 'housing', 'steel', 'pale', 'olive', 'ochre']
    .map(key => new T.MeshStandardMaterial(UNDERTOW_FINISH[key as keyof typeof UNDERTOW_FINISH]));
  // Small existing lamp strips read as sodium-lit fittings. No actual light.
  mats.push(new T.MeshBasicMaterial({ color: 0xd3c5a3 }));
  const batches = new Map<string, T.Matrix4[]>();
  const unit = new T.BoxGeometry(1, 1, 1), cylinder = new T.CylinderGeometry(0.5, 0.5, 1, 16);
  const add = (material: number, x: number, y: number, z: number, w: number, h: number, d: number, round = false, rx = 0, rz = 0, ry = 0) => {
    const key = `${material}-${round ? 'c' : 'b'}`, list = batches.get(key) ?? [];
    list.push(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(w, h, d)));
    batches.set(key, list);
  };
  if (!bakeOnly) buildSiteGround(scene, map, true);
  const structureParts = new Map((map.structures ?? []).flatMap(s => s.parts.map(p => [p.box, p] as const)));
  for (const b of map.boxes) {
    if (map.signalCore?.doors.includes(b)) continue;
    if (UNDERTOW_CRATES.includes(b)) continue; // separate detail/fallback pair, never baked twice
    const x = (b.min.x + b.max.x) / 2, z = (b.min.z + b.max.z) / 2;
    const w = b.max.x - b.min.x, h = b.max.y - b.min.y, d = b.max.z - b.min.z;
    const structure = structureParts.get(b);
    if (structure) {
      // Exact thin wall/lintel/slab faces: old turbine cladding would close
      // the apertures and wrongly move elevated surfaces back to the yard.
      const console = structure.kind === 'cover';
      add(console ? 1 : 0, x, b.min.y + h / 2, z, w, h, d);
      if (console) {
        add(2, x, b.max.y + .004, z, w, .008, d);
        add(4, x, b.max.y + .009, z, w * .75, .002, d * .64);
        for (let i = -.6; i <= .6; i += .3)
          add(3, x + i, b.max.y + .011, z, .09, .002, .2);
      } else if (structure.kind === 'wall' && b.min.y === 0 && h >= 1.1) {
        const accent = x < width / 2 ? 4 : 5;
        for (const side of [-1, 1]) {
          if (w > d) {
            add(accent, x, .43, z + side * (d / 2 + .004), w, .66, .008);
            add(3, x, .78, z + side * (d / 2 + .004), w, .04, .008);
          } else {
            add(accent, x + side * (w / 2 + .004), .43, z, .008, .66, d);
            add(3, x + side * (w / 2 + .004), .78, z, .008, .04, d);
          }
        }
      }
      continue;
    }
    if (b.min.y > 0) {
      if (b.min.y === 3) {
        // Gallery lintel: every cladding piece stays above standing clearance.
        add(1,x,b.min.y+h/2,z,w,h,d);
        add(3,x,b.max.y-.09,z,w+.006,.18,d+.006);
        continue;
      }
      // Central pressure-stack cladding stays within the authoritative envelope.
      add(1,x,b.min.y+h/2,z,w,h,d);
      for (const y of [7,10,13]) add(3,x,y,z,w+.004,.28,d+.004);
      for (const side of [-1,1]) {
        add(2,x,b.min.y+h/2,z+side*(d/2+.006),w*.64,h*.78,.012);
        for (const y of [8,9.2,10.4,11.6]) add(4,x,y,z+side*(d/2+.015),w*.55,.55,.008);
      }
      continue;
    }
    const low = h < 1.5, control = h > 4, screen = d > 8;
    const accent = x < width / 2 ? 4 : 5;
    add(low ? 2 : control ? 1 : 0, x, (h - .18) / 2, z, w, h - .18, d);
    add(2, x, 0.14, z, w + 0.004, 0.28, d + 0.004);
    add(low ? 5 : 3, x, h - 0.09, z, w + 0.006, 0.18, d + 0.006);
    if (low) {
      for (const sign of [-1, 1]) for (let px = b.min.x + 0.25; px < b.max.x; px += 0.45)
        add(5, px, h * 0.7, z + sign * (d / 2 + 0.004), 0.18, 0.12, 0.008);
    } else if (screen) {
      // Break the 14m deployment walls into readable service bays.
      for (let pz = b.min.z + 1; pz < b.max.z; pz += 2.2) for (const side of [-1, 1]) {
        add(2, x + side * (w / 2 + 0.004), 1.65, pz, 0.008, 2.2, 1.65);
        add(accent, x + side * (w / 2 + 0.009), 1.65, pz, 0.006, 1.9, 1.36);
        add(6, x + side * (w / 2 + 0.013), 2.48, pz, 0.004, 0.035, 1);
      }
    } else {
      for (const side of [-1, 1]) {
        const face = z + side * (d / 2 + 0.006);
        if (control) {
          add(2, x, 2.4, face, w - 0.5, 1.05, 0.012);
          for (let px = b.min.x + 0.65; px < b.max.x - 0.4; px += 1.25) {
            add(1, px, 2.4, face + side * 0.008, 1.0, 0.8, 0.005);
            add(6, px, 2.7, face + side * 0.012, 0.84, 0.025, 0.004);
          }
          add(accent, x, 0.85, face + side * 0.003, 0.8, 1.45, 0.01);
          add(2, x, 0.85, face + side * 0.01, 0.64, 1.30, 0.005);
        } else {
          // Flush turbine end plates: concentric rings with a six-spoke rotor.
          const count = Math.max(1, Math.floor(w / 2.2));
          for (let i = 0; i < count; i++) {
            const px = x + (i - (count - 1) / 2) * 2.35, diameter = Math.min(1.7, h - 0.5);
            add(2, px, h * 0.49, face, diameter, 0.015, diameter, true, Math.PI / 2);
            add(4, px, h * 0.49, face + side * 0.014, diameter * 0.80, 0.01, diameter * 0.80, true, Math.PI / 2);
            for (let blade = 0; blade < 6; blade++) {
              const angle = blade * Math.PI / 3;
              add(2, px + Math.sin(angle) * diameter * 0.23, h * 0.49 + Math.cos(angle) * diameter * 0.23,
                face + side * 0.023, 0.11, diameter * 0.42, 0.008, false, 0, -angle);
            }
            add(3, px, h * 0.49, face + side * 0.031, 0.25, 0.012, 0.25, true, Math.PI / 2);
          }
        }
        add(accent, x, h - 0.55, face, w - 0.25, 0.5, 0.01);
      }
      for (const side of [-1, 1]) for (let k = 0; k < 6; k++)
        add(2, x + side * (w / 2 + 0.007), 0.7 + k * 0.20, z, 0.012, 0.07, d * 0.65);
    }
  }
  // Stair nosings and door headers stay millimetres from authoritative faces.
  // Smooth ramp collision carries movement; the markings only describe it.
  for (const s of map.structures ?? []) {
    for (const r of s.ramps) for (let step = 1; step < 18; step++) {
      const t = step / 18, x = r.dir === 1 ? r.minX + t * (r.maxX - r.minX) : r.maxX - t * (r.maxX - r.minX);
      add(3, x, r.topY * t + .006, (r.minZ + r.maxZ) / 2, .028, .008, r.maxZ - r.minZ - .08);
    }
    for (const offset of [7, 15]) {
      const x = s.footprint.minX + offset, z = s.footprint.maxZ + .004;
      add(2, x, 2.54, z, 2.15, .27, .008);
      add(6, x, 2.58, z + .007, 1.7, .028, .004);
    }
  }
  // Boundary walls and their inset maintenance panels.
  for (const z of [-0.45, depth + 0.45]) {
    add(0, width / 2, 1.3, z, width + 1.8, 2.6, 0.9); add(2, width / 2, 2.7, z, width + 1.8, 0.2, 0.91);
    for (let x = 3; x < width; x += 4) add(1, x, 1.4, z, 0.20, 2.8, 0.92);
  }
  for (const x of [-0.45, width + 0.45]) {
    add(2, x, 2.6, depth / 2, 0.9, 5.2, depth);
    for (let z = 3; z < depth; z += 5) {
      add(1, x, 2.6, z, 0.91, 5.2, 0.24);
      add(4, x, 3.4, z + 1.5, 0.92, 1.4, 2.5);
    }
  }
  // Source-layout context anchors; outside offsets stay outside expanded bounds.
  const context: typeof add = (m, x, y, z, w, h, d, round, rx, rz, ry) => {
    const px = x < 0 ? x : x > 60 ? width + x - 60 : x / 60 * width;
    const pz = z < 0 ? z : z > 40 ? depth + z - 40 : z / 40 * depth;
    add(m, px, y, pz, w, h, d, round, rx, rz, ry);
  };
  // Basin and paired clarifiers: skyline hero stays completely beyond z=0.
  context(2, 30, -0.01, -13, width * .9, 0.02, 20);
  context(4, 30, 0.005, -13, width * .85, 0.01, 17);
  for (let x = 7; x < 57; x += 2.4) {
    context(1, x, 0.015, -5.6, 1.1, 0.005, 0.025);
    context(1, x + 0.5, 0.015, -20, 0.7, 0.005, 0.018);
  }
  for (const x of [17, 43]) {
    context(0, x, 4, -13, 11, 8, 11, true);
    context(2, x, 7.55, -13, 11.15, 0.25, 11.15, true);
    context(4, x, 8.1, -13, 10.4, 0.6, 10.4, true);
    context(3, x, 8.48, -13, 8.8, 0.15, 8.8, true);
    for (const level of [1.1, 5.8]) context(1, x, level, -13, 11.08, 0.16, 11.08, true);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      context(1, x + Math.sin(angle) * 5.48, 4, -13 + Math.cos(angle) * 5.48, 0.13, 6.4, 0.12, false, 0, 0, angle);
    }
    context(5, x, 10.2, -13, 0.7, 3.4, 0.7);
    context(2, x, 11.75, -13, 12, 0.35, 0.65);
    for (const side of [-1, 1]) {
      context(1, x + side * 4, 2.8, -4, 1, 5.6, 1, true);
      context(1, x + side * 4, 5.55, -7, 1, 6, 1, true, Math.PI / 2);
    }
  }
  // A landmark control stack and steel service bridge; no route-crossing pipes.
  context(1, 30, 12, -18, 5, 24, 5);
  context(2, 30, 23, -18, 8, 2, 7);
  context(3, 30, 24.15, -18, 8.2, 0.3, 7.2);
  context(6, 30, 23.2, -14.48, 6.7, 0.35, 0.03);
  // Forked intake crown: one north-axis silhouette above the repeated low kit.
  // Entirely beyond the boundary, including the widest crown; no new cover.
  for (const dx of [-4.5, 4.5]) {
    add(3, width / 2 + dx, 27, -18, 1.2, 14, 2.4);
    add(4, width / 2 + dx, 32.8, -18, 1.24, 1.4, 2.44);
  }
  add(2, width / 2, 29, -18, 11, 0.7, 3);
  for (const dx of [-2.4, -1.2, 0, 1.2, 2.4])
    add(1, width / 2 + dx, 26.5, -18, 0.25, 4.4, 2);
  for (const level of [4, 7.2, 10.4]) {
    context(2, 30, level, -15.49, 3.8, 1.8, 0.025);
    for (let i = -2; i <= 2; i++) context(1, 30 + i * 0.65, level, -15.47, 0.15, 1.5, 0.015);
  }
  context(5, 30, 6.4, -5, width * .65, 0.5, 1.2);
  for (let x = 12; x < 50; x += 3) context(2, x, 5.95, -5, 0.12, 0.7, 1);
  for (const [x, z, w, h, d] of [[-10, 11, 12, 13, 18], [71, 26, 15, 17, 24], [18, 53, 22, 10, 14], [49, 55, 17, 14, 18]]) {
    context(1, x!, (h! - 2.4) / 2, z!, w!, h! - 2.4, d!);
    context(2, x!, h! - 1.2, z!, w! + 0.1, 2.4, d! + 0.1);
    context(4, x!, h! + 0.7, z!, w! * 0.7, 1.4, d! * 0.6);
  }
  // West = upright pale filter vessels; east = low amber service gantry.
  // Shape carries orientation even without colour. Share the baked kit's six
  // existing materials and atlas, and keep all extents outside the play volume.
  for (const [z, height] of [[depth * .37, 21], [depth * .49, 26], [depth * .61, 21]] as const) {
    const x = -8;
    add(3, x, height / 2, z, 6, height, 6, true);
    for (const y of [2, height - 4, height - .4])
      add(4, x, y, z, 6.12, .65, 6.12, true);
    add(2, x, height + .2, z, 5.5, .5, 5.5, true);
    add(1, x + 3.12, height / 2, z, .24, height, .8);
  }
  for (const z of [depth * .34, depth * .66]) {
    add(5, width + 5, 6, z, 1.2, 12, 1.2);
    add(2, width + 5, 1.5, z, 1.3, 3, 1.3);
  }
  add(5, width + 5, 12, depth / 2, 1.6, 2, depth * .34);
  for (let z = depth * .35; z < depth * .66; z += 2)
    add(2, width + 4.17, 12, z, .04, 1.6, .35, false, Math.PI / 5);
  // Southern pump-service flues answer the north crown with unequal round stacks.
  for (const [x, height] of [[width * .43, 18], [width * .49, 14]] as const) {
    add(2, x, height / 2, depth + 6, 2.4, height, 2.4, true);
    add(5, x, height - 2, depth + 6, 2.44, 3, 2.44, true);
    add(3, x, height, depth + 6, 3, .4, 3, true);
  }
  // Floor-only circulation marks; caps retain the authority's positions.
  for (const cap of Object.values(map.caps)) for (const side of [-1, 1]) {
    add(3, cap.x + side * 2.7, 0.004, cap.z, 0.08, 0.008, 5.4);
    add(3, cap.x, 0.004, cap.z + side * 2.7, 5.4, 0.008, 0.08);
  }
  for (const z of [depth * .27, depth * .70]) for (const x of [width * .25, width / 2, width * .75]) {
    add(5, x, 0.005, z, 7, 0.01, 0.08);
    for (let i = -2; i <= 2; i++) add(3, x + i * 0.5, 0.006, z + 0.5, 0.2, 0.01, 0.65);
  }
  for (const [key, transforms] of batches) {
    const [material, shape] = key.split('-');
    const mesh = new T.InstancedMesh(shape === 'c' ? cylinder : unit, mats[Number(material)]!, transforms.length);
    transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.name = `undertow-${key}`; mesh.castShadow = material !== '6'; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); scene.add(mesh);
  }
  if (bakeOnly) return;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const labels = ['A / WEST CONTROL', 'B / PUMP HALL', 'C / EAST CONTROL', 'UNDERTOW / 02',
    'WEST DECK', 'EAST DECK', 'CLARIFIER ROUTE', 'MAINTENANCE'];
  labels.forEach((label, i) => {
    ctx.fillStyle = '#303b39'; ctx.fillRect(0, i * 128, 1024, 128);
    ctx.fillStyle = i === 0 || i === 4 || i === 6 ? '#a6b7a0' : '#d1b47d';
    ctx.fillRect(18, i * 128 + 22, 10, 84);
    ctx.fillStyle = '#dfe8dc'; ctx.font = '600 57px Arial'; ctx.fillText(label, 52, i * 128 + 83);
  });
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  const material = new T.MeshBasicMaterial({ map: texture });
  const sign = (label: number, x: number, y: number, z: number, yaw: number, width = 5.2) => {
    const geo = new T.PlaneGeometry(width, width / 8), uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + 7 - label) / 8);
    const mesh = new T.Mesh(geo, material); mesh.position.set(x, y, z); mesh.rotation.y = yaw; scene.add(mesh);
  };
  // Signs sit on actual solid faces, never on old blockout coordinates.
  for (const [label, cap] of [[0, map.caps.a], [2, map.caps.c]] as const) {
    sign(label, cap.x, 2.25, 10.016, 0);
    sign(label, cap.x, 2.25, 19.984, Math.PI);
  }
  sign(1, map.caps.b.x, 2.25, 90.016, 0);
  // Pump returns announce the destination before the covered bend. Reuse the
  // existing atlas and opaque material; both signs sit on real solid faces.
  sign(1, 61.984, 2.35, 86, -Math.PI / 2, 3.5);
  sign(1, 88.016, 2.35, 86, Math.PI / 2, 3.5);
  // Northern breakwater baffles: destination on the protected arrival face.
  // Same atlas, opaque shader and real full-cover envelope as the pump signs.
  sign(0, 17.984, 2.35, 28, -Math.PI / 2, 6);
  sign(2, 132.016, 2.35, 28, Math.PI / 2, 6);
  sign(3, width / 2, 22.8, -14.46, 0, 6);
  // One label per face: the former site label overlapped CLARIFIER ROUTE.
  sign(4, 46, 2.35, 44.016, 0, 4);
  sign(5, width - 46, 2.35, 44.016, 0, 4);
  sign(6, width / 2, 2.1, 0.016, 0, 5);
  sign(7, width / 2, 2.1, depth - .015, Math.PI, 6);
  sign(4, .016, 3.6, depth / 2, Math.PI / 2, 12);
  sign(5, width - .016, 3.6, depth / 2, -Math.PI / 2, 12);
  for (const s of map.structures ?? []) {
    const x = (s.footprint.minX + s.footprint.maxX) / 2;
    sign(x < width / 2 ? 4 : 5, x, 3.6, s.footprint.minZ - .016, Math.PI, 5);
    // The central window's lintel is only .37m high: keep text inside it.
    sign(7, x, 2.53, s.footprint.maxZ + .016, 0, 2.7);
  }
}

/** Lazy, map-owned issued supplies. Their exact box colliders are present even
 * while loading or on failure; the procedural fallback is replaced only after
 * the whole detailed hierarchy is ready, before scene preparation/warm-up. */
export async function loadUndertowSupplies(scene: T.Scene): Promise<void> {
  const library = createPropLibrary();
  const geometry = new T.BoxGeometry(1, 1, 1);
  const material = new T.MeshStandardMaterial({ color: 0x4c5140, roughness: .92 });
  const fallback = new T.Group(); fallback.name = 'undertow-supply-fallback';
  for (const b of UNDERTOW_CRATES) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
    mesh.scale.set(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
    mesh.castShadow = mesh.receiveShadow = true; fallback.add(mesh);
  }
  scene.add(fallback);
  try {
    const props = await Promise.all(UNDERTOW_CRATES.map(async b => {
      const root = await library.load('ammo-crate-stack');
      root.position.set((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
      root.traverse(node => { if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = true; });
      return root;
    }));
    const group = new T.Group(); group.name = 'undertow-issued-supplies';
    group.add(...props); scene.add(group); scene.remove(fallback);
    geometry.dispose(); material.dispose();
  } catch (error) {
    library.dispose();
    console.warn('Undertow supply detail unavailable; retaining authoritative crate envelopes.', error);
  }
}
