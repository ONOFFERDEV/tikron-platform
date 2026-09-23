import type { MapDef } from '../src/map/types.js';
import { UNDERTOW_B_APPROACHES } from '../src/map/undertow-yard.js';

/** Trodden trench-floor routes in metres: the B approaches plus both
 * deployment trenches to A and C. Painted once into the existing atlas. */
export function undertowTracks(width: number): { x: number; z: number }[][] {
  const west = [{ x: 8.6, z: 68 }, { x: 8.6, z: 31 }, { x: 16, z: 19 }, { x: 27, z: 15 }];
  const mirror = (route: readonly { x: number; z: number }[]) => route.map(p => ({ x: width - p.x, z: p.z }));
  return [...UNDERTOW_B_APPROACHES.west, ...UNDERTOW_B_APPROACHES.east, west, mirror(west)].map(r => [...r]);
}

/** Darker, browner trodden mud with twin ruts; opaque atlas paint only. */
export function paintUndertowTracks(ctx: CanvasRenderingContext2D, width: number): void {
  ctx.save(); ctx.lineCap = ctx.lineJoin = 'round';
  for (const [lineWidth, style] of [[3.2, 'rgba(38,30,20,0.26)'], [1.1, 'rgba(30,24,16,0.3)']] as const) {
    ctx.lineWidth = lineWidth; ctx.strokeStyle = style;
    for (const route of undertowTracks(width)) {
      ctx.beginPath(); route.forEach((p, i) => i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z)); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Original water stains around stationary machinery. This mask is composed once
 * during map preparation; moving gallery doors never leave a baked wet footprint. */
export function paintUndertowWetness(canvas: HTMLCanvasElement, map: MapDef): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.scale(canvas.width / map.bounds.width, canvas.height / map.bounds.depth);
  let seed = 76021;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const patch = (x: number, z: number, rx: number, rz: number) => {
    ctx.save(); ctx.translate(x, z); ctx.scale(rx, rz);
    const gradient = ctx.createRadialGradient(0, 0, 0.12, 0, 0, 1);
    gradient.addColorStop(0, '#eee'); gradient.addColorStop(0.6, '#d8d8d8');
    gradient.addColorStop(0.82, '#b0b0b0'); gradient.addColorStop(1, '#0000');
    ctx.fillStyle = gradient; ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const angle = i * Math.PI / 10, radius = 0.76 + random() * 0.24;
      const px = Math.cos(angle) * radius, py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  };
  for (const box of map.boxes) {
    if (box.min.y !== 0 || box.max.y < 2 || map.signalCore?.doors.includes(box)) continue;
    const x = (box.min.x + box.max.x) / 2;
    // Wet aprons sit beneath plant faces; open lane centres remain mainly dry.
    for (const side of [-1, 1]) {
      const z = (side < 0 ? box.min.z : box.max.z) + side * 0.8;
      patch(x + (random() - 0.5) * 2, z, Math.min(4.5, (box.max.x - box.min.x) * 0.55 + 1), 1.5 + random());
    }
  }
  // Standing water in the trodden ruts, every few metres along each route.
  for (const route of undertowTracks(map.bounds.width)) for (let i = 1; i < route.length; i++) {
    const from = route[i - 1]!, to = route[i]!, length = Math.hypot(to.x - from.x, to.z - from.z);
    for (let t = 2 + random() * 3; t < length; t += 5 + random() * 6)
      patch(from.x + (to.x - from.x) * t / length, from.z + (to.z - from.z) * t / length, .9 + random() * .9, .5 + random() * .4);
  }
  // Leaking north basin and south maintenance service, in metres on this map.
  for (let x = 9; x < map.bounds.width - 5; x += 13) {
    patch(x, 12 + random() * 3, 3.1, 1.7);
    patch(x + 4, map.bounds.depth - 14 + random() * 3, 3.8, 1.5);
  }
  ctx.restore();
}

