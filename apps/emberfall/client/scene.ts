/**
 * Three.js scene rig: quarter-view camera, lighting, fog, and ground plane
 * (PLAN-EMBERFALL.md §1/§6.1). Owns its own `<canvas>` (created and appended
 * here) so callers don't need to coordinate DOM ids with the page markup.
 */
import * as THREE from "three";

export interface SceneRig {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  ground: THREE.Mesh;
  /** World point the camera rig follows — set this to the local unit's position each frame. */
  target: THREE.Vector3;
  /** Recomputes camera position/orientation from `target` + the current zoom step. Call once per frame. */
  updateCamera(): void;
  /** Enters a cinematic orbit (H1 live-world landing): the camera ignores `target`/zoom/drag
   *  and instead slowly auto-orbits `focus` at a fixed `radius`/`pitch`, advancing yaw by
   *  `yawSpeed` (rad/s) every `updateCamera()`. Used behind the start screen before the
   *  player connects; `clearCinematic()` restores the normal follow camera. */
  setCinematic(focus: THREE.Vector3, opts: { radius: number; pitch: number; yawSpeed: number }): void;
  /** Leaves cinematic orbit, returning to the `target`-following quarter-view camera. */
  clearCinematic(): void;
  /** Current orbit yaw (radians, around Y) the camera is looking from — read by the minimap
   *  so it can rotate the map to keep the camera's forward direction pointing "up". */
  getYaw(): number;
  /** Registers a per-frame callback (dt in seconds, timed off `updateCamera()` calls —
   *  main.ts's frame loop calls it unconditionally every frame) and returns an
   *  unregister function. Lets systems like `ambient.ts` tick without main.ts needing a
   *  dedicated per-system call in its frame loop. */
  onUpdate(cb: (dt: number) => void): () => void;
  dispose(): void;
}

const INITIAL_PITCH = THREE.MathUtils.degToRad(50);
const MIN_PITCH = THREE.MathUtils.degToRad(25);
const MAX_PITCH = THREE.MathUtils.degToRad(75);
/** Right-drag orbit sensitivity (radians per pixel dragged). */
const YAW_SENSITIVITY = 0.005;
const PITCH_SENSITIVITY = 0.004;
const ZOOM_STEPS = [10.5, 16.5, 22.5] as const;
const DEFAULT_ZOOM_INDEX = 1;
const GROUND_SIZE = 240;
/** Sun offset from the camera target, held constant as the target moves (see `updateCamera`). */
const SUN_OFFSET = new THREE.Vector3(-12, 18, 10);
/** Bright midday sky — shared by the background, fog, and hemisphere sky tone. */
const SKY_COLOR = 0xbfe3ff;
/** Default (emberhold) ground tint applied via `material.color`. The texture itself is a
 *  neutral white base so `ambient.ts` can retint the ground per zone (ashen/brown) without
 *  the green fighting the tint — a green-baked map could only ever be darkened, not
 *  desaturated. White base * this green reproduces the original grass look exactly. */
const GROUND_BASE_COLOR = "#6a8f5a";

