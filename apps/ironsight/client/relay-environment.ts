import * as THREE from "three";
import { buildSiteGround } from "./site-ground.js";
import { buildRelayServiceDetail } from './relay-service-detail.js';
import type { MapDef } from "../src/map/types.js";
import { RELAY_FINISH } from './relay-palette.js';
import { relaySiteBoundary } from './relay-site.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Original structural kit. Every playable solid uses the authority's exact AABB.
 * Detail is inset into solids; skyline is outside the playable rectangle.
 * Instances batch by material, not by individual architectural part.
 */
export function buildRelayEnvironment(scene: THREE.Scene, map: MapDef, bakeOnly = false): void {
  const width = map.bounds.width, depth = map.bounds.depth;
  const contextX = (x: number) => x < 0 ? x : x > 60 ? width + x - 60 : x * width / 60;
  const contextZ = (z: number) => z < 0 ? z : z > 40 ? depth + z - 40 : z * depth / 40;
  const mastX = width / 2;
  const mats = {
    concrete: new THREE.MeshStandardMaterial(RELAY_FINISH.concrete),
    pale: new THREE.MeshStandardMaterial(RELAY_FINISH.pale),
    dark: new THREE.MeshStandardMaterial(RELAY_FINISH.dark),
    metal: new THREE.MeshStandardMaterial(RELAY_FINISH.metal),
    amber: new THREE.MeshStandardMaterial(RELAY_FINISH.amber),
    teal: new THREE.MeshStandardMaterial(RELAY_FINISH.teal),
    light: new THREE.MeshBasicMaterial({ color: 0xc9c8ac }),
    paint: new THREE.MeshStandardMaterial(RELAY_FINISH.paint),
  };
  type Mat = keyof typeof mats;
  const batches = new Map<Mat, THREE.Matrix4[]>();
  const skylineBatches = new Map<Mat, THREE.Matrix4[]>();
  let activeBatch = batches;
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const add = (m: Mat, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0) => {
    if (activeBatch === skylineBatches) { x = contextX(x); z = contextZ(z); }
    quat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    matrix.compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(w, h, d));
    const list = activeBatch.get(m) ?? []; list.push(matrix.clone()); activeBatch.set(m, list);
  };
  if (!bakeOnly) buildSiteGround(scene, map);
  const structureParts = new Map((map.structures ?? []).flatMap(s => s.parts.map(p => [p.box, p] as const)));

  for (const b of map.boxes) {
    if (map.terrain?.boxes.includes(b)) continue; // earth tops use the ground atlas
    // Moving shutters have their own prebuilt render kit; never bake a closed
    // door or its shadow across the passage into the permanent architecture.
    if (map.signalCore?.doors.includes(b)) continue;
    const x = (b.min.x + b.max.x) / 2, z = (b.min.z + b.max.z) / 2;
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
    const y = b.min.y;
    const structure = structureParts.get(b);
    if (structure) {
      // Thin walls, real lintels and pierced roof slabs must not use the old
      // solid-house kit (its foundations/cassettes would close the openings).
      // Every structural face is the exact authoritative box, including the
      // underside. Decorative paint is at most 8mm beyond a solid surface.
      const console = structure.kind === 'cover';
      add(console ? 'dark' : 'concrete', x, y + h / 2, z, w, h, d);
      if (console) {
        add('metal', x, b.max.y + .004, z, w, .008, d);
      } else if (structure.kind === 'wall' && y === 0 && h >= 1.1) {
        if (w > d) for (const side of [-1, 1]) {
          add('teal', x, .46, z + side * (d / 2 + .004), w, .66, .008);
          add('pale', x, .80, z + side * (d / 2 + .004), w, .04, .008);
        }
        else for (const side of [-1, 1]) {
          add('teal', x + side * (w / 2 + .004), .46, z, .008, .66, d);
          add('pale', x + side * (w / 2 + .004), .80, z, .008, .04, d);
        }
      }
      continue;
    }
    const low = h < 1.5;
    // End pillars fill the last 18 cm of each tall volume, rather than placing
    // a second coplanar face on a complete box (which causes depth fighting).
    const baseInset = y > 0 ? .32 : 0;
    add(low ? "dark" : "concrete", x, y + baseInset + (h - 0.16 - baseInset) / 2, z, low ? w : w - 0.36, h - 0.16 - baseInset, d);
    add(low ? "metal" : "pale", x, y + h - 0.08, z, w, 0.16, d);
    // Flush foundations and cornices give buildings scale without enlarging collisions.
    add("dark", x, y + 0.16, z, w + 0.006, 0.32, d + 0.006);
    const accent: Mat = z < depth / 2 ? "teal" : "amber";
    if (low) {
      add(accent, x, y + h * 0.65, z, w + 0.01, 0.13, d + 0.01);
      for (const sx of [-1, 1]) add("metal", x + sx * (w / 2 - 0.06), y + h / 2, z, 0.16, h, d + 0.024);
    } else {
      add(accent, x, y + h - 0.45, z, w + 0.006, 0.38, d + 0.006);
      if (y >= 6) {
        // Solid signal spine: stacked receiver cassettes identify the centre
        // from each lane. Every panel remains within its authoritative volume.
        for (const side of [-1, 1]) for (const level of [1.8, 3.8, 5.8]) {
          add('teal', x + side * (w / 2 + 0.004), y + level, z, 0.008, 1.1, d - 0.5);
          add('pale', x + side * (w / 2 + 0.009), y + level - 0.48, z, 0.006, 0.08, d - 0.8);
        }
      }
      if (h === 6 && w === 10 && d === 12) {
        // The shared 6.4m core is a signal coupler, distinct from service houses.
        // Cassette depth is in the collider; only millimetre cladding crosses it.
        for (const side of [-1, 1]) {
          const face = x + side * (w / 2);
          add('dark', face, 3.25, z, 0.010, 5.8, d - 0.30);
          for (const level of [1.25, 2.6, 4.95]) {
            add('pale', face + side * 0.008, level, z, 0.010, 0.95, d - 0.70);
            add('metal', face + side * 0.015, level, z, 0.006, 0.65, d - 1.0);
            for (let k = -2; k <= 2; k++)
              add('dark', face + side * 0.020, level, z + k * 0.40, 0.005, 0.44, 0.10);
            add('light', face + side * 0.024, level - 0.28, z, 0.004, 0.035, d - 1.30);
          }
          for (const end of [-1, 1]) add('amber', face + side * 0.012, 3.2, z + end * (d / 2 - 0.12), 0.010, 5.65, 0.12);
        }
      }
      for (const sx of [-1, 1]) {
        add("dark", x + sx * (w / 2 - 0.09), y + h / 2, z, 0.18, h - 0.32, d + 0.008);
        // End-face machinery panel. All thickness is inside the collider.
        add("metal", x + sx * (w / 2 + 0.006), y + 1.35, z, 0.012, 1.75, Math.min(d - 0.4, 2.8));
        for (let k = 0; k < 5; k++)
          add("dark", x + sx * (w / 2 + 0.020), y + 0.8 + k * 0.24, z, 0.008, 0.075, Math.min(d - 0.6, 2.5));
      }
      for (const sz of [-1, 1]) {
        for (let px = b.min.x + 0.55; px < b.max.x - 0.2; px += 1.45)
          add("metal", px, y + h / 2, z + sz * (d / 2 - 0.017), 0.045, h - 0.9, 0.04);
        add("light", x, y + h - 0.78, z + sz * (d / 2 + 0.003), Math.min(w - 0.5, 2.4), 0.045, 0.007);
      }
    }
  }
  // Built mass replaces the thin perimeter. Shared with the offline bake;
  // all vertices remain exterior, so no new gameplay solid is implied.
  for (const p of relaySiteBoundary(width, depth))
    add(p.material, p.x, p.y, p.z, p.w, p.h, p.d, p.yaw);
  // Painted lane edges, crossing bars and hazard chevrons: flush with the floor.
  for (const z of [25, 50, 75].map(z => z * depth / 100)) {
    for (const [x, w] of [[width * .18, 12], [width / 2, 16], [width * .82, 12]]) {
      let paintWidth = w!;
      const cut = map.terrain?.cut;
      if (cut && z >= cut.minZ && z <= cut.maxZ && x! + w! / 2 > cut.minX && x! - w! / 2 < cut.maxX) {
        // The old stripe crossed empty air after excavation. Only the actual
        // yard bridge supports ground paint here; trim it to that exact slab.
        const slab = map.structures?.flatMap(s => s.parts).find(p => p.kind === 'slab' && p.box.max.y === 0
          && x! > p.box.min.x && x! < p.box.max.x && z > p.box.min.z && z < p.box.max.z)?.box;
        if (!slab) continue;
        paintWidth = Math.min(w!, 2 * Math.min(x! - slab.min.x, slab.max.x - x!) - .1);
      }
      add("paint", x!, 0.007, z, paintWidth, 0.012, 0.065);
      for (let i = -2; i <= 2; i++) add("paint", x! + i * 0.45, 0.008, z + 0.55, 0.18, 0.014, 0.8);
    }
  }
  for (const x of [3, width - 3]) for (const z of [39, 43, 47, 51, 55, 59].map(z => z * depth / 100)) {
    add(x < width / 2 ? "amber" : "teal", x, 0.008, z, 3, 0.015, 0.12);
  }
  // Site context: large silhouettes, never cover in the playable world.
  activeBatch = skylineBatches;
  for (const [x, z, w, h, d] of [
    [-12, 4, 15, 18, 18], [-13, 33, 14, 12, 14], [72, 7, 17, 24, 22],
    [76, 36, 21, 15, 18], [9, -16, 18, 13, 20], [49, -19, 17, 22, 21],
    [15, 58, 23, 13, 22], [52, 59, 20, 20, 22],
  ] as const) {
    add("concrete", x, (h - 2.8) / 2, z, w, h - 2.8, d);
    add("dark", x, h - 1.4, z, w + 0.2, 2.8, d + 0.2);
    add("metal", x, h + 0.8, z, w * 0.6, 1.6, d * 0.65);
    for (let yy = 4; yy < h - 2; yy += 3)
      add("teal", x, yy, z, w + 0.02, 0.45, d + 0.02);
  }
  activeBatch = batches;
  // The moving dish and its mast live in SignalArray; only the static gantry
  // belongs in the architecture bake. Every part remains outside the arena.
  for (const x of [mastX - 9, mastX + 9]) add("amber", x, 8, -3, 0.6, 16, 0.8);
  add("amber", mastX, 15.6, -3, 19, 0.8, 1);
  for (let x = mastX - 8; x < mastX + 9; x += 2) add("dark", x, 15.1, -3, 0.16, 1.5, 0.5, 0.35);
  const fallback = new THREE.Group(); fallback.name = "relay-skyline-fallback"; scene.add(fallback);
  for (const [batch, parent] of [[batches, scene], [skylineBatches, fallback]] as const) {
   for (const [name, transforms] of batch) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mats[name], transforms.length);
    transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = name !== "light" && name !== "paint";
    mesh.receiveShadow = name !== "light";
    mesh.name = `relay-${name}`;
    mesh.computeBoundingSphere(); parent.add(mesh);
   }
  }
  // One original atlas for all world signs (no external fonts/textures).
  if (bakeOnly) return;
  buildRelayServiceDetail(scene, map);
  const atlas = document.createElement("canvas"); atlas.width = 1024; atlas.height = 512;
  const ctx = atlas.getContext("2d")!;
  const labels = ["01 / COOLING", "02 / RELAY", "03 / FREIGHT", "RELAY / 07"];
  labels.forEach((label, i) => {
    ctx.fillStyle = "#243a41"; ctx.fillRect(0, i * 128, 1024, 128);
    ctx.fillStyle = i === 0 ? "#86d7d9" : "#f2b35d"; ctx.fillRect(0, i * 128, 14, 128);
    ctx.fillStyle = "#ecede2"; ctx.font = "600 70px 'Arial', sans-serif";
    ctx.fillText(label, 42, i * 128 + 89);
  });
  const texture = new THREE.CanvasTexture(atlas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const signMat = new THREE.MeshBasicMaterial({ map: texture });
  const signParts: THREE.BufferGeometry[] = [];
  const sign = (index: number, x: number, y: number, z: number, yaw: number, w = 4.5) => {
    const geo = new THREE.PlaneGeometry(w, w / 8);
    const uv = geo.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + 3 - index) / 4);
    geo.rotateY(yaw); geo.translate(x, y, z); signParts.push(geo);
  };
  sign(0, width / 2, 2.1, 0.015, 0, 6);
  sign(2, width / 2, 2.1, depth - .015, Math.PI, 6);
  sign(3, mastX, 25.7, -13.4, 0, 6.8);
  for (const side of [-1, 1]) {
    sign(1, width / 2 + side * 5.030, 3.7, 50, side * Math.PI / 2, 3.5);
  }
  // Same atlas/material and five unchanged faces: one static draw. Retain
  // headroom when long frames temporarily overlap more pooled combat effects.
  const signs = new THREE.Mesh(mergeGeometries(signParts)!, signMat);
  signParts.forEach(g => g.dispose()); signs.name = 'relay-zone-signs'; scene.add(signs);
}
