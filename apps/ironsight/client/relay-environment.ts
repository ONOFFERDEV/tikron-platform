import * as THREE from "three";
import { buildSiteGround } from "./site-ground.js";
import { buildRelayServiceDetail } from './relay-service-detail.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapDef } from "../src/map/types.js";

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
    concrete: new THREE.MeshStandardMaterial({ color: 0xb4b7ae, roughness: 0.92 }),
    pale: new THREE.MeshStandardMaterial({ color: 0xd9d7c6, roughness: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x293c43, roughness: 0.72, metalness: 0.22 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x536468, roughness: 0.66, metalness: 0.35 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xd69542, roughness: 0.72 }),
    teal: new THREE.MeshStandardMaterial({ color: 0x4a989f, roughness: 0.7 }),
    light: new THREE.MeshBasicMaterial({ color: 0xb6eff0 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xc5b98c, roughness: 1 }),
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

  for (const b of map.boxes) {
    const x = (b.min.x + b.max.x) / 2, z = (b.min.z + b.max.z) / 2;
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
    const y = b.min.y;
    const low = h < 1.5;
    // End pillars fill the last 18 cm of each tall volume, rather than placing
    // a second coplanar face on a complete box (which causes depth fighting).
    add(low ? "dark" : "concrete", x, y + (h - 0.16) / 2, z, low ? w : w - 0.36, h - 0.16, d);
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
  // Perimeter retaining wall starts OUTSIDE the clamped movement bounds.
  for (const z of [-0.4, depth + 0.4]) {
    add("concrete", width / 2, 1.45, z, width + 1.6, 2.9, 0.8);
    add("dark", width / 2, 2.82, z, width + 1.6, 0.16, 0.8);
    for (let x = 2; x < width; x += 4) add("metal", x, 1.5, z, 0.22, 3, 0.9);
  }
  for (const x of [-0.4, width + 0.4]) {
    add("dark", x, 3.5, depth / 2, 0.8, 7, depth);
    for (let z = 2; z < depth; z += 6) {
      add("concrete", x, 3.5, z, 0.85, 7, 0.3);
      add(x < width / 2 ? "amber" : "teal", x, 5.4, z + 2, 0.86, 1.3, 3.3);
    }
  }
  // Painted lane edges, crossing bars and hazard chevrons: flush with the floor.
  for (const z of [25, 50, 75].map(z => z * depth / 100)) {
    for (const [x, w] of [[width * .18, 12], [width / 2, 16], [width * .82, 12]]) {
      add("paint", x!, 0.007, z, w!, 0.012, 0.065);
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
  // Relay mast and paired gantry behind the north boundary.
  add("dark", mastX, 12, -8, 2.4, 24, 2.4);
  add("pale", mastX, 20, -8, 8, 1.2, 4);
  add("teal", mastX, 20, -5.94, 5.6, 0.45, 0.1);
  // Original parabolic antenna: the map's identifying silhouette. It lives
  // entirely beyond z=0, so the detailed bowl needs no gameplay collider.
  const dish = new THREE.Group(); dish.position.set(mastX, 25, -8);
  dish.rotation.set(-0.18, -0.25, 0);
  const vertices: number[] = [], indices: number[] = [];
  const rings = 8, segments = 32, radius = 5.2;
  for (let r = 0; r <= rings; r++) for (let a = 0; a <= segments; a++) {
    const distance = radius * r / rings, angle = a / segments * Math.PI * 2;
    vertices.push(Math.cos(angle) * distance, Math.sin(angle) * distance, distance * distance / 16);
  }
  for (let r = 0; r < rings; r++) for (let a = 0; a < segments; a++) {
    const i = r * (segments + 1) + a, next = i + segments + 1;
    indices.push(i, next, i + 1, i + 1, next, next + 1);
  }
  const bowlGeometry = new THREE.BufferGeometry();
  bowlGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  bowlGeometry.setIndex(indices); bowlGeometry.computeVertexNormals();
  const bowlMaterial = new THREE.MeshStandardMaterial({ color: 0xc5cec7, roughness: 0.74, metalness: 0.25, side: THREE.DoubleSide });
  const bowl = new THREE.Mesh(bowlGeometry, bowlMaterial); bowl.castShadow = true; dish.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.12, 6, segments), mats.metal);
  rim.position.z = radius * radius / 16; dish.add(rim);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 3, 8), mats.dark);
  feed.rotation.x = Math.PI / 2; feed.position.z = 1.8; dish.add(feed);
  const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.6, 12), mats.amber);
  receiver.rotation.x = Math.PI / 2; receiver.position.z = 3.4; dish.add(receiver);
  // Feed suspension: three authored struts explain how the receiver is held.
  const braces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3 + Math.PI / 6;
    const start = new THREE.Vector3(Math.cos(angle) * 4.65, Math.sin(angle) * 4.65, 1.36);
    const end = new THREE.Vector3(0, 0, 3.2), axis = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(0.065, 0.065, axis.length(), 6);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(THREE.Object3D.DEFAULT_UP, axis.normalize()));
    geometry.translate(...start.add(end).multiplyScalar(0.5).toArray()); braces.push(geometry);
  }
  const bracing = new THREE.Mesh(mergeGeometries(braces)!, mats.metal);
  braces.forEach(g => g.dispose()); bracing.castShadow = true; dish.add(bracing);
  // Base actuator and service cabinets all remain beyond the north boundary.
  add('metal', mastX, 21.8, -8, 3.2, 2.6, 3.2);
  add('amber', mastX, 22.7, -6.38, 1.7, 0.5, 0.06);
  for (const side of [-1, 1]) {
    add('dark', mastX + side * 1.2, 12, -6.79, 0.20, 17, 0.12);
    add('metal', mastX + side * 3, 1.8, -8, 2, 3.6, 3);
  }
  scene.add(dish);
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
  const sign = (index: number, x: number, y: number, z: number, yaw: number, w = 4.5) => {
    const geo = new THREE.PlaneGeometry(w, w / 8);
    const uv = geo.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + 3 - index) / 4);
    const mesh = new THREE.Mesh(geo, signMat); mesh.position.set(x, y, z); mesh.rotation.y = yaw;
    scene.add(mesh);
  };
  sign(0, width / 2, 2.1, 0.015, 0, 6);
  sign(2, width / 2, 2.1, depth - .015, Math.PI, 6);
  sign(3, mastX, 21.4, -5.98, 0, 7);
  for (const side of [-1, 1]) {
    sign(1, width / 2 + side * 5.030, 3.7, 50, side * Math.PI / 2, 3.5);
  }
}
