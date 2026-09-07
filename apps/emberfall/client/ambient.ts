/**
 * Zone-ambient VFX (SCENARIO-EMBERFALL §9 E6/E7 + POLISH §H H3): falling ash in Ashen
 * Fields, rising embers + flickering brazier light in Ember Depths, and slow-drifting
 * low-poly clouds in the open-sky zones (Emberhold + Ashen Fields). Ember Depths is a
 * cave — no clouds underground.
 *
 * `setZoneAmbient` is the sole export. It tears down whatever ambient system is
 * currently active (idempotent — safe to call every time, including repeat calls for
 * the same zone) before building the one for `zoneId`, so zone switches never leak
 * particle systems or lights.
 *
 * Per-frame ticking rides `rig.onUpdate` (scene.ts's callback hook off `updateCamera()`)
 * instead of a dedicated call in main.ts's frame loop, keeping main.ts's edit to just the
 * two `setZoneAmbient(...)` call sites the task requires.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { SceneRig } from "./scene.js";
import type { SavedZone } from "../src/types.js";
import { EMBER_DEPTHS } from "../src/zones/ember-depths.js";
import { EMBERHOLD } from "../src/zones/emberhold.js";
import { ASHEN_FIELDS } from "../src/zones/ashen-fields.js";

const ASH_COUNT = 60;
const EMBER_COUNT = 30;

/** Per-zone ground `material.color` tint (scene.ts leaves the ground texture neutral so this
 *  fully recolors it): emberhold keeps the grass green, the fields go ashen gray-green, the
 *  depths go dark ember-brown. Applied in-place on every `setZoneAmbient` (zone switches are
 *  sequential, so mutating the shared ground material is safe) — so returning to the village
 *  restores the green. */
const GROUND_TINTS: Readonly<Record<SavedZone, number>> = {
  emberhold: 0x6a8f5a,
  "ashen-fields": 0x8a8d7f,
  "ember-depths": 0x4a3f38,
};

/** Soft round particle sprite (radial white glow -> transparent edge) shared by ash and
 *  embers, so `THREE.Points` renders soft discs instead of hard squares (the PointsMaterial
 *  default). Built lazily and once; the material's own `color` tints it per field. Mirrors
 *  vfx.ts's `createGlowTexture` shape (no shared import — that file is out of this boundary). */
let softCircleTexture: THREE.Texture | null = null;
function getSoftCircleTexture(): THREE.Texture {
  if (softCircleTexture) return softCircleTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.65)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  softCircleTexture = texture;
  return texture;
}

interface DriftFieldOptions {
  count: number;
  color: number;
  size: number;
  opacity: number;
  /** Half-extents of the recycling volume, centered on the camera target each tick. */
  boxHalf: { x: number; y: number; z: number };
  /** World-space Y the volume is centered at (so the box sits above the ground plane). */
  centerY: number;
  /** Units/sec along Y — negative falls (ash), positive rises (embers). */
  vertical: number;
  /** Amplitude of the sin/cos horizontal wobble, in units/sec. */
  driftAmp: number;
  blending?: THREE.Blending;
}

/** A single `THREE.Points` cloud that drifts vertically and wobbles horizontally inside
 *  a box recycled around the camera target — the shared shape behind both E6 (falling
 *  ash) and E7 (rising embers). Buffers are allocated once at creation and mutated in
 *  place every tick — no per-frame allocation. */
