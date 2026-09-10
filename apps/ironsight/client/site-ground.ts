import * as T from 'three';
import { terrainGeometry, exteriorApronGeometry } from './terrain-geometry.js';
import type { MapDef } from '../src/map/types.js';
import { buildRelayApronGeometry } from './relay-apron.js';
import { finishRelaySurface, relayGroundTexture, updateRelayGroundTexture } from './relay-surfaces.js';
import { paintUndertowWetness } from './undertow-wetness.js';
import { finishUndertowSurface, undertowGroundTexture, updateUndertowGroundTexture } from './undertow-surfaces.js';
import { finishSwitchyardSurface } from './switchyard-surfaces.js';
import { paintSwitchyardServiceWear } from './switchyard-service-wear.js';

const groundLoads = new WeakMap<T.Scene, Promise<void>>();
export function waitForSiteGround(scene: T.Scene): Promise<void> {
  return groundLoads.get(scene) ?? Promise.resolve();
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
  if (metric && !switchyard) {
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
  if (map.presentation === 'relay') {
    // Retired freight traffic: paired broad tire wear, patched concrete and
    // maintenance clearances. Painted into this EXISTING opaque ground atlas.
    ctx.save(); ctx.scale(sx, sz);
    ctx.save(); ctx.scale(map.bounds.width / 60, map.bounds.depth / 40);
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
    ctx.restore();
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
    // Aggregate is supplied by the metric tile, not stretched atlas noise.
    ctx.restore();
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
    paintUndertowWetness(wetness, map);
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
    const tint = new T.Color(undertow ? '#74766a' : relay ? '#817e70' : '#6e7168'), base = new T.Color(undertow ? '#606060' : '#898989').r;
    floor.material.color.copy(tint).multiplyScalar(1 / base);
    if (switchyard) finishSwitchyardSurface(floor.material, 'ground');
    else if (undertow) finishUndertowSurface(floor.material, 'ground');
    else finishRelaySurface(floor.material, 'ground');
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
