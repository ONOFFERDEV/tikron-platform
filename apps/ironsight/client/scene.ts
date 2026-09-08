import { easeAds } from "../src/handling.js";
import { architectureMeshes } from "./site-architecture.js";
import { loadArchitecture, loadSiteEnvironment } from "./site-lighting.js";
import { buildWedgeGeometry } from "./site-wedge.js";
/**
 * Three.js presentation: the FPS camera, the active map's geometry (passed in as a
 * {@link MapDef} so walls cost zero wire bytes — main.ts resolves which map from the
 * mode, same as the room does), remote-player capsules, the procedural rifle
 * viewmodel with sway/bob/recoil, muzzle flash, and tracers. Pure rendering — it
 * holds no authority; `main.ts` feeds it poses each frame.
 *
 * Coordinate system is the server's directly: x∈[0,60] east, z∈[0,40] north, y up
 * (ground 0). yaw 0 → +z, increasing yaw → +x, so the camera forward is
 * (sin yaw·cos pitch, sin pitch, cos yaw·cos pitch) — identical to the server's
 * `aimDir`, which keeps the crosshair (screen centre) honest with hit registration.
 */
import * as THREE from "three";
import { rifleSight } from './rifle-sight.js';
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { nearestBox, type Box } from "../src/physics.js";
import type { MapDef, RampDef } from "../src/map/types.js";
import { rampOccluderBoxes } from "../src/map/tilemap.js";
import type { FireClaim, HitPart } from "../src/hitscan.js";
import { ARENA, PLAYER, HIT } from "../src/config.js";
import { RemoteWeapon, remoteWeaponTemplate } from "./remote-weapon.js";
import { ViewmodelHands } from "./viewmodel-hands.js";
import { ReloadPresentation, reloadPose, remoteReloadProgress } from "./reload-presentation.js";
import { splitRifleMagazine } from "./rifle-magazine.js";
import { VISUALS } from "../config/visuals.js";
import { Vfx, makeFlashTexture } from "./vfx.js";
import { GAME } from "../src/game-config.js";
import { loadPlayerModel, clonePlayerRig, deathPresentationMs, type PlayerRigModel, type LocomotionState } from "./rig-loader.js";
import { loadWeaponModel, cloneWeaponMesh, cloneWeaponBundleNode, weaponMuzzle } from "./weapon-loader.js";
import { loadMapDressing } from "./dressing-loader.js";
import { buildRelayEnvironment } from "./relay-environment.js";
import { buildUndertowEnvironment } from "./undertow-environment.js";
import { buildSwitchyardEnvironment } from "./switchyard-environment.js";
import { loadSwitchyardTransformers } from "./switchyard-props.js";
import { loadRelayUplinks } from "./relay-props.js";
import arena1Manifest from "./dressing/arena1.manifest.json";
import arena2Manifest from "./dressing/arena2.manifest.json";

const PALETTE = GAME.palette;
const VIS = GAME.weaponVis.presentation ?? VISUALS;
const MOTION = VIS.motion;
const ADS_FOV = GAME.camera.adsFov;
const HIP_FOV = GAME.camera.hipFov;
// Map-dressing manifests (committed JSON, client/dressing/*.manifest.json — see
// generate-manifests.mjs). Only `hiddenBoxIndices` matters at runtime: which of
// this map's src/map/*.ts collision boxes the dressing bundle visually covers,
// so buildArena() can skip their procedural render once the bundle actually
// loads (never before — see the constructor's dressing load).
interface DressingManifest {
  readonly hiddenBoxIndices: readonly number[];
}
const DRESSING_MANIFESTS: Record<string, DressingManifest> = {
  arena1: arena1Manifest,
  arena2: arena2Manifest,
};
// ?debugBoxes=1 — permanent gate tool (not tied to any one dressing pass):
// overlays every collision box's true wireframe on top of whatever's rendered
// (dressing or procedural fallback), normal-depth-tested so a box the visual
// falls short of pokes its wireframe out into open space — a one-screenshot
// visual-vs-collision height check.
const DEBUG_BOXES = new URLSearchParams(location.search).get("debugBoxes") === "1";
// ?debugHitbox=1 — permanent gate tool. Originally visualized the server's
// analytic hit volumes against the rendered model (the hitbox/visual audit);
// since the hybrid-hit fix (raycastHitClaim below), the analytic capsule/
// sphere this draws is no longer what a shot is normally judged against — it's
// the FALLBACK path (an old client, a multi-pellet weapon, or a rejected
// claim), so this overlay now shows what a shot would be judged against if the
// hybrid claim path didn't apply, not the primary hit shape.
const DEBUG_HITBOX = new URLSearchParams(location.search).get("debugHitbox") === "1";
// Shared across every rig's overlay (wireframe has no per-instance state) —
// unit-sized geometry, rescaled per-frame in updateHitboxOverlay() below so
// crouch's height change never needs a geometry rebuild. Cyan is distinct from
// both debugBoxes' magenta and every TEAM_COLOR in this palette.
const HITBOX_MAT = new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.9 });
function buildHitboxOverlay(): { cylinder: THREE.Mesh; head: THREE.Mesh } {
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1), HITBOX_MAT);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), HITBOX_MAT);
  return { cylinder, head };
}
const TEAM_COLOR = GAME.teams.colors;

const EYE_UP = new THREE.Vector3(0, 1, 0);
const FWD_Z = new THREE.Vector3(0, 0, 1);
// Tracer = a short segment travelling from the muzzle to the impact point (not a
// static beam) — see addTracer/updateTracers. Speed is PER-WEAPON now (each
// Tracer instance carries its own `speed`, from WeaponSpec.tracerSpeed — user
// report: "총알 속도가 느린 것 같다," and every weapon sharing one flat 300 m/s
// was exactly why) — no shared module-level constant anymore.
const TRACER_SEG_FRAC = 0.15; // segment length as a fraction of the shot's travel distance
const TRACER_SEG_MAX = 8; // segment length cap (world units) so long shots don't streak forever
const TRACER_FADE_MS = 25; // brief opacity fade in the final stretch before the head arrives
const MUZZLE_LIFE_MS = 55;
const CAP_LEN = PLAYER.standHeight - 2 * PLAYER.radius;
/** Viewmodel recoil kick per weapon (indexed like WEAPONS: AR/SMG/Shotgun/Sniper/Pistol). */
const VM_RECOIL = GAME.weaponVis.recoil;
const NADE_GRAVITY = -22; // matches the server's grenade integrator
const SWAP_DOWN_MS = GAME.weaponVis.swapDownMs;
const SWAP_UP_MS = GAME.weaponVis.swapUpMs; // down+up = the server's 350 ms switch delay
const MUZZLE_Z_DEFAULT = -0.74; // procedural weapons' fixed muzzle depth (buildViewmodel's rest value)

interface WeaponVmTransform {
  /** Uniform scale bringing the model to roughly the same size the procedural
   *  boxes occupied at this same depth. */
  scale: number;
  /** Position within weaponHolder (X/Y stay 0 for every slot; only depth varies). */
  posZ: number;
  /** Local Z of this model's own muzzle tip — this.muzzle/muzzleLight move here
   *  (X/Y stay 0/0.02, matching the procedural convention) while it's held. */
  muzzleZ: number;
  /** Correction around the model's own bore axis (applied as `rotation.z`,
   *  after the shared `rotation.y = Math.PI` flip) — most assets need none;
   *  is-armfix's muzzle-normalization pipeline (+Z-alignment only) can leave a
   *  residual roll on asymmetric silhouettes (see VM_WEAPON_TRANSFORMS's SMG/
   *  Pistol entries), invisible to their 2-point muzzle/stock marker check
   *  since that only fixes the bore AXIS, not rotation around it. */
  roll?: number;
}

/**
 * Empirically-tuned per-weapon-slot scale/position/muzzle-tip offsets — index
 * matches WEAPONS' AR/SMG/Shotgun/Sniper/Pistol order. Applies identically to
 * either weaponVis source (a bundle node or a per-file model — see
 * setWeaponVisual): `scale`/`posZ` are visually tuned per slot, then
 * `muzzleZ` is DERIVED (not guessed) from the relationship this file's own
 * transform pipeline creates — `rotation.y = Math.PI` flips local Z, so a
 * model's own measured local max-Z (the muzzle tip, now confirmed at local
 * +Z for every asset — see the bore-test note below) ends up at world
 * `posZ - localMaxZ * scale`.
 *
 * Synty replacement (current values): re-derived for the new
 * SM_Wep_Rifle_Base_01/SMG_01/Shotgun_Plasma_01/Sniper_01/Pistol_01 meshes,
 * replacing the cyber-trooper set entirely (same 5 slots, different source
 * geometry). `posZ` keeps the same ~0.3-unit-out convention the cyber-trooper pass
 * established. Camera-local rest poses and motion now live in weaponVis.presentation.
 *
 * Bore test (confirms rotation, not just assumed): is-armfix's own per-asset
 * red/blue marker renders (muzzle vs stock ends, from their orientation
 * pipeline) plus in-game front-on captures of all 5 muzzle tips agree that
 * local +Z is the muzzle for every asset, so the existing `rotation.y =
 * Math.PI` flip (this viewmodel's own forward is -Z) needs no change.
 */
const VM_WEAPON_TRANSFORMS: Record<number, WeaponVmTransform> = {
  0: { scale: 0.65, posZ: -0.24, muzzleZ: -0.591 }, // AR — SM_Wep_Rifle_Base_01 (localMaxZ 0.54)
  1: { scale: 0.75, posZ: -0.3, muzzleZ: -0.552 }, // SMG — swapped to SM_Wep_MachinePistol_Gen1_01 (localMaxZ 0.336): the original SM_Wep_SMG_01's open carry-handle silhouette didn't read as a weapon at a glance; is-armfix independently re-measured (not just eyeballed) and found no real roll defect on either candidate, so the swap is purely a readability call. Scale started from this asset's own bounds (closer to Pistol's than to a long gun) rather than reused from the old SMG_01 entry — different mesh, not comparable.
  2: { scale: 0.5, posZ: -0.3, muzzleZ: -0.63 }, // Shotgun — swapped to SM_Wep_Rifle_Laser_01 (localMaxZ 0.661, nearly identical overall length to the old Shotgun_Plasma_01 so scale carried over as a starting point, muzzleZ re-derived fresh from this asset's own measured bounds, not reused) — this asset's own auto-orient pass genuinely had the muzzle backwards (is-armfix manually corrected with --flip_muzzle); re-verified independently in-game before shipping, see is-anim's report. The muzzle flash sprite's fixed (0, 0.02) local X/Y doesn't visibly land on this mesh's bore (its Y bounds aren't centered on 0 like the other 4 weapons) — cosmetic only, confirmed via instrumented timing that the flash itself fires correctly; tracer/casing/rotation all unaffected.
  3: { scale: 0.38, posZ: -0.3, muzzleZ: -0.631 }, // Sniper — SM_Wep_Sniper_01 (localMaxZ 0.87)
  4: { scale: 0.85, posZ: -0.3, muzzleZ: -0.47 }, // Pistol — SM_Wep_Pistol_01 (localMaxZ 0.2); roll: is-armfix re-measured properly (not by eye) and found ~0 on every asset — my -0.2 guess earlier was a false positive, left at 0
};

/**
 * Correction applied to a model rig's yaw so it visually faces the direction
 * `pose.yaw` says it's looking (`pose.yaw = 0` faces world +z — see this
 * file's header). The GLB's own forward axis is whatever the source
 * generation pipeline baked in and isn't knowable from the file alone, so this
 * was checked EMPIRICALLY: a static, single-time-seek render of the "walk"
 * clip at `rotation.y = 0` (no correction), viewed head-on along +z, shows a
 * forward-facing head and natural contralateral arm swing (left arm forward
 * while the right leg steps, and vice versa) — i.e. the raw model ALREADY
 * faces +z with no rotation applied, so no correction is needed here.
 * Re-confirmed 0 after the Plan-B swap to the KayKit-based (Knight.glb +
 * borrowed idle/walk/run/death clips) asset — same check, same result. If a
 * future model swap faces the wrong way, redo that check (a single static
 * `mixer.update(t)` seek viewed from a plain front camera — NOT a side/3-4
 * angle or a translating rig at extreme relative angles; both were found to
 * trigger a severe render artifact on the ORIGINAL UniRig asset, later traced
 * to that asset's own skin/rest-pose data, not the rendering pipeline — see
 * D:\game-assets\generated\unirig-poc\ingame\ for the investigation trail)
 * and adjust this constant in Math.PI/2 increments.
 */
