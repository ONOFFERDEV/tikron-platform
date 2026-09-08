import * as T from 'three';
import type { MapDef } from '../src/map/types.js';
import { buildRelayApronGeometry } from './relay-apron.js';

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
  if (map.presentation === 'relay') {
    // Broad pour-to-pour aging gives the existing atlas a second scale of wear.
    // Deterministic, restrained contrast keeps the lane paint readable.
    for (let z = 0; z < map.bounds.depth; z += 5) for (let x = 0; x < map.bounds.width; x += 6) {
      ctx.fillStyle = `rgba(43,57,49,${0.015 + random() * 0.055})`;
      ctx.fillRect(x * sx, z * sz, 6 * sx, 5 * sz);
    }
  }
  // Broad stained slabs, not a high-frequency grid that shimmers at eye level.
  ctx.strokeStyle = wet ? '#516e6e' : '#7b867d'; ctx.lineWidth = 0.6;
  for (let x = 0; x <= map.bounds.width; x += 6) { ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, 512); ctx.stroke(); }
  for (let z = 0; z <= map.bounds.depth; z += 5) { ctx.beginPath(); ctx.moveTo(0, z * sz); ctx.lineTo(512, z * sz); ctx.stroke(); }
  if (map.presentation === 'relay') {
    // Retired freight traffic: paired broad tire wear, patched concrete and
    // maintenance clearances. Painted into this EXISTING opaque ground atlas.
    ctx.save(); ctx.scale(sx, sz);
    for (const z of [11.3, 28.4]) for (const offset of [-0.55, 0.55]) {
      ctx.strokeStyle = 'rgba(43,55,49,0.15)'; ctx.lineWidth = 0.22;
      ctx.beginPath(); ctx.moveTo(4, z + offset);
      ctx.bezierCurveTo(19, z + offset, 20, z - 0.65 + offset, 30, z - 0.65 + offset);
      ctx.bezierCurveTo(40, z - 0.65 + offset, 42, z + offset, 56, z + offset); ctx.stroke();
    }
    for (const [x, z, w, d] of [[10, 18, 2.4, 1.7], [45, 21, 3.2, 1.5], [32, 10, 1.6, 1.1]] as const) {
      ctx.fillStyle = '#7d8981'; ctx.fillRect(x, z, w, d);
      ctx.strokeStyle = '#6f7d74'; ctx.lineWidth = 0.055; ctx.strokeRect(x, z, w, d);
    }
    for (const b of map.boxes) {
      const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
      if (h !== 6 || w < 18) continue;
      for (const side of [-1, 1]) {
        const faceZ = side < 0 ? b.min.z : b.max.z;
        const edgeZ = faceZ + side * 1.15;
        ctx.strokeStyle = '#999c81'; ctx.lineWidth = 0.11;
        ctx.setLineDash([0.65, 0.25]);
        ctx.beginPath(); ctx.moveTo(b.min.x + 0.3, faceZ);
        ctx.lineTo(b.min.x + 0.3, edgeZ); ctx.lineTo(b.max.x - 0.3, edgeZ);
        ctx.lineTo(b.max.x - 0.3, faceZ); ctx.stroke(); ctx.setLineDash([]);
        // A flush drain below the louver explains the localized dark runoff.
        const drainX = (b.min.x + b.max.x) / 2 + side * 1.6;
        const drainZ = faceZ + side * 0.38;
        ctx.fillStyle = '#596c68'; ctx.fillRect(drainX - 0.75, drainZ - 0.12, 1.5, 0.24);
        ctx.strokeStyle = '#89978b'; ctx.lineWidth = 0.055;
        for (let x = drainX - 0.65; x < drainX + 0.7; x += 0.2) {
          ctx.beginPath(); ctx.moveTo(x, drainZ - 0.08); ctx.lineTo(x, drainZ + 0.08); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(39,58,49,0.11)'; ctx.beginPath();
        ctx.ellipse(drainX, drainZ, 1.1, 0.5, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Worn paint gaps and low-frequency aggregate; never a flickering overlay.
    ctx.restore();
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = `rgba(128,142,127,${0.08 + random() * 0.14})`;
      ctx.fillRect(random() * 512, random() * 512, 1 + random() * 2, 0.5 + random());
    }
  }
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
  // Blender-baked ground AO (tools/bake-ground-ao.py, same row-0 = north layout)
  // multiplied in once it arrives; the atlas above stands alone until then.
  if (map.presentation) {
    const ao = new Image();
    ao.onload = () => { ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(ao, 0, 0, 512, 512); texture.needsUpdate = true; };
    ao.src = `/assets/maps/${map.presentation}-ground-ao.png`;
  }
  // CanvasTexture's default flipY puts its top row at plane V=1; after the
  // -90 degree floor rotation that is z=0 (north), matching the map footprints.
  const floor = new T.Mesh(new T.PlaneGeometry(map.bounds.width, map.bounds.depth),
    new T.MeshStandardMaterial({ map: texture, roughness: wet ? 0.76 : 0.96 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(map.bounds.width / 2, -0.012, map.bounds.depth / 2); floor.receiveShadow = true;
  floor.userData.siteGround = true;
  if (map.presentation === 'relay') floor.name = 'relay-ground';
  scene.add(floor);
  const relay = map.presentation === 'relay';
  const apron = new T.Mesh(relay ? buildRelayApronGeometry(map.bounds) : new T.PlaneGeometry(map.bounds.width + 120, map.bounds.depth + 120),
    new T.MeshStandardMaterial({ color: relay ? 0xffffff : wet ? 0x52686c : 0x818b88, vertexColors: relay, roughness: 0.98 }));
  if (!relay) { apron.rotation.x = -Math.PI / 2; apron.position.set(map.bounds.width / 2, -0.03, map.bounds.depth / 2); }
  apron.userData.siteGround = true;
  apron.name = `${map.presentation ?? 'site'}-apron`;
  apron.receiveShadow = true; scene.add(apron);
}