export function createScene(container: HTMLElement = document.body): SceneRig {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOR);
  // Pushed well past the zoomed-out camera distance (max 22.5) so it reads as
  // open-air haze at the horizon, not a nearby fog wall.
  scene.fog = new THREE.Fog(SKY_COLOR, 45, 120);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ACES filmic rolloff reads noticeably better on the stylized-lowpoly models than the
  // flat clamp NoToneMapping does; exposure bumped slightly above 1 so the change stays at
  // least as bright as before (there was prior "too dark" feedback on this game).
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Bright stylized-lowpoly midday look: sky-blue hemisphere fill + warm tan
  // ground bounce, strong warm-white sun. Replaces the earlier dusk-dark rig.
  scene.add(new THREE.HemisphereLight(SKY_COLOR, 0x8a7a55, 1.15));

  const sun = new THREE.DirectionalLight(0xffe9c2, 1.8);
  sun.position.set(SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -35;
  sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);

  const ground = createGround();
  scene.add(ground);

  let zoomIndex: number = DEFAULT_ZOOM_INDEX;
  const target = new THREE.Vector3(0, 0, 0);

  // Per-frame callback registry driving zone-ambient VFX (client/ambient.ts) off
  // `updateCamera()` — the one call every render frame already makes unconditionally —
  // instead of main.ts's frame loop needing its own dedicated tick call.
  const updateCallbacks = new Set<(dt: number) => void>();
  let lastUpdateMs = performance.now();

  function onUpdate(cb: (dt: number) => void): () => void {
    updateCallbacks.add(cb);
    return () => updateCallbacks.delete(cb);
  }

  // Right-drag orbit state (yaw = look direction around Y, pitch = tilt above ground).
  // yaw=0/pitch=INITIAL_PITCH reproduces the original fixed +Z/+Y camera offset exactly.
  let yaw = 0;
  let pitch = INITIAL_PITCH;

  // H1 cinematic-orbit state: when non-null, `updateCamera` orbits `focus` at a fixed
  // radius/pitch and auto-advances `yaw` by `yawSpeed`, ignoring the follow target/zoom/drag.
  let cinematic: { focus: THREE.Vector3; radius: number; pitch: number; yawSpeed: number; yaw: number } | null = null;

  function setCinematic(focus: THREE.Vector3, opts: { radius: number; pitch: number; yawSpeed: number }): void {
    cinematic = { focus: focus.clone(), radius: opts.radius, pitch: opts.pitch, yawSpeed: opts.yawSpeed, yaw: 0 };
  }

  function clearCinematic(): void {
    cinematic = null;
  }

  function updateCamera(): void {
    const nowMs = performance.now();
    // Capped like main.ts's own frame dt: guards against a huge first delta (scene is
    // created well before the frame loop starts — start-screen, asset load, etc. run in between).
    const dt = Math.min((nowMs - lastUpdateMs) / 1000, 0.1);
    lastUpdateMs = nowMs;
    for (const cb of updateCallbacks) cb(dt);

    // The cinematic orbit overrides the follow target, zoom, and drag yaw/pitch entirely.
    let focus = target;
    let effYaw = yaw;
    let effPitch = pitch;
    let distance: number = ZOOM_STEPS[zoomIndex]!;
    if (cinematic) {
      cinematic.yaw += dt * cinematic.yawSpeed;
      focus = cinematic.focus;
      effYaw = cinematic.yaw;
      effPitch = cinematic.pitch;
      distance = cinematic.radius;
    }

    const horizontal = Math.cos(effPitch) * distance;
    const height = Math.sin(effPitch) * distance;
    camera.position.set(
      focus.x + Math.sin(effYaw) * horizontal,
      focus.y + height,
      focus.z + Math.cos(effYaw) * horizontal,
    );
    camera.lookAt(focus);
    // Recenter the sun (and its shadow frustum, which is anchored at the light's own
    // position) on the moving focus instead of the world origin — the field zones are
    // 200x200, and a static light would either clip the focus past its shadow camera's
    // far plane or force a frustum wide enough to blur the 2048 shadow map into mush.
    sun.position.set(focus.x + SUN_OFFSET.x, SUN_OFFSET.y, focus.z + SUN_OFFSET.z);
    sun.target.position.copy(focus);
  }
  updateCamera();

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    zoomIndex = THREE.MathUtils.clamp(zoomIndex + (e.deltaY > 0 ? 1 : -1), 0, ZOOM_STEPS.length - 1);
    updateCamera();
  }
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // Right-mouse-button drag orbits the camera: horizontal drag rotates yaw around the
  // target, vertical drag tilts pitch (clamped so the camera never flips under/over the
  // ground). Left-click is untouched — input.ts's InputController only handles button 0.
  let dragging = false;
  let lastDragX = 0;
  let lastDragY = 0;

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 2) return;
    dragging = true;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    const dx = e.clientX - lastDragX;
    const dy = e.clientY - lastDragY;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    yaw -= dx * YAW_SENSITIVITY;
    pitch = THREE.MathUtils.clamp(pitch - dy * PITCH_SENSITIVITY, MIN_PITCH, MAX_PITCH);
    updateCamera();
  }

  function onPointerUp(e: PointerEvent): void {
    if (e.button !== 2) return;
    dragging = false;
  }

  function onContextMenu(e: MouseEvent): void {
    e.preventDefault();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("contextmenu", onContextMenu);

  function resize(): void {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }
  resize();
  window.addEventListener("resize", resize);

  function dispose(): void {
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("resize", resize);
    renderer.dispose();
    container.removeChild(canvas);
  }

  function getYaw(): number {
    return yaw;
  }

  return { scene, camera, renderer, canvas, ground, target, updateCamera, setCinematic, clearCinematic, getYaw, onUpdate, dispose };
}

/**
 * Flat ground plane with a procedurally-generated low-contrast texture: a
 * bright, muted-grass base fill plus a sparse crosshair grid a shade darker.
 * A fine, high-contrast tiled texture shimmers under camera motion — see
 * apps/gateway's 2D `shooter-client.ts` `drawGround` for the same lesson
 * learned there; low contrast (not just mipmapping) is what actually kills
 * the shimmer, so the grid stays faint even though the base got brighter.
 */
function createGround(): THREE.Mesh {
  const texture = createGroundTexture();
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(GROUND_SIZE / 8, GROUND_SIZE / 8);
  texture.anisotropy = 4;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: new THREE.Color(GROUND_BASE_COLOR),
    roughness: 0.95,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

function createGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  // Neutral white base — the grass hue comes from the material's `color` tint (see
  // GROUND_BASE_COLOR), so the zone tint in ambient.ts can recolor the ground freely.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(40,58,34,0.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