const MODEL_YAW_OFFSET = 0; // radians — see calibration note above

/** Locomotion state thresholds (m/s), picked against MOVE's crouch=3/walk=6/
 *  sprint=9 so ordinary walking always lands in "walk" and only sprint plays
 *  "run"/"sprint". The same idle threshold also gates crouch_idle vs crouch_walk
 *  since crouch itself is capped at MOVE.crouch=3, well under LOCOMOTION_WALK_MAX. */
const LOCOMOTION_IDLE_MAX = 0.5;
const LOCOMOTION_WALK_MAX = 7;

/** Subtle vertical squash for a crouched model rig on GLBs with no crouch clip
 *  (`!model.hasCrouchClips`) — (unlike the capsule path's real height change)
 *  this just compresses the model. Rigs whose GLB has a real crouch_idle/
 *  crouch_walk clip play that instead and skip the squash entirely. */
const MODEL_CROUCH_SQUASH = 0.8;

/** How long a model rig stays visible playing its death clip before hiding, once
 *  the server reports the player dead — capped so a very long/missing clip can't
 *  leave a corpse standing around. */

interface NadeFx {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
}

interface BoomFx {
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  parts: THREE.InstancedMesh;
  positions: THREE.Vector3[];
  vels: THREE.Vector3[];
  partMat: THREE.MeshBasicMaterial;
  born: number;
}
const BOOM_LIFE_MS = 650;

interface PlayerPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  crouch: boolean;
  team: number;
  alive: boolean;
  weapon: number;
  reloadEnd?: number;
}

/** A remote player's rig: either the original capsule+head primitives, or (once
 *  the player GLB is loaded) an animated model clone. `kind` discriminates which
 *  fields below are populated — see {@link SceneRig.makeRig}. */
interface PlayerRig {
  contact?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  weapon?: RemoteWeapon;
  group: THREE.Group;
  team: number;
  kind: "capsule" | "model";
  // --- kind === "capsule" ---
  body?: THREE.Mesh;
  head?: THREE.Mesh;
  // --- kind === "model" ---
  modelRoot?: THREE.Object3D;
  model?: PlayerRigModel;
  /** Uniform scale that normalizes the GLB to PLAYER.standHeight. */
  baseScale?: number;
  /** The model's own local bbox min.y (pre-scale) — needed to re-derive the
   *  feet-at-zero vertical offset whenever the crouch squash changes `scale.y`. */
  localMinY?: number;
  aliveWas?: boolean;
  /** performance.now() deadline until which a just-died model rig stays visible
   *  playing its death clip; undefined when not mid-death-hold. */
  deadHoldUntil?: number;
  prevX?: number;
  prevZ?: number;
  /** Local Y (relative to `group`, i.e. relative to the feet) of the head/eye
   *  anchor point, refreshed each sync — kept uniform across both kinds so
   *  {@link SceneRig.getRemoteMuzzleAnchor} doesn't need to know which one it has. */
  headY?: number;
  /** ?debugHitbox=1 only: wireframes of the server's assumed hit volumes,
   *  repositioned/rescaled every sync alongside `headY` (crouch changes both
   *  the cylinder's height and the head sphere's height identically to how
   *  hitscan.ts derives them from the same feetY/headY pair). */
  hitboxOverlay?: { cylinder: THREE.Mesh; head: THREE.Mesh };
}

interface Tracer {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  origin: THREE.Vector3;
  dir: THREE.Vector3; // unit length
  dist: number; // travel distance (clamped to a visible minimum for point-blank shots)
  segLen: number;
  born: number;
  baseOpacity: number;
  /** m/s this tracer's segment travels at — WeaponSpec.tracerSpeed at the
   *  instant addTracer was called, fixed for this tracer's whole lifetime
   *  (a weapon swap mid-flight can't retroactively speed up an already-fired shot). */
  speed: number;
}

export class SceneRig {
  private readonly creationStarted = performance.now();
  private constructionMs = 0;
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly boxes: readonly Box[];
  private readonly ramps: readonly RampDef[];
  /** `boxes` plus each ramp's old step-box approximation (see
   *  `rampOccluderBoxes` in ../src/map/tilemap.ts) — used only by the
   *  box-array-based `wallDistance` check. `raycastHitClaim` needs no
   *  equivalent: it raycasts real scene meshes, and ramps get their own wedge
   *  mesh added to `claimTargets` alongside `boxRenders` (see `rampRenders`). */
  private readonly hitBoxes: readonly Box[];
  private readonly players = new Map<string, PlayerRig>();
  // Reused across every syncPlayers() call (once per render frame) instead of
  // allocating a fresh Set each time purely to track "seen this frame" ids.
  private readonly seenPlayers = new Set<string>();
  private readonly tracers: Tracer[] = [];
  // Rigged remote-player model: kicked off once in the constructor (if configured),
  // resolved asynchronously — see makeRig()/upgradeCapsuleRigs(). "absent" covers
  // both "no models.player configured" (neonstrike) and "load failed" (rig-loader
  // already console.warn'd once); either way every rig stays capsule permanently.
  // While "loading", new rigs are capsules too (players/bots already exist from the
  // room's first broadcast, so this is the COMMON case, not a rare race) — once the
  // load resolves, upgradeCapsuleRigs() swaps every existing capsule rig in place.
  private modelState: "loading" | "ready" | "absent" = "absent";
  private modelGltf: GLTF | undefined;

  // Map dressing: every procedural box's mesh+edges, keyed by its index in
  // `this.boxes` — buildArena() populates this for every box unconditionally
  // (so the box/wall render never regresses if the bundle fails), and the
  // constructor's dressing load hides only the manifest's hiddenBoxIndices
  // once (and only once) the real bundle has actually loaded successfully.
  private readonly boxRenders = new Map<number, { mesh: THREE.Mesh; edges: THREE.LineSegments }>();
  // Ramp wedge renders, keyed by index into `this.ramps` — kept separate from
  // `boxRenders` on purpose: ramps have no dressing-manifest hidden-index
  // entry and a different collider shape, so they're tracked and hit-tested
  // independently (see raycastHitClaim).
  private readonly rampRenders = new Map<number, { mesh: THREE.Mesh; edges: THREE.LineSegments }>();

  // Viewmodel + its animated offsets.
  private readonly viewmodel = new THREE.Group();
  private readonly weaponHolder = new THREE.Group();
  private readonly hands = new ViewmodelHands();
  private readonly reload = new ReloadPresentation();
  private magazine?: THREE.Group;
  private bolt?: THREE.Group;
  private readonly weaponGeometry: THREE.BufferGeometry[] = [];
  private reloadPhase = 'idle';
  private inspectionReload: number | null | undefined;
  private reloadCue?: (phase: string) => void;
  // Whether weaponHolder's current child is a cloned GLB (shared/cached geometry
  // + material, never disposed) or a procedural buildWeaponMesh() (fresh
  // BoxGeometry per call, must be disposed) — see setWeaponVisual/disposeCurrentWeaponMesh.
  private weaponIsModel = false;
  private weaponGeneration = 0;
  private sightHeight = 0.1;
  private sightDot?: THREE.Object3D;
  private readonly muzzle: THREE.Mesh;
  private readonly muzzleLight: THREE.PointLight;
  private muzzleFiredAt = -1e9;
  private bobPhase = 0;
  private motionSpeed = 0;
  private recoil = 0; // 0..1, decays; drives kick-back + muzzle rise
  private swayX = 0;
  private swayY = 0;
  // Weapon swap (lower → replace mesh → raise; total = the server's 350 ms delay).
  private weaponIndex = 0;
  private swapT = -1e9; // performance.now() the swap started; <0 phase means idle
  private pendingWeapon = -1;
  // ADS state: adsT eases 0→1, drives FOV + viewmodel centering (+ sniper scope overlay).
  private adsHeld = false;
  private adsT = 0;
  private adsProgress = 0;
  private predictedAds: number | null = null;
  private fovCur = HIP_FOV;
  private scopeEl: HTMLDivElement | null = null;
  // Grenade + explosion effects, stepped in render().
  private readonly nades = new Map<string, NadeFx>();
  private readonly booms: BoomFx[] = [];
  private readonly blastLights: { light: THREE.PointLight; born: number }[] = [];
  private blastLightCursor = 0;
  private readonly debrisMatrix = new THREE.Matrix4();
  private shakeAmp = 0;
  reducedMotion = false;
  private lastFx = performance.now();
  private readonly vfx: Vfx;
  private readonly muzzleWorldScratch = new THREE.Vector3(); // reused by getSelfMuzzlePos, one per call not per frame
  private readonly diagScratch = new THREE.Vector3(); // reused by getHitboxDiagnostics, diagnostic-only
  // Hybrid hit registration (raycastHitClaim) — reused across every fire attempt
  // instead of allocating fresh; a shot is at most a few times/sec, so this is
  // about not leaving one-shot garbage behind, not a hot-path concern.
  private readonly claimRaycaster = new THREE.Raycaster();
  private readonly claimOrigin = new THREE.Vector3();
  private readonly claimDir = new THREE.Vector3();
  private readonly claimTargets: THREE.Object3D[] = [];
  private readonly claimScratch = new THREE.Vector3();

  private readonly assetLoads: Promise<unknown>[] = [];
  private preparation?: Promise<void>;
  private preparationMs = 0;
  // Retain a small material reference set so disposing the warm fixtures does
  // not evict their compiled programs before the first real shot/operator.
  private readonly warmedMaterials = new Set<THREE.Material>();
  private environmentLoading = false;
  private contactTexture?: THREE.CanvasTexture;
  private readonly contactGeometry = new THREE.PlaneGeometry(1.25, 1.25);

  constructor(map: MapDef, container: HTMLElement = document.body,
    options: { loadActors?: boolean; loadViewmodel?: boolean } = {}) {
    // Keep the light count stable: adding/removing a light recompiles every
    // lit material. Newest four blasts share a fixed budget, like muzzle flashes.
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(PALETTE.boom.light, 0, 20, 2);
      this.scene.add(light); this.blastLights.push({ light, born: -Infinity });
    }
    const relay = !!map.presentation; // shared industrial daylight lighting
    this.boxes = map.boxes;
    this.ramps = map.ramps ?? [];
    this.hitBoxes = [...map.boxes, ...this.ramps.flatMap(rampOccluderBoxes)];
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = VIS.exposure;
    if (relay) {
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      // Architecture is static. No per-frame shadow pass on the balanced preset.
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
    }

    this.scene.background = new THREE.Color(PALETTE.sceneBg);
    // World-oriented sky: fog and horizon share a colour, zenith stays midnight blue.
    const sky = new THREE.Mesh(new THREE.SphereGeometry(Math.max(200, map.bounds.width * 3), 24, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { horizon: { value: new THREE.Color(relay ? 0xc7d4cc : PALETTE.fog.color) }, zenith: { value: new THREE.Color(relay ? 0x547f94 : VIS.skyZenith) } },
      vertexShader: "varying vec3 vDirection; void main(){ vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: "uniform vec3 horizon; uniform vec3 zenith; varying vec3 vDirection; void main(){ float h=smoothstep(0.,0.75,normalize(vDirection).y); gl_FragColor=vec4(mix(horizon,zenith,h),1.); \n #include <tonemapping_fragment> \n #include <colorspace_fragment> \n }",
    }));
    sky.position.set(map.bounds.width / 2, 0, map.bounds.depth / 2);
    sky.raycast = () => {};
    this.scene.add(sky);
    this.scene.fog = relay ? new THREE.Fog(0xc7d4cc, Math.max(48, map.bounds.width * .6), Math.max(145, map.bounds.width * 2.4))
      : new THREE.Fog(PALETTE.fog.color, PALETTE.fog.near, PALETTE.fog.far);

    this.camera = new THREE.PerspectiveCamera(HIP_FOV, 1, GAME.camera.near, Math.max(GAME.camera.far, map.bounds.width * 5));

