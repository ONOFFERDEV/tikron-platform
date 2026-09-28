import * as T from 'three';
import { terrainGeometry, exteriorApronGeometry } from './terrain-geometry.js';
import type { MapDef } from '../src/map/types.js';
import { buildRelayApronGeometry } from './relay-apron.js';
import { finishRelaySurface, relayGroundTexture, updateRelayGroundTexture } from './relay-surfaces.js';
import { paintUndertowTracks, paintUndertowWetness } from './undertow-wetness.js';
import { finishUndertowSurface, undertowGroundTexture, updateUndertowGroundTexture } from './undertow-surfaces.js';
import { finishSwitchyardSurface } from './switchyard-surfaces.js';
import { paintSwitchyardServiceWear } from './switchyard-service-wear.js';
import type { FloorFace } from '../src/map/terrain.js';
import { paintRelayEarth, relayCraterSites, relayFootpathRoutes, type GroundPuddle } from './relay-ground-wear.js';
import { undertowTracks } from './undertow-wetness.js';
const groundLoads = new WeakMap<T.Scene, Promise<void>>();
export function waitForSiteGround(scene: T.Scene): Promise<void> {
  return groundLoads.get(scene) ?? Promise.resolve();
}

export function siteGroundFaces(map: MapDef): readonly FloorFace[] {
  return map.terrain?.faces ?? [{ minX: 0, maxX: map.bounds.width, minZ: 0, maxZ: map.bounds.depth, y: 0 }];
}

/** Original baked contact/dirt atlas. Opaque ground: no AO pass, blended floor
 * decal or per-frame work. MapDef footprints keep grime attached to real cover. */
