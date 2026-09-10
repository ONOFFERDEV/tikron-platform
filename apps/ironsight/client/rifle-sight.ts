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
