import * as T from 'three';

/** Original, entirely flat exterior paving. Colors and joints are geometry data,
 * not another texture or decal layer. Disjoint rectangles avoid coplanar overlap.
 * World coordinates preserve the existing ground/detail scale and shadow plane. */
export function buildRelayApronGeometry(bounds = { width: 60, depth: 40 }): T.BufferGeometry {
  const padding = Math.max(210, bounds.width * 3);
  const worldX = (x: number) => x === -210 ? -padding : x === 270 ? bounds.width + padding : x >= 60 ? x + bounds.width - 60 : x <= 0 ? x : x * bounds.width / 60;
  const padZ = Math.max(200, bounds.width > 60 ? bounds.width * 3 : 200);
  const worldZ = (z: number) => z === -200 ? -padZ : z === 240 ? bounds.depth + padZ : z >= 40 ? z + bounds.depth - 40 : z <= 0 ? z : z * bounds.depth / 40;
  const positions: number[] = [], colors: number[] = [], normals: number[] = [], uv: number[] = [];
  const tint = new T.Color();
  const quad = (x0: number, z0: number, x1: number, z1: number, color: T.Color) => {
    if (x1 <= x0 || z1 <= z0) return;
    for (const [x, z] of [[x0, z0], [x0, z1], [x1, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      positions.push(worldX(x!), -0.03, worldZ(z!)); normals.push(0, 1, 0);
      colors.push(color.r, color.g, color.b); uv.push(x! / 6, -z! / 5);
    }
  };
  const soil = new T.Color('#716d60'), concrete = new T.Color('#817e70');
  const asphalt = new T.Color('#595a50'), joint = new T.Color('#6d6b5f');
  const pad = new T.Color('#928d7b'), paint = new T.Color('#a69a72');
  // Four broad skirt faces reach beyond the 145 m fog end from every playable
  // viewpoint, so the site no longer has a visible rectangular edge in the sky.
  quad(-210, -200, 270, -25, soil); quad(-210, 65, 270, 240, soil);
  quad(-210, -25, -18, 65, soil); quad(78, -25, 270, 65, soil);
  const xs = [...new Set([...Array.from({ length: 17 }, (_, i) => -18 + i * 6), 20, 32, 42])].sort((a, b) => a - b);
  const zs = [...new Set([...Array.from({ length: 19 }, (_, i) => -25 + i * 5), -18, -12, -9, -3])].sort((a, b) => a - b);
  for (let zi = 0; zi < zs.length - 1; zi++) for (let xi = 0; xi < xs.length - 1; xi++) {
    const x0 = xs[xi]!, x1 = xs[xi + 1]!, z0 = zs[zi]!, z1 = zs[zi + 1]!;
    if (x0 >= 0 && x1 <= 60 && z0 >= 0 && z1 <= 40) continue; // actual arena floor owns this area
    const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    const hash = ((Math.imul(xi + 71, 73856093) ^ Math.imul(zi + 19, 19349663)) >>> 0) / 4294967296;
    const road = z0 >= -18 && z1 <= -12;
    // Flush foundations beneath the two uplinks and the main mast/cabinets.
    const machinery = z0 >= -9 && z1 <= -3 && x0 >= 20 && x1 <= 42;
    const distance = Math.max(-x, x - 60, -z, z - 40, 0);
    const fade = T.MathUtils.smoothstep(distance, 10, 23);
    tint.copy(road ? asphalt : machinery ? pad : concrete).lerp(soil, road ? 0 : fade);
    tint.multiplyScalar(0.975 + hash * 0.05);
    if (road) {
      // A worn centre dash is part of the same tessellation, never a second face.
      const a = Math.max(z0, -15.06), b = Math.min(z1, -14.94);
      if (a < b && x0 % 12 === 0 && x1 - x0 > 2) {
        quad(x0, z0, x1, a, tint); quad(x0, b, x1, z1, tint);
        quad(x0, a, x0 + 0.6, b, tint); quad(x0 + 0.6, a, x1 - 0.6, b, paint);
        quad(x1 - 0.6, a, x1, b, tint);
      } else quad(x0, z0, x1, z1, tint);
    } else if (fade < 0.8) {
      // Narrow recessed-looking grout, all on one plane: no raised visual cover.
      const inset = 0.025;
      quad(x0 + inset, z0 + inset, x1 - inset, z1 - inset, tint);
      const grout = joint.clone().lerp(tint, fade);
      quad(x0, z0, x1, z0 + inset, grout); quad(x0, z1 - inset, x1, z1, grout);
      quad(x0, z0 + inset, x0 + inset, z1 - inset, grout);
      quad(x1 - inset, z0 + inset, x1, z1 - inset, grout);
    } else quad(x0, z0, x1, z1, tint);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
