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
  /** Current orbit yaw (radians, around Y) the camera is looking from — read by the minimap
   *  so it can rotate the map to keep the camera's forward direction pointing "up". */
  getYaw(): number;
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
/** Bright midday sky — shared by the background, fog, and hemisphere sky tone. */
const SKY_COLOR = 0xbfe3ff;
/** Muted grass base for the procedural ground texture. */
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

  // Bright stylized-lowpoly midday look: sky-blue hemisphere fill + warm tan
  // ground bounce, strong warm-white sun. Replaces the earlier dusk-dark rig.
  scene.add(new THREE.HemisphereLight(SKY_COLOR, 0x8a7a55, 1.15));

  const sun = new THREE.DirectionalLight(0xffe9c2, 1.8);
  sun.position.set(-12, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0015;
  scene.add(sun);
  scene.add(sun.target);

  const ground = createGround();
  scene.add(ground);

  let zoomIndex: number = DEFAULT_ZOOM_INDEX;
  const target = new THREE.Vector3(0, 0, 0);

  // Right-drag orbit state (yaw = look direction around Y, pitch = tilt above ground).
  // yaw=0/pitch=INITIAL_PITCH reproduces the original fixed +Z/+Y camera offset exactly.
  let yaw = 0;
  let pitch = INITIAL_PITCH;

  function updateCamera(): void {
    const distance = ZOOM_STEPS[zoomIndex]!;
    const horizontal = Math.cos(pitch) * distance;
    const height = Math.sin(pitch) * distance;
    camera.position.set(
      target.x + Math.sin(yaw) * horizontal,
      target.y + height,
      target.z + Math.cos(yaw) * horizontal,
    );
    camera.lookAt(target);
    sun.target.position.copy(target);
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

  return { scene, camera, renderer, canvas, ground, target, updateCamera, getYaw, dispose };
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

  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0 });
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
  ctx.fillStyle = GROUND_BASE_COLOR;
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