export function buildSiteGround(scene: T.Scene, map: MapDef, wet = false): void {
  const relay = map.presentation === 'relay';
  const undertow = map.presentation === 'undertow', switchyard = map.presentation === 'switchyard';
  const metric = relay || undertow || switchyard;
  const canvas = document.createElement('canvas');
  canvas.width = metric ? 1024 : 512; canvas.height = metric ? Math.round(1024 * map.bounds.depth / map.bounds.width) : 512;
  const ctx = canvas.getContext('2d')!;
  // Drawing coordinates stay in the original atlas space. Detailed maps get
  // equal density along both world axes; metric joints live in the shader.
  ctx.scale(canvas.width / 512, canvas.height / 512);
  ctx.fillStyle = wet ? '#607a7b' : '#89928a'; ctx.fillRect(0, 0, 512, 512);
  let seed = 71;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < (metric ? 0 : 16000); i++) {
    ctx.fillStyle = `rgba(22,35,32,${random() * 0.08})`;
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 2, 1 + random() * 2);
  }
  const sx = 512 / map.bounds.width, sz = 512 / map.bounds.depth;
  if (metric && !switchyard && !relay) {
    // Broad pour-to-pour aging gives the existing atlas a second scale of wear.
    // Deterministic, restrained contrast keeps the lane paint readable.
    for (let z = 0; z < map.bounds.depth; z += 5) for (let x = 0; x < map.bounds.width; x += 6) {
      ctx.fillStyle = `rgba(43,57,49,${0.015 + random() * 0.055})`;
      ctx.fillRect(x * sx, z * sz, 6 * sx, 5 * sz);
    }
  }
  // Broad stained slabs, not a high-frequency grid that shimmers at eye level.
  ctx.strokeStyle = wet ? '#516e6e' : '#7b867d'; ctx.lineWidth = 0.6;
  if (!metric) {
    for (let x = 0; x <= map.bounds.width; x += 6) { ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, 512); ctx.stroke(); }
    for (let z = 0; z <= map.bounds.depth; z += 5) { ctx.beginPath(); ctx.moveTo(0, z * sz); ctx.lineTo(512, z * sz); ctx.stroke(); }
  }
  const puddles: GroundPuddle[] = [];
  if (map.presentation === 'relay') {
    paintRelayEarth(ctx, map, puddles);
  }
  if (switchyard) paintSwitchyardServiceWear(ctx, map);
  if (switchyard && map.terrain) {
    const c = map.terrain.cut;
    ctx.save(); ctx.scale(sx, sz);
    ctx.fillStyle = '#53584f'; ctx.fillRect(c.minX, c.minZ, c.maxX - c.minX, c.maxZ - c.minZ);
    // Ballast/oil band and service drains live in the existing opaque atlas.
    ctx.fillStyle = '#42463c'; ctx.fillRect(c.minX + 8, 70.5, c.maxX - c.minX - 16, 3);
    ctx.fillStyle = '#303b34';
    for (const z of [c.minZ + .5, c.maxZ - .7]) ctx.fillRect(c.minX + 8, z, c.maxX - c.minX - 16, .2);
    ctx.restore();
  }
  if (undertow && map.terrain) {
    const c = map.terrain.cut;
    ctx.save(); ctx.scale(sx, sz);
    // A stained, drained channel floor. Paint is in the existing packed atlas;
    // no water surface, transparent overlay or invisible sight obstruction.
    ctx.fillStyle = '#4d5346'; ctx.fillRect(c.minX, c.minZ, c.maxX-c.minX, c.maxZ-c.minZ);
    ctx.fillStyle = '#353d36';
    for (const z of [c.minZ+.55,c.maxZ-.7]) ctx.fillRect(c.minX+8,z,c.maxX-c.minX-16,.15);
    paintUndertowTracks(ctx, map.bounds.width);
    ctx.restore();
  }
  for (const box of map.boxes) {
    if (map.terrain?.boxes.includes(box)) continue;
    if (map.signalCore?.doors.includes(box)) continue; // No baked shadow from retractable cover.
    const x = box.min.x * sx, z = box.min.z * sz, w = (box.max.x - box.min.x) * sx, d = (box.max.z - box.min.z) * sz;
    // Nested translucent fills are baked into an opaque texture once at load.
    for (let ring = 8; ring >= 1; ring--) {
      ctx.fillStyle = wet ? 'rgba(10,32,32,0.055)' : 'rgba(21,32,27,0.045)';
      ctx.fillRect(x - ring * 0.65, z - ring, w + ring * 1.3, d + ring * 2);
    }
  }
  if (wet && !undertow) for (let i = 0; i < 28; i++) {
    ctx.fillStyle = 'rgba(23,55,58,0.13)'; ctx.beginPath();
    ctx.ellipse(random() * 512, random() * 512, 5 + random() * 13, 2 + random() * 4, random(), 0, Math.PI * 2); ctx.fill();
  }
  const wetness = undertow ? document.createElement('canvas') : null;
  if (wetness) {
    wetness.width = canvas.width; wetness.height = canvas.height;
    paintUndertowWetness(wetness, map, puddles);
  }
  const texture = wetness ? undertowGroundTexture(canvas, wetness) : metric ? relayGroundTexture(canvas) : new T.CanvasTexture(canvas);
  if (switchyard) texture.name = 'switchyard-ground-intensity';
  if (!metric) texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  // Blender-baked ground AO (tools/bake-ground-ao.py, same row-0 = north layout)
  // multiplied in once it arrives; the atlas above stands alone until then.
  if (map.presentation) {
    const ao = new Image();
    let loaded!: () => void;
    groundLoads.set(scene, new Promise<void>(resolve => { loaded = resolve; }));
    ao.onload = () => {
      ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(ao, 0, 0, 512, 512);
      if (texture instanceof T.DataTexture && wetness) updateUndertowGroundTexture(texture, canvas, wetness);
      else if (texture instanceof T.DataTexture) updateRelayGroundTexture(texture, canvas);
      else texture.needsUpdate = true;
      loaded();
    };
    // Keep the opaque authored base if the optional AO download fails.
    ao.onerror = () => loaded();
    ao.src = `/assets/maps/${map.presentation}-ground-ao.png`;
  }
  // CanvasTexture's default flipY puts its top row at plane V=1; after the
  // -90 degree floor rotation that is z=0 (north), matching the map footprints.
  const floor = new T.Mesh(terrainGeometry(map),
    new T.MeshStandardMaterial({ map: texture, roughness: undertow ? 0.94 : wet ? 0.76 : 0.96 }));
  if (metric) {
    const tint = new T.Color(undertow ? '#7a705c' : relay ? '#81725f' : '#6e7168'), base = new T.Color(undertow ? '#606060' : '#898989').r;
    floor.material.color.copy(tint).multiplyScalar(1 / base);
    if (switchyard) finishSwitchyardSurface(floor.material, 'ground');
    else if (undertow) finishUndertowSurface(floor.material, 'ground');
    else finishRelaySurface(floor.material, 'ground');
    if (relay || undertow) addUnderfoot(floor.material, underfootMask(map, puddles, canvas.width, canvas.height), map, undertow);
  }
  floor.receiveShadow = true;
  floor.userData.siteGround = true;
  floor.name = `${map.presentation ?? 'site'}-ground`;
  scene.add(floor);
  const apron = new T.Mesh(relay ? buildRelayApronGeometry(map.bounds) : map.terrain ? exteriorApronGeometry(map) : new T.PlaneGeometry(map.bounds.width + 120, map.bounds.depth + 120),
    new T.MeshStandardMaterial({ color: relay ? 0xffffff : undertow ? 0x60655c : switchyard ? 0x62665d : wet ? 0x52686c : 0x818b88, vertexColors: relay, roughness: 0.98 }));
  if (!relay && !map.terrain) { apron.rotation.x = -Math.PI / 2; apron.position.set(map.bounds.width / 2, -0.03, map.bounds.depth / 2); }
  apron.userData.siteGround = true;
  apron.name = `${map.presentation ?? 'site'}-apron`;
  apron.receiveShadow = true; scene.add(apron);
}

