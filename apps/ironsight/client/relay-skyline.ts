import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapDef } from '../src/map/types.js';
import { fadeRelayDressing } from './relay-palette.js';

type Point = readonly [number, number, number];
type House = {
  readonly x: number; readonly z: number; readonly width: number;
  readonly depth: number; readonly floors: number; readonly broken: boolean;
};

const FINISH = {
  brick: 0x8f7764, lime: 0xaea38e, soot: 0x454239,
  timber: 0x655740, slate: 0x5e625a, rubble: 0x968b76,
} as const;

/** Original village ruins. Four exterior batches share one opaque vertex-colour
 * material; export and failed-load fallback use this same construction. */
export function buildRelaySkyline(bounds: MapDef['bounds']): T.Group {
  const root = new T.Group();
  root.name = 'relay-skyline-fallback';
  root.userData.provenance = 'ironsight-original-signal-village-v1';
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .96, metalness: 0, side: T.DoubleSide });
  material.name = 'signal-village-masonry';
  fadeRelayDressing(material);
  const { width: w, depth: d } = bounds;
  const sectors: readonly (readonly House[])[] = [
    [{ x: -15, z: 22, width: 18, depth: 24, floors: 5, broken: true },
      { x: -17, z: 72, width: 20, depth: 26, floors: 3, broken: false }],
    [{ x: w + 17, z: 22, width: 20, depth: 24, floors: 4, broken: false },
      { x: w + 18, z: 72, width: 15, depth: 18, floors: 7, broken: true }],
    [{ x: w * .20, z: -19, width: 26, depth: 20, floors: 3, broken: false },
      { x: w * .78, z: -22, width: 21, depth: 24, floors: 5, broken: true }],
    [{ x: w * .24, z: d + 21, width: 26, depth: 24, floors: 4, broken: true },
      { x: w * .78, z: d + 21, width: 23, depth: 24, floors: 5, broken: false }],
  ];
  for (const [sectorIndex, houses] of sectors.entries()) {
    const parts: T.BufferGeometry[] = [];
    let seed = 771 + sectorIndex * 107;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const finish = (geometry: T.BufferGeometry, color: number) => {
      const position = geometry.getAttribute('position');
      const tint = new T.Color(color).multiplyScalar(.88 + random() * .20);
      const colors = new Uint8Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        const contact = .70 + Math.min(1, Math.max(0, position.getY(i)) / 3) * .30;
        colors[i * 3] = Math.round(tint.r * contact * 255);
        colors[i * 3 + 1] = Math.round(tint.g * contact * 255);
        colors[i * 3 + 2] = Math.round(tint.b * contact * 255);
      }
      geometry.setAttribute('color', new T.BufferAttribute(colors, 3, true));
      geometry.deleteAttribute('uv');
      parts.push(geometry);
    };
    const block = (center: Point, size: Point, color: number) => {
      const geometry = new T.BoxGeometry(...size);
      geometry.translate(...center); finish(geometry, color);
    };
    const timber = (from: Point, to: Point, width: number) => {
      const a = new T.Vector3(...from), b = new T.Vector3(...to);
      const delta = b.clone().sub(a);
      const geometry = new T.BoxGeometry(width, delta.length(), width);
      geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()));
      geometry.translate(...a.add(b).multiplyScalar(.5).toArray());
      finish(geometry, FINISH.timber);
    };
    for (const house of houses) {
      const { x, z, width, depth, floors, broken } = house;
      const eaves = floors * 3.2, ridge = eaves + width * .31;
      const facade = (side: number, acrossX: boolean) => {
        const length = acrossX ? width : depth;
        const bays = Math.floor(length / 4.5), step = length / bays;
        const heights = Array.from({ length: bays }, (_, bay) =>
          broken && bay > bays * .4 && bay < bays * .9 ? eaves - 1.5 - random() * 3.2 : eaves);
        const shape = new T.Shape();
        shape.moveTo(-length / 2, 0); shape.lineTo(length / 2, 0);
        for (let bay = bays - 1; bay >= 0; bay--) {
          const height = heights[bay] ?? eaves;
          shape.lineTo(-length / 2 + (bay + 1) * step, height);
          shape.lineTo(-length / 2 + (bay + .7) * step, height + .22);
          shape.lineTo(-length / 2 + (bay + .3) * step, height - .16);
          shape.lineTo(-length / 2 + bay * step, height);
        }
        shape.closePath();
        for (let bay = 0; bay < bays; bay++) {
          const along = -length / 2 + (bay + .5) * step;
          const height = heights[bay] ?? eaves;
          for (let level = 0; level < floors; level++) {
            const floor = level * 3.2;
            if (floor + 3.2 > height) continue;
            const hole = new T.Path();
            hole.moveTo(along - .72, floor + 1.1); hole.lineTo(along - .72, floor + 2.6);
            hole.lineTo(along - .52, floor + 2.8); hole.lineTo(along + .52, floor + 2.8);
            hole.lineTo(along + .72, floor + 2.6); hole.lineTo(along + .72, floor + 1.1);
            hole.closePath(); shape.holes.push(hole);
          }
        }
        const geometry = new T.ShapeGeometry(shape);
        geometry.rotateY(acrossX ? (side < 0 ? Math.PI : 0) : side * Math.PI / 2);
        geometry.translate(acrossX ? x : x + side * width / 2, 0, acrossX ? z + side * depth / 2 : z);
        finish(geometry, FINISH.brick);
      };
      for (const side of [-1, 1]) { facade(side, true); facade(side, false); }
      for (let level = 1; level < floors; level++) {
        block([x, level * 3.2, z], [width - .7, .18, depth - .7], FINISH.soot);
        for (const side of [-1, 1]) block([x + side * (width / 2 + .015), level * 3.2 - .42, z - depth * .16],
          [.03, .55, depth * .38], FINISH.lime);
      }
      const roofLength = Math.hypot(width / 2 + .45, width * .31);
      const roofAngle = Math.atan2(width * .31, width / 2 + .45);
      for (const side of [-1, 1]) {
        for (let strip = 0; strip < 12; strip++) {
          const rz = z - depth / 2 + (strip + .5) * depth / 12;
          const gap = broken && strip > 3 && strip < 9;
          if (!gap) {
            const roof = new T.BoxGeometry(roofLength, .18, depth / 12 + .04);
            roof.rotateZ(-side * roofAngle);
            roof.translate(x + side * (width / 4 + .225), eaves + width * .155, rz);
            finish(roof, FINISH.slate);
          }
          if (strip % 2 === 0) timber([x + side * width / 2, eaves, rz],
            [x + (gap ? side * width * .14 : 0), gap ? ridge - 1.1 : ridge, rz], .19);
        }
      }
      for (const end of [-1, 1]) {
        for (let step = 0; step < 9; step++) {
          const across = (step - 4) * width / 9;
          const height = width * .31 * (1 - Math.abs(across) / (width / 2));
          if (broken && step > 3) continue;
          block([x + across, eaves + height / 2, z + end * depth / 2], [width / 9, height, .55], FINISH.brick);
        }
      }
      const chimneyX = x - width * .25, chimneyZ = z - depth * .25;
      const chimneyBase = eaves + width * .15, chimneyHeight = 2.2;
      for (const side of [-1, 1]) {
        block([chimneyX + side * .48, chimneyBase + chimneyHeight / 2, chimneyZ], [.24, chimneyHeight, 1.2], FINISH.brick);
        block([chimneyX, chimneyBase + chimneyHeight / 2, chimneyZ + side * .48], [.72, chimneyHeight, .24], FINISH.brick);
      }
      for (let piece = 0; piece < 28; piece++) {
        const size = .4 + random() * 1.2;
        const rubble = new T.BoxGeometry(size, .3 + random() * .5, size * .7);
        rubble.rotateY(random() * Math.PI); rubble.rotateZ((random() - .5) * .35);
        rubble.translate(x + (random() - .5) * (width + 2), .6, z + (random() - .5) * (depth + 2));
        finish(rubble, piece % 3 ? FINISH.brick : FINISH.rubble);
      }
    }
    const geometry = mergeGeometries(parts);
    if (!geometry) throw new RangeError('Signal village contains no geometry');
    parts.forEach(part => part.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, material);
    mesh.name = `signal-village-sector-${sectorIndex}`;
    mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}