function createDriftField(
  rig: SceneRig,
  opts: DriftFieldOptions,
): { tick: (dt: number) => void; dispose: () => void } {
  const { count, boxHalf, centerY, vertical, driftAmp } = opts;
  const positions = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    positions[ix] = (Math.random() * 2 - 1) * boxHalf.x;
    positions[ix + 1] = (Math.random() * 2 - 1) * boxHalf.y;
    positions[ix + 2] = (Math.random() * 2 - 1) * boxHalf.z;
    phase[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute("position", posAttr);
  const material = new THREE.PointsMaterial({
    color: opts.color,
    map: getSoftCircleTexture(),
    size: opts.size,
    sizeAttenuation: true,
    transparent: true,
    opacity: opts.opacity,
    depthWrite: false,
    blending: opts.blending ?? THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  rig.scene.add(points);

  let time = 0;
  function tick(dt: number): void {
    time += dt;
    points.position.set(rig.target.x, centerY, rig.target.z);

    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      arr[ix + 1]! += vertical * dt;
      arr[ix]! += Math.sin(time * 0.6 + phase[i]!) * driftAmp * dt;
      arr[ix + 2]! += Math.cos(time * 0.5 + phase[i]!) * driftAmp * dt;

      if (vertical < 0 && arr[ix + 1]! < -boxHalf.y) {
        arr[ix + 1] = boxHalf.y;
        arr[ix] = (Math.random() * 2 - 1) * boxHalf.x;
        arr[ix + 2] = (Math.random() * 2 - 1) * boxHalf.z;
      } else if (vertical > 0 && arr[ix + 1]! > boxHalf.y) {
        arr[ix + 1] = -boxHalf.y;
        arr[ix] = (Math.random() * 2 - 1) * boxHalf.x;
        arr[ix + 2] = (Math.random() * 2 - 1) * boxHalf.z;
      }
      // Wrap horizontal drift too, so particles never wobble out of the volume.
      if (arr[ix]! > boxHalf.x) arr[ix]! -= boxHalf.x * 2;
      else if (arr[ix]! < -boxHalf.x) arr[ix]! += boxHalf.x * 2;
      if (arr[ix + 2]! > boxHalf.z) arr[ix + 2]! -= boxHalf.z * 2;
      else if (arr[ix + 2]! < -boxHalf.z) arr[ix + 2]! += boxHalf.z * 2;
    }
    posAttr.needsUpdate = true;
  }

  function dispose(): void {
    rig.scene.remove(points);
    geometry.dispose();
    material.dispose();
  }

  return { tick, dispose };
}

/** E6 — Ashen Fields: ~60 low-density gray ash particles, slow fall + slight drift,
 *  recycling in a volume around the camera ("눈 내리듯" — SCENARIO §9). */
function createAshFall(rig: SceneRig): () => void {
  const field = createDriftField(rig, {
    count: ASH_COUNT,
    color: 0xb8b6ae,
    size: 0.5,
    opacity: 0.85,
    boxHalf: { x: 22, y: 9, z: 22 },
    centerY: 10,
    vertical: -1.1,
    driftAmp: 0.35,
  });
  const unregister = rig.onUpdate(field.tick);
  return () => {
    unregister();
    field.dispose();
  };
}

/** E7 — Ember Depths: ~30 rising orange embers plus a warm flickering point light at
 *  each brazier obstacle (coordinates sourced from `ember-depths.ts`'s own `obstacles`,
 *  so a layout change there never needs a matching edit here). Flicker = two sine terms
 *  of different frequency/phase per light (cheap sin+noise stand-in — SCENARIO §9). */
function createEmberDepthsAmbient(rig: SceneRig): () => void {
  const embers = createDriftField(rig, {
    count: EMBER_COUNT,
    color: 0xff8a3d,
    size: 0.45,
    opacity: 0.95,
    boxHalf: { x: 16, y: 7, z: 16 },
    centerY: 7,
    vertical: 1.0,
    driftAmp: 0.3,
    blending: THREE.AdditiveBlending,
  });
  const unregisterEmbers = rig.onUpdate(embers.tick);

  const brazierPositions = EMBER_DEPTHS.obstacles
    .filter((o) => o.prop === "prop.brazier")
    .map((o) => new THREE.Vector3(o.x, 1.6, o.y));
  const lights = brazierPositions.map((pos) => {
    const light = new THREE.PointLight(0xff7a2e, 1.4, 22, 2);
    light.position.copy(pos);
    rig.scene.add(light);
    return light;
  });
  const lightPhase = lights.map(() => Math.random() * Math.PI * 2);

  let time = 0;
  function flicker(dt: number): void {
    time += dt;
    for (let i = 0; i < lights.length; i++) {
      const wobble = Math.sin(time * 6 + lightPhase[i]!) * 0.25 + Math.sin(time * 13.7 + lightPhase[i]! * 1.7) * 0.15;
      lights[i]!.intensity = 1.4 + wobble;
    }
  }
  const unregisterFlicker = rig.onUpdate(flicker);

  return () => {
    unregisterEmbers();
    unregisterFlicker();
    embers.dispose();
    for (const light of lights) rig.scene.remove(light);
  };
}

// ── H3: low-poly drifting clouds ──────────────────────────────────────────────────

interface CloudFieldOptions {
  count: number;
  color: number;
  /** [min, max] world Y the clouds hang at (quarter-view looks down, so these read on the
   *  horizon in play and fill the sky for the low-pitch landing orbit camera). */
  yRange: [number, number];
  /** World-space scatter extent — clouds spread across x∈[0,width], z∈[0,depth], matching a
   *  zone's `[0,width]×[0,height]` layout (server (x,y) → world (x,0,y)). */
  width: number;
  depth: number;
  /** Fixed PRNG seed so a zone's sky is identical every session (no `Math.random` reshuffle). */
  seed: number;
}

const EMBERHOLD_CLOUDS: CloudFieldOptions = {
  count: 5,
  color: 0xe8e6e2,
  yRange: [18, 26],
  width: EMBERHOLD.width,
  depth: EMBERHOLD.height,
  seed: 0x5eed01,
};
const ASHEN_CLOUDS: CloudFieldOptions = {
  count: 6,
  color: 0x9b9894,
  yRange: [15, 22],
  width: ASHEN_FIELDS.width,
  depth: ASHEN_FIELDS.height,
  seed: 0x5eed02,
};

/** How far past the zone edge a cloud drifts before wrapping back to the far side. */
const CLOUD_WRAP_MARGIN = 24;

/** Tiny deterministic PRNG (LCG, Numerical Recipes constants) so cloud layout is fixed
 *  per zone — `Math.random` would reshuffle the sky on every reload. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** One low-poly cloud: 3–5 vertically-squashed icosahedron blobs (detail 0 = 20 tris each)
 *  clustered horizontally and merged into a single faceted mesh geometry (≤100 tris),
 *  centered on its own origin so the owning mesh's `position` places and drifts it. */
function buildCloudGeometry(rng: () => number): THREE.BufferGeometry {
  const blobCount = 3 + Math.floor(rng() * 3); // 3..5
  const blobs: THREE.BufferGeometry[] = [];
  for (let b = 0; b < blobCount; b++) {
    const radius = 2.4 + rng() * 1.6; // 2.4..4.0
    const g = new THREE.IcosahedronGeometry(radius, 0);
    // Squash Y + spread XZ so blobs read as a puffy cloud, not a ball.
    g.scale(1.15, 0.62, 0.9);
    g.translate((rng() * 2 - 1) * 3.8, (rng() * 2 - 1) * 0.7, (rng() * 2 - 1) * 2.4);
    blobs.push(g);
  }
  const merged = mergeGeometries(blobs, false);
  for (const g of blobs) g.dispose();
  return merged;
}

/** A field of slow-drifting low-poly clouds scattered across the zone at a fixed (seeded)
 *  layout. Each cloud rides +x at its own 0.3–0.6 u/s pace and wraps to the far side at the
 *  zone edge + margin (no rotation). Shadow casting is OFF — a cloud shadow would smear the
 *  whole ground. Geometry is per-cloud (unique blob layout); one shared flat material per
 *  field. Returns a teardown that unregisters the tick and disposes GPU resources. */
function createCloudField(rig: SceneRig, opts: CloudFieldOptions): () => void {
  const rng = makeRng(opts.seed);
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: opts.color,
    // Faint self-illum keeps undersides visible from the low landing-orbit camera.
    emissive: new THREE.Color(opts.color).multiplyScalar(0.18),
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });

  const clouds: { mesh: THREE.Mesh; speed: number }[] = [];
  for (let i = 0; i < opts.count; i++) {
    const mesh = new THREE.Mesh(buildCloudGeometry(rng), material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.scale.setScalar(0.85 + rng() * 0.9); // 0.85..1.75
    mesh.position.set(
      rng() * opts.width,
      opts.yRange[0] + rng() * (opts.yRange[1] - opts.yRange[0]),
      rng() * opts.depth,
    );
    group.add(mesh);
    clouds.push({ mesh, speed: 0.3 + rng() * 0.3 }); // 0.3..0.6 u/s
  }
  rig.scene.add(group);

  const wrapHigh = opts.width + CLOUD_WRAP_MARGIN;
  const unregister = rig.onUpdate((dt) => {
    for (const c of clouds) {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > wrapHigh) c.mesh.position.x = -CLOUD_WRAP_MARGIN;
    }
  });

  return () => {
    unregister();
    rig.scene.remove(group);
    for (const c of clouds) c.mesh.geometry.dispose();
    material.dispose();
  };
}

