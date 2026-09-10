import type { MapDef } from '../src/map/types.js';

/** Original retired service traffic and cabinet-foot grime, painted once into
 * the existing opaque atlas. Coordinates are metres, then scaled to atlas space.
 * These faint rubber/oil marks never imply another playable obstacle or lane. */
export function paintSwitchyardServiceWear(ctx: CanvasRenderingContext2D, map: MapDef): void {
  ctx.save(); ctx.scale(512 / map.bounds.width, 512 / map.bounds.depth);
  let seed = 77021;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  // Metre-scale mottling between the fine tile and six-metre slab rhythm.
  // Soft, overlapping original stains give the yard age without stretched grit.
  for (let i = 0; i < 420; i++) {
    const x = random() * map.bounds.width, z = random() * map.bounds.depth;
    const radius = 0.65 + random() * 2.4;
    const stain = ctx.createRadialGradient(x, z, 0, x, z, radius);
    stain.addColorStop(0, `rgba(39,47,40,${0.025 + random() * 0.075})`);
    stain.addColorStop(1, 'rgba(39,47,40,0)');
    ctx.fillStyle = stain; ctx.fillRect(x - radius, z - radius, radius * 2, radius * 2);
  }
  // Broad rubber wear along the north bus and southern maintenance courts.
  // Interrupted tyre paths stay quiet under the existing amber/cyan wayfinding.
  for (const z of [29, 85]) for (const x of [27, 53, 93, 117]) {
    for (const side of [-1, 1]) {
      ctx.strokeStyle = 'rgba(29,38,34,0.14)'; ctx.lineWidth = 0.24;
      ctx.beginPath(); ctx.moveTo(x - 4, z + side * 0.85);
      ctx.bezierCurveTo(x, z + side * 0.85, x + 4, z + 0.6 + side * 0.85, x + 8, z + 0.6 + side * 0.85);
      ctx.stroke();
    }
  }
  for (const box of map.boxes) {
    if (map.signalCore?.doors.includes(box) || box.min.y !== 0 || box.max.y < 1.75) continue;
    const width = box.max.x - box.min.x;
    // Dry grease at cabinet service feet; no shadow from retractable freight.
    for (const side of [-1, 1]) {
      const x = box.min.x + width * (0.25 + random() * 0.5);
      const z = (side < 0 ? box.min.z : box.max.z) + side * 0.25;
      ctx.fillStyle = 'rgba(34,43,37,0.10)'; ctx.beginPath();
      ctx.ellipse(x, z, 0.4 + random() * 0.7, 0.2 + random() * 0.25, random() * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