type Segment = readonly [number, number, number, number];

/** Where things lie underfoot, in the ground atlas layout (row 0 = north), 0..1:
 * R brick spill at wall bases, G duckboard run, B duckboard heading (angle / pi),
 * A standing water. One RGBA8 upload at load; none of it is geometry or stands up. */
function underfootMask(map: MapDef, puddles: readonly GroundPuddle[], width: number, height: number): T.DataTexture {
  let seed = 4127;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const layer = () => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const g = canvas.getContext('2d')!; g.fillStyle = '#000'; g.fillRect(0, 0, width, height);
    g.scale(width / map.bounds.width, height / map.bounds.depth); g.lineCap = 'round';
    return { canvas, g };
  };
  const rubble = layer(), board = layer(), heading = layer(), water = layer();
  const solids = map.boxes.filter(b => b.min.y < 0.5 && b.max.y - b.min.y > 0.9
    && !map.terrain?.boxes.includes(b) && !map.signalCore?.doors.includes(b));
  // Spill hugs each wall face in short ragged strokes, heavier under tall masonry.
  for (const b of solids) {
    const tall = b.max.y - b.min.y > 2.4 ? 1 : 0.55;
    const faces = [[b.min.x, b.min.z, b.max.x, b.min.z], [b.max.x, b.min.z, b.max.x, b.max.z],
      [b.max.x, b.max.z, b.min.x, b.max.z], [b.min.x, b.max.z, b.min.x, b.min.z]] as const;
    for (const [x0, z0, x1, z1] of faces) {
      const length = Math.hypot(x1 - x0, z1 - z0);
      for (let at = 0; at < length; at += 0.5) {
        const t = at / length, reach = (0.35 + random() * random() * 1.3) * tall;
        rubble.g.strokeStyle = `rgba(255,255,255,${(0.35 + random() * 0.5) * tall})`; rubble.g.lineWidth = reach;
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        rubble.g.beginPath(); rubble.g.moveTo(x, z);
        rubble.g.lineTo(x + (x1 - x0) / length * 0.6, z + (z1 - z0) / length * 0.6); rubble.g.stroke();
      }
    }
  }
  if (map.presentation === 'relay') for (const [x, z, r] of relayCraterSites(map)) {
    const spill = rubble.g.createRadialGradient(x, z, r * 0.8, x, z, r * 2.2);
    spill.addColorStop(0, 'rgba(255,255,255,0.55)'); spill.addColorStop(1, 'rgba(255,255,255,0)');
    rubble.g.fillStyle = spill; rubble.g.fillRect(x - r * 2.2, z - r * 2.2, r * 4.4, r * 4.4);
  }
  for (const p of puddles) {
    water.g.save(); water.g.translate(p.x, p.z); water.g.rotate(p.angle); water.g.scale(p.rx, p.rz);
    const pool = water.g.createRadialGradient(0, 0, 0, 0, 0, 1);
    pool.addColorStop(0, '#fff'); pool.addColorStop(0.55, '#ddd'); pool.addColorStop(1, '#000');
    water.g.fillStyle = pool; water.g.beginPath(); water.g.arc(0, 0, 1, 0, Math.PI * 2); water.g.fill(); water.g.restore();
  }
  // Duckboards over the wettest stretches of the trodden routes and across the larger
  // pools, only where a 0.5 m margin stays clear of every solid and the map edge.
  const clear = (x: number, z: number) => x > 1 && z > 1 && x < map.bounds.width - 1 && z < map.bounds.depth - 1
    && solids.every(b => x < b.min.x - 0.5 || x > b.max.x + 0.5 || z < b.min.z - 0.5 || z > b.max.z + 0.5);
  const runs: Segment[] = [];
  const lay = ([ax, az, bx, bz]: Segment) => {
    const length = Math.hypot(bx - ax, bz - az);
    for (let at = 0; at <= length; at += 0.4) if (!clear(ax + (bx - ax) * at / length, az + (bz - az) * at / length)) return;
    runs.push([ax, az, bx, bz]);
  };
  const routes = map.presentation === 'relay' ? relayFootpathRoutes(map).map(route => route.map(([x, z]) => ({ x, z })))
    : undertowTracks(map.bounds.width);
  for (const route of routes) for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!, b = route[i]!, length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 6 || random() < 0.45) continue;
    const run = Math.min(length - 2, 4 + random() * 6), start = 1 + random() * (length - 2 - run);
    const ux = (b.x - a.x) / length, uz = (b.z - a.z) / length;
    lay([a.x + ux * start, a.z + uz * start, a.x + ux * (start + run), a.z + uz * (start + run)]);
  }
  for (const p of puddles) if (p.rx > 1.3) {
    const reach = p.rx + 0.9, ux = Math.cos(p.angle), uz = Math.sin(p.angle);
    lay([p.x - ux * reach, p.z - uz * reach, p.x + ux * reach, p.z + uz * reach]);
  }
  for (const [ax, az, bx, bz] of runs) {
    const angle = ((Math.atan2(bz - az, bx - ax) % Math.PI) + Math.PI) % Math.PI;
    // The heading is painted wider than the boards so filtering never blends it at their edges.
    for (const [target, style, lineWidth] of [[board, '#fff', 0.95], [heading, `rgb(${Math.round(angle / Math.PI * 255)},0,0)`, 2.2]] as const) {
      target.g.strokeStyle = style; target.g.lineWidth = lineWidth; target.g.lineCap = 'square';
      target.g.beginPath(); target.g.moveTo(ax, az); target.g.lineTo(bx, bz); target.g.stroke();
    }
  }
  const read = (canvas: HTMLCanvasElement) => canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  const [r, g, b, a] = [read(rubble.canvas), read(board.canvas), read(heading.canvas), read(water.canvas)];
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const out = ((height - 1 - Math.floor(i / width)) * width + i % width) * 4;
    data[out] = r[i * 4]!; data[out + 1] = g[i * 4]!; data[out + 2] = b[i * 4]!; data[out + 3] = a[i * 4]!;
  }
  const texture = new T.DataTexture(data, width, height, T.RGBAFormat);
  texture.name = `${map.presentation}-underfoot`;
  texture.generateMipmaps = true; texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const UNDERFOOT_FUNCTIONS = `
uniform sampler2D underfootMask;
float ufHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float ufNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ufHash(i), ufHash(i + vec2(1.0, 0.0)), f.x), mix(ufHash(i + vec2(0.0, 1.0)), ufHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Coverage of a rotated rectangle / ellipse, antialiased to the pixel footprint.
float ufRect(vec2 local, float angle, vec2 halfSize, float px) {
  vec2 q = abs(mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * local) - halfSize;
  return 1.0 - smoothstep(-px * 0.5, px * 0.5, max(q.x, q.y));
}
float ufOval(vec2 local, float angle, vec2 halfSize, float px) {
  vec2 q = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * local / halfSize;
  return 1.0 - smoothstep(1.0 - px / min(halfSize.x, halfSize.y), 1.0, length(q));
}
`;

