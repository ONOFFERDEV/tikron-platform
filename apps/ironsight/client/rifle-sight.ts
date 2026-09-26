import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const frameMaterial = new T.MeshStandardMaterial({ color: 0x29373a, roughness: 0.65, metalness: 0.25 });
const dotMaterial = new T.MeshBasicMaterial({ color: 0xff8653, toneMapped: false });

/** Original open reflex frame: no glass layer, opaque lens or scope postprocess.
 * The aperture centre is the ADS camera axis, above the weapon's highest vertex. */
export function rifleSight(x: number, railY: number, issued = false): { object: T.Group; centerY: number; geometry: T.BufferGeometry[] } {
  const object = new T.Group(), centerY = railY + (issued ? 0 : 0.052);
  // Issued housing is already merged into the offline receiver draw.
  const parts = issued ? [] : [
    new T.BoxGeometry(0.036, 0.11, 0.10).translate(x, railY - 0.040, -0.39),
    new T.BoxGeometry(0.084, 0.014, 0.10).translate(x, railY + 0.009, -0.39),
    new T.BoxGeometry(0.008, 0.060, 0.018).translate(x - 0.036, centerY, -0.39),
    new T.BoxGeometry(0.008, 0.060, 0.018).translate(x + 0.036, centerY, -0.39),
    new T.BoxGeometry(0.080, 0.008, 0.018).translate(x, centerY + 0.030, -0.39),
  ];
  const frame = parts.length ? mergeGeometries(parts)! : undefined; parts.forEach(p => p.dispose());
  if (frame) object.add(new T.Mesh(frame, frameMaterial));
  const dot = new T.CircleGeometry(0.0015, 8);
  const reticle = new T.Mesh(dot, dotMaterial);
  reticle.name = 'reflex-dot'; reticle.visible = false;
  reticle.position.set(x, centerY, -0.60); object.add(reticle);
  return { object, centerY, geometry: frame ? [frame, dot] : [dot] };
}

/** Late-WW1 iron sights for the issued carbine, built in the carbine's mesh space
 * (metres, +Z muzzle) so they follow its scale and roll exactly. The sight line is
 * horizontal at ISSUED_SIGHT_LINE_Y through the bore's x: the front blade tip sits
 * flush with the tops of the rear notch shoulders (a centre hold, blade visible in
 * the notch), clear of the handguard (top 0.039). */
export const ISSUED_SIGHT_LINE_Y = 0.060;
export function issuedIronSights(boreX: number, material: T.Material): { object: T.Group; geometry: T.BufferGeometry[] } {
  const y = ISSUED_SIGHT_LINE_Y, object = new T.Group();
  object.name = 'issued-iron-sights';
  const parts = [
    // Rear: tangent-leaf style plate on the existing base, U-notch cut to the sight line.
    new T.BoxGeometry(0.048, y - 0.010 - 0.047, 0.005).translate(boreX, 0.047 + (y - 0.010 - 0.047) / 2, 0.232),
    new T.BoxGeometry(0.018, 0.010, 0.005).translate(boreX - 0.015, y - 0.005, 0.232),
    new T.BoxGeometry(0.018, 0.010, 0.005).translate(boreX + 0.015, y - 0.005, 0.232),
    // Front: barrel band and a thin blade whose tip is the sight line.
    new T.BoxGeometry(0.026, 0.024, 0.030).translate(boreX, -0.008, 0.705),
    new T.BoxGeometry(0.0055, y - 0.004, 0.014).translate(boreX, 0.004 + (y - 0.004) / 2, 0.705),
  ];
  const merged = mergeGeometries(parts)!; parts.forEach(p => p.dispose());
  object.add(new T.Mesh(merged, material));
  // Diagnostic marker at the blade tip (the ADS inspector reports its screen position).
  const tip = new T.Object3D(); tip.name = 'reflex-dot'; tip.position.set(boreX, y, 0.705); object.add(tip);
  return { object, geometry: [merged] };
}

/** Remove the baked box aperture (two uprights and top bar, three separate
 * connected parts above the base plate) from a per-view copy of the body index.
 * The cached source geometry and the GLB stay untouched. */
export function stripIssuedSightHousing(root: T.Object3D): T.BufferGeometry[] {
  const body = root.getObjectByName('field-body');
  if (!(body instanceof T.Mesh) || !body.geometry.index) return [];
  const source = body.geometry, positions = source.getAttribute('position'), index = source.index!;
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
    const root = find(index.getX(i));
    (bounds.get(root) ?? bounds.set(root, new T.Box3()).get(root)!).expandByPoint(v.fromBufferAttribute(positions, index.getX(i)));
  }
  const housing = (b: T.Box3) => b.min.z > 0.20 && b.max.z < 0.26 && b.min.y > 0.043;
  const keep: number[] = [];
  for (let i = 0; i < index.count; i++) if (!housing(bounds.get(find(index.getX(i)))!)) keep.push(index.getX(i));
  if (keep.length === index.count) return [];
  const stripped = source.clone().setIndex(keep);
  body.geometry = stripped;
  return [stripped];
}
