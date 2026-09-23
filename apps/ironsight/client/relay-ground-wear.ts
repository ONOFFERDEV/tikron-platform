import type { MapDef } from '../src/map/types.js';

export function paintRelayEarth(ctx: CanvasRenderingContext2D, map: MapDef): void {
  let seed = 1917;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.save();
  ctx.scale(512 / map.bounds.width, 512 / map.bounds.depth);
  ctx.fillStyle = '#898989';
  ctx.fillRect(0, 0, map.bounds.width, map.bounds.depth);
  for (let patch = 0; patch < 320; patch++) {
    const x = random() * map.bounds.width, z = random() * map.bounds.depth;
    const radius = 0.7 + random() * 4.8;
    const shade = ctx.createRadialGradient(x, z, 0, x, z, radius);
    shade.addColorStop(0, `rgba(35,35,35,${0.04 + random() * 0.13})`);
    shade.addColorStop(1, 'rgba(35,35,35,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(x - radius, z - radius, radius * 2, radius * 2);
  }
  for (const z of [27.2, 70.7]) for (const side of [-0.72, 0.72]) {
    for (const [width, opacity] of [[0.85, 0.07], [0.28, 0.20], [0.09, 0.17]] as const) {
      ctx.strokeStyle = `rgba(35,35,35,${opacity})`; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(4, z + side);
      ctx.bezierCurveTo(34, z + side, 40, z - 1.7 + side, 74, z - 1.7 + side);
      ctx.bezierCurveTo(108, z - 1.7 + side, 125, z + side, 146, z + side);
      ctx.stroke();
    }
  }
  for (let scuff = 0; scuff < 1300; scuff++) {
    const x = random() * map.bounds.width, z = random() * map.bounds.depth;
    ctx.fillStyle = random() < 0.5 ? 'rgba(36,36,36,0.12)' : 'rgba(180,180,180,0.08)';
    ctx.beginPath();
    ctx.ellipse(x, z, 0.07 + random() * 0.20, 0.05 + random() * 0.08, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  paintRelayFootpaths(ctx, map);
  for (const [x, z, r] of relayCraterSites(map)) paintCrater(ctx, x, z, r, random);
  if (map.terrain) {
    const cut = map.terrain.cut;
    ctx.fillStyle = 'rgba(30,30,30,0.13)';
    ctx.fillRect(cut.minX, cut.minZ, cut.maxX - cut.minX, cut.maxZ - cut.minZ);
  }
  ctx.restore();
}

/** Trodden routes between the deployment gates, the objectives and the signal
 * post: a broad compacted band with a darker centre line. Paint only. */
function paintRelayFootpaths(ctx: CanvasRenderingContext2D, map: MapDef): void {
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
  for (const [width, alpha] of [[2.4, 0.07], [1.3, 0.10], [0.45, 0.12]] as const) {
    ctx.strokeStyle = `rgba(38,38,38,${alpha})`; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const route of routes) {
      ctx.beginPath(); ctx.moveTo(route[0]![0], route[0]![1]);
      for (let i = 1; i < route.length - 1; i++) {
        const [px, pz] = route[i]!, [nx, nz] = route[i + 1]!;
        ctx.quadraticCurveTo(px, pz, (px + nx) / 2, (pz + nz) / 2);
      }
      const last = route[route.length - 1]!; ctx.lineTo(last[0], last[1]); ctx.stroke();
    }
  }
}

/** Open ground at least 4.5 m from any solid, spawn gate or objective, spread apart.
 * Deterministic from the collision map so it can never land under or inside cover. */
export function relayCraterSites(map: MapDef): [number, number, number][] {
  const standing = map.boxes.filter(b => b.min.y < 2 && b.max.y > 0.05 && !map.terrain?.boxes.includes(b));
  const clear = (x: number, z: number, margin: number) => standing.every(b =>
    x < b.min.x - margin || x > b.max.x + margin || z < b.min.z - margin || z > b.max.z + margin);
  const reserved = [...Object.values(map.caps), ...map.spawns.red, ...map.spawns.blue];
  const sites: [number, number, number][] = [];
  for (let z = 8; z <= 92 && sites.length < 6; z += 3) for (let x = 8; x <= map.bounds.width - 8 && sites.length < 6; x += 3) {
    if (!clear(x, z, 4.5)) continue;
    if (reserved.some(p => Math.hypot(p.x - x, p.z - z) < 10)) continue;
    if ((map.ramps ?? []).some(r => x > r.minX - 4 && x < r.maxX + 4 && z > r.minZ - 4 && z < r.maxZ + 4)) continue;
    if (map.terrain && x > map.terrain.cut.minX - 4 && x < map.terrain.cut.maxX + 4 && z > map.terrain.cut.minZ - 4 && z < map.terrain.cut.maxZ + 4) continue;
    if (sites.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 22)) continue;
    sites.push([x, z, 1.7 + ((x * 7 + z * 3) % 5) * 0.2]);
  }
  return sites;
}

/** Shell crater decal: scorched bowl, raised pale lip and radial ejecta clods. */
function paintCrater(ctx: CanvasRenderingContext2D, x: number, z: number, r: number, random: () => number): void {
  const bowl = ctx.createRadialGradient(x, z, 0, x, z, r);
  bowl.addColorStop(0, 'rgba(24,24,24,0.42)'); bowl.addColorStop(0.65, 'rgba(34,34,34,0.30)'); bowl.addColorStop(1, 'rgba(34,34,34,0)');
  ctx.fillStyle = bowl; ctx.beginPath(); ctx.arc(x, z, r, 0, Math.PI * 2); ctx.fill();
  const lip = ctx.createRadialGradient(x, z, r * 0.8, x, z, r * 1.5);
  lip.addColorStop(0, 'rgba(190,190,190,0)'); lip.addColorStop(0.35, 'rgba(190,190,190,0.16)'); lip.addColorStop(1, 'rgba(190,190,190,0)');
  ctx.fillStyle = lip; ctx.beginPath(); ctx.arc(x, z, r * 1.5, 0, Math.PI * 2); ctx.fill();
  for (let ray = 0; ray < 22; ray++) {
    const a = random() * Math.PI * 2, reach = r * (1.4 + random() * 1.6);
    ctx.strokeStyle = `rgba(40,40,40,${0.05 + random() * 0.07})`; ctx.lineWidth = 0.12 + random() * 0.25;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.9, z + Math.sin(a) * r * 0.9);
    ctx.lineTo(x + Math.cos(a) * reach, z + Math.sin(a) * reach); ctx.stroke();
  }
  for (let clod = 0; clod < 70; clod++) {
    const a = random() * Math.PI * 2, d = r * (1.0 + random() * random() * 2.4);
    ctx.fillStyle = random() < 0.6 ? 'rgba(40,40,40,0.22)' : 'rgba(175,175,175,0.18)';
    ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, z + Math.sin(a) * d, 0.06 + random() * 0.16, 0.05 + random() * 0.1, a, 0, Math.PI * 2); ctx.fill();
  }
}
