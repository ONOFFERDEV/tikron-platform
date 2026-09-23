import * as T from 'three';
import type { MapDef } from '../src/map/types.js';
import type { Box } from '../src/physics.js';
import { buildSiteGround } from './site-ground.js';
import { UNDERTOW_FINISH } from './undertow-palette.js';
import { undertowSkylineParts } from './undertow-skyline.js';
import { UNDERTOW_CRATES } from '../src/map/undertow-structures.js';
import { UNDERTOW_SLUICE_PARTS, UNDERTOW_YARD_PARTS, UNDERTOW_YARD_CRATES } from '../src/map/undertow-yard.js';
import { createPropLibrary, PROP_LIBRARY } from './prop-library.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { undertowCanalSurface, undertowFieldKitPlacements, undertowSiteBoundary, undertowSiteSigns, undertowSiteSupplies } from './undertow-site.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { blockingEnvironmentBoxes } from '../src/map/environment-props.js';

/** Original canal redoubt kit. Timber revetments preserve the solid collision
 * envelope; thin boards never create openings or additional playable cover. */
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
  // Deterministic irregularity: repairs and bag courses never repeat per bay.
  const jitter = (a: number, b: number) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
  // Thin tile on a solid face. 'z' faces span x, 'x' faces span z; off + t/2
  // stays inside the 0.02 m cladding limit, so no tile reads as extra cover.
  const tile = (m: number, b: Box, axis: 'x' | 'z', side: number, u: number, y: number, du: number, dy: number, off = .006, t = .01) =>
    axis === 'z' ? add(m, u, y, (side < 0 ? b.min.z : b.max.z) + side * off, du, dy, t)
      : add(m, (side < 0 ? b.min.x : b.max.x) + side * off, y, u, t, dy, du);
  // Sandbag courses as irregular runs of a few bags; the dark body reads as seams.
  const bagCourses = (b: Box, axis: 'x' | 'z', side: number, u0: number, u1: number, y0: number, courses: number, hc: number) => {
    for (let c = 0; c < courses; c++) {
      let u = u0 - (c % 2 ? .35 : 0);
      while (u < u1 - .1) {
        const r = jitter(u + u0 * 3.1, c + y0), e = Math.min(u + 1.4 + r * 1.6, u1), a = Math.max(u, u0);
        if (e - a > .15) tile(3, b, axis, side, (a + e) / 2, y0 + c * hc + hc / 2, e - a - .05, hc - .045, .005 + r * .006);
        u = e;
      }
    }
  };
  if (!bakeOnly) buildSiteGround(scene, map, true);
  const structureParts = new Map((map.structures ?? []).flatMap(s => s.parts.map(p => [p.box, p] as const)));
  const yardParts = new Map([...UNDERTOW_YARD_PARTS, ...UNDERTOW_SLUICE_PARTS].map(p => [p.box, p]));
  const environmentBoxes = new Set(blockingEnvironmentBoxes('undertow'));
  for (const b of map.boxes) {
    if (map.terrain?.boxes.includes(b)) continue; // floor mesh owns earth faces
    if (map.signalCore?.doors.includes(b)) continue;
    if (environmentBoxes.has(b)) continue;
    if (UNDERTOW_CRATES.includes(b) || UNDERTOW_YARD_CRATES.includes(b)) continue; // separate detail/fallback pair, never baked twice
    const x = (b.min.x + b.max.x) / 2, z = (b.min.z + b.max.z) / 2;
    const w = b.max.x - b.min.x, h = b.max.y - b.min.y, d = b.max.z - b.min.z;
    const yard = yardParts.get(b);
    if (yard) {
      const bench = yard.kind === 'bench', steel = !yard.west && !bench;
      add(bench ? 2 : steel ? 2 : 0, x, b.min.y + h / 2, z, w, h, d);
      // Flush cladding only: no panel bridges an opening or hides false cover.
      for (const side of [-1, 1]) {
        const face = z + side * (d / 2 + .004);
        if (steel) {
          for (let px = b.min.x + .15; px < b.max.x; px += .38)
            add(1, px, b.min.y + h / 2, face, .04, h, .008);
        } else if (!bench) {
          for (let py = b.min.y + .48; py < b.max.y; py += .5)
            add(2, x, py, face, w, .016, .008);
          add(4, x, b.min.y + Math.min(.3, h / 2), face + side * .005, w, Math.min(.55, h), .002);
        } else {
          // Former switch consoles become sandbagged fire-steps.
          bagCourses(b, 'z', side, b.min.x, b.max.x, b.min.y, 3, h / 3);
        }
      }
      if (bench) for (let px = b.min.x + .02; px < b.max.x - .1; px += .3)
        add(jitter(px, z) < .5 ? 4 : 5, Math.min(px + .14, b.max.x - .14), b.max.y + .004, z, .26, .008, d - .03);
      continue;
    }
    const structure = structureParts.get(b);
    if (structure) {
      // Exact thin wall/lintel/slab faces: old turbine cladding would close
      // the apertures and wrongly move elevated surfaces back to the yard.
      if (b.min.y < 0) {
        // Below-grade concrete and pump cabinets keep their real elevations.
        add(structure.kind === 'cover' ? 1 : 0, x, b.min.y + h / 2, z, w, h, d);
        if (structure.kind === 'wall') {
          // Drain revetment: stakes, boards and gaps where the wet cut shows,
          // flush to the retaining face. No pipe or light occupies the lane.
          const side = z < 71 ? 1 : -1, face = z < 71 ? b.max.z + .004 : b.min.z - .004;
          add(2, x, -2.75, face, w, .5, .008);
          for (let px = b.min.x + .05; px < b.max.x - .2; px += .5) {
            const r = jitter(px, z);
            if (r < .08) continue; // missing board: the wet cut shows through
            add(r < .55 ? 4 : 5, px + .24, -1.45 - r * .08, face + side * .004, .46, 2.7 - r * .16, .008);
          }
          for (let px = b.min.x + 1; px < b.max.x; px += 2.2)
            add(1, px, -1.5, face + side * .01, .14, 3, .008);
          add(4, x, -.55, face + side * .012, w, .14, .006);
        } else if (structure.kind === 'slab') {
          // Flush steel wearing surface and painted edge strips; open sides
          // are real drops. No non-colliding rail suggests false protection.
          add(2, x, b.max.y + .003, z, w - .04, .006, d);
          for (const side of [-1,1]) add(5, x + side * (w/2-.12), b.max.y+.008, z, .12, .004, d);
        } else if (structure.kind === 'cover') {
          add(2, x, b.max.y + .004, z, w, .008, d);
          for (let py = b.min.y + .3; py < b.max.y - .2; py += .2)
            add(2, x, py, b.max.z + .006, w * .75, .035, .01);
        }
        continue;
      }
      const console = structure.kind === 'cover';
      add(console ? 5 : 0, x, b.min.y + h / 2, z, w, h, d);
      if (console) {
        // Former control desks: plank map tables with one pinned sheet.
        for (let px = b.min.x + .02; px < b.max.x - .1; px += .32)
          add(4, Math.min(px + .15, b.max.x - .15), b.max.y + .004, z, .28, .008, d - .02);
        add(3, x + (jitter(x, z) - .5) * .6, b.max.y + .01, z, .42, .004, .3);
      } else if (structure.kind === 'wall' && b.min.y === 0 && h >= 1.1) {
        // Damp tide line on the masonry, no painted factory stripe.
        for (const side of [-1, 1]) {
          if (w > d) add(1, x, .28, z + side * (d / 2 + .004), w, .56, .008);
          else add(1, x + side * (w / 2 + .004), .28, z, .008, .56, d);
        }
      }
      continue;
    }
    if (b.min.y > 0) {
      if (b.min.y === 3) {
        // Gallery lintel: every cladding piece stays above standing clearance.
        add(1,x,b.min.y+h/2,z,w,h,d);
        add(4,x,b.max.y-.09,z,w+.006,.18,d+.006);
        continue;
      }
      // Field-office chimney: brick stack, corbelled cap and soot, all inside
      // the authoritative envelope.
      add(0,x,b.min.y+h/2,z,w,h,d);
      add(1,x,b.max.y-.35,z,w+.012,.3,d+.012);
      add(2,x,b.max.y-.9,z,w+.006,.8,d+.006);
      add(1,x,b.min.y+.2,z,w+.012,.4,d+.012);
      continue;
    }
    const low = h < 1.5, control = h > 4, screen = d > 8;
    const accent = x < width / 2 ? 4 : 5;
    add(low ? 2 : control ? 1 : 0, x, (h - .18) / 2, z, w, h - .18, d);
    add(2, x, 0.14, z, w + 0.004, 0.28, d + 0.004);
    add(low ? 2 : control ? 1 : 4, x, h - 0.09, z, w + 0.006, 0.18, d + 0.006);
    if (low) {
      // Sandbagged low cover: three staggered courses and a double top row.
      // The dark core reads as seams; every bag stays on the solid envelope.
      for (const side of [-1, 1]) {
        bagCourses(b, 'z', side, b.min.x, b.max.x, 0, 3, h / 3);
        bagCourses(b, 'x', side, b.min.z, b.max.z, 0, 3, h / 3);
      }
      const long = w >= d;
      for (const lane of [-1, 1]) {
        if (long) add(3, x, h + .004, z + lane * d / 4, w - .06, .008, d / 2 - .05);
        else add(3, x + lane * w / 4, h + .004, z, w / 2 - .05, .008, d - .06);
      }
    } else if (screen) {
      // Fire-trench revetment: wet masonry footing, irregular boards held by
      // stakes and walers, corrugated-iron repairs and a sandbag parapet.
      for (const side of [-1, 1]) {
        const mouth = b.min.z + d * (side < 0 ? .55 : .35), clear = (pz: number) => Math.abs(pz - mouth) > 1.2;
        for (let pz = b.min.z + .05; pz < b.max.z - .3; pz += .42) {
          const r = jitter(pz, x + side);
          if (r < .07) continue;
          const top = 2.18 - r * .14;
          tile(r < .6 ? 4 : 5, b, 'x', side, Math.min(pz + .2, b.max.z - .2), (.3 + top) / 2, .39, top - .3);
        }
        for (let pz = b.min.z + 1.2; pz < b.max.z - .5; pz += 2.4) if (clear(pz))
          tile(1, b, 'x', side, pz, 1.2, .15, 2.4, .014, .01);
        for (const y of [.8, 1.7]) tile(4, b, 'x', side, (b.min.z + b.max.z) / 2, y, d - .1, .13, .012, .008);
        for (let pz = b.min.z + 3; pz < b.max.z - 3; pz += 7 + jitter(pz, side) * 5) {
          if (!clear(pz) || !clear(pz + 1) || !clear(pz - 1)) continue;
          const r = jitter(side, pz);
          tile(2, b, 'x', side, pz, .95 + r * .5, 1.2 + r * .6, 1 + r * .4, .016, .006);
        }
        bagCourses(b, 'x', side, b.min.z, b.max.z, 2.26, 2, .36);
        // One gas-curtained dugout mouth per trench face: a closed blanket
        // on the solid face, framed in timber, never a walkable opening.
        for (const du of [-.72, .72]) tile(4, b, 'x', side, mouth + du, 1.05, .16, 2.1, .016, .006);
        tile(4, b, 'x', side, mouth, 2.12, 1.66, .2, .016, .006);
        tile(2, b, 'x', side, mouth, 1.02, 1.28, 2, .014, .008);
        bagCourses(b, 'x', side, mouth - 1.9, mouth - .85, .28, 3, .3);
        bagCourses(b, 'x', side, mouth + .85, mouth + 1.9, .28, 3, .3);
      }
      for (let pz = b.min.z; pz < b.max.z - .1; pz += .7)
        add(3, x, h + .004, Math.min(pz + .33, b.max.z - .33), w - .08, .008, .64);
    } else {
      for (const side of [-1, 1]) {
        const face = z + side * (d / 2 + 0.006);
        if (control) {
          // Field office: masonry string course, boarded upper windows, a
          // notice board and field telephone. No lamps or control panels.
          add(4, x, 3.05, face, w - .2, .2, .012);
          if (side < 0) for (const dx of [-2.6, 2.6]) {
            add(4, x + dx, 4.3, face, 1.4, 1.2, .01);
            for (const bx of [-.4, 0, .4]) add(5, x + dx + bx, 4.3 - jitter(dx, bx) * .06, face + side * .006, .36, 1.02, .006);
          }
          add(4, x - 1.2, 1.45, face, 1.3, .85, .01);
          for (const [dx, dy] of [[-.35, .12], [.05, -.05], [.4, .1]] as const)
            add(3, x - 1.2 + dx, 1.45 + dy, face + side * .007, .26, .34, .004);
          add(2, x + .9, 1.35, face + side * .002, .32, .42, .014);
          if (side < 0) bagCourses(b, 'z', side, b.min.x + .3, b.max.x - .3, 0, 3, .34);
          continue;
        } else {
          // Timber revetment lies entirely against the solid redoubt envelope.
          const boards = Math.max(1, Math.ceil(w / .36));
          const boardWidth = w / boards;
          for (let i = 0; i < boards; i++) {
            const px = b.min.x + (i + .5) * boardWidth;
            add(i % 4 === 0 ? 4 : 5, px, h / 2, face, boardWidth - .018, h - .24, .012);
          }
          for (const height of [.27, .73])
            add(4, x, h * height, face + side * .008, w - .04, .13, .008);
        }
        // Sandbag parapet replaces the old painted top band.
        bagCourses(b, 'z', side, b.min.x + .05, b.max.x - .05, h - .74, 2, .36);
      }
      if (control) continue;
      for (const side of [-1, 1]) for (const height of [.27, .73])
        add(4, x + side * (w / 2 + .006), h * height, z, .012, .13, d - .04);
    }
  }
  // Stair nosings and door headers stay millimetres from authoritative faces.
  // Smooth ramp collision carries movement; the markings only describe it.
  for (const s of map.structures ?? []) {
    for (const r of s.ramps) for (let step = 1; step < 18; step++) {
      const t = step / 18, x = r.dir === 1 ? r.minX + t * (r.maxX - r.minX) : r.maxX - t * (r.maxX - r.minX);
      const y = (r.baseY ?? 0) + (r.topY - (r.baseY ?? 0)) * t;
      add(3, x, y + .006, (r.minZ + r.maxZ) / 2, .028, .008, r.maxZ - r.minZ - .08);
    }
    if (s.id === 'pump-channel') continue;
    for (const offset of [7, 15]) {
      const x = s.footprint.minX + offset, z = s.footprint.maxZ + .004;
      // Timber door head with one small sodium lamp, no fluorescent strip.
      add(4, x, 2.54, z, 2, .27, .008);
      add(6, x, 2.58, z + .007, .32, .06, .004);
    }
  }
  // Built plant mass replaces the thin enclosure. Exact full extents are
  // audited outside the shared movement rectangle, including yawed roofs.
  for (const p of undertowSiteBoundary(width, depth))
    add(p.material, p.x, p.y, p.z, p.w, p.h, p.d, false, 0, 0, p.yaw);
  for (const p of undertowSkylineParts(width, depth))
    add(p.material, p.x, p.y, p.z, p.w, p.h, p.d, false, 0, p.roll, p.yaw);
  // Objective outlines remain as readable gameplay markers.
  for (const cap of Object.values(map.caps)) for (const side of [-1, 1]) {
    add(3, cap.x + side * 2.7, 0.004, cap.z, 0.08, 0.008, 5.4);
    add(3, cap.x, 0.004, cap.z + side * 2.7, 5.4, 0.008, 0.08);
  }
  // Clip duckboards to real horizontal supports at y=0, including bridges;
  // neither the lower floor nor a descending ramp supports floating timber.
  const paintSupports = map.terrain ? map.boxes.filter(b => b.max.y === 0) : [
    { min: { x: 0, z: 0 }, max: { x: width, z: depth } },
  ];
  const groundBoard = (m: number, x: number, z: number, w: number, d: number) => {
    for (const b of paintSupports) {
      const x0 = Math.max(x - w / 2, b.min.x), x1 = Math.min(x + w / 2, b.max.x);
      const z0 = Math.max(z - d / 2, b.min.z), z1 = Math.min(z + d / 2, b.max.z);
      if (x1 > x0 && z1 > z0) add(m, (x0 + x1) / 2, .005, (z0 + z1) / 2, x1 - x0, .01, z1 - z0);
    }
  };
  for (const z of [depth * .27, depth * .70]) for (const x of [width * .25, width / 2, width * .75]) {
    for (let i = -9; i <= 9; i++) groundBoard(i % 4 === 0 ? 4 : 5, x + i * .36, z, .32, 1.15);
    for (const side of [-1, 1]) groundBoard(4, x, z + side * .42, 7, .07);
  }
  // Timber thresholds reuse the same clipped, supported ground plane.
  for (const east of [false, true]) for (const [xx, zz] of [[34, 82.6], [35, 75.5]] as const) {
    const x = east ? width - xx : xx;
    for (let i = -4; i <= 4; i++) groundBoard(i % 3 === 0 ? 4 : 5, x + i * .38, zz, .34, .95);
  }
  // Duckboard runs from both deployment trenches to the forward traverses,
  // with an occasional missing slat where the mud has taken it.
  for (const x of [8.6, width - 8.6]) {
    for (let z = 31; z < 69; z += .46) if (jitter(x, z) > .06) groundBoard(jitter(z, x) < .5 ? 4 : 5, x, z, 1.1, .38);
    for (const side of [-1, 1]) groundBoard(1, x + side * .47, 50, .07, 38);
  }
  // Dry-drain floor: a duckboard walk and open drainage gutter on the real
  // -3 m face, skipping the pump baffles that own the southern bypass.
  const drain = map.terrain?.faces.find(f => f.y < 0), below = map.boxes.filter(b => b.min.y < 0 && !map.terrain?.boxes.includes(b));
  const floorBoard = (m: number, x: number, z: number, w: number, d: number) => {
    if (!drain || x - w / 2 < drain.minX || x + w / 2 > drain.maxX || z - d / 2 < drain.minZ || z + d / 2 > drain.maxZ) return;
    if (below.some(b => b.min.y <= drain.y && x + w / 2 > b.min.x && x - w / 2 < b.max.x && z + d / 2 > b.min.z && z - d / 2 < b.max.z)) return;
    add(m, x, drain.y + .005, z, w, .01, d);
  };
  for (let x = 42.4; x < 107.6; x += .4) if (jitter(x, 71) > .05) floorBoard(jitter(71, x) < .5 ? 4 : 5, x, 72.05, .34, .9);
  for (let x = 42.4; x < 107.6; x += 4) floorBoard(2, x + 2, 70.1, 3.9, .3);
  // Keep the bake's material identities stable when a geometry batch disappears.
  const bakeOrder = [0, 2, 3, 4, 5, 1, 6];
  const orderedBatches = [...batches].sort(([a], [b]) => bakeOrder.indexOf(Number(a[0])) - bakeOrder.indexOf(Number(b[0])));
  for (const [key, transforms] of orderedBatches) {
    const [material, shape] = key.split('-');
    const mesh = new T.InstancedMesh(shape === 'c' ? cylinder : unit, mats[Number(material)]!, transforms.length);
    transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.name = `undertow-${key}`; mesh.castShadow = material !== '6'; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); scene.add(mesh);
  }
  if (bakeOnly) return;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const labels = ['A / WEST REDOUBT', 'B / SLUICE SQUARE', 'C / EAST REDOUBT', 'UNDERTOW / 1917',
    'WEST EMBANKMENT', 'EAST EMBANKMENT', 'DRY DRAIN', 'FIELD OFFICE'];
  labels.forEach((label, i) => {
    ctx.fillStyle = '#303b39'; ctx.fillRect(0, i * 128, 1024, 128);
    ctx.fillStyle = i === 0 || i === 4 || i === 6 ? '#a6b7a0' : '#d1b47d';
    ctx.fillRect(18, i * 128 + 22, 10, 84);
    ctx.fillStyle = '#dfe8dc'; ctx.font = '600 57px Arial'; ctx.fillText(label, 52, i * 128 + 83);
  });
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  const material = new T.MeshBasicMaterial({ map: texture });
  const signParts: T.BufferGeometry[] = [];
  const sign = (label: number, x: number, y: number, z: number, yaw: number, width = 5.2) => {
    const geo = new T.PlaneGeometry(width, width / 8), uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + 7 - label) / 8);
    geo.rotateY(yaw).translate(x, y, z); signParts.push(geo);
  };
  // Signs sit on actual solid faces, never on old blockout coordinates.
  for (const [label, cap] of [[0, map.caps.a], [2, map.caps.c]] as const) {
    sign(label, cap.x, 2.25, 10.016, 0);
    sign(label, cap.x, 2.25, 19.984, Math.PI);
  }
  sign(1, 66.5, .8, 51.016, 0, 3.8);
  sign(1, 83.5, .8, 51.016, 0, 3.8);
  // Sluice traverses announce B before the covered bend. Both signs sit on
  // authoritative stone faces and reuse the existing opaque atlas.
  sign(1, 62.984, 2.35, 49, -Math.PI / 2, 3.5);
  sign(1, 87.016, 2.35, 49, Math.PI / 2, 3.5);
  // Northern breakwater baffles: destination on the protected arrival face.
  // Same atlas, opaque shader and real full-cover envelope as the pump signs.
  sign(0, 17.984, 2.35, 28, -Math.PI / 2, 6);
  sign(2, 132.016, 2.35, 28, Math.PI / 2, 6);
  sign(3, width / 2, 22.8, -14.46, 0, 6);
  for (const east of [false, true]) {
    const x = (n: number) => east ? width - n : n;
    sign(7, x(29.5), 2.15, 82.016, 0, 4.3);
    sign(7, x(40), 2.15, 77.016, 0, 4.2);
  }
  // One label per face: the former site label overlapped CLARIFIER ROUTE.
  sign(4, 46, 2.35, 44.016, 0, 4);
  sign(5, width - 46, 2.35, 44.016, 0, 4);
  for (const s of undertowSiteSigns(width, depth)) sign(s.label, s.x, s.y, s.z, s.yaw, s.width);
  for (const s of map.structures ?? []) {
    if (s.id === 'pump-channel') {
      // Existing MAINTENANCE atlas, scaled into the retaining face.
      for (const x of [50, 100]) sign(7, x, -1.15, 68.416, 0, 3.5);
      continue;
    }
    const x = (s.footprint.minX + s.footprint.maxX) / 2;
    sign(x < width / 2 ? 4 : 5, x, 3.6, s.footprint.minZ - .016, Math.PI, 5);
    // The central window's lintel is only .37m high: keep text inside it.
    sign(7, x, 2.53, s.footprint.maxZ + .016, 0, 2.7);
  }
  // One static sign draw, same opaque atlas and exact transformed vertices.
  const signs = new T.Mesh(mergeGeometries(signParts)!, material);
  signs.name = 'undertow-site-signs'; scene.add(signs);
  signParts.forEach(geometry => geometry.dispose());
}