/** Background/fog color per zone (SCENARIO-EMBERFALL §9): pale ash haze in the fields,
 *  a warm clear hub at Emberhold, dark warm cave gloom in the depths. Fog color always
 *  matches the background (same convention scene.ts's own default sky/fog use) so the
 *  far clip blends into the horizon instead of showing a seam. */
function zoneAtmosphere(zoneId: SavedZone): { background: number; fog: THREE.Fog | null } {
  if (zoneId === "ashen-fields") {
    // Near/far kept close to scene.ts's own default (45/120) so the tint reads as haze,
    // not a wall — most of the screen must stay clear of fog.
    return { background: 0xa8a5a0, fog: new THREE.Fog(0xa8a5a0, 40, 110) };
  }
  if (zoneId === "ember-depths") {
    // Near sits past the camera's own distance from its target (max zoom step 22.5) so
    // the player and nearby units read clearly; far closes in well short of the field
    // edge for cave claustrophobia.
    return { background: 0x1a0f0a, fog: new THREE.Fog(0x1a0f0a, 20, 65) };
  }
  // emberhold: warm, clear hub — no fog.
  return { background: 0xffdfae, fog: null };
}

let activeTeardown: (() => void) | null = null;

/** Switches the active zone-ambient VFX system to match `zoneId`. Always tears down
 *  whatever was running first (idempotent — safe on every zone-load/transfer, even
 *  repeat calls for the same zone), so nothing leaks across zone switches. Also resets
 *  the scene's background/fog to the zone's atmosphere every call, so a previous zone's
 *  fog/background never lingers after switching (or re-switching to the same zone). */
export function setZoneAmbient(rig: SceneRig, zoneId: SavedZone): void {
  const atmosphere = zoneAtmosphere(zoneId);
  rig.scene.background = new THREE.Color(atmosphere.background);
  rig.scene.fog = atmosphere.fog;

  // Retint the (shared) ground material for this zone — in-place is safe since zone loads
  // are sequential, and this runs on every load so a village return restores the green.
  (rig.ground.material as THREE.MeshStandardMaterial).color.setHex(GROUND_TINTS[zoneId]);

  activeTeardown?.();
  const teardowns: Array<() => void> = [];
  if (zoneId === "ashen-fields") {
    teardowns.push(createAshFall(rig));
    teardowns.push(createCloudField(rig, ASHEN_CLOUDS)); // ash haze + heavy gray clouds
  } else if (zoneId === "ember-depths") {
    teardowns.push(createEmberDepthsAmbient(rig)); // cave — no clouds
  } else {
    // emberhold: bright drifting clouds only (H3) — the hub's live sky for the landing scene.
    teardowns.push(createCloudField(rig, EMBERHOLD_CLOUDS));
  }
  activeTeardown = teardowns.length ? () => teardowns.forEach((t) => t()) : null;
}
