import * as T from 'three';
import type { MapDef } from '../src/map/types.js';

/** Original baked contact/dirt atlas. Opaque ground: no AO pass, blended floor
 * decal or per-frame work. MapDef footprints keep grime attached to real cover. */
export function buildSiteGround(scene: T.Scene, map: MapDef, wet = false): void {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = wet ? '#607a7b' : '#89928a'; ctx.fillRect(0, 0, 512, 512);
  let seed = 71;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 16000; i++) {
    ctx.fillStyle = `rgba(22,35,32,${random() * 0.08})`;
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 2, 1 + random() * 2);
  }
  const sx = 512 / map.bounds.width, sz = 512 / map.bounds.depth;
  // Broad stained slabs, not a high-frequency grid that shimmers at eye level.
  ctx.strokeStyle = wet ? '#516e6e' : '#7b867d'; ctx.lineWidth = 0.6;
  for (let x = 0; x <= 60; x += 6) { ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, 512); ctx.stroke(); }
  for (let z = 0; z <= 40; z += 5) { ctx.beginPath(); ctx.moveTo(0, z * sz); ctx.lineTo(512, z * sz); ctx.stroke(); }
  for (const box of map.boxes) {
    const x = box.min.x * sx, z = box.min.z * sz, w = (box.max.x - box.min.x) * sx, d = (box.max.z - box.min.z) * sz;
    // Nested translucent fills are baked into an opaque texture once at load.
    for (let ring = 8; ring >= 1; ring--) {
      ctx.fillStyle = wet ? 'rgba(10,32,32,0.055)' : 'rgba(21,32,27,0.045)';
      ctx.fillRect(x - ring * 0.65, z - ring, w + ring * 1.3, d + ring * 2);
    }
  }
  if (wet) for (let i = 0; i < 28; i++) {
    ctx.fillStyle = 'rgba(23,55,58,0.13)'; ctx.beginPath();
    ctx.ellipse(random() * 512, random() * 512, 5 + random() * 13, 2 + random() * 4, random(), 0, Math.PI * 2); ctx.fill();
  }
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  // CanvasTexture's default flipY puts its top row at plane V=1; after the
  // -90 degree floor rotation that is z=0 (north), matching the map footprints.
  const floor = new T.Mesh(new T.PlaneGeometry(map.bounds.width, map.bounds.depth),
    new T.MeshStandardMaterial({ map: texture, roughness: wet ? 0.76 : 0.96 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(30, -0.012, 20); floor.receiveShadow = true;
  scene.add(floor);
  const apron = new T.Mesh(new T.PlaneGeometry(180, 160), new T.MeshStandardMaterial({ color: wet ? 0x52686c : 0x818b88, roughness: 0.98 }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(30, -0.03, 20); apron.receiveShadow = true; scene.add(apron);
}
