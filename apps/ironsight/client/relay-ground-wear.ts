import type { MapDef } from '../src/map/types.js';

type Random = () => number;
type Box = MapDef['boxes'][number];

/** Solids standing on the yard floor (not the sunken cut, not roofs). */
function standingSolids(map: MapDef): Box[] {
  return map.boxes.filter(b => b.min.y < 2 && b.max.y > 0.05 && !map.terrain?.boxes.includes(b));
}

/** Churned, trodden and shelled yard earth, painted once at load into the
 * existing luminance atlas in metre coordinates. Darker paint also reads as
 * wet mud in finishRelaySurface('ground'). No texture file, pass or per-frame work. */
export function paintRelayEarth(ctx: CanvasRenderingContext2D, map: MapDef): void {
  let seed = 1917;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const { width, depth } = map.bounds;
  ctx.save();
  ctx.scale(512 / width, 512 / depth);
  ctx.fillStyle = '#898989';
  ctx.fillRect(0, 0, width, depth);
  // Two scales of value break the uniform sand: broad wet/dry fields, then clods.
  for (let patch = 0; patch < 90; patch++) {
    const x = random() * width, z = random() * depth, radius = 5 + random() * 12, dry = random() < 0.5;
    blot(ctx, x, z, radius, dry ? 215 : 30, dry ? 0.12 + random() * 0.12 : 0.05 + random() * 0.11);
  }
  for (let patch = 0; patch < 420; patch++) {
    const x = random() * width, z = random() * depth;
    blot(ctx, x, z, 0.7 + random() * 4.8, 35, 0.04 + random() * 0.12);
  }
  for (const z of [27.2, 70.7]) for (const side of [-0.72, 0.72]) {
    for (const [lineWidth, opacity] of [[0.85, 0.12], [0.28, 0.30], [0.09, 0.22]] as const) {
      ctx.strokeStyle = `rgba(30,30,30,${opacity})`; ctx.lineWidth = lineWidth;
      ctx.beginPath(); ctx.moveTo(4, z + side);
      ctx.bezierCurveTo(34, z + side, 40, z - 1.7 + side, 74, z - 1.7 + side);
      ctx.bezierCurveTo(108, z - 1.7 + side, 125, z + side, 146, z + side);
      ctx.stroke();
    }
  }
  paintMudAprons(ctx, map, random);
  paintRelayFootpaths(ctx, map, random);
  for (const [x, z, r] of relayCraterSites(map)) paintCrater(ctx, x, z, r, random);
  paintShellPocks(ctx, map, random);
  paintRubble(ctx, map, random);
  for (let scuff = 0; scuff < 2600; scuff++) {
    const x = random() * width, z = random() * depth;
    ctx.fillStyle = random() < 0.55 ? 'rgba(30,30,30,0.18)' : 'rgba(200,200,200,0.12)';
    ctx.beginPath();
    ctx.ellipse(x, z, 0.07 + random() * 0.22, 0.05 + random() * 0.09, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  if (map.terrain) {
    const cut = map.terrain.cut;
    ctx.fillStyle = 'rgba(30,30,30,0.13)';
    ctx.fillRect(cut.minX, cut.minZ, cut.maxX - cut.minX, cut.maxZ - cut.minZ);
  }
  ctx.restore();
}

function blot(ctx: CanvasRenderingContext2D, x: number, z: number, radius: number, value: number, alpha: number): void {
  const shade = ctx.createRadialGradient(x, z, 0, x, z, radius);
  shade.addColorStop(0, `rgba(${value},${value},${value},${alpha})`);
  shade.addColorStop(0.6, `rgba(${value},${value},${value},${alpha * 0.55})`);
  shade.addColorStop(1, `rgba(${value},${value},${value},0)`);
  ctx.fillStyle = shade;
  ctx.fillRect(x - radius, z - radius, radius * 2, radius * 2);
}

/** Trampled, wet ground hugging every cover base: irregular lobes, not a halo. */
function paintMudAprons(ctx: CanvasRenderingContext2D, map: MapDef, random: Random): void {
  for (const b of standingSolids(map)) {
    const perimeter = 2 * ((b.max.x - b.min.x) + (b.max.z - b.min.z));
    const lobes = Math.max(3, Math.round(perimeter / 1.6));
    for (let i = 0; i < lobes; i++) {
      const edge = random() * 4 | 0, t = random();
      const x = edge === 0 ? b.min.x + t * (b.max.x - b.min.x) : edge === 1 ? b.max.x : edge === 2 ? b.max.x - t * (b.max.x - b.min.x) : b.min.x;
      const z = edge === 0 ? b.min.z : edge === 1 ? b.min.z + t * (b.max.z - b.min.z) : edge === 2 ? b.max.z : b.max.z - t * (b.max.z - b.min.z);
      blot(ctx, x, z, 1.0 + random() * 1.7, 22, 0.18 + random() * 0.18);
    }
  }
}

/** Trodden routes between the deployment gates, the objectives and the signal
 * post: a compacted band, two cart/boot ruts and standing-water stains. */
function paintRelayFootpaths(ctx: CanvasRenderingContext2D, map: MapDef, random: Random): void {
  const w = map.bounds.width;
  const routes: (readonly [number, number])[][] = [];
  for (const east of [false, true]) {
    const x = (n: number) => east ? w - n : n;
    routes.push([[x(4), 45], [x(12), 42], [x(20), 26], [x(25), 16]]);
    routes.push([[x(4), 53], [x(18), 54], [x(38), 49], [x(58), 51], [x(71), 53]]);
    routes.push([[x(4), 57], [x(12), 64], [x(28), 76], [x(50), 82], [x(72), 85]]);
    routes.push([[x(27), 17], [x(42), 26], [x(60), 27], [x(71), 38], [x(73), 50]]);
  }
  routes.push([[75, 84], [74, 70], [76, 60], [75, 56]]);
  const trace = (route: readonly (readonly [number, number])[], offset: number) => {
    // Offset each vertex perpendicular to its local direction for parallel ruts.
    const points = route.map(([x, z], i) => {
      const [ax, az] = route[Math.max(0, i - 1)]!, [bx, bz] = route[Math.min(route.length - 1, i + 1)]!;
      const length = Math.hypot(bx - ax, bz - az) || 1;
      return [x - (bz - az) / length * offset, z + (bx - ax) / length * offset] as const;
    });
    ctx.beginPath(); ctx.moveTo(points[0]![0], points[0]![1]);
    for (let i = 1; i < points.length - 1; i++) {
      const [px, pz] = points[i]!, [nx, nz] = points[i + 1]!;
      ctx.quadraticCurveTo(px, pz, (px + nx) / 2, (pz + nz) / 2);
    }
    const last = points[points.length - 1]!; ctx.lineTo(last[0], last[1]); ctx.stroke();
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [lineWidth, alpha] of [[3.4, 0.10], [2.0, 0.14]] as const) {
    ctx.strokeStyle = `rgba(32,32,32,${alpha})`; ctx.lineWidth = lineWidth;
    for (const route of routes) trace(route, 0);
  }
  for (const offset of [-0.6, 0.6]) for (const [lineWidth, alpha] of [[0.42, 0.22], [0.16, 0.34]] as const) {
    ctx.strokeStyle = `rgba(22,22,22,${alpha})`; ctx.lineWidth = lineWidth;
    for (const route of routes) trace(route, offset);
  }
  // Standing-water stains in the ruts: dark centre, pale dried-silt rim.
  for (const route of routes) for (let i = 0; i + 1 < route.length; i++) {
    const [ax, az] = route[i]!, [bx, bz] = route[i + 1]!;
    if (random() < 0.35) continue;
    const t = 0.25 + random() * 0.5, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const rx = 0.9 + random() * 1.3, rz = 0.45 + random() * 0.6, angle = Math.atan2(bz - az, bx - ax);
    ctx.fillStyle = 'rgba(200,200,200,0.14)';
    ctx.beginPath(); ctx.ellipse(x, z, rx * 1.25, rz * 1.35, angle, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(14,14,14,0.42)';
    ctx.beginPath(); ctx.ellipse(x, z, rx, rz, angle, 0, Math.PI * 2); ctx.fill();
  }
}

/** Open ground at least 4.5 m from any solid, spawn gate or objective, spread apart.
 * Deterministic from the collision map so it can never land under or inside cover. */
export function relayCraterSites(map: MapDef): [number, number, number][] {
  const standing = standingSolids(map);
  const clear = (x: number, z: number, margin: number) => standing.every(b =>
    x < b.min.x - margin || x > b.max.x + margin || z < b.min.z - margin || z > b.max.z + margin);
  const reserved = [...Object.values(map.caps), ...map.spawns.red, ...map.spawns.blue];
  const sites: [number, number, number][] = [];
  for (let z = 8; z <= 92 && sites.length < 10; z += 3) for (let x = 8; x <= map.bounds.width - 8 && sites.length < 10; x += 3) {
    if (!clear(x, z, 4.5)) continue;
    if (reserved.some(p => Math.hypot(p.x - x, p.z - z) < 10)) continue;
    if ((map.ramps ?? []).some(r => x > r.minX - 4 && x < r.maxX + 4 && z > r.minZ - 4 && z < r.maxZ + 4)) continue;
    if (map.terrain && x > map.terrain.cut.minX - 4 && x < map.terrain.cut.maxX + 4 && z > map.terrain.cut.minZ - 4 && z < map.terrain.cut.maxZ + 4) continue;
    if (sites.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 15)) continue;
    sites.push([x, z, 2.6 + ((x * 7 + z * 3) % 5) * 0.3]);
  }
  return sites;
}

/** Shell crater decal: dark bowl, scorched rim, pale thrown-up lip and ejecta. */
function paintCrater(ctx: CanvasRenderingContext2D, x: number, z: number, r: number, random: Random): void {
  const outer = ctx.createRadialGradient(x, z, r * 0.9, x, z, r * 2.3);
  outer.addColorStop(0, 'rgba(210,210,210,0.22)'); outer.addColorStop(0.3, 'rgba(210,210,210,0.12)'); outer.addColorStop(1, 'rgba(210,210,210,0)');
  ctx.fillStyle = outer; ctx.beginPath(); ctx.arc(x, z, r * 2.3, 0, Math.PI * 2); ctx.fill();
  for (let ray = 0; ray < 34; ray++) {
    const a = random() * Math.PI * 2, reach = r * (1.5 + random() * 1.9);
    ctx.strokeStyle = `rgba(25,25,25,${0.10 + random() * 0.14})`; ctx.lineWidth = 0.15 + random() * 0.35;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.95, z + Math.sin(a) * r * 0.95);
    ctx.lineTo(x + Math.cos(a) * reach, z + Math.sin(a) * reach); ctx.stroke();
  }
  // Scorched, irregular rim.
  for (let lobe = 0; lobe < 14; lobe++) {
    const a = lobe / 14 * Math.PI * 2 + random() * 0.3, d = r * (0.85 + random() * 0.3);
    blot(ctx, x + Math.cos(a) * d, z + Math.sin(a) * d, r * (0.35 + random() * 0.25), 12, 0.45);
  }
  const bowl = ctx.createRadialGradient(x, z, 0, x, z, r);
  bowl.addColorStop(0, 'rgba(10,10,10,0.62)'); bowl.addColorStop(0.55, 'rgba(18,18,18,0.52)'); bowl.addColorStop(1, 'rgba(18,18,18,0.12)');
  ctx.fillStyle = bowl; ctx.beginPath(); ctx.arc(x, z, r, 0, Math.PI * 2); ctx.fill();
  for (let clod = 0; clod < 140; clod++) {
    const a = random() * Math.PI * 2, d = r * (0.9 + random() * random() * 2.6);
    ctx.fillStyle = random() < 0.6 ? 'rgba(20,20,20,0.40)' : 'rgba(210,210,210,0.28)';
    ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, z + Math.sin(a) * d, 0.08 + random() * 0.24, 0.06 + random() * 0.14, a, 0, Math.PI * 2); ctx.fill();
  }
}

