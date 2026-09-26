import * as T from 'three';
import type { MapDef } from '../src/map/types.js';
import { buildSiteGround } from './site-ground.js';
import { SWITCHYARD_FINISH } from './switchyard-palette.js';
import { SWITCHYARD_CRATES } from '../src/map/switchyard-structures.js';
import { SWITCHYARD_YARD_PARTS, SWITCHYARD_YARD_CRATES } from '../src/map/switchyard-yard.js';
import { createPropLibrary, PROP_LIBRARY } from './prop-library.js';
import { switchyardSiteBoundary, switchyardSiteSigns, switchyardSiteSupplies } from './switchyard-site.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blockingEnvironmentBoxes } from '../src/map/environment-props.js';

/** Late-war front supply depot. Complete collider envelopes remain visibly
 * solid; millimetre face cladding cannot create a route, opening or extra cover.
 * Palette slots: 0 brick, 1 iron, 2 ammunition-box stacks, 3/4 timber,
 * 5 burlap sandbags. Wagons and sidings stand entirely outside the bounds. */
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
  const yardParts = new Map(SWITCHYARD_YARD_PARTS.map(p => [p.box, p]));
  const environmentBoxes = new Set(blockingEnvironmentBoxes('switchyard'));
  for (const b of map.boxes) {
    if (map.terrain?.boxes.includes(b)) continue; // exposed terrain owns earth faces
    if (map.signalCore?.doors.includes(b)) continue;
    if (environmentBoxes.has(b)) continue;
    if (SWITCHYARD_CRATES.includes(b) || SWITCHYARD_YARD_CRATES.includes(b)) continue; // removable supply fallback below
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
    const x = (b.min.x + b.max.x) / 2, z = (b.min.z + b.max.z) / 2, base = b.min.y;
    const low = h < 1.5;
    const yard = yardParts.get(b);
    if (yard) {
      // West store is brick, the east shed a timber revetment on iron stakes,
      // and the benches are rows of stacked ammunition boxes.
      const bench = yard.kind === 'bench', steel = !yard.west && !bench;
      add(bench ? 2 : steel ? 3 : 0, x, base + h / 2, z, w, h, d, 'shell');
      const alongX = w >= d;
      for (const side of [-1, 1]) {
        const fx = alongX ? x : x + side * (w / 2 + .004);
        const fz = alongX ? z + side * (d / 2 + .004) : z;
        const length = alongX ? w : d;
        const strip = (mat: number, offset: number, y: number, span: number, height: number, depth = .008) =>
          add(mat, fx + (alongX ? offset : 0), y, fz + (alongX ? 0 : offset),
            alongX ? span : depth, height, alongX ? depth : span);
        if (steel) {
          for (const y of [base + h * .3, base + h * .78]) strip(4, 0, y, length, .16, .012);
          for (let p = -length / 2 + .2; p < length / 2; p += 1.6) strip(1, p, base + h / 2, .1, h, .016);
        } else if (!bench && base === 0) {
          strip(1, 0, .12, length, .24, .006); // sooty plinth, clipped to the piece
        }
      }
      if (bench) add(3, x, b.max.y + .004, z, w * .9, .008, d * .8); // tarpaulin boards
      continue;
    }
    const part = structureParts.get(b);
    if (part) {
      if (base < 0) {
        add(part.kind === 'cover' ? 2 : part.kind === 'slab' ? 3 : 0, x, base + h / 2, z, w, h, d, 'shell');
        if (part.kind === 'wall') {
          const face = z < 72 ? b.max.z + .004 : b.min.z - .004;
          // Brick unloading cut: sooty foot, timber fender and coping boards.
          add(1, x, -2.73, face, w, .5, .008);
          add(4, x, -.09, z, w, .18, d + .008);
          add(4, x, -1.2, face, w, .22, .012);
        } else if (part.kind === 'slab') {
          // Plank unloading platform; open sides are real drops with edge beams.
          for (const side of [-1, 1]) add(1, x + side * (w / 2 - .13), .006, z, .16, .008, d);
        } else {
          add(3, x, b.max.y + .004, z, w * .9, .008, d * .8);
        }
        continue;
      }
      // Exact slab/lintel/sill envelopes. Cabinet panels used on the old sealed
      // blocks must never extend down across a doorway or below a roof slab.
      add(part.kind === 'cover' ? 2 : 0, x, base + h / 2, z, w, h, d, 'shell');
      if (part.kind === 'wall') {
        const accent = x < cx ? 4 : 3;
        for (const side of [-1, 1]) {
          const alongX = w > d;
          const faceX = alongX ? x : x + side * (w / 2 + .004);
          const faceZ = alongX ? z + side * (d / 2 + .004) : z;
          // Dado is bounded to the piece; windows, doors and roof escape stay open.
          if (base === 0 && h >= 1.1) {
            add(accent, faceX, .44, faceZ, alongX ? w : .008, .64, alongX ? .008 : d);
            add(1, faceX, .8, faceZ, alongX ? w : .008, .04, alongX ? .008 : d);
          }
          if (base === 3) add(1, faceX, 3.88, faceZ, alongX ? w : .008, .09, alongX ? .008 : d);
        }
      } else if (part.kind === 'slab') {
        // Thin opaque wearing surface, inset from all stairwell edges.
        add(4, x, b.max.y + .003, z, Math.max(.01, w - .04), .006, Math.max(.01, d - .04));
      }
      continue;
    }
    // Exact authority volume, including its top. No decorative gaps through cover.
    // Low covers are sandbag walls; screens and the freight stack are stacked
    // ammunition boxes; the loading platform is timber; tall blocks are brick
    // stores; the platform post is an iron water-crane column.
    const platform = w >= 12 && d >= 12, column = h > 6, store = !column && h > 4;
    add(low ? 5 : platform ? 4 : column ? 1 : store ? 0 : 2, x, base + h / 2, z, w, h, d, 'shell');
    if (low) {
      add(1, x, base + .06, z, w + .006, .12, d + .006); // mud at the bag foot
    } else if (platform) {
      for (const side of [-1, 1]) {
        add(1, x, b.max.y - .12, z + side * (d / 2 + .004), w, .2, .008); // edge beams
        add(1, x + side * (w / 2 + .004), b.max.y - .12, z, .008, .2, d);
        for (let px = b.min.x + 1; px < b.max.x; px += 2.4)
          add(3, px, base + h / 2 - .1, z + side * (d / 2 + .008), .22, h - .3, .006); // trestle posts
      }
    } else if (store) {
      add(3, x, b.max.y + .004, z, w, .008, d); // timber roof boarding
      for (const side of [-1, 1]) add(1, x, b.max.y - .3, z + side * (d / 2 + .004), w, .12, .008);
    } else if (column) {
      add(3, x, base + h - .5, z, w + .02, .3, d + .02);
    } else {
      // Tarpaulin boards weighted with a sandbag row along the stack top.
      add(3, x, b.max.y + .004, z, w * .96, .008, d * .92);
      add(5, x, b.max.y + .0125, z, w * .9, .009, Math.min(.6, d * .5));
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
      const base = r.baseY ?? 0;
      add(1, x, base + (r.topY - base) * t + .006, (r.minZ + r.maxZ) / 2, .035, .008, r.maxZ - r.minZ - .08, 'paint');
    }
  }
  if (map.terrain) {
    // Exact earth side/bottom shells. Their top faces belong to siteGround,
    // whose UV-mapped horizontal faces must stay exposed, including the cut.
    const earthGeometry = box.clone(), indices = [], normals = earthGeometry.getAttribute('normal');
    for (let i = 0; i < earthGeometry.index!.count; i += 3) {
      const a = earthGeometry.index!.getX(i);
      if (normals.getY(a) > .5) continue;
      indices.push(a, earthGeometry.index!.getX(i + 1), earthGeometry.index!.getX(i + 2));
    }
    earthGeometry.setIndex(indices); earthGeometry.clearGroups();
    const earth = new T.InstancedMesh(earthGeometry, materials[0]!, map.terrain.boxes.length);
    earth.name = 'switchyard-shell-earth';
    map.terrain.boxes.forEach((b, i) => earth.setMatrixAt(i, new T.Matrix4().compose(
      new T.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2),
      new T.Quaternion(), new T.Vector3(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z))));
    earth.castShadow = earth.receiveShadow = true; earth.computeBoundingSphere(); scene.add(earth);
    // Retired, inset rail and sleeper marks. All faces stay within 2cm of the
    // real floor, so there is no decorative step or uncollidable cover.
    const c = map.terrain.cut, floor = map.bounds.floor ?? -3;
    for (let px = c.minX + 9; px < c.maxX - 8; px += .75)
      add(4, px, floor + .002, 72, .2, .004, 2.6, 'paint');
    for (const z of [71.28, 72.72]) {
      add(1, 75, floor + .009, z, c.maxX - c.minX - 18, .012, .10, 'paint');
    }
    for (const x of [c.minX - 1.5, c.maxX + 1.5]) for (const z of [69, 75])
      add(3, x, .007, z, 1.4, .008, .15, 'paint');
  }
  for (const p of switchyardSiteBoundary(width, depth))
    add(p.material, p.x, p.y, p.z, p.w, p.h, p.d, 'exterior', false, new T.Euler(0, p.yaw, 0));
  // Flush thresholds lead through the offset breaches; no paint spans the rail cut.
  for (const east of [false, true]) for (const [px, pz] of [[47, 35.5], [46, 44.5], [52.5, 42]] as const) {
    const x = east ? width - px : px;
    add(3, x, .005, pz, 2.4, .006, .16, 'paint');
    for (const dx of [-.85, 0, .85]) add(1, x + dx, .009, pz, .22, .002, .16, 'paint');
  }
  // North sidings: a standard-gauge track on sleepers between the boundary
  // wall and the goods sheds, with timber box vans and one shell-wrecked van.
  // Every part is at z <= -5.6, entirely outside play.
  const siding = -6.8;
  for (const side of [-1, 1]) add(1, cx, .07, siding + side * .72, width + 60, .12, .08, 'exterior');
  for (let px = -28; px <= width + 28; px += 1.4) add(4, px, .03, siding, .24, .06, 2.2, 'exterior');
  for (const [vx, wrecked] of [[4, false], [57, false], [65, false], [91, true], [142, false]] as const) {
    const tilt = wrecked ? new T.Euler(.16, .08, -.05) : new T.Euler();
    add(1, vx, .75, siding, 7.2, .3, 2.2, 'exterior', false, tilt);
    add(wrecked ? 1 : 4, vx, 2, siding, 7, wrecked ? 1.6 : 2.4, 2.5, 'exterior', false, tilt);
    if (!wrecked) {
      add(1, vx, 3.27, siding, 7.3, .14, 2.7, 'exterior');
      for (const side of [-1, 1]) add(3, vx, 1.95, siding + side * 1.26, 1.7, 2.1, .02, 'exterior');
    }
    for (const wx of [-2.3, 2.3]) for (const side of [-1, 1])
      add(1, vx + wx, .46, siding + side * .72, .92, .1, .92, 'exterior', true, new T.Euler(Math.PI / 2, 0, 0));
  }
  // West dump: a timber water tower above the goods sheds and two tarpaulined
  // ammunition stacks in the shed gaps. All extents remain x <= -4.8.
  for (const dx of [-1.8, 1.8]) for (const dz of [-1.8, 1.8]) add(1, -28 + dx, 4.5, 36 + dz, .3, 9, .3, 'exterior');
  add(4, -28, 11, 36, 5.2, 4, 5.2, 'exterior', true);
  add(1, -28, 13.2, 36, 5.6, .4, 5.6, 'exterior', true);
  add(1, -28, 9, 36, 5, .25, 5, 'exterior');
  for (const z of [35.5, 66.5]) {
    add(2, -7.5, 1.4, z, 5.4, 2.8, 4.2, 'exterior');
    add(3, -7.5, 2.84, z, 5.6, .08, 4.4, 'exterior');
  }
  // East maintenance crane: broad amber double beam versus the west uprights.
  // Its entire structure is x >= width + 3.9, never across a playable route.
  for (const z of [cz - 22, cz + 22]) {
    add(1, width + 6, 1.4, z, 3.2, 2.8, 3.2, 'exterior');
    add(3, width + 6, 10, z, 1.4, 20, 1.6, 'exterior');
    add(1, width + 6, 16, z, 1.44, 1.5, 1.64, 'exterior');
  }
  for (const x of [width + 4.5, width + 7.5]) {
    add(3, x, 20, cz, 1.2, 2.2, 49, 'exterior');
    add(1, x, 21.2, cz, 1.24, .2, 49, 'exterior');
  }
  // Trolley, hoist cables and cargo are the moving CargoCrane. They are excluded
  // from this permanent AO/shadow bake so a transfer leaves no frozen duplicate.
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
  // Flush narrow-gauge trolley lines across the courts: sleepers and two rails.
  for (const z of [29, 65]) for (const x of [cx - 40, cx, cx + 40]) {
    for (let dx = -6; dx <= 6; dx += .9) add(4, x + dx, .003, z, .16, .006, 1.3, 'paint');
    for (const side of [-1, 1]) add(1, x, .006, z + side * .38, 13, .012, .06, 'paint');
  }
  for (const x of [3, width - 3]) for (let z = 4; z <= depth - 4; z += 4)
    add(1, x, 0.004, z, 0.085, 0.006, 2, 'paint');
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
  const exteriorSupplies = switchyardSiteSupplies(depth).map(p => {
    const [w,h,d] = PROP_LIBRARY['ammo-crate-stack'].sizeM;
    return {min:{x:p.x-w/2,y:p.y,z:p.z-d/2},max:{x:p.x+w/2,y:p.y+h,z:p.z+d/2}};
  });
  // Only the interior supplies are authority shells. Exterior fallbacks have
  // the same separate classification as the rest of the out-of-bounds depot.
  for (const [name, supplyBoxes] of [
    ['switchyard-shell-supplies', [...SWITCHYARD_CRATES, ...SWITCHYARD_YARD_CRATES]],
    ['switchyard-exterior-supplies', exteriorSupplies],
  ] as const) {
  const supplyGeometry = new T.BoxGeometry(1, 1, 1);
  const supplyMaterial = new T.MeshStandardMaterial({ color: 0x4c5140, roughness: .92 });
  const supplies = new T.InstancedMesh(supplyGeometry, supplyMaterial, supplyBoxes.length);
  supplies.name = name; supplies.userData.architectureExclude = true;
  supplyBoxes.forEach((b, i) => supplies.setMatrixAt(i, new T.Matrix4().compose(
    new T.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2),
    new T.Quaternion(), new T.Vector3(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z))));
  supplies.castShadow = supplies.receiveShadow = true;
  supplies.computeBoundingSphere(); scene.add(supplies);
  }
  if (bakeOnly) return;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const labels = ['SUPPLY DEPOT No. 3', 'No. 1 SIDING', 'RAMP > PLATFORM', 'SOUTH STORES',
    'BAGGAGE OFFICE', 'SIGNAL OFFICE', 'STAIR > ROOF', 'STORES No. 4', 'UNLOADING',
    'S.A.A. STORE', 'GANTRY', 'GOODS DEPOT', 'R.E. STORES'];
  const row = canvas.height / labels.length;
  labels.forEach((label, i) => {
    // Hand-painted boards: dark creosoted plank, cream serif lettering.
    ctx.fillStyle = '#3a342b'; ctx.fillRect(0, i * row, 1024, row);
    ctx.fillStyle = '#2c2721'; ctx.fillRect(0, i * row + row * .48, 1024, 3);
    ctx.fillStyle = '#d9d0b6'; ctx.font = '600 58px Georgia, serif'; ctx.fillText(label, 36, i * row + row * .69);
  });
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  const mat = new T.MeshBasicMaterial({ map: texture });
  const signParts: T.BufferGeometry[] = [];
  const sign = (label: number, x: number, y: number, z: number, yaw = 0, width = 5.5) => {
    const geo = new T.PlaneGeometry(width, width / 8), uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + labels.length - 1 - label) / labels.length);
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
  for (const s of switchyardSiteSigns(width, depth)) sign(s.label, s.x, s.y, s.z, s.yaw, s.width);
  for (const east of [false, true]) {
    const x = (v: number) => east ? width - v : v;
    sign(east ? 12 : 9, x(51.5), 2.25, 35.984, Math.PI, 4.4);
    sign(east ? 12 : 9, x(42.5), 2.25, 44.016, 0, 2.8);
    sign(1, x(51.5), 2.25, 37.016, 0, 4.4);
  }
  for (const s of map.structures ?? []) {
    if (s.id === 'rail-loading-cut') {
      for (const x of [45, 105]) {
        sign(8, x, -1.05, 68.416, 0, 4.5);
        sign(8, x, -1.05, 75.584, Math.PI, 4.5);
      }
      continue;
    }
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
export async function loadSwitchyardSupplies(scene: T.Scene, depth: number): Promise<void> {
  const library = createPropLibrary();
  const finishes = new Map<T.MeshStandardMaterial, T.MeshStandardMaterial>();
  try {
    const positions = [
      ...[...SWITCHYARD_CRATES, ...SWITCHYARD_YARD_CRATES].map(b => ({x:(b.min.x+b.max.x)/2,y:b.min.y,z:(b.min.z+b.max.z)/2})),
      ...switchyardSiteSupplies(depth),
    ];
    const crates = await Promise.all(positions.map(async p => {
      const root = await library.load('ammo-crate-stack');
      root.position.set(p.x, p.y, p.z);
      root.traverse(node => {
        if (!(node instanceof T.Mesh)) return;
        node.castShadow = node.receiveShadow = true;
        const finish = (source: T.Material): T.Material => {
          if (!(source instanceof T.MeshStandardMaterial)) return source;
          let material = finishes.get(source);
          if (!material) {
            // Small painted supplies need their colour/edge detail, but
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
    for (const name of ['switchyard-shell-supplies', 'switchyard-exterior-supplies']) {
    const fallback = scene.getObjectByName(name);
    if (fallback instanceof T.InstancedMesh) {
      scene.remove(fallback); fallback.geometry.dispose(); (fallback.material as T.Material).dispose(); fallback.dispose();
    }
    }
  } catch (error) {
    for (const material of finishes.values()) material.dispose();
    library.dispose(); console.warn('Switchyard supply detail unavailable; retaining authoritative crate envelopes.', error);
  }
}
