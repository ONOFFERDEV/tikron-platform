import * as T from 'three';
import type { MapDef } from '../src/map/types.js';
import { buildSiteGround } from './site-ground.js';
import { SWITCHYARD_FINISH } from './switchyard-palette.js';
import { SWITCHYARD_CRATES } from '../src/map/switchyard-structures.js';
import { createPropLibrary } from './prop-library.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Power-distribution yard. Complete collider envelopes remain visibly solid;
 * millimetre face cladding cannot create a route, opening or extra cover.
 * Substation gantries and machinery stand entirely outside the playable bounds. */
export function buildSwitchyardEnvironment(scene: T.Scene, map: MapDef, bakeOnly = false): void {
  const { width, depth } = map.bounds;
  const cx = width / 2, cz = depth / 2;
  const materials = [SWITCHYARD_FINISH.concrete, SWITCHYARD_FINISH.steel, SWITCHYARD_FINISH.housing,
    SWITCHYARD_FINISH.ochre, SWITCHYARD_FINISH.olive, SWITCHYARD_FINISH.pale].map(finish => new T.MeshStandardMaterial(finish));
  const batches = new Map<string, T.Matrix4[]>();
  const box = new T.BoxGeometry(1, 1, 1);
  const cylinder = new T.CylinderGeometry(0.5, 0.5, 1, 12);
  const add = (mat: number, x: number, y: number, z: number, w: number, h: number, d: number,
    zone: 'shell' | 'cladding' | 'exterior' | 'paint' = 'cladding', round = false, rotation = new T.Euler()) => {
    const key = `${zone}:${mat}:${round ? 'c' : 'b'}`, list = batches.get(key) ?? [];
    list.push(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(rotation), new T.Vector3(w, h, d)));
    batches.set(key, list);
  };
  if (!bakeOnly) buildSiteGround(scene, map);
  const structureParts = new Map((map.structures ?? []).flatMap(s => s.parts.map(p => [p.box, p] as const)));
  for (const b of map.boxes) {
    if (map.signalCore?.doors.includes(b)) continue;
    if (SWITCHYARD_CRATES.includes(b)) continue; // removable supply fallback below
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
    const x = (b.min.x + b.max.x) / 2, z = (b.min.z + b.max.z) / 2, base = b.min.y;
    const low = h < 1.5, wall = w > 6;
    const part = structureParts.get(b);
    if (part) {
      // Exact slab/lintel/sill envelopes. Cabinet panels used on the old sealed
      // blocks must never extend down across a doorway or below a roof slab.
      add(part.kind === 'cover' ? 1 : 0, x, base + h / 2, z, w, h, d, 'shell');
      if (part.kind === 'cover') {
        add(1, x, b.max.y + .004, z, w, .008, d);
        add(2, x, b.max.y + .009, z, w * .8, .002, d * .66);
        for (const side of [-1, 1]) {
          add(5, x + side * w * .32, b.max.y + .011, z, .14, .002, d * .46);
          add(3, x + side * w * .32, base + .82, b.max.z + .006, .18, .1, .008);
        }
      } else if (part.kind === 'wall') {
        const accent = x < cx ? 4 : 3;
        for (const side of [-1, 1]) {
          const alongX = w > d;
          const faceX = alongX ? x : x + side * (w / 2 + .004);
          const faceZ = alongX ? z + side * (d / 2 + .004) : z;
          // Dado is bounded to the piece; windows, doors and roof escape stay open.
          if (base === 0 && h >= 1.1) {
            add(accent, faceX, .44, faceZ, alongX ? w : .008, .64, alongX ? .008 : d);
            add(5, faceX, .8, faceZ, alongX ? w : .008, .04, alongX ? .008 : d);
          }
          if (base === 3) add(1, faceX, 3.88, faceZ, alongX ? w : .008, .09, alongX ? .008 : d);
        }
      } else if (part.kind === 'slab') {
        // Thin opaque wearing surface, inset from all stairwell edges.
        add(1, x, b.max.y + .003, z, Math.max(.01, w - .04), .006, Math.max(.01, d - .04));
      }
      continue;
    }
    // Exact authority volume, including its top. No decorative gaps through cover.
    add(low ? 1 : 0, x, base + h / 2, z, w, h, d, 'shell');
    add(1, x, base + 0.12, z, w + 0.006, 0.24, d + 0.006);
    add(low ? 3 : 5, x, base + h - 0.08, z, w + 0.008, 0.15, d + 0.008);
    const accent = z < cz ? 4 : 3;
    for (const side of [-1, 1]) {
      const face = z + side * (d / 2);
      if (low) {
        // Armoured transport cases; the middle platform stays walkable on top.
        for (let px = b.min.x + 0.2; px < b.max.x; px += 0.5)
          add(3, px, base + h * 0.7, face + side * 0.005, 0.18, 0.13, 0.008);
        add(2, x, base + h * 0.40, face + side * 0.008, w - 0.32, h * 0.28, 0.008);
      } else {
        // Repeated switchgear cabinet doors break long screens into human-scale bays.
        const bays = Math.max(1, Math.floor(w / 1.6));
        const bayWidth = (w - 0.30) / bays;
        for (let i = 0; i < bays; i++) {
          const px = x + (i - (bays - 1) / 2) * bayWidth;
          add(1, px, base + h * 0.48, face + side * 0.005, bayWidth - 0.07, h - 0.62, 0.008);
          add(wall ? 2 : accent, px, base + h * 0.48, face + side * 0.011, bayWidth - 0.16, h - 0.75, 0.006);
          add(5, px + bayWidth * 0.30, base + h * 0.46, face + side * 0.016, 0.045, 0.28, 0.004);
          for (let row = 0; row < 4; row++)
            add(1, px, base + 0.5 + row * 0.12, face + side * 0.016, bayWidth * 0.62, 0.045, 0.004);
          add(3, px - bayWidth * 0.23, base + h * 0.70, face + side * 0.016, 0.18, 0.22, 0.004);
        }
        add(accent, x, base + h - 0.31, face + side * 0.006, w - 0.1, 0.16, 0.01);
      }
    }
    // Visible end plates with inset louvers, useful from flanking routes.
    if (!low) for (const side of [-1, 1]) {
      const face = x + side * w / 2;
      add(2, face + side * 0.005, base + h / 2, z, 0.008, h - 0.4, d - 0.28);
      for (let row = 0; row < 7; row++)
        add(1, face + side * 0.011, base + 0.55 + row * (h - 1.1) / 7, z, 0.004, 0.06, d - 0.5);
    }
    // Arrival-side wayfinding: two amber chevrons point around each end of a
    // northern spawn screen. Baked strips reuse the kit material, no sign atlas.
    const northernArrival = [...map.spawns.red, ...map.spawns.blue].some(s =>
      s.z < b.min.z && b.min.z - s.z <= 4 && s.x > b.min.x && s.x < b.max.x);
    if (!low && w >= 12 && northernArrival) for (const direction of [-1, 1]) {
      const arrowX = x + direction * w * .28;
      for (const repeat of [0, .65]) for (const vertical of [-1, 1])
        add(3, arrowX + direction * repeat, base + 1.65 + vertical * .28,
          b.min.z - .018, .86, .16, .003, 'cladding', false,
          new T.Euler(0, 0, -direction * vertical * Math.PI / 4));
    }
  }
  // Eighteen painted tread noses follow each real ramp. They imply a stair
  // without adding physics steps, a lip at the landing, or a fourth floor.
  for (const s of map.structures ?? []) for (const r of s.ramps) {
    for (let step = 1; step < 18; step++) {
      const t = step / 18;
      const x = r.dir === 1 ? r.minX + t * (r.maxX - r.minX) : r.maxX - t * (r.maxX - r.minX);
      add(5, x, r.topY * t + .006, (r.minZ + r.maxZ) / 2, .035, .008, r.maxZ - r.minZ - .08, 'paint');
    }
  }
  // Retaining walls sit outside the server's clamped rectangle, including trim.
  for (const z of [-0.46, depth + 0.46]) {
    const height = z < 0 ? 1.4 : 2.8;
    add(0, cx, height / 2, z, width + 1.8, height, 0.9, 'exterior');
    add(1, cx, height - 0.06, z, width + 1.8, 0.12, 0.91, 'exterior');
    for (let x = 2; x < width; x += 4) add(2, x, height / 2, z, 0.2, height, 0.915, 'exterior');
  }
  for (const x of [-0.46, width + 0.46]) {
    add(1, x, 2.6, cz, 0.9, 5.2, depth, 'exterior');
    for (let z = 2; z < depth; z += 4) {
      add(2, x, 2.6, z, 0.915, 5.2, 0.18, 'exterior');
      add(x < 0 ? 4 : 3, x, 3.4, z + 1.7, 0.915, 1.2, 2.3, 'exterior');
    }
  }
  // North substation: three portal frames and visible ceramic insulator stacks.
  // The generated transformer sits between these bays; all geometry is beyond z=0.
  for (const z of [-5, -13]) {
    for (const x of [cx - 40, cx, cx + 40]) {
      for (const dx of [-5, 5]) {
        add(0, x + dx, 0.45, z, 1.5, 0.9, 1.6, 'exterior');
        add(2, x + dx, 6, z, 0.38, 12, 0.5, 'exterior');
        add(3, x + dx, 1.9, z, 0.39, 2.5, 0.51, 'exterior');
      }
      add(2, x, 11.3, z, 10.6, 0.35, 0.5, 'exterior');
      add(2, x, 12, z, 10.6, 0.22, 0.5, 'exterior');
      for (let dx = -4; dx <= 4; dx += 2) {
        add(2, x + dx, 11.65, z, 0.12, 0.8, 0.25, 'exterior', false, new T.Euler(0, 0, Math.PI / 4));
        add(1, x + dx, 10, z, 0.17, 2.3, 0.17, 'exterior', true);
        for (let yy = 9.3; yy < 10.8; yy += 0.24)
          add(5, x + dx, yy, z, 0.48, 0.10, 0.48, 'exterior', true);
        if (z === -5) add(3, x + dx, 8.8, z - 4, 0.075, 0.075, 8, 'exterior');
      }
    }
  }
  // One north-axis switching mast; entirely outside play, visible above the deck.
  add(1, cx, 13, -5, 2, 26, 2, 'exterior');
  for (const y of [17, 21, 25]) {
    add(2, cx, y, -5, 14, 0.5, 0.8, 'exterior');
    for (const dx of [-6, -3, 3, 6]) {
      add(5, cx + dx, y - 1, -5, 0.65, 1.8, 0.65, 'exterior', true);
      add(3, cx + dx, y - 2, -5, 0.8, 0.3, 0.8, 'exterior');
    }
  }
  // Southern service hall and distant industrial masses balance the open substation.
  // The east hall stands behind the gantry's swept cargo envelope (x <= 158.2),
  // leaving a service apron between its front face at x=162 and the moving load.
  for (const [x, z, w, h, d] of [[cx - 30, depth + 11, 24, 9, 15], [cx + 30, depth + 15, 20, 15, 18], [-10, cz - 12, 12, 14, 22], [width + 20, cz + 12, 16, 19, 26]] as const) {
    add(0, x, (h - 2) / 2, z, w, h - 2, d, 'exterior');
    add(1, x, h - 1, z, w + 0.1, 2, d + 0.1, 'exterior');
    add(2, x, h + 0.5, z, w * 0.7, 1, d * 0.7, 'exterior');
    for (let xx = x - w / 2 + 1; xx < x + w / 2; xx += 2.4)
      add(2, xx, h * 0.45, z, 0.18, h - 2.2, d + 0.012, 'exterior');
    add(4, x, h - 1, z, w + 0.12, 0.3, d + 0.12, 'exterior');
  }
  // West capacitor bank: three ribbed ceramic towers, the middle one taller.
  // All extents remain x <= -4.8; silhouette identifies the half without colour.
  for (const [z, height] of [[cz - 17, 22], [cz, 29], [cz + 17, 22]] as const) {
    add(1, -8, 2, z, 6.4, 4, 6.4, 'exterior');
    add(5, -8, (height + 4) / 2, z, 4.6, height - 4, 4.6, 'exterior', true);
    for (let y = 5; y < height - 1; y += 1.6)
      add(4, -8, y, z, 6.2, .42, 6.2, 'exterior', true);
    add(1, -8, height, z, 5.2, .5, 5.2, 'exterior', true);
    add(3, -8, height + 1.2, z, .6, 2, .6, 'exterior', true);
  }
  // East maintenance crane: broad amber double beam versus the west uprights.
  // Its entire structure is x >= width + 3.9, never across a playable route.
  for (const z of [cz - 22, cz + 22]) {
    add(1, width + 6, 1.4, z, 3.2, 2.8, 3.2, 'exterior');
    add(3, width + 6, 10, z, 1.4, 20, 1.6, 'exterior');
    add(5, width + 6, 16, z, 1.44, 1.5, 1.64, 'exterior');
  }
  for (const x of [width + 4.5, width + 7.5]) {
    add(3, x, 20, cz, 1.2, 2.2, 49, 'exterior');
    add(1, x, 21.2, cz, 1.24, .2, 49, 'exterior');
  }
  // Trolley, hoist cables and cargo are the moving CargoCrane. They are excluded
  // from this permanent AO/shadow bake so a transfer leaves no frozen duplicate.
  // South service hall's three stepped ventilation monitors answer the north
  // mast with a low, broad roof rhythm. Each sits above the exterior hall only.
  for (const x of [cx - 38, cx - 30, cx - 22]) {
    add(3, x, 11, depth + 11, 5.8, 4, 11, 'exterior');
    add(1, x, 13.2, depth + 11, 6.2, .4, 11.4, 'exterior');
    for (const y of [10, 11, 12])
      add(5, x, y, depth + 5.49, 4.8, .25, .02, 'exterior');
  }
  // In-ground cable raceways and crossings, not raised rail obstacles.
  // Flush induction plates: baked concentric bands and flight chevrons make the
  // route readable without a new material, light, pass or collision volume.
  for (const pad of map.launchPads ?? []) {
    const {x,z}=pad.from, direction=Math.sign(pad.to.x-x);
    add(1,x,.006,z,3.5,.012,3.5,'paint');
    for (const size of [3.2,2.6]) for(const side of [-1,1]) {
      add(4,x+side*size/2,.015,z,.1,.008,size,'paint');
      add(4,x,.015,z+side*size/2,size,.008,.1,'paint');
    }
    for(const offset of [-.65,0,.65]) for(const side of [-1,1])
      add(5,x+direction*offset,.022,z+side*.25,.7,.008,.12,'paint',false,
        new T.Euler(0,direction*side*Math.PI/4,0));
    for(const side of [-1,1]) {
      add(3,pad.to.x+side*1.25,3.009,pad.to.z,.12,.008,2.6,'paint');
      add(3,pad.to.x,3.009,pad.to.z+side*1.25,2.6,.008,.12,'paint');
    }
  }
  for (const z of [29, 65]) for (const x of [cx - 40, cx, cx + 40]) {
    add(1, x, 0.002, z, 13, 0.004, 0.30, 'paint');
    for (const side of [-1, 1]) add(5, x, 0.004, z + side * 0.27, 13, 0.005, 0.055, 'paint');
    for (let dx = -2; dx <= 2; dx++) add(3, x + dx * 0.5, 0.005, z + 0.85, 0.19, 0.006, 0.65, 'paint');
  }
  for (const x of [3, width - 3]) for (let z = 4; z <= depth - 4; z += 4)
    add(5, x, 0.004, z, 0.085, 0.006, 2, 'paint');
  // Dashed perimeter of the switching deck; the deck itself remains empty.
  for (const b of map.boxes.filter(b => b.min.x === 66 && b.max.x === 84 && b.max.y === 3)) {
    for (const side of [-1, 1])
      add(3, (b.min.x + b.max.x) / 2, 3.004, (b.min.z + b.max.z) / 2 + side * ((b.max.z - b.min.z) / 2 - 0.10),
        b.max.x - b.min.x - 0.15, 0.006, 0.08, 'paint');
  }
  for (const [key, transforms] of batches) {
    const [zone, mat, shape] = key.split(':');
    const mesh = new T.InstancedMesh(shape === 'c' ? cylinder : box, materials[Number(mat)]!, transforms.length);
    transforms.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.name = `switchyard-${zone}-${mat}-${shape}`;
    mesh.castShadow = zone !== 'paint'; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); scene.add(mesh);
  }
  // Kept separate from the architecture bake so a successful detail load can
  // remove these exact authority envelopes without leaving a baked duplicate.
  const supplyGeometry = new T.BoxGeometry(1, 1, 1);
  const supplyMaterial = new T.MeshStandardMaterial({ color: 0x4c5140, roughness: .92 });
  const supplies = new T.InstancedMesh(supplyGeometry, supplyMaterial, SWITCHYARD_CRATES.length);
  supplies.name = 'switchyard-shell-supplies'; supplies.userData.architectureExclude = true;
  SWITCHYARD_CRATES.forEach((b, i) => supplies.setMatrixAt(i, new T.Matrix4().compose(
    new T.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2),
    new T.Quaternion(), new T.Vector3(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z))));
  supplies.castShadow = supplies.receiveShadow = true;
  supplies.computeBoundingSphere(); scene.add(supplies);
  if (bakeOnly) return;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const labels = ['SWITCHYARD / 03', '01 / NORTH BUS', 'JUMP > DECK', '03 / SOUTH SERVICE',
    'MAINTENANCE / WEST', 'DISPATCH / EAST', 'STAIR > ROOF', 'SERVICE / 04'];
  labels.forEach((label, i) => {
    ctx.fillStyle = '#353b36'; ctx.fillRect(0, i * 128, 1024, 128);
    ctx.fillStyle = i === 1 ? '#a8b7a5' : '#c5b185'; ctx.fillRect(16, i * 128 + 18, 12, 92);
    ctx.fillStyle = '#e1e0cf'; ctx.font = '600 58px Arial'; ctx.fillText(label, 46, i * 128 + 84);
  });
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  const mat = new T.MeshBasicMaterial({ map: texture });
  const signParts: T.BufferGeometry[] = [];
  const sign = (label: number, x: number, y: number, z: number, yaw = 0, width = 5.5) => {
    const geo = new T.PlaneGeometry(width, width / 8), uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + 7 - label) / 8);
    geo.rotateY(yaw).translate(x, y, z); signParts.push(geo);
  };
  sign(0, cx, 0.75, 0.006, 0, 9);
  sign(1, 25, 2.4, 8.024, 0, 7);
  sign(1, width - 25, 2.4, 8.024, 0, 7);
  sign(3, cx, 2.4, 97.976, Math.PI, 7);
  sign(2, 69, 2.4, 58.024, 0, 4);
  for (const pad of map.launchPads ?? []) {
    const direction=Math.sign(pad.to.x-pad.from.x);
    // Label on the actual deck wall directly above the marked pad.
    sign(2,direction>0?65.976:84.024,2.1,pad.from.z,direction>0?-Math.PI/2:Math.PI/2,3.8);
  }
  sign(0, width * .3, 2.05, depth - 0.006, Math.PI, 7);
  for (const s of map.structures ?? []) {
    const mid = (s.footprint.minX + s.footprint.maxX) / 2, west = mid < cx;
    // Names on the solid parapets; tiny lintels receive only short door labels.
    sign(west ? 4 : 5, mid, 3.56, s.footprint.minZ - .016, Math.PI, 6.8);
    for (const dx of [-5, 5]) sign(west ? 4 : 5, mid + dx, 3.56, s.footprint.maxZ + .016, 0, 5.5);
    sign(7, mid, 2.53, s.footprint.maxZ + .016, 0, 2.4);
    // Interior north-facing parapet above the stair entrance (opposing arrow
    // is expressed by placement; text remains upright on both halves).
    sign(6, mid, 3.54, s.footprint.minZ + .416, 0, 4);
  }
  const signs = new T.Mesh(mergeGeometries(signParts)!, mat);
  signs.name = 'switchyard-signs'; scene.add(signs);
  signParts.forEach(g => g.dispose());
}