/** Small shell and grenade pocks across the open floor, clear of solids. */
function paintShellPocks(ctx: CanvasRenderingContext2D, map: MapDef, random: Random): void {
  const standing = standingSolids(map);
  for (let placed = 0, tries = 0; placed < 55 && tries < 600; tries++) {
    const x = 4 + random() * (map.bounds.width - 8), z = 4 + random() * (map.bounds.depth - 8), r = 0.5 + random() * 0.9;
    if (!standing.every(b => x < b.min.x - 1 || x > b.max.x + 1 || z < b.min.z - 1 || z > b.max.z + 1)) continue;
    placed++;
    blot(ctx, x, z, r * 2.1, 205, 0.14);
    blot(ctx, x, z, r, 14, 0.55);
  }
}

/** Brick rubble and splinters spilled at the foot of walls and around craters. */
function paintRubble(ctx: CanvasRenderingContext2D, map: MapDef, random: Random): void {
  const speck = (x: number, z: number, spread: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2, d = Math.sqrt(random()) * spread;
      ctx.fillStyle = random() < 0.45 ? 'rgba(225,225,225,0.34)' : 'rgba(15,15,15,0.38)';
      ctx.save(); ctx.translate(x + Math.cos(a) * d, z + Math.sin(a) * d); ctx.rotate(random() * Math.PI);
      const s = 0.08 + random() * 0.26; ctx.fillRect(-s / 2, -s * 0.35, s, s * 0.7); ctx.restore();
    }
  };
  for (const b of standingSolids(map)) {
    if (b.max.y - b.min.y < 2.5 || random() < 0.4) continue;
    const alongX = b.max.x - b.min.x >= b.max.z - b.min.z, side = random() < 0.5;
    const x = alongX ? b.min.x + random() * (b.max.x - b.min.x) : side ? b.min.x - 0.6 : b.max.x + 0.6;
    const z = alongX ? (side ? b.min.z - 0.6 : b.max.z + 0.6) : b.min.z + random() * (b.max.z - b.min.z);
    speck(x, z, 1.1 + random() * 0.8, 45);
  }
  for (const [x, z, r] of relayCraterSites(map)) speck(x, z, r * 2.2, 80);
}
