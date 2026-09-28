import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Period service-arm silhouettes for the four legacy Synty weapons (look round 18).
 *  Load-time edits of each per-view copy: drop the sci-fi rails, fins, side panels and
 *  optic (whole connected parts, like the carbine's box aperture), then add period parts
 *  in the weapon's own object space. The muzzle part, grip/receiver, the reload parts
 *  that `splitRifleMagazine` separates, and every socket are left where they were, so
 *  hands, tracers and ejection keep their positions. The GLB and cache are untouched. */

type Box = { min: T.Vector3; max: T.Vector3 };
type Part = { geometry: T.BufferGeometry; wood: boolean };
type Spec = { remove: (b: Box) => boolean; build: () => Part[]; sightLine: number };

const box = (x: number, y: number, z: number, cx: number, cy: number, cz: number) =>
  new T.BoxGeometry(x, y, z).translate(cx, cy, cz);
/** Cylinder along +Z. */
const tube = (r: number, z0: number, z1: number, cx: number, cy: number, segments = 10) =>
  new T.CylinderGeometry(r, r, z1 - z0, segments).rotateX(Math.PI / 2).translate(cx, cy, (z0 + z1) / 2);
const steel = (geometry: T.BufferGeometry): Part => ({ geometry, wood: false });
const wood = (geometry: T.BufferGeometry): Part => ({ geometry, wood: true });
/** Front blade and rear U-notch whose tips sit on the sight line. */
const irons = (x: number, line: number, frontZ: number, frontBase: number, rearZ: number, rearBase: number): Part[] => [
  steel(box(.004, line - frontBase, .012, x, (line + frontBase) / 2, frontZ)),
  steel(box(.03, line - .006 - rearBase, .004, x, (rearBase + line - .006) / 2, rearZ)),
  steel(box(.01, .006, .004, x - .01, line - .003, rearZ)),
  steel(box(.01, .006, .004, x + .01, line - .003, rearZ)),
];
const within = (b: Box, [x0, x1]: number[], [y0, y1]: number[], [z0, z1]: number[]) =>
  b.min.x >= x0! && b.max.x <= x1! && b.min.y >= y0! && b.max.y <= y1! && b.min.z >= z0! && b.max.z <= z1!;

// Object-space bounds come from `.inspect/look-r18/components.mjs` (connected parts per weapon).
export const PERIOD_ARMS: Readonly<Record<string, Spec>> = {
  // SMG: no rails or side panels; barrel band, box magazine kept, irons. A stock or full jacket
  // cannot be added here: the receiver ends at the grip and hides the barrel (see Session 20).
  wep_smg: {
    sightLine: .126,
    remove: b => within(b, [-.03, .03], [.045, .13], [.02, .28])        // top rail
      || within(b, [-.03, .05], [.06, .13], [-.01, .235])                // top housing
      || within(b, [.02, .05], [-.01, .06], [.13, .27]) || within(b, [-.045, -.01], [-.01, .06], [.13, .27]) // side rails
      || within(b, [-.04, .05], [.045, .095], [.11, .155]),              // sight ears
    build: () => [
      steel(tube(.02, .28, .3, .001, .022, 12)),                         // barrel band at the jacket mouth
      ...irons(.001, .126, .3, .046, .02, .115),
    ],
  },
  // Shotgun: barrel fins, studs and top rail gone; bead front sight. The body already carries
  // the under-barrel magazine and slide (the finish makes them wood).
  wep_shotgun: {
    sightLine: .1,
    remove: b => within(b, [-.015, .015], [.07, .11], [-.16, .01])       // top rail
      || (b.max.x - b.min.x > .06 && b.max.y - b.min.y < .07 && b.max.z - b.min.z < .03) // barrel fins
      || (b.max.x - b.min.x < .005 && b.max.z - b.min.z < .02),          // side studs
    build: () => [
      steel(new T.SphereGeometry(.007, 8, 6).translate(0, .094, .63)),   // bead front sight (behind the muzzle slice)
      steel(box(.006, .012, .01, 0, .088, .63)),                         // bead base
    ],
  },
  // Rifle: optic, mount and rail removed; open irons; the left bolt handle (reload part) stays.
  wep_sniper: {
    sightLine: .07,
    remove: b => within(b, [-.06, .06], [.03, .16], [-.03, .28]),        // scope, rings, mount, rail
    build: () => [
      wood(box(.036, .05, .7, 0, -.035, .6)),                            // long slim fore-end under the barrel
      steel(tube(.012, .95, 1.05, 0, -.01, 10)),                         // exposed muzzle end
      steel(box(.03, .016, .12, 0, .046, .12)),                          // receiver top / rear sight base
      ...irons(0, .07, 1.0, .014, .08, .054),
    ],
  },
  // Pistol: under-rail, top rib and blocky sight housings gone; irons. Grips are already wood (finish).
  wep_pistol: {
    sightLine: .136,
    remove: b => within(b, [-.035, .035], [.035, .12], [-.04, .05])      // blocky rear housing
      || within(b, [-.015, .015], [.05, .11], [.12, .28])                // top rib
      || within(b, [-.01, .015], [.11, .15], [-.02, .04])                // top sight block
      || within(b, [-.015, .015], [-.005, .065], [.08, .27]),            // under-rail
    build: () => [
      ...irons(.001, .136, .26, .122, -.03, .122),
    ],
  },
};

const walnut = new T.MeshStandardMaterial({ color: 0x3c2414, roughness: .6, metalness: 0, name: 'period-walnut' });
const blued = new T.MeshStandardMaterial({ color: 0x1a1d22, roughness: .42, metalness: .65, name: 'period-steel' });

/** Remove whole connected parts matching `remove` from every indexed mesh of a per-view copy. */
function stripParts(root: T.Object3D, remove: (b: Box) => boolean): T.BufferGeometry[] {
  const owned: T.BufferGeometry[] = [];
  root.updateMatrixWorld(true);
  const toRoot = new T.Matrix4().copy(root.matrixWorld).invert();
  root.traverse(node => {
    if (!(node instanceof T.Mesh) || !node.geometry.index) return;
    const source = node.geometry, positions = source.getAttribute('position'), index = source.index!;
    const local = new T.Matrix4().multiplyMatrices(toRoot, node.matrixWorld);
    const parent = Array.from({ length: positions.count }, (_, i) => i), seen = new Map<string, number>(), v = new T.Vector3();
    const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; } return i; };
    const union = (a: number, b: number): void => { parent[find(a)] = find(b); };
    for (let i = 0; i < positions.count; i++) {
      const key = v.fromBufferAttribute(positions, i).toArray().map(n => n.toFixed(5)).join(), previous = seen.get(key);
      if (previous !== undefined) union(i, previous); else seen.set(key, i);
    }
    for (let i = 0; i < index.count; i += 3) { union(index.getX(i), index.getX(i + 1)); union(index.getX(i), index.getX(i + 2)); }
    const bounds = new Map<number, T.Box3>();
    for (let i = 0; i < index.count; i++) {
      const r = find(index.getX(i));
      (bounds.get(r) ?? bounds.set(r, new T.Box3()).get(r)!).expandByPoint(v.fromBufferAttribute(positions, index.getX(i)).applyMatrix4(local));
    }
    const keep: number[] = [];
    for (let i = 0; i < index.count; i++) if (!remove(bounds.get(find(index.getX(i)))!)) keep.push(index.getX(i));
    if (keep.length === index.count) return;
    node.geometry = source.clone().setIndex(keep);
    owned.push(node.geometry);
  });
  return owned;
}