    this.scene.add(new THREE.HemisphereLight(relay ? 0xc7e4ef : PALETTE.lights.hemiSky, relay ? 0x535648 : PALETTE.lights.hemiGround, relay ? 1.8 : VIS.lighting.hemisphere));
    const key = new THREE.DirectionalLight(relay ? 0xffe1ad : PALETTE.lights.key, relay ? 3.2 : VIS.lighting.key);
    key.position.set(map.bounds.width / 2 - 22, map.bounds.width > 60 ? 80 : 40, map.bounds.depth / 2 - 14);
    if (relay) {
      key.target.position.set(map.bounds.width / 2, 0, map.bounds.depth / 2); this.scene.add(key.target);
      key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, map.bounds.width > 60
        ? { left: -map.bounds.width * .75, right: map.bounds.width * .75, top: map.bounds.depth, bottom: -map.bounds.depth, near: 1, far: 250 }
        : { left: -45, right: 45, top: 40, bottom: -40, near: 1, far: 110 });
      key.shadow.normalBias = 0.12; key.shadow.bias = -0.0003;
    }
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(PALETTE.lights.ambient, relay ? 0.12 : VIS.lighting.ambient));

    this.vfx = new Vfx(this.scene);
    this.buildArena(map);
    if (map.presentation === 'relay') this.assetLoads.push(loadRelayUplinks(this.scene, map.bounds.width / 2).then(() => {
      this.renderer.shadowMap.needsUpdate = true;
    }).catch(error => console.warn('Relay uplink unavailable; retaining original relay mast.', error)));
    if (map.presentation === 'switchyard') this.assetLoads.push(loadSwitchyardTransformers(this.scene).then(() => {
      this.renderer.shadowMap.needsUpdate = true;
    }).catch(error => console.warn('Switchyard transformer unavailable; retaining substation architecture.', error)));
    if (map.presentation) this.assetLoads.push(loadSiteEnvironment(this.scene, this.renderer)
      .catch(error => console.warn("Site environment unavailable; retaining hemisphere fill.", error)));

    const vm = this.buildViewmodel();
    this.viewmodel.add(vm.group);
    this.muzzle = vm.muzzle;
    this.muzzleLight = vm.light;
    this.camera.add(this.viewmodel);
    // Keep the light outside the hideable viewmodel subtree so death and scoped ADS never change the scene's light count.
    this.camera.add(this.muzzleLight);
    this.scene.add(this.camera); // camera must be in the graph for its viewmodel child to render
    if (options.loadViewmodel !== false) this.assetLoads.push(this.setWeaponVisual(0));

    const modelUrl = options.loadActors !== false ? GAME.models?.player : undefined;
    if (modelUrl) {
      this.modelState = "loading";
      this.assetLoads.push(loadPlayerModel(modelUrl).then((gltf) => {
        this.modelGltf = gltf;
        this.modelState = gltf ? "ready" : "absent";
        // Bots/players already exist server-side from the room's first broadcast,
        // so the client's very first syncPlayers() call (same frame the scene is
        // constructed) almost always creates their rigs BEFORE this async load can
        // possibly finish — confirmed live: every rig came up capsule-only even
        // seconds after the model had already loaded. Upgrade any rig that was
        // built as a capsule for exactly that reason, now that the model is ready.
        if (gltf) this.upgradeCapsuleRigs();
      }));
    }

    // Map dressing: `map`'s id ("arena1"/"arena2") isn't on MapDef itself
    // (src/map/*.ts is collision-only, untouched by this feature) — recovered
    // by matching object identity against GAME.maps, which is keyed by exactly
    // those ids and holds the same ARENA1/ARENA2 references mapForMode returns.
    const mapId = Object.keys(GAME.maps).find((k) => GAME.maps[k] === map);
    const dressingUrl = map.presentation === 'relay' ? '/assets/maps/relay-skyline.glb'
      : map.presentation ? undefined : mapId ? GAME.mapDressing?.[mapId] : undefined;
    if (dressingUrl) {
      this.environmentLoading = true;
      this.assetLoads.push(loadMapDressing(dressingUrl).then((gltf) => {
        this.environmentLoading = false;
        if (!gltf) return; // load failed — stay on the procedural box/wall render permanently
        gltf.scene.traverse(node => {
          if (!(node instanceof THREE.Mesh)) return;
          if (relay) { node.castShadow = true; node.receiveShadow = true; }
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.roughness = Math.max(0.72, material.roughness);
              material.metalness = Math.min(0.18, material.metalness);
            }
          }
        });
        this.scene.add(gltf.scene);
        if (relay) {
          const fallback = this.scene.getObjectByName("relay-skyline-fallback");
          if (fallback) fallback.visible = false;
          this.renderer.shadowMap.needsUpdate = true;
        }
        const hidden = !relay && mapId ? DRESSING_MANIFESTS[mapId]?.hiddenBoxIndices : undefined;
        for (const idx of hidden ?? []) {
          const render = this.boxRenders.get(idx);
          if (!render) continue;
          render.mesh.visible = false;
          render.edges.visible = false;
        }
      }));
    }

    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.constructionMs = performance.now() - this.creationStarted;
  }

  // --- arena ------------------------------------------------------------------

  private buildArena(map: MapDef): void {
    if (map.presentation) {
      const existing = new Set(architectureMeshes(this.scene));
      if (map.presentation === 'undertow') buildUndertowEnvironment(this.scene, map);
      else if (map.presentation === 'switchyard') buildSwitchyardEnvironment(this.scene, map);
      else buildRelayEnvironment(this.scene, map);
      const material = new THREE.MeshStandardMaterial({ color: 0x667a7b, roughness: 0.84, side: THREE.DoubleSide });
      for (const r of this.ramps) {
        const mesh = new THREE.Mesh(buildWedgeGeometry(r), material);
        mesh.castShadow = true; mesh.receiveShadow = true; this.scene.add(mesh);
      }
      const fallback = architectureMeshes(this.scene).filter(mesh => !existing.has(mesh));
      this.assetLoads.push(loadArchitecture(this.scene, map.presentation, fallback).then(() => {
        this.renderer.shadowMap.needsUpdate = true;
      }).catch(error => console.warn("Architecture AO unavailable; retaining original kit.", error)));
      if (DEBUG_BOXES) {
        const mat = new THREE.LineBasicMaterial({ color: 0xff00ff });
        for (const b of this.boxes) {
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(
            b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z)), mat);
          edges.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
          this.scene.add(edges);
        }
      }
      return;
    }
    const { width, depth } = map.bounds;

    // Floor with a faint low-contrast grid (a high-contrast tiled grid shimmers).
    const floorTex = makeGridTexture();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(width / 2, depth / 2);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ map: floorTex, color: PALETTE.floor, roughness: 0.9, metalness: 0.08 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(width / 2, 0, depth / 2);
    this.scene.add(floor);

    // Team spawn pads (colour = 진영) at the two short ends.
    for (const [team, cx] of [[0, 4], [1, width - 4]] as const) {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(8, depth - 4),
        new THREE.MeshBasicMaterial({ color: TEAM_COLOR[team], transparent: true, opacity: 0.16 }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(cx, 0.02, depth / 2);
      this.scene.add(pad);
    }

    // Perimeter walls (dark, low) so the arena bounds read.
    const wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.walls, roughness: 0.82, metalness: 0.12 });
    const wallH = 3;
    const wall = (w: number, d: number, x: number, z: number): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      m.position.set(x, wallH / 2, z);
      this.scene.add(m);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.045, d),
        new THREE.MeshBasicMaterial({ color: PALETTE.viewmodel.modelEmissive, transparent: true, opacity: 0.55 }));
      strip.position.set(x, wallH - 0.12, z);
      this.scene.add(strip);
    };
    wall(width, 0.4, width / 2, 0);
    wall(width, 0.4, width / 2, depth);
    wall(0.4, depth, 0, depth / 2);
    wall(0.4, depth, width, depth / 2);

    // Cover / dividers / platforms from the shared map. Rendered unconditionally
    // here regardless of dressing — every box is tracked in `boxRenders` so the
    // constructor's dressing load can hide specific ones once (and only once)
    // a real bundle has actually loaded, never based on the manifest alone.
    const boxMat = new THREE.MeshStandardMaterial({ color: PALETTE.coverBox, roughness: 0.85, metalness: 0.05 });
    const edgeMat = new THREE.LineBasicMaterial({ color: PALETTE.coverEdge, transparent: true, opacity: 0.35 });
    // ?debugBoxes=1 overlay material — bright magenta, distinct from both the
    // procedural fallback edges (coverEdge) and any dressing mesh's own colors.
    const debugMat = new THREE.LineBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.85 });
    this.boxes.forEach((b, i) => {
      const w = b.max.x - b.min.x;
      const h = b.max.y - b.min.y;
      const d = b.max.z - b.min.z;
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, boxMat);
      mesh.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
      this.scene.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
      edges.position.copy(mesh.position);
      this.scene.add(edges);
      this.boxRenders.set(i, { mesh, edges });
      if (DEBUG_BOXES) {
        // Separate from `boxRenders` on purpose — never hidden by the dressing
        // load, so it stays the ground truth overlay regardless of dressing state.
        const debugEdges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), debugMat);
        debugEdges.position.copy(mesh.position);
        this.scene.add(debugEdges);
      }
    });

    // Ramps: true sloped-surface colliders (see ../src/physics.ts), rendered as
    // hand-built wedge meshes — never as the old 3-step-box approximation (that
    // now only survives inside rampOccluderBoxes, for hit-scan occlusion). Reuses
    // boxMat's look via a clone rather than the shared object itself, since this
    // one needs `side: DoubleSide` — see buildWedgeGeometry's comment for why.
    const rampMat = boxMat.clone();
    rampMat.side = THREE.DoubleSide;
    this.ramps.forEach((r, i) => {
      const geo = buildWedgeGeometry(r);
      const mesh = new THREE.Mesh(geo, rampMat);
      this.scene.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
      this.scene.add(edges);
      this.rampRenders.set(i, { mesh, edges });
      if (DEBUG_BOXES) {
        const debugEdges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), debugMat);
        this.scene.add(debugEdges);
      }
    });
  }

  // --- viewmodel --------------------------------------------------------------

  private buildViewmodel(): { group: THREE.Group; muzzle: THREE.Mesh; light: THREE.PointLight } {
    const g = new THREE.Group();
    g.add(this.hands.group);
    g.add(this.weaponHolder); // the per-weapon mesh is swapped inside this holder

    const muzzle = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: PALETTE.muzzle, map: makeFlashTexture(), toneMapped: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    muzzle.position.set(0, 0.02, -0.74);
    g.add(muzzle);

    const light = new THREE.PointLight(PALETTE.muzzleLight, 0, 6, 2);
    light.position.set(0, 0.02, -0.74);

    return { group: g, muzzle, light };
  }

  /** Kick the viewmodel on a confirmed local shot; strength scales by weapon. */
  fireRecoil(weaponIndex = this.weaponIndex): void {
    this.recoil = Math.min(1, this.recoil + (VM_RECOIL[weaponIndex] ?? 0.4));
    this.muzzleFiredAt = performance.now();
    (this.muzzle.material as THREE.MeshBasicMaterial).opacity = 0.9;
    this.muzzle.rotation.z = Math.random() * Math.PI;
    this.muzzle.getWorldPosition(this.muzzleWorldScratch);
    this.camera.worldToLocal(this.muzzleWorldScratch);
    this.muzzleLight.position.copy(this.muzzleWorldScratch);
    this.muzzleLight.intensity = 3;
  }

  /** Start the lower→swap→raise animation toward `index` (no-op if already held/pending). */
  setWeapon(index: number): void {
    if (index === this.weaponIndex && this.pendingWeapon < 0) return;
    if (index === this.pendingWeapon) return;
    this.pendingWeapon = index;
    this.reload.sync(0, 1, performance.now());
    this.swapT = performance.now();
  }

  /** Shows `index`'s viewmodel: builds the procedural mesh immediately (so the
   *  holder is never empty, and it's the permanent result if no model is
   *  configured or its load fails), then swaps in the GLB — with its own
   *  scale/position/muzzle-tip offset from VM_WEAPON_TRANSFORMS — once loaded.
   *  Guards against a stale load resolving after the player has since switched
   *  to a different weapon. Bundle mode (`weaponVis.bundle`) takes priority
   *  over a per-slot single file for any slot it covers; a slot absent from
   *  the bundle's `nodes` map falls back to `weaponVis.models`, then to the
   *  procedural mesh — same 2-tier "try once, else stay procedural" pattern
   *  either way, just a different source URL/extraction step. */
  private async setWeaponVisual(index: number): Promise<void> {
    const generation = ++this.weaponGeneration;
    this.disposeCurrentWeaponMesh();
    const fallback = buildWeaponMesh(index);
    this.sightHeight = new THREE.Box3().setFromObject(fallback).max.y;
    this.weaponHolder.add(fallback);
    this.weaponIsModel = false;
    this.muzzle.position.set(0, 0.02, MUZZLE_Z_DEFAULT);
    this.muzzleLight.position.set(0, 0.02, MUZZLE_Z_DEFAULT);

    const transform = VM_WEAPON_TRANSFORMS[index];
    if (!transform) return;
    const bundle = GAME.weaponVis.bundle;
    const nodeName = bundle?.nodes[index];
    const url = nodeName ? bundle!.url : GAME.weaponVis.models?.[index];
    if (!url) return;

    {
      const gltf = await loadWeaponModel(url);
      if (!gltf) return; // load failed — weapon-loader already warned once, stay procedural
      if (this.weaponIndex !== index || generation !== this.weaponGeneration) return;

      const obj = nodeName ? cloneWeaponBundleNode(gltf, nodeName) : cloneWeaponMesh(gltf);
      if (!obj) return; // bundle loaded but this slot's node is missing — stay procedural

      const bore = weaponMuzzle(obj);
      const sightHeight = new THREE.Box3().setFromObject(obj).max.y * transform.scale;
      this.disposeCurrentWeaponMesh();
      {
        const split = splitRifleMagazine(obj, index);
        this.magazine = split.magazine; this.bolt = split.bolt; this.weaponGeometry.push(...split.owned);
      }
      obj.scale.setScalar(transform.scale);
      obj.rotation.y = Math.PI; // this asset family's +Z-is-muzzle -> this viewmodel's -Z-is-forward
      if (transform.roll) obj.rotation.z = transform.roll; // bore-axis roll correction, see WeaponVmTransform
      obj.position.set(0, 0, transform.posZ);
      // Legacy single-file cyber-trooper GLBs are untextured (shape-only) and
      // need the shared flat material; bundle-mode Synty weapons ship their
      // own dedup'd textured material (is-armfix's bundle pipeline) — keep it.
      if (!nodeName) {
        obj.traverse((n) => {
          if (n instanceof THREE.Mesh) n.material = VM_MODEL_MATERIAL;
        });
      }
      this.sightHeight = sightHeight;
      this.weaponHolder.add(obj);
      if (index === 0) {
        const sight = rifleSight(-bore.x * transform.scale, sightHeight);
        this.weaponHolder.add(sight.object); this.weaponGeometry.push(...sight.geometry);
        this.sightDot = sight.object.getObjectByName('reflex-dot');
        this.sightHeight = sight.centerY;
      }
      this.weaponIsModel = true;
      this.muzzle.position.set(-bore.x * transform.scale, bore.y * transform.scale, transform.posZ - bore.z * transform.scale);
      this.muzzleLight.position.copy(this.muzzle.position);
    }
  }

  /** Empties weaponHolder. A model mesh's geometry/material are shared/cached
   *  (SkeletonUtils-free `Object3D#clone()` in weapon-loader.ts) and must never
   *  be disposed here; only the procedural mesh's fresh-per-call BoxGeometry is. */
  private disposeCurrentWeaponMesh(): void {
    for (const geometry of this.weaponGeometry) geometry.dispose();
    this.weaponGeometry.length = 0; this.magazine = undefined; this.bolt = undefined; this.sightDot = undefined;
    for (const child of [...this.weaponHolder.children]) {
      this.weaponHolder.remove(child);
      if (!this.weaponIsModel) {
        child.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
      }
    }
  }

  /** ADS hold state (from input). FOV/viewmodel/scope ease toward it every frame. */
  setAds(held: boolean, progress?: number): void {
    this.adsHeld = held;
    this.predictedAds = progress ?? null;
  }

  /** Camera FOV this frame (main uses it to scale mouse sensitivity while zoomed). */
  get currentFov(): number {
    return this.fovCur;
  }

  setReload(remainingMs: number, durationMs: number): void {
    this.reload.sync(remainingMs, durationMs, performance.now());
  }
  onReloadCue(callback: (phase: string) => void): void { this.reloadCue = callback; }

  /** Deterministic inspector calls the same presentation path as gameplay. */
  inspectViewmodel(progress: number | null, ads: boolean): boolean {
    this.inspectionReload = progress; this.adsHeld = ads;
    this.updateViewmodel(100, 0, 0, 0, true);
    return this.weaponIsModel && this.pendingWeapon < 0;
  }
  viewmodelDiagnostics() {
    return { weapon: this.weaponIndex, phase: this.reloadPhase, muzzle: this.muzzle.position.toArray(),
      magazineMeshes: this.magazine?.children.length ?? 0, ads: this.adsT, adsProgress: this.adsProgress, fov: this.fovCur,
      hands: this.hands.group.visible, ...this.getRenderInfo() };
  }

  // --- grenades + explosions ----------------------------------------------------

  spawnNade(e: { id: string; x: number; y: number; z: number; vx: number; vy: number; vz: number }): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.grenadeMesh, roughness: 0.6, metalness: 0.3 }),
    );
    mesh.position.set(e.x, e.y, e.z);
    this.scene.add(mesh);
    this.nades.set(e.id, { mesh, vx: e.vx, vy: e.vy, vz: e.vz });
  }

  bounceNade(e: { id: string; x: number; y: number; z: number; vx: number; vy: number; vz: number }): void {
    const n = this.nades.get(e.id);
    if (!n) return;
    n.mesh.position.set(e.x, e.y, e.z);
    n.vx = e.vx;
    n.vy = e.vy;
    n.vz = e.vz;
  }

  boomNade(e: { id: string; x: number; y: number; z: number; r: number }): void {
    const n = this.nades.get(e.id);
    if (n) {
      this.scene.remove(n.mesh);
      n.mesh.geometry.dispose();
      (n.mesh.material as THREE.Material).dispose();
      this.nades.delete(e.id);
    }
    // Flash + expanding ring + debris burst.
    const slot = this.blastLights[this.blastLightCursor]!;
    this.blastLightCursor = (this.blastLightCursor + 1) % this.blastLights.length;
    slot.born = performance.now(); slot.light.intensity = 60; slot.light.distance = e.r * 4;
    slot.light.position.set(e.x, e.y + 0.3, e.z);
    const ringMat = new THREE.MeshBasicMaterial({
      color: PALETTE.boom.ring, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(e.x, Math.max(0.05, e.y) + 0.05, e.z);
    this.scene.add(ring);
    const partMat = new THREE.MeshBasicMaterial({
      color: PALETTE.boom.parts, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    // Each burst shares geometry/material: 18 debris pieces cost one draw call.
    const parts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), partMat, 18);
    parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // The tiny moving burst has no stable static bounds. Avoid stale frustum culling.
    parts.frustumCulled = false;
    const positions: THREE.Vector3[] = [], vels: THREE.Vector3[] = [];
    for (let i = 0; i < 18; i++) {
      const position = new THREE.Vector3(e.x, e.y + 0.2, e.z);
      positions.push(position);
      parts.setMatrixAt(i, this.debrisMatrix.makeTranslation(position.x, position.y, position.z));
      const a = (i / 18) * Math.PI * 2;
      vels.push(new THREE.Vector3(Math.cos(a) * (3 + Math.random() * 5), 4 + Math.random() * 6, Math.sin(a) * (3 + Math.random() * 5)));
    }
    this.scene.add(parts);
    this.booms.push({ ring, ringMat, parts, positions, vels, partMat, born: performance.now() });
    // Camera shake, attenuated by distance to the blast.
    const d = this.camera.position.distanceTo(new THREE.Vector3(e.x, e.y, e.z));
    this.shakeAmp = Math.min(0.6, this.shakeAmp + Math.max(0, 1 - d / 30) * 0.45);
  }

  private stepFx(now: number): void {
    const dt = Math.min(0.1, (now - this.lastFx) / 1000);
    this.lastFx = now;
    for (const n of this.nades.values()) {
      n.vy += NADE_GRAVITY * dt;
      n.mesh.position.x += n.vx * dt;
      n.mesh.position.y = Math.max(0.13, n.mesh.position.y + n.vy * dt);
      n.mesh.position.z += n.vz * dt;
      n.mesh.rotation.x += dt * 6;
    }
    for (const slot of this.blastLights) slot.light.intensity = 60 * Math.max(0, 1 - (now - slot.born) / BOOM_LIFE_MS);
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i]!;
      const t01 = (now - b.born) / BOOM_LIFE_MS;
      if (t01 >= 1) {
        this.scene.remove(b.ring);
        this.scene.remove(b.parts); b.parts.geometry.dispose(); b.parts.dispose();
        b.ring.geometry.dispose();
        if (!this.warmedMaterials.has(b.ringMat)) b.ringMat.dispose();
        if (!this.warmedMaterials.has(b.partMat)) b.partMat.dispose();
        this.booms.splice(i, 1);
        continue;
      }
      const s = 1 + t01 * 14;
      b.ring.scale.set(s, s, 1);
      b.ringMat.opacity = 0.9 * (1 - t01);
      b.partMat.opacity = 1 - t01;
      for (const [j, p] of b.positions.entries()) {
        const v = b.vels[j]!;
        v.y += NADE_GRAVITY * 0.6 * dt;
        p.addScaledVector(v, dt);
        b.parts.setMatrixAt(j, this.debrisMatrix.makeTranslation(p.x, p.y, p.z));
      }
      b.parts.instanceMatrix.needsUpdate = true;
    }
    this.shakeAmp *= Math.exp(-dt * 6);
  }

  /**
   * Animate the viewmodel: bob from movement, sway lagging the look delta, and the
   * decaying recoil kick. `speed01` is 0..1 horizontal speed, `dLook` the yaw+pitch
   * delta this frame (for sway).
   */
  updateViewmodel(dtMs: number, speed01: number, dYaw: number, dPitch: number, grounded: boolean): void {
    const dt = clamp(dtMs / 1000, 0, 0.1);
    const now = performance.now();
    const progress = this.inspectionReload !== undefined ? this.inspectionReload : this.reload.progress(now);
    const reload = reloadPose(progress);
    if (reload.phase !== this.reloadPhase) {
      this.reloadPhase = reload.phase;
      if (this.inspectionReload === undefined) this.reloadCue?.(reload.phase);
    }
    this.hands.update(this.weaponIndex, progress);
    this.hands.group.visible = MOTION.hands;
    if (this.bolt) this.bolt.position.z = -reload.bolt * 0.07;
    if (this.magazine) {
      this.magazine.position.y = -reload.magazine * (this.weaponIndex === 2 ? 0.04 : 0.34);
      this.magazine.position.x = -reload.magazine * (this.weaponIndex === 2 ? 0.32 : 0.08);
    }
    const response = 1 - Math.exp(-dt * MOTION.speedResponse);
    this.motionSpeed += ((grounded ? clamp(speed01, 0, 1) : 0) - this.motionSpeed) * response;
    this.bobPhase += dt * MOTION.bobRate * this.motionSpeed;
    const bobAmt = this.reducedMotion ? 0 : this.motionSpeed * MOTION.bobAmplitude;
    const bx = Math.cos(this.bobPhase) * bobAmt;
    const by = Math.sin(this.bobPhase * 2) * bobAmt * 0.6;
    const swayResponse = 1 - Math.exp(-dt * MOTION.swayResponse);
    this.swayX += (clamp(-dYaw / Math.max(dt, 0.001) * MOTION.swayGain, -MOTION.swayLimit, MOTION.swayLimit) - this.swayX) * swayResponse;
    this.swayY += (clamp(dPitch / Math.max(dt, 0.001) * MOTION.swayGain, -MOTION.swayLimit, MOTION.swayLimit) - this.swayY) * swayResponse;

    if (this.reducedMotion) { this.swayX = 0; this.swayY = 0; }

    // Weapon swap: dip the holder, replace the mesh at the bottom, raise back up.
    let swapDip = 0;
    if (this.pendingWeapon >= 0) {
      const t = now - this.swapT;
      if (t < SWAP_DOWN_MS) {
        swapDip = THREE.MathUtils.smoothstep(t / SWAP_DOWN_MS, 0, 1);
      } else {
        if (this.weaponIndex !== this.pendingWeapon) {
          this.weaponIndex = this.pendingWeapon;
          this.setWeaponVisual(this.weaponIndex);
        }
        const up = (t - SWAP_DOWN_MS) / SWAP_UP_MS;
        swapDip = 1 - THREE.MathUtils.smoothstep(up, 0, 1);
        if (up >= 1) this.pendingWeapon = -1;
      }
    }

    // One finite per-weapon timer drives sights and world FOV together.
    const aiming = this.adsHeld && this.pendingWeapon < 0 && progress === null;
    const adsMs = GAME.weapons[this.weaponIndex]?.adsMs ?? 250;
    if (aiming && this.predictedAds !== null) this.adsProgress = this.predictedAds;
    else this.adsProgress = clamp(this.adsProgress + (aiming ? 1 : -1) * dt * 1000 / adsMs, 0, 1);
    this.adsT = easeAds(this.adsProgress);
    this.fovCur = lerp(HIP_FOV, ADS_FOV[this.weaponIndex] ?? HIP_FOV, this.adsT);
    if (this.camera.fov !== this.fovCur) {
      this.camera.fov = this.fovCur;
      this.camera.updateProjectionMatrix();
    }
    const scoped = this.weaponIndex === 3 && aiming && this.adsProgress >= 1;
    if (this.sightDot) this.sightDot.visible = aiming && this.adsT > 0.95;
    this.viewmodel.visible = !scoped;
    this.toggleScope(scoped);

    this.recoil *= Math.exp(-dt * 1000 / MOTION.recoilSettleMs);
    const kick = this.recoil;
    const ads = this.adsT;
    const pose = MOTION.poses[this.weaponIndex] ?? MOTION.poses[0]!;
    const steady = lerp(1, MOTION.adsMotion, ads);
    // Centre X on the bore; look just above the sight silhouette, parallel to the barrel.
    this.viewmodel.position.set(
      lerp(pose.x, -this.muzzle.position.x, ads) + (bx + this.swayX) * steady,
      lerp(pose.y, -this.sightHeight - (this.weaponIndex === 0 && this.weaponIsModel ? 0 : MOTION.adsSightClearance), ads) +
        (by + this.swayY + (this.reducedMotion ? 0 : Math.sin(now * 0.001 * MOTION.breathRate) * MOTION.breathAmplitude)) * steady - swapDip * MOTION.swapDrop - reload.tilt * 0.025,
      lerp(pose.z, MOTION.adsDepth, ads) + kick * MOTION.recoilBack,
    );
    this.viewmodel.rotation.set(
      pose.pitch * (1 - ads) + kick * MOTION.recoilPitch + swapDip * MOTION.swapPitch + reload.tilt * 0.20,
      pose.yaw * (1 - ads) + this.swayX * steady,
      (this.reducedMotion ? 0 : Math.sin(this.bobPhase) * this.motionSpeed * MOTION.bobRoll * steady) - reload.tilt * 0.40,
    );

    if (now - this.muzzleFiredAt > MUZZLE_LIFE_MS) {
      (this.muzzle.material as THREE.MeshBasicMaterial).opacity = 0;
      this.muzzleLight.intensity = 0;
    }
  }

  private toggleScope(on: boolean): void {
    if (on && !this.scopeEl) {
      const el = document.createElement("div");
      el.style.cssText =
        "position:fixed;inset:0;z-index:40;pointer-events:none;" +
        "background:radial-gradient(circle at 50% 50%, transparent 31%, rgba(2,4,8,0.985) 32.5%);";
      const line = (w: string, h: string, l: string, t: string): void => {
        const d = document.createElement("div");
        d.style.cssText = `position:absolute;left:${l};top:${t};width:${w};height:${h};background:rgba(210,230,255,0.8);transform:translate(-50%,-50%);`;
        el.appendChild(d);
      };
      line("36vmin", "1px", "50%", "50%");
      line("1px", "36vmin", "50%", "50%");
      document.body.appendChild(el);
      this.scopeEl = el;
    } else if (!on && this.scopeEl) {
      this.scopeEl.remove();
      this.scopeEl = null;
    }
  }

  // --- camera -----------------------------------------------------------------

  setView(eye: { x: number; y: number; z: number }, yaw: number, pitch: number): void {
    const sx = !this.reducedMotion && this.shakeAmp > 0.002 ? (Math.random() - 0.5) * this.shakeAmp * 0.12 : 0;
    const sy = !this.reducedMotion && this.shakeAmp > 0.002 ? (Math.random() - 0.5) * this.shakeAmp * 0.12 : 0;
    this.camera.position.set(eye.x + sx, eye.y + sy, eye.z);
    const cp = Math.cos(pitch);
    this.camera.up.copy(EYE_UP);
    this.camera.lookAt(eye.x + Math.sin(yaw) * cp + sx, eye.y + Math.sin(pitch) + sy, eye.z + Math.cos(yaw) * cp);
  }

  // --- players ----------------------------------------------------------------

  /** Sync the remote-player rigs to `poses` (keyed by id); `selfId` is never drawn.
   *  `dtMs` is the render frame delta (main.ts's own `dt`) — used to derive each
   *  model rig's locomotion state from consecutive poses and to step its mixer. */
  syncPlayers(poses: Map<string, PlayerPose>, selfId: string, dtMs: number, clip?: LocomotionState, serverNow = Date.now(), now = performance.now()): void {
    const seen = this.seenPlayers;
    seen.clear();
    for (const [id, pose] of poses) {
      if (id === selfId) continue;
      seen.add(id);
      let rig = this.players.get(id);
      if (!rig || rig.team !== pose.team) {
        if (rig) this.disposeRig(rig);
        rig = this.makeRig(id, pose.team);
        this.players.set(id, rig);
      }
      rig.weapon ??= new RemoteWeapon(rig.group, rig.modelRoot);
      rig.weapon.setWeapon(pose.weapon);
      rig.weapon.beforeAnimation();
      rig.model?.setWeaponHold(pose.weapon);
      if (rig.kind === "model") this.syncModelRig(rig, pose, dtMs, now, clip);
      else this.syncCapsuleRig(rig, pose);
      if (rig.contact) {
        // A downward ray finds the same platform/ramp surfaces used by shots.
        // Ground is the fallback; the decal fades while jumping above it.
        const distance = nearestBox({ x: pose.x, y: pose.y + 0.05, z: pose.z },
          { x: 0, y: -1, z: 0 }, this.hitBoxes, pose.y + 0.1);
        const floor = Number.isFinite(distance) ? pose.y + 0.05 - distance : 0;
        rig.contact.position.y = floor - pose.y + 0.018;
        rig.contact.material.opacity = Math.max(0, 0.48 - (pose.y - floor) * 0.2);
        rig.contact.visible = pose.alive;
      }
      rig.weapon.update(rig.headY ?? 1.5, pose.pitch, pose.alive, undefined, true,
        remoteReloadProgress(pose.alive, pose.reloadEnd ?? 0, GAME.weapons[pose.weapon]?.reloadMs ?? 1, serverNow));
    }
    // Map iterators tolerate deleting the current/already-visited key mid-loop
    // (spec-guaranteed), so this needs no defensive array copy.
    for (const [id, rig] of this.players) {
      if (!seen.has(id)) {
        this.disposeRig(rig);
        this.players.delete(id);
      }
    }
  }

  /** Network-free preview: same factory, mixer and weapon update as syncPlayers. */
  inspectRig(pose: PlayerPose, clip: LocomotionState, blend: number | undefined, arms: boolean, sample = 0.75, reload: number | null = null): boolean {
    this.viewmodel.visible = false;
    this.syncPlayers(new Map([["inspect", pose]]), "", 0, clip);
    const rig = this.players.get("inspect")!;
    if (!rig.model || !rig.weapon) return false;
    rig.weapon.beforeAnimation();
    rig.model.setWeaponHold(arms ? pose.weapon : undefined);
    rig.model.forceIdle();
    rig.model.setState(clip);
    rig.model.update(sample); // repeatable clip sample for every camera angle
    this.groundCrouch(rig, pose.crouch);
    rig.weapon.update(rig.headY ?? 1.5, pose.pitch, true, blend, arms, reload);
    return rig.weapon.loaded;
  }

  /** Offline fixed-time sample through the normal hit/death transition path. */
  inspectReaction(kind: string, ageMs: number): boolean {
    const pose = { x: 10, y: 0, z: 20, yaw: 0, pitch: 0, crouch: kind === "crouch",
      alive: true, team: 0, weapon: 0 };
    const poses = new Map([["reaction", pose]]);
    this.syncPlayers(poses, "", 0, undefined, 1000, 1000);
    const rig = this.players.get("reaction");
    if (!rig?.model || !rig.weapon?.loaded) return false;
    rig.model.forceIdle(); rig.aliveWas = true; rig.deadHoldUntil = undefined;
    this.syncPlayers(poses, "", 200, undefined, 1000, 1000);
    if (kind === "death") {
      pose.alive = false;
      this.syncPlayers(poses, "", 0, undefined, 1000, 1000);
    } else this.playHitReaction("reaction", kind === "head");
    for (let elapsed = 0; elapsed < ageMs;) {
      const dt = Math.min(10, ageMs - elapsed); elapsed += dt;
      this.syncPlayers(poses, "", dt, undefined, 1000 + elapsed, 1000 + elapsed);
    }
    return true;
  }

  inspectionReactionInfo(): { visible: boolean; head: number[] | undefined; supportY: number | undefined } {
    const rig = this.players.get("reaction");
    const head = rig?.modelRoot?.getObjectByName("head");
    return { visible: rig?.group.visible ?? false, head: head?.getWorldPosition(new THREE.Vector3()).toArray(), supportY: rig?.model?.getBodySupportWorldY() };
  }

  inspectionHandFocus(): THREE.Vector3 | undefined {
    const root = this.players.get('inspect')?.modelRoot;
    const left = root?.getObjectByName('Hand_L'), right = root?.getObjectByName('Hand_R');
    if (!left || !right) return undefined;
    const point = left.getWorldPosition(new THREE.Vector3()).add(right.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    point.y += 0.08; point.z += 0.1; return point;
  }

  inspectionGrip(): unknown {
    const rig = this.players.get('inspect');
    if (!rig?.modelRoot || !rig.weapon) return null;
    const mount = rig.weapon.mount;
    const bones: Record<string, number[]> = {};
    for (const name of ['Hand_R', 'Hand_L', 'thumb_01_l', 'thumb_02_l', 'thumb_03_l', 'indexFinger_01_l', 'indexFinger_04_l', 'finger_01_l', 'finger_04_l', 'indexFinger_01_r', 'indexFinger_04_r', 'finger_01_r', 'finger_04_r']) {
      const bone = rig.modelRoot.getObjectByName(name);
      if (bone) bones[name] = mount.worldToLocal(bone.getWorldPosition(new THREE.Vector3())).toArray();
    }
    return { bones, muzzle: rig.weapon.muzzle.position.toArray() };
  }

  /** Server-confirmed upper-body impulse; feet, crouch and weapon holds continue. */
  playHitReaction(id: string, headshot: boolean): void {
    const rig = this.players.get(id);
    if (!rig?.model || rig.aliveWas === false) return;
    rig.model.setState(headshot ? "hit_head" : "hit_chest");
  }

  private syncCapsuleRig(rig: PlayerRig, pose: PlayerPose): void {
    rig.group.visible = pose.alive;
    if (!pose.alive) return;
    // A primitive capsule has no independent "real" crouch pose to audit against
    // (unlike the animated model) — sized directly off HIT so there's no
    // visual/assumed gap to have in the first place.
    const stance = pose.crouch ? HIT.crouchHeight / HIT.standHeight : 1;
    const h = pose.crouch ? HIT.crouchHeight : HIT.standHeight;
    rig.body!.scale.y = stance;
    rig.body!.position.y = h / 2;
    rig.head!.position.y = h - HIT.headRadius;
    rig.headY = rig.head!.position.y;
    rig.group.position.set(pose.x, pose.y, pose.z);
    rig.group.rotation.y = pose.yaw;
    this.updateHitboxOverlay(rig, rig.headY);
  }

  private syncModelRig(rig: PlayerRig, pose: PlayerPose, dtMs: number, now: number, clip?: LocomotionState): void {
    const model = rig.model!;
    const wasAlive = rig.aliveWas ?? true;
    rig.aliveWas = pose.alive;

    if (!pose.alive) {
      if (wasAlive) {
        // Let the inherited fall reach its final pose before hiding the body.
        // The authoritative respawn edge below always cancels this local hold.
        model.setState("death");
        rig.deadHoldUntil = now + deathPresentationMs(model.deathDuration);
      }
      const holding = rig.deadHoldUntil !== undefined && now < rig.deadHoldUntil;
      rig.group.visible = holding;
      if (holding) {
        model.update(dtMs / 1000);
        // Source root motion leaves the settled body suspended. Reset the local
        // anchor before sampling so this correction cannot accumulate per frame.
        rig.modelRoot!.position.y = -rig.localMinY! * rig.baseScale!;
        const supportY = model.getBodySupportWorldY();
        if (supportY !== undefined)
          rig.modelRoot!.position.y -= Math.max(0, supportY - rig.group.position.y - 0.1);
      }
      return;
    }

    rig.group.visible = true;
    if (!wasAlive) {
      // Respawn edge: snap back to idle and re-anchor the speed sample so the
      // teleport-to-spawn jump isn't read as an instantaneous sprint next frame.
      model.forceIdle();
      rig.deadHoldUntil = undefined;
      rig.prevX = pose.x;
      rig.prevZ = pose.z;
    }

    const squash = pose.crouch && !model.hasCrouchClips ? MODEL_CROUCH_SQUASH : 1;
    const sy = rig.baseScale! * squash;
    rig.modelRoot!.scale.set(rig.baseScale!, sy, rig.baseScale!);
    rig.modelRoot!.position.y = -rig.localMinY! * sy; // keeps feet at the group's local y=0 as squash changes
    rig.group.position.set(pose.x, pose.y, pose.z);
    rig.group.rotation.y = pose.yaw + MODEL_YAW_OFFSET;
    // Mirrors the capsule rig's head-sphere formula so getRemoteMuzzleAnchor's
    // anchor height is consistent regardless of which rig kind a player has.
    // Uses HIT (not PLAYER) — this is the server's assumed hit-sphere centre,
    // not the animation's own actual head height (which hitscan.ts can't read
    // and doesn't need to; see the hitbox/visual audit's findings on HIT.crouchHeight).
    rig.headY = (pose.crouch ? HIT.crouchHeight : HIT.standHeight) - HIT.headRadius;
    this.updateHitboxOverlay(rig, rig.headY);

    const dtSec = dtMs / 1000;
    const dx = pose.x - (rig.prevX ?? pose.x);
    const dz = pose.z - (rig.prevZ ?? pose.z);
    const speed = dtSec > 0 ? Math.hypot(dx, dz) / dtSec : 0;
    rig.prevX = pose.x;
    rig.prevZ = pose.z;
    let locomotion: LocomotionState;
    if (pose.crouch && model.hasCrouchClips) {
      locomotion = speed < LOCOMOTION_IDLE_MAX ? "crouch_idle" : "crouch_walk";
    } else {
      locomotion =
        speed < LOCOMOTION_IDLE_MAX ? "idle" : speed < LOCOMOTION_WALK_MAX ? "walk" : model.hasSprintClip ? "sprint" : "run";
    }
    if (speed >= LOCOMOTION_IDLE_MAX && pose.weapon === 0) {
      // Travel relative to the facing direction, never inferred from aim alone.
      const lateral = dx * Math.cos(pose.yaw) - dz * Math.sin(pose.yaw);
      const forward = dx * Math.sin(pose.yaw) + dz * Math.cos(pose.yaw);
      if (Math.abs(lateral) > Math.abs(forward) * 1.2)
        locomotion = pose.crouch ? (lateral > 0 ? 'crouch_left' : 'crouch_right')
          : lateral > 0 ? 'strafe_left' : 'strafe_right';
      else if (forward < -Math.abs(lateral) && !pose.crouch) locomotion = 'backpedal';
    }
    model.setState(clip ?? locomotion);
    model.update(dtSec);
    this.groundCrouch(rig, pose.crouch);
  }

  /** The inherited crouch clip lifts both feet in its source root frame. Anchor
   * its lowest foot to the authoritative floor, without a per-vertex skin scan
   * or changing collision/hit rules. The six foot bones cost constant work. */
  private groundCrouch(rig: PlayerRig, crouch: boolean): void {
    if (!crouch || !rig.model?.hasCrouchClips || !rig.modelRoot) return;
    rig.modelRoot.position.y = -rig.localMinY! * rig.baseScale!;
    const footY = rig.model.getFootWorldY();
    if (footY !== undefined) rig.modelRoot.position.y -= Math.max(0, footY - rig.group.position.y - 0.035);
  }

  private makeRig(id: string, team: number): PlayerRig {
    if (this.modelState === "ready" && this.modelGltf) return this.makeModelRig(id, team, this.modelGltf);
    return this.makeCapsuleRig(id, team);
  }

  /** Runs once, right after the player model finishes loading: swaps every
   *  currently-tracked capsule rig for a model rig of the same team, in place.
   *  Positions/pose are re-applied by the very next syncPlayers() tick, same as
   *  any newly-created rig — nothing special needs to happen here beyond the swap. */
  private upgradeCapsuleRigs(): void {
    for (const [id, rig] of this.players) {
      if (rig.kind !== "capsule") continue;
      this.disposeRig(rig);
      this.players.set(id, this.makeModelRig(id, rig.team, this.modelGltf!));
    }
  }

  private makeCapsuleRig(id: string, team: number): PlayerRig {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: TEAM_COLOR[team] ?? 0xaaaaaa, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER.radius, CAP_LEN, 4, 10), mat);
    body.position.y = PLAYER.standHeight / 2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(PLAYER.headRadius, 12, 10), mat);
    head.position.y = PLAYER.standHeight - PLAYER.headRadius;
    // Hybrid hit registration (raycastHitClaim): a capsule rig's primitives ARE
    // its own exact hit shape (no visual/assumed gap to bridge), so ownership +
    // part are tagged directly rather than derived from a hit point's height.
    body.userData.victimId = id;
    body.userData.part = "body" satisfies HitPart;
    head.userData.victimId = id;
    head.userData.part = "head" satisfies HitPart;
    group.add(body);
    group.add(head);
    this.scene.add(group);
    let hitboxOverlay: { cylinder: THREE.Mesh; head: THREE.Mesh } | undefined;
    if (DEBUG_HITBOX) {
      hitboxOverlay = buildHitboxOverlay();
      group.add(hitboxOverlay.cylinder, hitboxOverlay.head);
    }
    return { group, team, kind: "capsule", body, head, hitboxOverlay, contact: this.makeContactShadow(group) };
  }

  private makeModelRig(id: string, team: number, gltf: GLTF): PlayerRig {
    const group = new THREE.Group();
    const model = clonePlayerRig(gltf);
    const object = model.object;
    // Hybrid hit registration (raycastHitClaim): tags the WHOLE skinned-mesh
    // hierarchy as belonging to `id` — a raycast hit lands on some nested mesh
    // under `object`, and userData doesn't inherit, so the claim lookup walks
    // up parents until it finds this tag (see raycastHitClaim).
    object.userData.victimId = id;

    // Normalize scale from the model's own (unknown) authored bbox to
    // PLAYER.standHeight, then position it so its feet sit at the group's local
    // y=0 — matches the capsule rig's convention of "group position = feet".
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const height = box.max.y - box.min.y || 1;
    const baseScale = PLAYER.standHeight / height;
    object.scale.setScalar(baseScale);
    object.position.y = -box.min.y * baseScale;
    object.traverse((n) => {
      if (n instanceof THREE.Mesh) {
        // The balanced atlas contains STATIC architecture only; baking a moving
        // actor once would leave a ghost shadow at its loading-time position.
        n.castShadow = false;
        n.receiveShadow = true;
      }
    });
    applyTeamTint(object, TEAM_COLOR[team] ?? 0xaaaaaa);

    group.add(object);
    this.scene.add(group);
    let hitboxOverlay: { cylinder: THREE.Mesh; head: THREE.Mesh } | undefined;
    if (DEBUG_HITBOX) {
      hitboxOverlay = buildHitboxOverlay();
      group.add(hitboxOverlay.cylinder, hitboxOverlay.head);
    }
    return {
      group,
      contact: this.makeContactShadow(group),
      team,
      kind: "model",
      modelRoot: object,
      model,
      baseScale,
      localMinY: box.min.y,
      aliveWas: true,
      hitboxOverlay,
    };
  }

  /** Repositions/rescales a rig's `?debugHitbox=1` overlay to match the exact
   *  volumes hitscan.ts would raycast against right now — same feetY/headY
   *  pair syncCapsuleRig/syncModelRig just derived, same HIT.radius/headRadius
   *  resolveHitscan is called with (server/client share this one config
   *  module, so there's no separate "wire" value to fall out of sync with —
   *  see this file's header). `headY` is feet-relative, matching the field's
   *  existing convention. */
  private updateHitboxOverlay(rig: PlayerRig, headY: number): void {
    if (!rig.hitboxOverlay) return;
    const yTop = headY - 2 * HIT.headRadius; // hitscan.ts's cylinder top = neck, where the head sphere's underside begins
    const { cylinder, head } = rig.hitboxOverlay;
    cylinder.scale.set(HIT.radius, Math.max(0.001, yTop), HIT.radius);
    cylinder.position.y = yTop / 2;
    head.scale.setScalar(HIT.headRadius);
    head.position.y = headY - HIT.headRadius;
  }

  private disposeRig(rig: PlayerRig): void {
    if (rig.contact && !this.warmedMaterials.has(rig.contact.material)) rig.contact.material.dispose();
    rig.weapon?.dispose();
    this.scene.remove(rig.group);
    if (rig.hitboxOverlay) {
      rig.hitboxOverlay.cylinder.geometry.dispose();
      rig.hitboxOverlay.head.geometry.dispose();
      // HITBOX_MAT is shared across every rig's overlay — never disposed here.
    }
    if (rig.kind === "capsule") {
      rig.body!.geometry.dispose();
      rig.head!.geometry.dispose();
      (rig.body!.material as THREE.Material).dispose();
      return;
    }
    // Geometry is shared across every clone of the cached GLB (SkeletonUtils.clone
    // never deep-clones buffers) — only the per-instance tint materials this rig's
    // makeModelRig() created are ours to dispose.
    rig.modelRoot!.traverse((n) => {
      if (!(n instanceof THREE.Mesh)) return;
      const m = n.material;
      for (const material of Array.isArray(m) ? m : [m])
        if (!this.warmedMaterials.has(material)) material.dispose();
      if (n instanceof THREE.SkinnedMesh) n.skeleton.dispose();
    });
  }

  // --- tracers ----------------------------------------------------------------

  /** Spawn a tracer that TRAVELS from `origin` to `origin + dir*dist` at
   *  `speed` m/s (WeaponSpec.tracerSpeed — a moving segment, not a static
   *  beam) — see {@link updateTracers}, which owns the per-frame
   *  position/opacity. Cosmetic only: this speed never touches hit
   *  registration (hitscan is instant), only how long the beam is visible. */
  addTracer(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    dist: number,
    hit: boolean,
    speed: number,
  ): void {
    const travelDist = Math.max(0.5, dist);
    const segLen = Math.min(travelDist * TRACER_SEG_FRAC, TRACER_SEG_MAX);
    const d = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
    const mat = new THREE.MeshBasicMaterial({
      color: hit ? PALETTE.tracerHit : PALETTE.tracerMiss,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, segLen), mat);
    mesh.quaternion.setFromUnitVectors(FWD_Z, d);
    this.scene.add(mesh);
    this.tracers.push({
      mesh,
      mat,
      origin: new THREE.Vector3(origin.x, origin.y, origin.z),
      dir: d,
      dist: travelDist,
      segLen,
      born: performance.now(),
      baseOpacity: 0.85,
      speed,
    });
  }

  // --- VFX/SFX polish (remote flashes, casings, impacts, footsteps) -------------
  // Thin wiring only — `vfx.ts` owns the pools and per-frame aging.

  /** Distance to the first map box the ray enters within `maxT`, or `maxT` itself
   *  if none (a pure client-side wall stop — used by main.ts to give a
   *  self-authoritative tracer a plausible endpoint without server round-trip). */
  wallDistance(origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, maxT: number): number {
    return Math.min(maxT, nearestBox(origin, dir, this.hitBoxes, maxT));
  }

  /** World-space position of the LOCAL player's own viewmodel muzzle right now —
   *  the same node `fireRecoil` flashes, so it already carries every animated
   *  offset (rest pose, bob, sway, recoil kick, ADS centering) for free. Used to
   *  anchor the self tracer/casing to the gun instead of the eye, which used to
   *  make them appear to shoot out of the middle of the screen. */
  getSelfMuzzlePos(): { x: number; y: number; z: number } {
    this.muzzle.getWorldPosition(this.muzzleWorldScratch);
    return { x: this.muzzleWorldScratch.x, y: this.muzzleWorldScratch.y, z: this.muzzleWorldScratch.z };
  }

  /** The currently-rendered world position of a remote player's weapon muzzle, formerly eye
   *  height (feet + the head mesh's local Y, which already accounts for crouch) —
   *  used to anchor their muzzle flash/casing/tracer start to where they visually
   *  are, since the wire shot origin is stale by their RTT plus our own render
   *  interpolation delay. `undefined` if the rig isn't tracked (e.g. just left). */
  getRemoteMuzzleAnchor(id: string): { x: number; y: number; z: number } | undefined {
    const rig = this.players.get(id);
    if (!rig) return undefined;
    if (rig.weapon) {
      rig.weapon.muzzle.getWorldPosition(this.muzzleWorldScratch);
      return { x: this.muzzleWorldScratch.x, y: this.muzzleWorldScratch.y, z: this.muzzleWorldScratch.z };
    }
    return { x: rig.group.position.x, y: rig.group.position.y + (rig.headY ?? 0), z: rig.group.position.z };
  }

  /** Diagnostic-only (hitbox/visual audit): for every currently-tracked remote
   *  rig, the server-assumed head-sphere-centre world Y (same formula
   *  resolveHitscan uses) alongside where the rig is ACTUALLY rendered right
   *  now — the "head" bone's real world position for a model rig (reflects
   *  whatever pose/state is currently playing, crouch/hit-reaction included),
   *  or exactly the assumed value for a capsule rig (a primitive sphere IS its
   *  own hit volume, so there's no visual/assumed gap to measure there — kept
   *  for a sane zero-error baseline). `bodyHalfX`/`bodyHalfZ` are the rig's
   *  current animated bounding-box half-extents (a silhouette-width proxy for
   *  the body cylinder's radius); `crownWorldY` is the same box's top, for
   *  checking the crouch stance's actual height against `crouchHeight`. */
  getHitboxDiagnostics(): Array<{
    id: string;
    kind: "capsule" | "model";
    renderedX: number;
    renderedZ: number;
    feetWorldY: number;
    assumedHeadWorldY: number;
    visualHeadWorldY: number;
    bodyHalfX: number;
    bodyHalfZ: number;
    crownWorldY: number;
  }> {
    const out: Array<{
      id: string;
      kind: "capsule" | "model";
      renderedX: number;
      renderedZ: number;
      feetWorldY: number;
      assumedHeadWorldY: number;
      visualHeadWorldY: number;
      bodyHalfX: number;
      bodyHalfZ: number;
      crownWorldY: number;
    }> = [];
    for (const [id, rig] of this.players) {
      const feetWorldY = rig.group.position.y;
      const assumedHeadWorldY = feetWorldY + (rig.headY ?? 0);
      let visualHeadWorldY = assumedHeadWorldY;
      let box: THREE.Box3;
      if (rig.kind === "model" && rig.modelRoot && rig.model) {
        rig.model.getHeadWorldPos(this.diagScratch);
        // A rig with no "head" bone leaves diagScratch untouched by
        // getHeadWorldPos — guard against reporting a stale (0,0,0)-ish value
        // as if it were real by falling back to the assumed height instead.
        if (this.diagScratch.lengthSq() > 0) visualHeadWorldY = this.diagScratch.y;
        box = new THREE.Box3().setFromObject(rig.modelRoot);
      } else {
        box = new THREE.Box3().setFromObject(rig.group);
      }
      out.push({
        id,
        kind: rig.kind,
        // rig.group.position is the render-INTERPOLATED pose (main.ts's
        // sampleRemotes(), ~INTERP_DELAY_MS behind the wire) — what a real
        // shooter's crosshair actually tracks for a moving target, unlike
        // net.state's raw un-interpolated x/z (Stage 3 time-domain re-test).
        renderedX: rig.group.position.x,
        renderedZ: rig.group.position.z,
        feetWorldY,
        assumedHeadWorldY,
        visualHeadWorldY,
        bodyHalfX: (box.max.x - box.min.x) / 2,
        bodyHalfZ: (box.max.z - box.min.z) / 2,
        crownWorldY: box.max.y,
      });
    }
    return out;
  }

  /**
   * Hybrid hit registration (PLAN "모양 100%"): raycasts the shooter's aim ray
   * against the ACTUALLY RENDERED scene — every remote rig's real mesh in its
   * current animated pose (or the capsule/head primitives when no model
   * loaded), plus every map box for occlusion — instead of the server's
   * analytic capsule/sphere approximation. `intersectObjects` sorts by
   * distance, so a nearer box beats a farther rig for free (natural
   * occlusion): the nearest hit decides the outcome.
   *
   * Returns `undefined` when the raycast finds nothing (used range is capped
   * at `maxRange`) OR when the nearest hit is a map box (occluded) — either
   * way the caller (net.ts's `tryFire`) sends an explicit `claim: null`, not
   * this `undefined` — see net.ts's doc comment on the 3-way distinction.
   *
   * Head/body classification: a capsule rig's hit primitives ARE the exact
   * shape (tagged `userData.part` at creation — see makeCapsuleRig). A model
   * rig has no such split, so this classifies by the hit point's world Y
   * against the actual head bone's CURRENT world Y minus 2×headRadius (the
   * same "neck" convention hitscan.ts's resolveHitscan uses) — real animated
   * geometry, not the assumed constant, so a crouching or mid-hit-reaction rig
   * classifies correctly regardless of pose. Falls back to the assumed
   * `headY` if this GLB has no "head" bone (same contract as
   * getHitboxDiagnostics's `visualHeadWorldY`).
   */
  raycastHitClaim(
    eye: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    maxRange: number,
  ): FireClaim | undefined {
    this.claimRaycaster.far = maxRange;
    this.claimRaycaster.set(this.claimOrigin.set(eye.x, eye.y, eye.z), this.claimDir.set(dir.x, dir.y, dir.z));
    this.claimTargets.length = 0;
    for (const { mesh } of this.boxRenders.values()) this.claimTargets.push(mesh);
    for (const { mesh } of this.rampRenders.values()) this.claimTargets.push(mesh);
    for (const rig of this.players.values()) {
      if (rig.kind === "model" && rig.modelRoot) this.claimTargets.push(rig.modelRoot);
      else if (rig.body && rig.head) this.claimTargets.push(rig.body, rig.head);
    }
    const nearest = this.claimRaycaster.intersectObjects(this.claimTargets, true)[0];
    if (!nearest) return undefined;

    let owner: THREE.Object3D | null = nearest.object;
    while (owner && owner.userData.victimId === undefined) owner = owner.parent;
    const victimId = owner?.userData.victimId as string | undefined;
    if (!victimId) return undefined; // nearest hit was a map box — occluded, no claim

    const taggedPart = owner!.userData.part as HitPart | undefined;
    if (taggedPart === "head" || taggedPart === "body") return { id: victimId, part: taggedPart };

    const rig = this.players.get(victimId);
    if (!rig) return undefined;
    this.claimScratch.set(0, 0, 0);
    rig.model?.getHeadWorldPos(this.claimScratch);
    const headWorldY =
      this.claimScratch.lengthSq() > 0 ? this.claimScratch.y : rig.group.position.y + (rig.headY ?? 0);
    const neckY = headWorldY - 2 * HIT.headRadius;
    return { id: victimId, part: nearest.point.y >= neckY ? "head" : "body" };
  }

  spawnMuzzleFlash(origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }): void {
    this.vfx.spawnMuzzleFlash(origin, dir);
  }

  spawnCasing(origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }): void {
    this.vfx.spawnCasing(origin, dir);
  }

  spawnImpact(pos: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, hitPlayer: boolean): void {
    this.vfx.spawnImpact(pos, dir, hitPlayer);
  }

  /** Self footstep cadence; `dtMs` is the render frame delta. */
  stepFootSelf(pos: { x: number; y: number; z: number }, dtMs: number, grounded: boolean): void {
    this.vfx.stepFoot("me", pos, dtMs / 1000, grounded, null);
  }

  /** Remote footstep cadence, attenuated by distance to `listenerPos` (the local eye). */
  stepFootRemote(id: string, pos: { x: number; y: number; z: number }, dtMs: number, listenerPos: { x: number; y: number; z: number }, threatGain = 1, grounded = true): void {
    this.vfx.stepFoot(id, pos, dtMs / 1000, grounded, listenerPos, threatGain);
  }

  /** Advance each tracer's travelling segment: `headDist` is how far its leading
   *  edge has moved from `origin` at this tracer's OWN `speed` (WeaponSpec.
   *  tracerSpeed, fixed per-tracer at spawn — see addTracer); the segment is the
   *  [headDist − segLen, headDist] window (clamped to not go behind the muzzle),
   *  so it grows out of the muzzle over the first `segLen / speed` seconds, then
   *  cruises at a constant on-screen length. Brightness stays flat until the
   *  last {@link TRACER_FADE_MS} before the head reaches `dist`, then a short
   *  fade; once it arrives, the tracer is removed outright (no beam left
   *  hanging at the impact point). */
  private updateTracers(now: number): void {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]!;
      const headDist = t.speed * ((now - t.born) / 1000);
      if (headDist >= t.dist) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        if (!this.warmedMaterials.has(t.mat)) t.mat.dispose();
        this.tracers.splice(i, 1);
        continue;
      }
      const tailDist = Math.max(0, headDist - t.segLen);
      const visibleLen = headDist - tailDist;
      const midDist = (headDist + tailDist) / 2;
      t.mesh.position.set(
        t.origin.x + t.dir.x * midDist,
        t.origin.y + t.dir.y * midDist,
        t.origin.z + t.dir.z * midDist,
      );
      t.mesh.scale.z = visibleLen / t.segLen;
      const remainingMs = ((t.dist - headDist) / t.speed) * 1000;
      t.mat.opacity = remainingMs < TRACER_FADE_MS ? t.baseOpacity * (remainingMs / TRACER_FADE_MS) : t.baseOpacity;
    }
  }

  /** Run before input is attached. Compile hidden effect variants and upload their
   * buffers on this renderer, under the loading screen. The same path is measured
   * by the map inspector; loading time is reported separately, never erased. */
  prepare(): Promise<void> {
    return this.preparation ??= this.prepareScene();
  }

  private async prepareScene(): Promise<void> {
    const start = performance.now();
    await Promise.all(this.assetLoads);
    const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await nextFrame(); // let the loading message paint before GPU work
    const rig = this.modelGltf ? this.makeModelRig('__prepare', 0, this.modelGltf) : undefined;
    const bundle = GAME.weaponVis.bundle;
    const weapons = bundle && this.weaponIsModel ? await loadWeaponModel(bundle.url) : undefined;
    const weaponFixture = weapons?.scene.clone();
    if (weaponFixture) {
      if (weapons && bundle) Object.entries(bundle.nodes).forEach(([index, name]) => {
        const template = remoteWeaponTemplate(weapons, name, Number(index));
        if (template) weaponFixture.add(template.object.clone());
      });
      this.scene.add(weaponFixture);
    }
    const oldVisibility = this.canvas.style.visibility;
    this.canvas.style.visibility = 'hidden';
    // Keep the default framebuffer's color-space and sample configuration: a
    // tiny linear render target would warm different material variants.
    const changed: { object: THREE.Object3D; visible: boolean; culled: boolean }[] = [];
    try {
      this.boomNade({ id: '__prepare', x: 0, y: 0, z: 0, r: 5 });
      this.addTracer({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, 10, false, 300);
      this.scene.traverse(object => {
        changed.push({ object, visible: object.visible, culled: object.frustumCulled });
        object.visible = true; object.frustumCulled = false;
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite)
          for (const material of Array.isArray(object.material) ? object.material : [object.material])
            this.warmedMaterials.add(material);
      });
      await this.renderer.compileAsync(this.scene, this.camera);
      this.renderer.render(this.scene, this.camera);
      await nextFrame();
      this.renderer.render(this.scene, this.camera);
      await nextFrame();
    } finally {
      for (const { object, visible, culled } of changed) {
        object.visible = visible; object.frustumCulled = culled;
      }
      if (rig) this.disposeRig(rig);
      weaponFixture?.removeFromParent();
      const now = performance.now();
      this.stepFx(now + 10000); this.updateTracers(now + 10000);
      for (const light of this.blastLights) { light.born = -Infinity; light.light.intensity = 0; }
      this.shakeAmp = 0; this.lastFx = now;
      // The warm pass temporarily made hidden diagnostic geometry visible.
      // Bake the correct static shadow atlas before the first playable frame.
      this.renderer.shadowMap.needsUpdate = true;
      this.renderer.render(this.scene, this.camera);
      await nextFrame();
      this.canvas.style.visibility = oldVisibility;
      this.preparationMs = performance.now() - start;
    }
  }

  getPreparationInfo() { return { constructionMs: this.constructionMs, durationMs: this.preparationMs }; }

  render(): void {
    const now = performance.now();
    this.updateTracers(now);
    this.stepFx(now);
    this.vfx.update(now);
    this.renderer.render(this.scene, this.camera);
  }

  /** Read-only renderer.info snapshot for perf diagnostics/E2E tooling — draw
   *  calls and triangles reset every render() call (three.js's own semantics,
   *  so this is "last frame"), programs accumulate for the renderer's
   *  lifetime (one per unique material/defines combination compiled so far). */
  getEffectInfo() { return { explosions: this.booms.length, tracers: this.tracers.length, blastLights: this.blastLights.length }; }

  inspectConcreteDetail() {
    let meshes = 0, invalidUv = false;
    const textures = new Set<THREE.Texture>();
    this.scene.traverse(node => {
      if (!(node instanceof THREE.Mesh) || !(node.material instanceof THREE.MeshStandardMaterial) ||
          node.material.normalMap?.name !== 'relay-concrete-normal') return;
      meshes++;
      textures.add(node.material.normalMap);
      if (node.material.roughnessMap) textures.add(node.material.roughnessMap);
      const uv = node.geometry.getAttribute('uv2');
      if (!uv || uv.count !== node.geometry.getAttribute('position').count || ![...uv.array].every(Number.isFinite)) invalidUv = true;
    });
    return { meshes, textures: textures.size, invalidUv };
  }

  inspectSiteGround() {
    return this.scene.children.filter((node): node is THREE.Mesh =>
      node instanceof THREE.Mesh && node.userData.siteGround === true).map(node => {
      const bounds = new THREE.Box3().setFromObject(node);
      return { name: node.name, visible: node.visible, min: bounds.min.toArray(), max: bounds.max.toArray(),
        triangles: (node.geometry.index?.count ?? node.geometry.getAttribute('position').count) / 3 };
    });
  }

  inspectRelayUplinks() {
    return this.scene.children.filter(node => node.name === 'relay-uplink').map(node => {
      const box = new THREE.Box3().setFromObject(node);
      let triangles = 0;
      node.traverse(child => { if (child instanceof THREE.Mesh) triangles += (child.geometry.index?.count ?? child.geometry.attributes.position!.count) / 3; });
      return { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray(), triangles };
    });
  }

  getRenderInfo(): { calls: number; triangles: number; programs: number; textures: number; geometries: number } {
    const info = this.renderer.info;
    return { calls: info.render.calls, triangles: info.render.triangles, programs: info.programs?.length ?? 0,
      textures: info.memory.textures, geometries: info.memory.geometries };
  }

  private makeContactShadow(group: THREE.Group): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
    if (!this.contactTexture) {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
      gradient.addColorStop(0, "rgba(0,0,0,0.8)"); gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
      this.contactTexture = new THREE.CanvasTexture(canvas);
    }
    const shadow = new THREE.Mesh(this.contactGeometry, new THREE.MeshBasicMaterial({
      map: this.contactTexture, transparent: true, depthWrite: false, opacity: 0.48,
    }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.018;
    shadow.raycast = () => {}; // cosmetic grounding must never become a hit claim
    group.add(shadow); return shadow;
  }

  /** Offline map review uses the production renderer, with no weapon in the vista. */
  hideViewmodel(): void { this.viewmodel.visible = false; }

  readyForInspection(actorCount: number): boolean {
    return !this.environmentLoading && (actorCount === 0 || (this.modelState === "ready"
      && this.players.size === actorCount && [...this.players.values()].every(p => p.kind === "model" && p.weapon?.loaded)));
  }

  /** Estimate sampled texture residency (RGBA8/half/float + mip levels), including
   * skin matrices and the static shadow target. Driver overhead is not observable. */
  textureBytesEstimate(): number {
    const textures = new Set<THREE.Texture>();
    let depthRenderbufferBytes = 0;
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
          for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
        }
      }
      if (object instanceof THREE.SkinnedMesh && object.skeleton.boneTexture) textures.add(object.skeleton.boneTexture);
      if (object instanceof THREE.DirectionalLight && object.shadow.map) {
        textures.add(object.shadow.map.texture);
        if (object.shadow.map.depthTexture) textures.add(object.shadow.map.depthTexture);
        else if (object.shadow.map.depthBuffer) depthRenderbufferBytes += object.shadow.map.width * object.shadow.map.height * 4;
      }
    });
    if (this.scene.environment) textures.add(this.scene.environment);
    let bytes = depthRenderbufferBytes;
    for (const texture of textures) {
      const img = texture.image as { width?: number; height?: number } | undefined;
      const channels = texture.format === THREE.RedFormat || texture.format === THREE.DepthFormat || texture.format === THREE.DepthStencilFormat ? 1 : 4;
      const component = [THREE.FloatType, THREE.UnsignedIntType, THREE.UnsignedInt248Type, THREE.IntType].includes(texture.type as typeof THREE.FloatType)
        ? 4 : texture.type === THREE.HalfFloatType || texture.type === THREE.UnsignedShortType ? 2 : 1;
      bytes += (img?.width ?? 0) * (img?.height ?? 0) * channels * component * (texture.generateMipmaps ? 4 / 3 : 1);
    }
    return Math.ceil(bytes);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, VIS.pixelRatio));
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Colors the player GLB for its team. A mesh with NO texture map (the original
 *  shape-only UniRig asset) gets a fresh flat team-tinted MeshStandardMaterial.
 *  A mesh that DOES carry a texture map (the KayKit-based asset's authored look)
 *  gets a per-instance clone of its own material with `color` set to the team
 *  tint — `material.color` multiplies the diffuse map in three.js, so this
 *  colors the texture instead of replacing it, preserving the authored detail. */
function applyTeamTint(object: THREE.Object3D, color: number): void {
  const tint = new THREE.Color(color);
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const tintOne = (m: THREE.Material): THREE.Material => {
      if ((m as { map?: unknown }).map instanceof THREE.Texture) {
        const clone = m.clone();
        (clone as THREE.MeshStandardMaterial).color.set(tint);
        return clone;
      }
      return new THREE.MeshStandardMaterial({ color: tint, roughness: 0.7, metalness: 0.05 });
    };
    node.material = Array.isArray(node.material) ? node.material.map(tintOne) : tintOne(node.material);
  });
}

