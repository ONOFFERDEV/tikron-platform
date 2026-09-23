import * as T from 'three';
import type { MapDef } from '../src/map/types.js';

/** The front beyond the wire: churned, cratered ground rising gently into low
 *  ridges, trench lines with picket rows, shattered tree stumps and one ruined
 *  farm, all fading into the site fog. Built once, four static draws, no lights,
 *  no shadows, no per-frame work. Everything starts well outside the playable
 *  rectangle and stays below eye height until it is far away, so it can neither
 *  act as cover nor rise over the boundary walls. */
const SITES = {
  // The Relay apron is flat paving to ~450 m; the far field starts past its fenced yard.
  relay: { inner: 28, soil: [0x5d5445, 0x4a4136, 0x6d6453], ruin: [0x8a7a64, 0x6f5a47, 0x9a8f7c], farm: 2.4 },
  // Undertow's apron ends 60 m out; start under it and surface past its edge.
  undertow: { inner: 58, soil: [0x3f3d38, 0x2f2d2a, 0x4d4a42], ruin: [0x6c6258, 0x57493f, 0x7d746a], farm: -0.9 },
} as const;
const FAR = 520; // metres beyond the boundary; the fog is opaque well before this

export function createFarField(map: MapDef): T.Group | undefined {
  const site = map.presentation === 'relay' ? SITES.relay : map.presentation === 'undertow' ? SITES.undertow : undefined;
  if (!site) return undefined;
  const { width: w, depth: d } = map.bounds, cx = w / 2, cz = d / 2;
  let seed = map.presentation === 'relay' ? 0x51a7 : 0x7e11;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  // Distance outside the playable rectangle (0 on the boundary).
  const outside = (x: number, z: number) => Math.hypot(Math.max(0, -x, x - w), Math.max(0, -z, z - d));
  // Walk the rectangle's outline (edges plus rounded corners) so a point at
  // offset r along the outward normal is exactly r outside the playable area.
  const outline: (readonly [number, number, number, number])[] = [];
  const edge = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number, steps: number) => {
    for (let i = 0; i < steps; i++) outline.push([x0 + (x1 - x0) * i / steps, z0 + (z1 - z0) * i / steps, nx, nz]);
  };
  const corner = (x: number, z: number, from: number, steps: number) => {
    for (let i = 0; i < steps; i++) { const a = from + i / steps * Math.PI / 2; outline.push([x, z, Math.cos(a), Math.sin(a)]); }
  };
  const along = (length: number) => Math.max(4, Math.round(length / 9));
  edge(0, 0, w, 0, 0, -1, along(w)); corner(w, 0, -Math.PI / 2, 8);
  edge(w, 0, w, d, 1, 0, along(d)); corner(w, d, 0, 8);
  edge(w, d, 0, d, 0, 1, along(w)); corner(0, d, Math.PI / 2, 8);
  edge(0, d, 0, 0, -1, 0, along(d)); corner(0, 0, Math.PI, 8);
  const ring = outline.length;
  const place = (u: number, r: number) => {
    const [bx, bz, nx, nz] = outline[((Math.floor(u) % ring) + ring) % ring]!;
    return [bx + nx * r, bz + nz * r] as const;
  };
  // Long, low swells: fields, not dunes. Everything detailed (craters, trench and
  // wire lines, churned mud) is drawn per pixel in the ground shader below.
  const height = (x: number, z: number) => {
    const o = outside(x, z), a = Math.atan2(z - cz, x - cx);
    const swell = T.MathUtils.smoothstep(o, site.inner + 40, 380) * (3.2 + 1.8 * Math.sin(a * 3 + 1.3) + .9 * Math.sin(a * 7 + o * .01));
    const start = T.MathUtils.smoothstep(o, site.inner, site.inner + 10);
    return -0.3 + start * (0.55 + swell); // 0.25 m above the flat apron once it surfaces
  };

  // Terrain: a rectangular ring of quads, finer near the boundary.
  const radii = [0, 4, 9, 15, 23, 33, 46, 62, 82, 108, 140, 180, 230, 290, 360, 440, FAR].map(r => site.inner + r);
  const positions: number[] = [], colors: number[] = [];
  const soil = site.soil.map(c => new T.Color(c)), tint = new T.Color();
  const point = (i: number, k: number) => {
    const r = radii[k]!, [x, z] = place(i, r);
    return [x, z, Math.atan2(z - cz, x - cx), r] as const;
  };
  for (let k = 0; k < radii.length - 1; k++) for (let i = 0; i < ring; i++) {
    const corners = [point(i, k), point(i + 1, k), point(i, k + 1), point(i + 1, k + 1)];
    for (const idx of [0, 1, 2, 1, 3, 2]) {
      const [x, z] = corners[idx]!;
      positions.push(x, height(x, z), z);
      // Blend from the apron's own soil at the seam to the darker, wetter front.
      tint.copy(soil[2]!).lerp(soil[0]!, T.MathUtils.smoothstep(outside(x, z), site.inner, site.inner + 60));
      colors.push(tint.r, tint.g, tint.b);
    }
  }
  const terrain = new T.BufferGeometry();
  terrain.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  terrain.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  terrain.computeVertexNormals();
  const groundMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const dark = new T.Color(site.soil[1]), wire = new T.Color(0x2a2622);
  groundMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      farBounds: { value: new T.Vector2(w, d) }, farInner: { value: site.inner },
      farDark: { value: dark }, farWire: { value: wire },
    });
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFarWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFarWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vFarWorld;
      uniform vec2 farBounds; uniform float farInner; uniform vec3 farDark, farWire;
      float farHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float farNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(farHash(i), farHash(i + vec2(1, 0)), f.x), mix(farHash(i + vec2(0, 1)), farHash(i + vec2(1, 1)), f.x), f.y); }
      float farTri(float t) { return abs(fract(t) - .5) * 2.; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 p = vFarWorld.xz;
        vec2 o = max(max(-p, p - farBounds), 0.);
        float out_ = length(o) - farInner; // metres beyond the far-field seam
        float fade = 1. - smoothstep(.35, 2.5, max(length(dFdx(p)), length(dFdy(p))) ); // keep lines from shimmering far off
        // Churned mud: two octaves of broad blotching.
        float churn = farNoise(p * .08) * .6 + farNoise(p * .31) * .4;
        diffuseColor.rgb *= .78 + .38 * churn;
        // Shell craters: one per 13 m cell, dark bowl with a lighter thrown rim.
        vec2 cell = floor(p / 13.), local = p - (cell + .5) * 13.;
        float h = farHash(cell), rad = 2.2 + 3.2 * farHash(cell + 7.1);
        vec2 off = (vec2(farHash(cell + 3.3), farHash(cell + 5.9)) - .5) * 5.;
        float q = length(local - off) / rad;
        float hit = step(.35, h) * step(8., out_);
        diffuseColor.rgb = mix(diffuseColor.rgb, farDark * .7, hit * (1. - smoothstep(.55, 1., q)));
        diffuseColor.rgb *= 1. + hit * .22 * (smoothstep(.85, 1., q) - smoothstep(1., 1.35, q));
        // Zig-zag trench lines with a wire belt in front, parallel to the front.
        float zig = farTri((p.x + p.y) * .035) * 5.;
        for (int i = 0; i < 3; i++) {
          float R = 18. + float(i) * (46. + float(i) * 22.);
          float t = abs(out_ - R - zig);
          diffuseColor.rgb = mix(diffuseColor.rgb, farDark * .55, (1. - smoothstep(.9, 1.8, t)) * step(0., out_));
          float wb = abs(out_ - R + 7. - zig * .6);
          diffuseColor.rgb = mix(diffuseColor.rgb, farWire, (1. - smoothstep(.6, 1.6, wb)) * .45 * fade * step(0., out_));
        }
      }`);
  };
  groundMaterial.customProgramCacheKey = () => 'ironsight-far-field-ground-v1';
  const ground = new T.Mesh(terrain, groundMaterial);
  ground.name = 'far-field-ground';

  // Picket rows along the trench lines, stumps scattered across the fields.
  const matrix = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3();
  const pickets: T.Matrix4[] = [], stumps: T.Matrix4[] = [];
  const zigAt = (x: number, z: number) => Math.abs(((x + z) * .035) % 1 + (((x + z) * .035) % 1 < 0 ? 1 : 0) - .5) * 2 * 5;
  for (let belt = 0; belt < 3; belt++) {
    const R = 18 + belt * (46 + belt * 22) - 7;
    for (let i = 0; i < ring * 4; i++) {
      if (random() < .3) continue;
      const u = i / 4, [bx, bz] = place(u, site.inner + R);
      const [x, z] = place(u, site.inner + R + zigAt(bx, bz) * .6);
      q.setFromAxisAngle(new T.Vector3(random() - .5, 0, random() - .5).normalize(), (random() - .5) * .5);
      pickets.push(new T.Matrix4().compose(p.set(x + (random() - .5) * 1.5, height(x, z) + .5, z + (random() - .5) * 1.5), q, s.set(1, 1, 1)));
    }
  }
  for (let n = 0; n < 140; n++) {
    const [x, z] = place(random() * ring, site.inner + 20 + random() * 330), tall = 1.2 + random() * 3.5;
    q.setFromAxisAngle(new T.Vector3(random() - .5, 0, random() - .5).normalize(), (random() - .5) * .35);
    stumps.push(new T.Matrix4().compose(p.set(x, height(x, z) + tall / 2 - .2, z), q, s.set(1, tall, 1)));
  }
  const wood = new T.MeshStandardMaterial({ color: 0x3a2e24, roughness: 1 });
  const picketMesh = new T.InstancedMesh(new T.BoxGeometry(.09, 1.3, .09), wood, pickets.length);
  pickets.forEach((m, i) => picketMesh.setMatrixAt(i, m)); picketMesh.name = 'far-field-pickets';
  const stumpMesh = new T.InstancedMesh(new T.CylinderGeometry(.16, .3, 1, 5, 1).translate(0, 0, 0), wood, stumps.length);
  stumps.forEach((m, i) => stumpMesh.setMatrixAt(i, m)); stumpMesh.name = 'far-field-stumps';

  // One ruined farm: roofless walls with broken tops, on the ridge line.
  const farmAngle = site.farm, farmR = site.inner + 230;
  const [fx, fz] = place(Math.round((farmAngle / (Math.PI * 2) + 1) % 1 * ring), farmR);
  const walls: [number, number, number, number, number, number][] = [ // dx, dz, length, height, thickness, yaw
    [0, 0, 16, 5.5, .6, 0], [0, 9, 16, 3.2, .6, 0], [-8, 4.5, 9, 6.5, .6, Math.PI / 2], [8, 4.5, 9, 2.4, .6, Math.PI / 2],
    [15, -6, 10, 4.2, .5, .3], [22, -3, 7, 2.8, .5, .3 + Math.PI / 2], [-18, 12, 8, 3.6, .5, -.2],
    [-3, 2, 3, 8.5, .7, 0], [26, 10, 5, 1.8, .5, 1.1], [-14, -7, 6, 2.2, .5, .7],
  ];
  const ruin = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1).translate(0, .5, 0),
    new T.MeshStandardMaterial({ roughness: 1 }), walls.length * 2);
  const ruinColors = site.ruin.map(c => new T.Color(c));
  let n = 0;
  for (const [dx, dz, length, tall, thick, yaw] of walls) {
    const x = fx + dx, z = fz + dz, base = height(x, z) - .4;
    q.setFromAxisAngle(new T.Vector3(0, 1, 0), yaw + farmAngle);
    // Each wall is two blocks of different heights: a broken, stepped top.
    const split = .35 + random() * .3;
    for (const [part, h] of [[split, tall], [1 - split, tall * (.45 + random() * .35)]] as const) {
      const offset = (part === split ? -(1 - split) : split) * length / 2;
      matrix.compose(p.set(x + Math.cos(yaw + farmAngle) * offset, base, z - Math.sin(yaw + farmAngle) * offset), q, s.set(length * part, h, thick));
      ruin.setMatrixAt(n, matrix); ruin.setColorAt(n, ruinColors[n % ruinColors.length]!); n++;
    }
  }
  ruin.name = 'far-field-ruin';

  const group = new T.Group();
  group.name = 'far-field';
  for (const mesh of [ground, picketMesh, stumpMesh, ruin]) {
    mesh.castShadow = false; mesh.receiveShadow = false; mesh.raycast = () => {};
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    group.add(mesh);
  }
  for (const mesh of [picketMesh, stumpMesh, ruin]) mesh.computeBoundingSphere();
  group.matrixAutoUpdate = false;
  return group;
}

export function disposeFarField(group: T.Group | undefined): void {
  group?.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    node.geometry.dispose();
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => m.dispose());
  });
}