/** Apply the period silhouette to a per-view copy. Returns the geometry the caller owns
 *  and the sight-line height (object space), or undefined for weapons without a spec. */
export function periodServiceArm(root: T.Object3D, nodeName: string): { geometry: T.BufferGeometry[]; sightLine: number } | undefined {
  const spec = PERIOD_ARMS[nodeName];
  if (!spec) return undefined;
  const geometry = stripParts(root, spec.remove);
  const parts = spec.build();
  const group = new T.Group(); group.name = 'period-parts';
  for (const [isWood, material] of [[true, walnut], [false, blued]] as const) {
    const list = parts.filter(p => p.wood === isWood).map(p => p.geometry.index ? p.geometry.toNonIndexed() : p.geometry);
    parts.filter(p => p.wood === isWood).forEach(p => { if (p.geometry.index) p.geometry.dispose(); });
    if (!list.length) continue;
    for (const g of list) { g.deleteAttribute('uv'); }
    const merged = mergeGeometries(list)!; list.forEach(g => g.dispose());
    const mesh = new T.Mesh(merged, material); mesh.name = isWood ? 'period-wood' : 'period-steel';
    mesh.raycast = () => {};
    group.add(mesh); geometry.push(merged);
  }
  root.add(group);
  return { geometry, sightLine: spec.sightLine };
}
