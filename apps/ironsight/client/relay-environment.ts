import * as THREE from "three";
import { buildSiteGround } from "./site-ground.js";
import { buildRelayServiceDetail } from './relay-service-detail.js';
import type { MapDef } from "../src/map/types.js";
import { RELAY_FINISH } from './relay-palette.js';
import { relaySiteBoundary } from './relay-site.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RELAY_YARD_PARTS } from '../src/map/relay-yard.js';
import { blockingEnvironmentBoxes } from '../src/map/environment-props.js';
import { buildRelaySkyline } from './relay-skyline.js';

/** Original structural kit. Every playable solid uses the authority's exact AABB.
 * Detail is inset into solids; skyline is outside the playable rectangle.
 * Instances batch by material, not by individual architectural part.
 */
export function buildRelayEnvironment(scene: THREE.Scene, map: MapDef, bakeOnly = false): void {
  const width = map.bounds.width, depth = map.bounds.depth;
  const mastX = width / 2;
  const mats = {
    concrete: new THREE.MeshStandardMaterial(RELAY_FINISH.concrete),
    pale: new THREE.MeshStandardMaterial(RELAY_FINISH.pale),
    dark: new THREE.MeshStandardMaterial(RELAY_FINISH.dark),
    metal: new THREE.MeshStandardMaterial(RELAY_FINISH.metal),
    amber: new THREE.MeshStandardMaterial(RELAY_FINISH.amber),
    teal: new THREE.MeshStandardMaterial(RELAY_FINISH.teal),
    paint: new THREE.MeshStandardMaterial(RELAY_FINISH.paint),
  };
  type Mat = keyof typeof mats;
  const batches = new Map<Mat, THREE.Matrix4[]>([
    ['concrete', []], ['pale', []], ['dark', []], ['teal', []], ['metal', []], ['amber', []], ['paint', []],
  ]);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const add = (m: Mat, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0) => {
    quat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    matrix.compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(w, h, d));
    const list = batches.get(m) ?? []; list.push(matrix.clone()); batches.set(m, list);
  };
  if (!bakeOnly) buildSiteGround(scene, map);
  const structureParts = new Map((map.structures ?? []).flatMap(s => s.parts.map(p => [p.box, p] as const)));
  const yardParts = new Map(RELAY_YARD_PARTS.map(p => [p.box, p]));
  const environmentBoxes = new Set(blockingEnvironmentBoxes('relay'));

  for (const b of map.boxes) {
    if (map.terrain?.boxes.includes(b)) continue; // earth tops use the ground atlas
    // Moving shutters have their own prebuilt render kit; never bake a closed
    // door or its shadow across the passage into the permanent architecture.
    if (map.signalCore?.doors.includes(b)) continue;
    if (environmentBoxes.has(b)) continue;
    const x = (b.min.x + b.max.x) / 2, z = (b.min.z + b.max.z) / 2;
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
    const y = b.min.y;
    const structure = structureParts.get(b);
    const yard = yardParts.get(b);
    if (yard) {
      const timber = yard.finish === 'cargo' || yard.finish === 'bench';
      add(timber ? 'dark' : 'concrete', x, y + h / 2, z, w, h, d);
      if (timber) for (const side of [-1, 1]) {
        for (const band of [.18, h - .18])
          add('metal', x, y + band, z + side * (d / 2 + .005), w - .08, .055, .008);
        for (let px = b.min.x + .22; px < b.max.x - .1; px += 1.8)
          add('amber', px, y + h / 2, z + side * (d / 2 + .004), .12, h - .12, .008);
      }
      continue;
    }
    if (structure) {
      const timber = structure.kind === 'cover'
        || (structure.kind === 'slab' && structure.box.max.y <= 0);
      add(timber ? 'dark' : 'concrete', x, y + h / 2, z, w, h, d);
      if (structure.kind === 'wall' && y === 0 && h >= 1.1) {
        if (w > d) for (const side of [-1, 1])
          add('dark', x, .19, z + side * (d / 2 + .004), w, .30, .008);
        else for (const side of [-1, 1])
          add('dark', x + side * (w / 2 + .004), .19, z, .008, .30, d);
      }
      continue;
    }
    const chamber = map.signalCore?.chamber;
    const hut = chamber !== undefined && b.min.x >= chamber.min.x && b.max.x <= chamber.max.x
      && b.min.z >= chamber.min.z - .401 && b.max.z <= chamber.max.z + .401;
    const timber = hut || h < 1.5;
    add(timber ? 'dark' : 'concrete', x, y + h / 2, z, w, h, d);
    if (h <= .48) continue;
    if (hut && w < .5 && d < .5) continue;
    add('pale', x, b.max.y - .06, z, w + .008, .12, d + .008);
    add('dark', x, y + .13, z, w + .008, .26, d + .008);
    for (const side of [-1, 1]) {
      const face = z + side * (d / 2 + .004);
      for (let px = b.min.x + .18; px < b.max.x - .1; px += 3.4)
        add('dark', px, y + h / 2, face, .14, h - .2, .008);
      if (w >= 3 && h >= 2) {
        add('teal', x - w * .19, y + h * .54, face, Math.min(1.15, w * .24), Math.min(1.4, h * .55), .008);
        for (const band of [-.4, .4])
          add('metal', x - w * .19, y + h * .54 + band, face + side * .006, Math.min(1.15, w * .24), .045, .004);
      }
      const end = x + side * (w / 2 + .004);
      for (const band of [.28, h - .28])
        add('dark', end, y + band, z, .008, .12, d - .08);
    }
  }
  // Built mass replaces the thin perimeter. Shared with the offline bake;
  // all vertices remain exterior, so no new gameplay solid is implied.
  for (const p of relaySiteBoundary(width, depth))
    add(p.material, p.x, p.y, p.z, p.w, p.h, p.d, p.yaw);
  for (const x of [30.5, 58, 92, 119.5]) {
    add('paint', x, .008, 89.7, 2.8, .012, .08);
    add('paint', x - 1.36, .008, 88.4, .08, .012, 2.6);
  }
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
  // The moving dish and its mast live in SignalArray; only the static gantry
  // belongs in the architecture bake. Every part remains outside the arena.
  for (const x of [mastX - 9, mastX + 9]) add("amber", x, 8, -3, 0.6, 16, 0.8);
  add("amber", mastX, 15.6, -3, 19, 0.8, 1);
  for (let x = mastX - 8; x < mastX + 9; x += 2) add("dark", x, 15.1, -3, 0.16, 1.5, 0.5, 0.35);
  if (bakeOnly) scene.add(buildRelaySkyline(map.bounds));
  for (const [name, transforms] of batches) {
    if (transforms.length === 0) continue;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mats[name], transforms.length);
    transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = name !== "paint";
    mesh.receiveShadow = true;
    mesh.name = `relay-${name}`;
    mesh.computeBoundingSphere(); scene.add(mesh);
  }
  // One original atlas for all world signs (no external fonts/textures).
  if (bakeOnly) return;
  buildRelayServiceDetail(scene, map);
  const atlas = document.createElement("canvas"); atlas.width = 1024; atlas.height = 512;
  const ctx = atlas.getContext("2d")!;
  const labels = ["01 / 통신반", "02 / 무선반", "03 / 보급소", "야전 초소 / 07"];
  labels.forEach((label, i) => {
    ctx.fillStyle = "#3c4132"; ctx.fillRect(0, i * 128, 1024, 128);
    ctx.fillStyle = "#a28c61"; ctx.fillRect(0, i * 128, 14, 128);
    ctx.fillStyle = "#d4ccb3"; ctx.font = "600 70px 'Arial', 'Noto Sans KR', 'Malgun Gothic', sans-serif";
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
  for (const x of [41, 109]) sign(1, x, 2.95, 44.014, 0, 2.4);
  const signs = new THREE.Mesh(mergeGeometries(signParts)!, signMat);
  signParts.forEach(g => g.dispose()); signs.name = 'relay-zone-signs'; scene.add(signs);
}