// --- per-weapon procedural viewmodels -----------------------------------------

const VM_METAL = new THREE.MeshStandardMaterial({ color: PALETTE.viewmodel.metal, roughness: 0.55, metalness: 0.4 });
const VM_ACCENT = new THREE.MeshStandardMaterial({ color: PALETTE.viewmodel.accent, roughness: 0.45, metalness: 0.55 });
const VM_DARK = new THREE.MeshStandardMaterial({ color: PALETTE.viewmodel.dark, roughness: 0.6, metalness: 0.35 });
// Shared across every cloned weapon GLB (untextured, single mesh each) — a dark
// body with a subtle cyan glow, not a base color; overpoweringly bright emissive
// (tried during tuning) reads as "all cyan", not "dark gun with an accent".
const VM_MODEL_MATERIAL = new THREE.MeshStandardMaterial({
  color: PALETTE.viewmodel.dark,
  roughness: 0.45,
  metalness: 0.55,
  emissive: PALETTE.viewmodel.modelEmissive,
  emissiveIntensity: 0.1,
});

/** Build the blocky low-poly mesh for a weapon slot (0 AR · 1 SMG · 2 Shotgun · 3 Sniper · 4 Pistol). */
function buildWeaponMesh(index: number): THREE.Group {
  const g = new THREE.Group();
  g.name = "weapon-mesh";
  const part = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
  };
  switch (index) {
    case 1: // SMG — stubby barrel, fat receiver, vertical foregrip
      part(0.1, 0.12, 0.34, 0, 0, -0.08, VM_METAL);
      part(0.05, 0.05, 0.18, 0, 0.02, -0.34, VM_ACCENT);
      part(0.07, 0.16, 0.07, 0, -0.14, -0.02, VM_ACCENT); // magazine
      part(0.05, 0.14, 0.05, 0, -0.13, -0.24, VM_DARK); // foregrip
      part(0.06, 0.07, 0.14, 0, -0.01, 0.16, VM_METAL); // folded stock
      break;
    case 2: // Shotgun — thick long tube barrel + pump
      part(0.11, 0.13, 0.42, 0, 0, -0.12, VM_DARK);
      part(0.08, 0.08, 0.5, 0, 0.02, -0.5, VM_METAL); // fat barrel
      part(0.07, 0.07, 0.5, 0, -0.07, -0.5, VM_ACCENT); // tube mag
      part(0.09, 0.09, 0.16, 0, -0.07, -0.42, VM_DARK); // pump
      part(0.08, 0.1, 0.24, 0, -0.03, 0.22, VM_DARK); // stock
      break;
    case 3: // Sniper — long barrel + big scope cylinder + bipod nub
      part(0.09, 0.12, 0.5, 0, 0, -0.1, VM_METAL);
      part(0.045, 0.045, 0.75, 0, 0.02, -0.68, VM_ACCENT); // long barrel
      {
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 12), VM_DARK);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.1, -0.12);
        g.add(scope);
      }
      part(0.08, 0.18, 0.09, 0, -0.15, 0.0, VM_ACCENT); // magazine
      part(0.07, 0.1, 0.26, 0, -0.02, 0.26, VM_METAL); // stock
      break;
    case 4: // Pistol — compact slide + grip
      part(0.07, 0.09, 0.24, 0, 0, -0.06, VM_METAL);
      part(0.05, 0.04, 0.1, 0, 0.035, -0.2, VM_ACCENT); // slide nose
      part(0.06, 0.16, 0.08, 0, -0.11, 0.04, VM_DARK); // grip
      break;
    default: // AR — receiver, barrel, magazine, stock, front sight
      part(0.09, 0.12, 0.5, 0, 0, -0.15, VM_METAL);
      part(0.05, 0.05, 0.42, 0, 0.02, -0.5, VM_ACCENT);
      part(0.08, 0.2, 0.1, 0, -0.16, -0.05, VM_ACCENT);
      part(0.07, 0.09, 0.22, 0, -0.02, 0.22, VM_METAL);
      part(0.03, 0.06, 0.03, 0, 0.09, -0.28, VM_ACCENT);
  }
  return g;
}

function makeGridTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = "rgba(90,120,160,0.26)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