/** What a trench line leaves underfoot, drawn in the existing ground pass: tracked
 * boot mud, duckboards, cartridge cases, straw, paper, brick spill and standing water
 * with a sheen. World-anchored cells fade by pixel footprint so nothing shimmers at
 * range. Everything is flat (normal relief only), so it can never act as cover. */
function underfootSnippet(map: MapDef, undertow: boolean): string {
  const f = (n: number) => n.toFixed(3);
  return `
  #if defined(USE_MAP) && defined(USE_ROUGHNESSMAP)
  {
    vec2 lxz = vec2(vMapUv.x * ${f(map.bounds.width)}, (1.0 - vMapUv.y) * ${f(map.bounds.depth)});
    vec2 lfw = max(fwidth(lxz), vec2(0.0005));
    float lpx = max(lfw.x, lfw.y);
    vec4 feat = texture2D(underfootMask, vMapUv);
    float mudness = 1.0 - smoothstep(${undertow ? '0.045, 0.10' : '0.10, 0.21'}, texture2D(map, vMapUv).r);
    // Boot-tracked mud: sole and heel smears, densest where the paint is already trodden.
    vec2 bc = floor(lxz / 0.55), bl = (fract(lxz / 0.55) - 0.5) * 0.55;
    float bh = ufHash(bc + 3.1), ba = ufHash(bc + 9.7) * 6.2832;
    vec2 toe = vec2(cos(ba), sin(ba));
    float sole = max(ufOval(bl + toe * 0.04, ba, vec2(0.08, 0.042), lpx), ufOval(bl - toe * 0.085, ba, vec2(0.034, 0.036), lpx));
    sole *= 0.55 + 0.45 * ufNoise(lxz * 60.0);
    float boot = step(bh, 0.08 + mudness * 0.45) * sole * (1.0 - smoothstep(0.03, 0.09, lpx));
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.64, 0.58, 0.50), boot);
    // Brick spill at wall bases: chips and half-bricks; a warm dust tone at range.
    float spill = feat.r;
    diffuseColor.rgb *= mix(vec3(1.0), vec3(1.04, 0.92, 0.82), spill * 0.35);
    vec2 cc = floor(lxz / 0.13), cl = (fract(lxz / 0.13) - 0.5) * 0.13;
    float ch = ufHash(cc + 1.7);
    float chip = step(ch, spill * 0.7) * ufRect(cl, ufHash(cc + 4.4) * 3.14, vec2(0.018, 0.012) + ufHash(cc + 8.2) * 0.022, lpx)
      * (1.0 - smoothstep(0.012, 0.03, lpx));
    vec3 chipTone = ch < spill * 0.3 ? vec3(0.30, 0.12, 0.06) : ch < spill * 0.42 ? vec3(0.46, 0.43, 0.37) : vec3(0.07, 0.06, 0.05);
    vec2 hc = floor(lxz / 0.5), hl = (fract(lxz / 0.5) - 0.5) * 0.5;
    float hh = ufHash(hc + 5.3);
    float brick = step(hh, spill * 0.35) * ufRect(hl, ufHash(hc + 2.2) * 3.14, vec2(0.06 + hh * 0.2, 0.04 + hh * 0.1), lpx)
      * (1.0 - smoothstep(0.03, 0.08, lpx));
    diffuseColor.rgb = mix(diffuseColor.rgb, chipTone, chip);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.27, 0.11, 0.055) * (0.8 + ufHash(hc + 6.6) * 0.4), brick);
    fieldRelief += (chip * 0.006 + brick * 0.014) * (1.0 - smoothstep(0.02, 0.06, lpx));
    // Straw: tufts of thin stalks, more of it where the ground is churned.
    vec2 sc = floor(lxz / 0.32), sl = (fract(lxz / 0.32) - 0.5) * 0.32;
    float sh = ufHash(sc + 7.9), straw = 0.0;
    if (sh < 0.20 + mudness * 0.30 + spill * 0.08) for (int k = 0; k < 6; k++) {
      float fk = float(k);
      vec2 o = (vec2(ufHash(sc + fk * 1.3), ufHash(sc + fk * 2.1 + 0.5)) - 0.5) * 0.16;
      straw = max(straw, ufRect(sl - o, ufHash(sc + fk * 3.7) * 3.14, vec2(0.018 + ufHash(sc + fk) * 0.035, 0.0022), lpx) * (0.6 + 0.4 * ufHash(sc + fk * 5.1)));
    }
    straw *= 1.0 - smoothstep(0.003, 0.009, lpx);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.40, 0.32, 0.14) * (0.8 + sh), straw * 0.7);
    // Paper: a few dirty, torn scraps of orders and wrappers.
    vec2 pc = floor(lxz / 1.3), pl = (fract(lxz / 1.3) - 0.5) * 1.3;
    float ph = ufHash(pc + 11.3);
    float paper = step(ph, 0.018 + mudness * 0.02)
      * ufRect(pl - (vec2(ufHash(pc + 1.0), ufHash(pc + 2.0)) - 0.5) * 0.8, ufHash(pc + 3.0) * 3.14, vec2(0.05 + ph * 2.0, 0.07), lpx);
    paper *= step(0.25, ufNoise(lxz * 40.0)) * (1.0 - smoothstep(0.02, 0.06, lpx));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.50, 0.48, 0.41) * mix(1.0, 0.7, mudness), paper);
    // Spent cartridge cases: brass, near walls and along the lanes.
    vec2 kc = floor(lxz / 0.7), kl = (fract(lxz / 0.7) - 0.5) * 0.7;
    float kh = ufHash(kc + 13.1);
    float brass = step(kh, 0.06 + spill * 0.18 + mudness * 0.05)
      * ufRect(kl - (vec2(ufHash(kc + 4.0), ufHash(kc + 5.0)) - 0.5) * 0.5, ufHash(kc + 6.0) * 3.14, vec2(0.03, 0.0065), lpx);
    brass *= 1.0 - smoothstep(0.006, 0.016, lpx);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.37, 0.12), brass);
    roughnessFactor = mix(roughnessFactor, 0.32, brass);
    metalnessFactor = mix(metalnessFactor, 0.9, brass);
    // Standing water where the paving dips: dark, flat and glossy, with a wet rim.
    float pool = feat.a + (ufNoise(lxz * 2.3) - 0.5) * 0.55 + (ufNoise(lxz * 7.0) - 0.5) * 0.15;
    float water = smoothstep(0.50, 0.56, pool);
    float rim = smoothstep(0.30, 0.50, pool) * (1.0 - water);
    // Duckboards: slats across the heading with dark gaps and stringer edges, laid over the water.
    float duck = smoothstep(0.40, 0.60, feat.g);
    float heading = feat.b * 3.14159;
    float u = dot(lxz, vec2(cos(heading), sin(heading))) / 0.2, slat = fract(u);
    float slatDetail = 1.0 - smoothstep(0.01, 0.04, lpx);
    float gap = smoothstep(0.80, 0.84, slat) * (1.0 - smoothstep(0.96, 1.0, slat)) * slatDetail;
    float stringer = (1.0 - smoothstep(0.66, 0.80, feat.g)) * duck;
    vec3 plank = vec3(0.17, 0.12, 0.075) * (0.8 + ufHash(vec2(floor(u), heading)) * 0.35) * mix(1.0, 0.8, mudness);
    plank = mix(plank, vec3(0.05, 0.045, 0.035), max(gap, stringer * 0.7));
    water *= 1.0 - duck; rim *= 1.0 - duck;
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.78, 0.76, 0.72), rim);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.30, 0.33, 0.33), water);
    roughnessFactor = mix(mix(roughnessFactor, 0.07, water), 0.55, rim);
    fieldRelief *= 1.0 - water;
    diffuseColor.rgb = mix(diffuseColor.rgb, plank, duck);
    roughnessFactor = mix(roughnessFactor, 0.9, duck);
    metalnessFactor = mix(metalnessFactor, 0.0, duck);
    fieldRelief += duck * 0.012 * (1.0 - gap);
    ${undertow ? 'undertowWet = max(undertowWet * (1.0 - duck), water);' : ''}
  }
  #endif
  `;
}

/** site-lighting re-applies the map's surface finish to the floor once the detail maps
 * arrive, which reassigns onBeforeCompile. Keep the underfoot layer on top of whatever
 * finish is assigned, now or later. */
function addUnderfoot(material: T.MeshStandardMaterial, mask: T.DataTexture, map: MapDef, undertow: boolean): void {
  let finish = material.onBeforeCompile, key = material.customProgramCacheKey;
  const compile: typeof finish = (shader, renderer) => {
    finish.call(material, shader, renderer);
    shader.uniforms.underfootMask = { value: mask };
    shader.fragmentShader = UNDERFOOT_FUNCTIONS + shader.fragmentShader
      .replace('#include <normal_fragment_begin>', `${underfootSnippet(map, undertow)}\n#include <normal_fragment_begin>`);
  };
  const cacheKey = () => `${key.call(material)}-underfoot-v1`;
  Object.defineProperty(material, 'onBeforeCompile', { get: () => compile, set: next => { finish = next; }, configurable: true });
  Object.defineProperty(material, 'customProgramCacheKey', { get: () => cacheKey, set: next => { key = next; }, configurable: true });
  material.needsUpdate = true;
}
