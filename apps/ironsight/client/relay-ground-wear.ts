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
  if (map.terrain) {
    const cut = map.terrain.cut;
    ctx.fillStyle = 'rgba(30,30,30,0.13)';
    ctx.fillRect(cut.minX, cut.minZ, cut.maxX - cut.minX, cut.maxZ - cut.minZ);
  }
  ctx.restore();
}
