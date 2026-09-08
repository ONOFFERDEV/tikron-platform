import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function tint(geometry: T.BufferGeometry, hex: number): T.BufferGeometry {
  const color = new T.Color(hex), values: number[] = [];
  for (let i = 0; i < geometry.getAttribute('position').count; i++) values.push(color.r, color.g, color.b);
  geometry.setAttribute('color', new T.Float32BufferAttribute(values, 3));
  return geometry;
}

/** Original tailored sleeve, authored once in a unit-length wrist/elbow frame.
 * Oval sections, compression folds and a longitudinal reinforced panel replace
 * the straight hexagonal tube. Vertex colour costs no texture or extra draw. */
export function sleeveGeometry(): T.BufferGeometry {
  const rings = [
    [-0.5, .061], [-.38, .063], [-.20, .058], [-.05, .052],
    [.04, .054], [.08, .049], [.13, .052], [.20, .045],
    [.27, .048], [.32, .041], [.36, .044], [.41, .037], [.5, .035],
  ] as const;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const sides = 12;
  for (let r = 0; r < rings.length; r++) {
    const [y, radius] = rings[r]!;
    for (let s = 0; s <= sides; s++) {
      const angle = s / sides * Math.PI * 2;
      const fold = r > 3 && r < 11 ? Math.sin(angle + r * .7) * .008 : 0;
      positions.push(Math.sin(angle) * radius, y + fold, Math.cos(angle) * radius * .82);
      const panel = s >= 4 && s <= 8;
      const shade = new T.Color(panel ? 0x394a4b : 0x596b68);
      shade.multiplyScalar(r === 5 || r === 9 ? .78 : 1);
      colors.push(shade.r, shade.g, shade.b);
      if (r < rings.length - 1 && s < sides) {
        const a = r * (sides + 1) + s, b = a + sides + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function gloveGeometry(side: number): T.BufferGeometry {
  const parts: T.BufferGeometry[] = [];
  const pad = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) => {
    const g = new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * .22);
    parts.push(tint(g.translate(x, y, z), color));
  };
  pad(side * .025, -.004, 0, .045, .055, .065, 0x293335);
  for (let i = 0; i < 4; i++) {
    const y = -.030 + i * .014;
    pad(-.002, y, -.021, .060, .012, .026, 0x20292c);
    // Separate padded knuckles sit on the outer back, away from the grip.
    pad(side * .049, y + .004, -.008, .009, .010, .026, 0x4b5958);
  }
  pad(side * -.012, .023, .015, .025, .022, .045, 0x293335);
  pad(side * .050, -.004, .022, .008, .039, .023, 0x425352);
  const merged = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); return merged;
}

export function cuffGeometry(): T.BufferGeometry {
  const parts = [
    tint(new T.CylinderGeometry(.036, .037, .046, 12), 0x222d30),
    tint(new T.CylinderGeometry(.037, .037, .006, 12).translate(0, .011, 0), 0xb48c50),
  ];
  const merged = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); return merged;
}