/** Exterior water uses the already loaded dusk environment. Opaque, static
 * geometry/normals: no SSR, planar reflection pass, texture or animation. Add
 * after the architecture fallback list is captured so cladding cannot replace
 * it with a rough concrete finish. */
export function buildUndertowCanalWater(scene: T.Scene, map: MapDef): void {
  const p = undertowCanalSurface(map.bounds.width, map.bounds.depth);
  const geometry = new T.PlaneGeometry(p.w, p.d, 100, 8);
  geometry.rotateX(-Math.PI / 2).translate(p.x, p.y, p.z);
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const nx = .025 * Math.sin(x * 1.6 + z * .5), nz = .045 * Math.cos(x * .3 + z * 2.4);
    const length = Math.hypot(nx, 1, nz);
    normals.setXYZ(i, nx / length, 1 / length, nz / length);
  }
  const material = new T.MeshStandardMaterial({ color: 0x394941, roughness: .24, metalness: .22 });
  const water = new T.Mesh(geometry, material);
  water.name = 'undertow-canal-water'; water.receiveShadow = true;
  scene.add(water);
}

export async function loadUndertowFieldKit(scene: T.Scene): Promise<void> {
  const placements = undertowFieldKitPlacements();
  const loader = new GLTFLoader();
  const loaded = new Map<string, T.Object3D>();
  await Promise.all([...new Set(placements.map(({ publicUrl }) => publicUrl))].map(async (publicUrl) => {
    loaded.set(publicUrl, (await loader.loadAsync(publicUrl)).scene);
  }));
  const group = new T.Group();
  group.name = 'undertow-ww1-field-kit';
  for (const placement of placements) {
    const source = loaded.get(placement.publicUrl);
    if (source === undefined) throw new TypeError(`Missing loaded Undertow field kit: ${placement.key}`);
    const root = source.clone(true);
    root.position.set(placement.x, placement.y, placement.z);
    root.rotation.y = placement.yaw;
    root.traverse((node) => {
      if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = true;
    });
    group.add(root);
  }
  scene.add(group);
}

