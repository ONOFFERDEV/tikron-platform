import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function tint(geometry: T.BufferGeometry, hex: number): T.BufferGeometry {
  const color = new T.Color(hex), values: number[] = [];
  for (let i = 0; i < geometry.getAttribute('position').count; i++) values.push(color.r, color.g, color.b);
  geometry.setAttribute('color', new T.Float32BufferAttribute(values, 3));
  return geometry;
}

/** Original field sleeve in a unit-length wrist/elbow frame. Reinforcement,
 * webbing and stitches merge into the cloth draw at construction; no texture,
 * per-frame geometry or independent attachment can drift away during reload. */
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
      const shade = new T.Color(panel ? 0x575847 : 0x70725a);
      shade.multiplyScalar(r === 5 || r === 9 ? .78 : 1);
      colors.push(shade.r, shade.g, shade.b);
      if (r < rings.length - 1 && s < sides) {
        const a = r * (sides + 1) + s, b = a + sides + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  // Surface-fitted patches follow the same tapered oval as the cloth. Positive
  // local Z faces the player over the forearm, including the support-hand reach.
  const radiusAt = (y: number) => {
    for (let i = 1; i < rings.length; i++) {
      const [end, radius] = rings[i]!, [start, previous] = rings[i - 1]!;
      if (y <= end) return T.MathUtils.lerp(previous, radius, (y - start) / (end - start));
    }
    return rings[rings.length - 1]![1];
  };
  const patch = (rows: readonly number[], angles: readonly number[], lift: number, hex: number, bevel = false) => {
    const start = positions.length / 3;
    for (let r = 0; r < rows.length; r++) for (let s = 0; s < angles.length; s++) {
      const y = rows[r]!, angle = angles[s]!;
      const edge = r === 0 || r === rows.length - 1 || s === 0 || s === angles.length - 1;
      const radius = radiusAt(y) + (bevel && edge ? .0015 : lift);
      positions.push(Math.sin(angle) * radius, y, Math.cos(angle) * radius * .82);
      const shade = new T.Color(hex).multiplyScalar(bevel && edge ? .65 : 1);
      colors.push(shade.r, shade.g, shade.b);
      if (r < rows.length - 1 && s < angles.length - 1) {
        const a = start + r * angles.length + s, b = a + angles.length;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  };
  patch([-.32, -.29, -.20, -.05, .08, .14, .18], [-1.12, -1.02, -.64, 0, .64, 1.02, 1.12], .0025, 0x65634e, true);
  const around = Array.from({ length: 17 }, (_, i) => i / 16 * Math.PI * 2);
  for (const y of [-.24, .22]) {
    patch([y - .034, y - .026, y + .026, y + .034], around, .0035, 0x424638, true);
    patch([y - .004, y + .004], around, .004, 0x777864);
  }
  // Two quiet recognition bars and short seam stitches, all opaque vertex colour.
  for (const y of [.10, .135]) patch([y, y + .014], [-.42, 0, .42], .003, 0x96977c);
  for (const angle of [-.96, .96]) for (const y of [-.16, -.10, -.04, .02])
    patch([y, y + .018], [angle - .014, angle + .014], .003, 0x9a9478);
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
  pad(side * .025, -.004, 0, .045, .055, .065, 0x46473a);
  for (let i = 0; i < 4; i++) {
    const y = -.030 + i * .014;
    pad(-.002, y, -.021, .060, .012, .026, 0x30372f);
    // Separate padded knuckles sit on the outer back, away from the grip.
    pad(side * .049, y + .004, -.008, .009, .010, .026, 0x686851);
  }
  pad(side * -.012, .023, .015, .025, .022, .045, 0x46473a);
  pad(side * .050, -.004, .022, .008, .039, .023, 0x64644e);
  // Raised back-of-hand ribs leave the authored palm and trigger contact intact.
  for (const y of [-.016, -.004, .008])
    parts.push(tint(new T.BoxGeometry(.004, .004, .022).toNonIndexed()
      .translate(side * .055, y, .022), 0x929078));
  const merged = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); return merged;
}

export function cuffGeometry(): T.BufferGeometry {
  const parts = [
    tint(new T.CylinderGeometry(.036, .037, .046, 12), 0x3e4436),
    tint(new T.CylinderGeometry(.037, .037, .006, 12).translate(0, .011, 0), 0x8d8a6b),
  ];
  const merged = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); return merged;
}