/** Per-map lazy library detail, resolved before texture/program preparation. */
export async function loadSwitchyardSupplies(scene: T.Scene): Promise<void> {
  const library = createPropLibrary();
  const finishes = new Map<T.MeshStandardMaterial, T.MeshStandardMaterial>();
  try {
    const crates = await Promise.all(SWITCHYARD_CRATES.map(async b => {
      const root = await library.load('ammo-crate-stack');
      root.position.set((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
      root.traverse(node => {
        if (!(node instanceof T.Mesh)) return;
        node.castShadow = node.receiveShadow = true;
        const finish = (source: T.Material): T.Material => {
          if (!(source instanceof T.MeshStandardMaterial)) return source;
          let material = finishes.get(source);
          if (!material) {
            // Four small painted supplies need their colour/edge detail, but
            // their extra normal/ORM maps pushed the full fight to34textures.
            // One shared, map-owned finish keeps the32texture gate intact.
            material = source.clone(); material.name = 'switchyard-issued-crate';
            material.normalMap = material.aoMap = material.roughnessMap = material.metalnessMap = null;
            material.roughness = .86; material.metalness = .08;
            finishes.set(source, material);
          }
          return material;
        };
        node.material = Array.isArray(node.material) ? node.material.map(finish) : finish(node.material);
      });
      return root;
    }));
    const group = new T.Group(); group.name = 'switchyard-issued-supplies'; group.add(...crates); scene.add(group);
    const fallback = scene.getObjectByName('switchyard-shell-supplies');
    if (fallback instanceof T.InstancedMesh) {
      scene.remove(fallback); fallback.geometry.dispose(); (fallback.material as T.Material).dispose(); fallback.dispose();
    }
  } catch (error) {
    for (const material of finishes.values()) material.dispose();
    library.dispose(); console.warn('Switchyard supply detail unavailable; retaining authoritative crate envelopes.', error);
  }
}