/** Lazy, map-owned issued supplies. Their exact box colliders are present even
 * while loading or on failure; the procedural fallback is replaced only after
 * the whole detailed hierarchy is ready, before scene preparation/warm-up. */
export async function loadUndertowSupplies(scene: T.Scene, map: MapDef): Promise<void> {
  await loadUndertowFieldKit(scene).catch((error: unknown) => {
    console.warn('Undertow WW1 field kit unavailable; retaining collision-backed procedural forms.', error);
  });
  const library = createPropLibrary();
  const size = PROP_LIBRARY['ammo-crate-stack'].sizeM;
  const placements = [
    ...[...UNDERTOW_CRATES, ...UNDERTOW_YARD_CRATES].map(b => ({ x: (b.min.x + b.max.x) / 2, y: b.min.y, z: (b.min.z + b.max.z) / 2,
      w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z })),
    ...undertowSiteSupplies(map.bounds.depth).map(p => ({ ...p, w: size[0], h: size[1], d: size[2] })),
  ];
  const geometry = new T.BoxGeometry(1, 1, 1);
  const material = new T.MeshStandardMaterial({ color: 0x4c5140, roughness: .92 });
  const fallback = new T.Group(); fallback.name = 'undertow-supply-fallback';
  for (const p of placements) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(p.x, p.y + p.h / 2, p.z);
    mesh.scale.set(p.w, p.h, p.d);
    mesh.castShadow = mesh.receiveShadow = true; fallback.add(mesh);
  }
  scene.add(fallback);
  try {
    const props = await Promise.all(placements.map(async p => {
      const root = await library.load('ammo-crate-stack');
      root.position.set(p.x, p.y, p.z);
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
