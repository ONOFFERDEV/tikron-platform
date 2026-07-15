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
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { nearestBox, type Box } from "../src/physics.js";
import type { MapDef } from "../src/map/types.js";
import { ARENA, PLAYER } from "../src/config.js";
import { Vfx } from "./vfx.js";
import { GAME } from "../src/game-config.js";
import { loadPlayerModel, clonePlayerRig, type PlayerRigModel, type LocomotionState } from "./rig-loader.js";
import { loadWeaponModel, cloneWeaponMesh } from "./weapon-loader.js";
import { loadMapDressing } from "./dressing-loader.js";
import arena1Manifest from "./dressing/arena1.manifest.json";
import arena2Manifest from "./dressing/arena2.manifest.json";

const PALETTE = GAME.palette;
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
const TEAM_COLOR = GAME.teams.colors;

const EYE_UP = new THREE.Vector3(0, 1, 0);
const FWD_Z = new THREE.Vector3(0, 0, 1);
// Tracer = a short segment travelling from the muzzle to the impact point (not a
// static beam) — see addTracer/updateTracers.
const TRACER_SPEED = 300; // world units/sec the visible segment travels at
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
}

/**
 * Empirically-tuned per-weapon-slot scale/position/muzzle-tip offsets for the
 * cyber-trooper viewmodel GLBs (weaponVis.models — index matches WEAPONS'
 * AR/SMG/Shotgun/Sniper/Pistol order).
 *
 * The rotation direction was independently re-verified after a review flagged
 * the rendered weapons as looking backwards: rendering each raw GLB's two Z
 * extremes close-up (looking straight down the bore) shows a clear circular
 * muzzle opening at local +Z and a smooth, closed stock/butt face at local
 * -Z, for every one of the 5 assets — confirming +Z really is the muzzle, so
 * the shared `rotation.y = Math.PI` flip (this viewmodel's own forward is -Z)
 * is correct and untouched. The actual defect was `posZ`: the original values
 * placed each model's near (stock) end only ~0.05-0.1 units from the camera —
 * close enough to the near-clip plane to produce a heavily distorted,
 * unrecognizable close-up blob that read as "wrong orientation" even though
 * the rotation itself was fine. Reset here so every weapon's near point sits
 * ~0.3 units out (matching the procedural weapons' own depth), and `muzzleZ`
 * re-derived from each model's own measured bounding box at that new depth
 * (not guessed) so the muzzle flash/tracer origin still lands on the visible
 * barrel tip. A reported ~45° pistol grip tilt did not reproduce in this or
 * the original pass, at any scale/rotation tried — flagged, not "fixed",
 * since it was never observed here.
 */
const VM_WEAPON_TRANSFORMS: Record<number, WeaponVmTransform> = {
  0: { scale: 0.4, posZ: -0.196, muzzleZ: -0.603 }, // AR
  1: { scale: 0.35, posZ: -0.119, muzzleZ: -0.513 }, // SMG
  2: { scale: 0.42, posZ: -0.204, muzzleZ: -0.65 }, // Shotgun
  3: { scale: 0.45, posZ: -0.167, muzzleZ: -0.715 }, // Sniper
  4: { scale: 0.3, posZ: -0.117, muzzleZ: -0.486 }, // Pistol
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
const DEATH_HOLD_MS = 1200;

interface NadeFx {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
}

interface BoomFx {
  light: THREE.PointLight;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  parts: THREE.Mesh[];
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
}

/** A remote player's rig: either the original capsule+head primitives, or (once
 *  the player GLB is loaded) an animated model clone. `kind` discriminates which
 *  fields below are populated — see {@link SceneRig.makeRig}. */
interface PlayerRig {
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
  /** performance.now() deadline until which a hit_chest/hit_head one-shot is
   *  still playing — syncModelRig skips its own locomotion setState() call
   *  until this passes; undefined when no hit reaction is in progress. */
  hitReactionUntil?: number;
  prevX?: number;
  prevZ?: number;
  /** Local Y (relative to `group`, i.e. relative to the feet) of the head/eye
   *  anchor point, refreshed each sync — kept uniform across both kinds so
   *  {@link SceneRig.getRemoteMuzzleAnchor} doesn't need to know which one it has. */
  headY?: number;
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
}

export class SceneRig {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly boxes: readonly Box[];
  private readonly players = new Map<string, PlayerRig>();
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

  // Viewmodel + its animated offsets.
  private readonly viewmodel = new THREE.Group();
  private readonly weaponHolder = new THREE.Group();
  // Whether weaponHolder's current child is a cloned GLB (shared/cached geometry
  // + material, never disposed) or a procedural buildWeaponMesh() (fresh
  // BoxGeometry per call, must be disposed) — see setWeaponVisual/disposeCurrentWeaponMesh.
  private weaponIsModel = false;
  private readonly muzzle: THREE.Mesh;
  private readonly muzzleLight: THREE.PointLight;
  private muzzleFiredAt = -1e9;
  private bobPhase = 0;
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
  private fovCur = HIP_FOV;
  private scopeEl: HTMLDivElement | null = null;
  // Grenade + explosion effects, stepped in render().
  private readonly nades = new Map<string, NadeFx>();
  private readonly booms: BoomFx[] = [];
  private shakeAmp = 0;
  private lastFx = performance.now();
  private readonly vfx: Vfx;
  private readonly muzzleWorldScratch = new THREE.Vector3(); // reused by getSelfMuzzlePos, one per call not per frame

  constructor(map: MapDef, container: HTMLElement = document.body) {
    this.boxes = map.boxes;
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene.background = new THREE.Color(PALETTE.sceneBg);
    this.scene.fog = new THREE.Fog(PALETTE.fog.color, PALETTE.fog.near, PALETTE.fog.far);

    this.camera = new THREE.PerspectiveCamera(HIP_FOV, 1, GAME.camera.near, GAME.camera.far);

    this.scene.add(new THREE.HemisphereLight(PALETTE.lights.hemiSky, PALETTE.lights.hemiGround, 1.5));
    const key = new THREE.DirectionalLight(PALETTE.lights.key, 2.4);
    key.position.set(25, 45, 15);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(PALETTE.lights.ambient, 0.9));

    this.vfx = new Vfx(this.scene);
    this.buildArena();

    const vm = this.buildViewmodel();
    this.viewmodel.add(vm.group);
    this.muzzle = vm.muzzle;
    this.muzzleLight = vm.light;
    this.camera.add(this.viewmodel);
    this.scene.add(this.camera); // camera must be in the graph for its viewmodel child to render
    this.setWeaponVisual(0);

    const modelUrl = GAME.models?.player;
    if (modelUrl) {
      this.modelState = "loading";
      loadPlayerModel(modelUrl).then((gltf) => {
        this.modelGltf = gltf;
        this.modelState = gltf ? "ready" : "absent";
        // Bots/players already exist server-side from the room's first broadcast,
        // so the client's very first syncPlayers() call (same frame the scene is
        // constructed) almost always creates their rigs BEFORE this async load can
        // possibly finish — confirmed live: every rig came up capsule-only even
        // seconds after the model had already loaded. Upgrade any rig that was
        // built as a capsule for exactly that reason, now that the model is ready.
        if (gltf) this.upgradeCapsuleRigs();
      });
    }

    // Map dressing: `map`'s id ("arena1"/"arena2") isn't on MapDef itself
    // (src/map/*.ts is collision-only, untouched by this feature) — recovered
    // by matching object identity against GAME.maps, which is keyed by exactly
    // those ids and holds the same ARENA1/ARENA2 references mapForMode returns.
    const mapId = Object.keys(GAME.maps).find((k) => GAME.maps[k] === map);
    const dressingUrl = mapId ? GAME.mapDressing?.[mapId] : undefined;
    if (dressingUrl) {
      loadMapDressing(dressingUrl).then((gltf) => {
        if (!gltf) return; // load failed — stay on the procedural box/wall render permanently
        this.scene.add(gltf.scene);
        const hidden = mapId ? DRESSING_MANIFESTS[mapId]?.hiddenBoxIndices : undefined;
        for (const idx of hidden ?? []) {
          const render = this.boxRenders.get(idx);
          if (!render) continue;
          render.mesh.visible = false;
          render.edges.visible = false;
        }
      });
    }

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  // --- arena ------------------------------------------------------------------

  private buildArena(): void {
    const { width, depth } = ARENA;

    // Floor with a faint low-contrast grid (a high-contrast tiled grid shimmers).
    const floorTex = makeGridTexture();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(width / 2, depth / 2);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ map: floorTex, color: PALETTE.floor, roughness: 1, metalness: 0 }),
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
    const wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.walls, roughness: 1 });
    const wallH = 3;
    const wall = (w: number, d: number, x: number, z: number): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      m.position.set(x, wallH / 2, z);
      this.scene.add(m);
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
    const edgeMat = new THREE.LineBasicMaterial({ color: PALETTE.coverEdge });
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
  }

  // --- viewmodel --------------------------------------------------------------

  private buildViewmodel(): { group: THREE.Group; muzzle: THREE.Mesh; light: THREE.PointLight } {
    const g = new THREE.Group();
    g.add(this.weaponHolder); // the per-weapon mesh is swapped inside this holder

    const muzzle = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: PALETTE.muzzle, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    muzzle.position.set(0, 0.02, -0.74);
    g.add(muzzle);

    const light = new THREE.PointLight(PALETTE.muzzleLight, 0, 6, 2);
    light.position.set(0, 0.02, -0.74);
    g.add(light);

    // Rest pose: lower-right of the view. rotation.y is turned in enough to
    // show a classic FPS 3/4 view of the barrel's length rather than looking
    // nearly straight down it — verified by sweeping candidates with the real
    // camera/viewmodel hierarchy: -0.05 (and more negative) foreshortens the
    // GLB weapons' long barrels away to almost nothing (an AR reads as a
    // pistol from behind), while +0.35 reveals the barrel clearly toward the
    // crosshair for all 5 GLB weapons AND keeps the procedural boxes reading
    // the same as before (checked side by side).
    g.position.set(0.22, -0.2, -0.5);
    g.rotation.y = 0.35;
    return { group: g, muzzle, light };
  }

  /** Kick the viewmodel on a confirmed local shot; strength scales by weapon. */
  fireRecoil(weaponIndex = this.weaponIndex): void {
    this.recoil = Math.min(1, this.recoil + (VM_RECOIL[weaponIndex] ?? 0.4));
    this.muzzleFiredAt = performance.now();
    (this.muzzle.material as THREE.MeshBasicMaterial).opacity = 0.9;
    this.muzzle.rotation.z = Math.random() * Math.PI;
    this.muzzleLight.intensity = 3;
  }

  /** Start the lower→swap→raise animation toward `index` (no-op if already held/pending). */
  setWeapon(index: number): void {
    if (index === this.weaponIndex && this.pendingWeapon < 0) return;
    if (index === this.pendingWeapon) return;
    this.pendingWeapon = index;
    this.swapT = performance.now();
  }

  /** Shows `index`'s viewmodel: builds the procedural mesh immediately (so the
   *  holder is never empty, and it's the permanent result if no model is
   *  configured or its load fails), then swaps in the GLB — with its own
   *  scale/position/muzzle-tip offset from VM_WEAPON_TRANSFORMS — once loaded.
   *  Guards against a stale load resolving after the player has since switched
   *  to a different weapon. */
  private setWeaponVisual(index: number): void {
    this.disposeCurrentWeaponMesh();
    this.weaponHolder.add(buildWeaponMesh(index));
    this.weaponIsModel = false;
    this.muzzle.position.set(0, 0.02, MUZZLE_Z_DEFAULT);
    this.muzzleLight.position.set(0, 0.02, MUZZLE_Z_DEFAULT);

    const url = GAME.weaponVis.models?.[index];
    const transform = VM_WEAPON_TRANSFORMS[index];
    if (!url || !transform) return;
    loadWeaponModel(url).then((gltf) => {
      if (!gltf) return; // load failed — weapon-loader already warned once, stay procedural
      if (this.weaponIndex !== index) return; // player swapped away again before this resolved

      this.disposeCurrentWeaponMesh();
      const obj = cloneWeaponMesh(gltf);
      obj.scale.setScalar(transform.scale);
      obj.rotation.y = Math.PI; // this asset family's +Z-is-muzzle -> this viewmodel's -Z-is-forward
      obj.position.set(0, 0, transform.posZ);
      obj.traverse((n) => {
        if (n instanceof THREE.Mesh) n.material = VM_MODEL_MATERIAL;
      });
      this.weaponHolder.add(obj);
      this.weaponIsModel = true;
      this.muzzle.position.set(0, 0.02, transform.muzzleZ);
      this.muzzleLight.position.set(0, 0.02, transform.muzzleZ);
    });
  }

  /** Empties weaponHolder. A model mesh's geometry/material are shared/cached
   *  (SkeletonUtils-free `Object3D#clone()` in weapon-loader.ts) and must never
   *  be disposed here; only the procedural mesh's fresh-per-call BoxGeometry is. */
  private disposeCurrentWeaponMesh(): void {
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
  setAds(held: boolean): void {
    this.adsHeld = held;
  }

  /** Camera FOV this frame (main uses it to scale mouse sensitivity while zoomed). */
  get currentFov(): number {
    return this.fovCur;
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
    const light = new THREE.PointLight(PALETTE.boom.light, 60, e.r * 4, 2);
    light.position.set(e.x, e.y + 0.3, e.z);
    this.scene.add(light);
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
    const parts: THREE.Mesh[] = [];
    const vels: THREE.Vector3[] = [];
    for (let i = 0; i < 18; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), partMat);
      p.position.set(e.x, e.y + 0.2, e.z);
      const a = (i / 18) * Math.PI * 2;
      vels.push(new THREE.Vector3(Math.cos(a) * (3 + Math.random() * 5), 4 + Math.random() * 6, Math.sin(a) * (3 + Math.random() * 5)));
      this.scene.add(p);
      parts.push(p);
    }
    this.booms.push({ light, ring, ringMat, parts, vels, partMat, born: performance.now() });
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
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i]!;
      const t01 = (now - b.born) / BOOM_LIFE_MS;
      if (t01 >= 1) {
        this.scene.remove(b.light, b.ring);
        for (const p of b.parts) { this.scene.remove(p); p.geometry.dispose(); }
        b.ring.geometry.dispose();
        b.ringMat.dispose();
        b.partMat.dispose();
        this.booms.splice(i, 1);
        continue;
      }
      b.light.intensity = 60 * (1 - t01);
      const s = 1 + t01 * 14;
      b.ring.scale.set(s, s, 1);
      b.ringMat.opacity = 0.9 * (1 - t01);
      b.partMat.opacity = 1 - t01;
      for (const [j, p] of b.parts.entries()) {
        const v = b.vels[j]!;
        v.y += NADE_GRAVITY * 0.6 * dt;
        p.position.addScaledVector(v, dt);
      }
    }
    this.shakeAmp *= Math.exp(-dt * 6);
  }

  /**
   * Animate the viewmodel: bob from movement, sway lagging the look delta, and the
   * decaying recoil kick. `speed01` is 0..1 horizontal speed, `dLook` the yaw+pitch
   * delta this frame (for sway).
   */
  updateViewmodel(dtMs: number, speed01: number, dYaw: number, dPitch: number, grounded: boolean): void {
    const dt = dtMs / 1000;
    const now = performance.now();
    this.bobPhase += dt * (6 + speed01 * 8) * (grounded ? 1 : 0.2);
    const bobAmt = speed01 * 0.02 * (1 - this.adsT * 0.8); // ADS steadies the bob
    const bx = Math.cos(this.bobPhase) * bobAmt;
    const by = Math.abs(Math.sin(this.bobPhase)) * bobAmt;

    // Sway eases toward an offset proportional to the look delta, then relaxes.
    this.swayX += (-dYaw * 0.35 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (dPitch * 0.35 - this.swayY) * Math.min(1, dt * 10);
    this.swayX = clamp(this.swayX, -0.06, 0.06);
    this.swayY = clamp(this.swayY, -0.06, 0.06);

    // Weapon swap: dip the holder, replace the mesh at the bottom, raise back up.
    let swapDip = 0;
    if (this.pendingWeapon >= 0) {
      const t = now - this.swapT;
      if (t < SWAP_DOWN_MS) {
        swapDip = t / SWAP_DOWN_MS;
      } else {
        if (this.weaponIndex !== this.pendingWeapon) {
          this.weaponIndex = this.pendingWeapon;
          this.setWeaponVisual(this.weaponIndex);
        }
        const up = (t - SWAP_DOWN_MS) / SWAP_UP_MS;
        swapDip = Math.max(0, 1 - up);
        if (up >= 1) this.pendingWeapon = -1;
      }
    }

    // ADS: ease adsT, drive FOV + centering; sniper hides the gun behind a scope overlay.
    this.adsT += ((this.adsHeld ? 1 : 0) - this.adsT) * Math.min(1, dt * 14);
    const targetFov = this.adsHeld ? (ADS_FOV[this.weaponIndex] ?? HIP_FOV) : HIP_FOV;
    if (Math.abs(targetFov - this.fovCur) > 0.05) {
      this.fovCur += (targetFov - this.fovCur) * Math.min(1, dt * 14);
      this.camera.fov = this.fovCur;
      this.camera.updateProjectionMatrix();
    }
    const scoped = this.weaponIndex === 3 && this.adsT > 0.7;
    this.viewmodel.visible = !scoped;
    this.toggleScope(scoped);

    this.recoil *= Math.exp(-dtMs / 70);
    const kick = this.recoil;
    const ads = this.adsT;
    const rx = lerp(0.22, 0.0, ads);
    const ry = lerp(-0.2, -0.152, ads);
    const rz = lerp(-0.5, -0.42, ads);
    this.viewmodel.position.set(
      rx + (bx + this.swayX) * (1 - ads * 0.7),
      ry + (by + this.swayY) * (1 - ads * 0.7) - kick * 0.02 - swapDip * 0.35,
      rz + kick * 0.08,
    );
    this.viewmodel.rotation.x = kick * 0.25 - swapDip * 0.9;
    this.viewmodel.rotation.y = -0.05 * (1 - ads) + this.swayX * 0.5;

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
    const sx = this.shakeAmp > 0.002 ? (Math.random() - 0.5) * this.shakeAmp * 0.12 : 0;
    const sy = this.shakeAmp > 0.002 ? (Math.random() - 0.5) * this.shakeAmp * 0.12 : 0;
    this.camera.position.set(eye.x + sx, eye.y + sy, eye.z);
    const cp = Math.cos(pitch);
    this.camera.up.copy(EYE_UP);
    this.camera.lookAt(eye.x + Math.sin(yaw) * cp + sx, eye.y + Math.sin(pitch) + sy, eye.z + Math.cos(yaw) * cp);
  }

  // --- players ----------------------------------------------------------------

  /** Sync the remote-player rigs to `poses` (keyed by id); `selfId` is never drawn.
   *  `dtMs` is the render frame delta (main.ts's own `dt`) — used to derive each
   *  model rig's locomotion state from consecutive poses and to step its mixer. */
  syncPlayers(poses: Map<string, PlayerPose>, selfId: string, dtMs: number): void {
    const now = performance.now();
    const seen = new Set<string>();
    for (const [id, pose] of poses) {
      if (id === selfId) continue;
      seen.add(id);
      let rig = this.players.get(id);
      if (!rig || rig.team !== pose.team) {
        if (rig) this.disposeRig(rig);
        rig = this.makeRig(pose.team);
        this.players.set(id, rig);
      }
      if (rig.kind === "model") this.syncModelRig(rig, pose, dtMs, now);
      else this.syncCapsuleRig(rig, pose);
    }
    for (const [id, rig] of [...this.players]) {
      if (!seen.has(id)) {
        this.disposeRig(rig);
        this.players.delete(id);
      }
    }
  }

  /** Plays a one-shot hit-reaction clip on remote player `id` — headshot uses
   *  "hit_head" if the GLB has it, else falls back to "hit_chest" same as a body
   *  hit; a true no-op (unchanged behavior) if the rig has neither clip (capsule
   *  fallback, or an older/backup GLB without them) — see rig-loader.ts's
   *  hasHitChestClip/hasHitHeadClip. Never called for the local player (main.ts
   *  guards `e.from`/`h.id !== net.myId`) since first-person has no body model. */
  playHitReaction(id: string, headshot: boolean): void {
    const rig = this.players.get(id);
    if (!rig || rig.kind !== "model") return;
    const model = rig.model!;
    const state: LocomotionState | undefined =
      headshot && model.hasHitHeadClip ? "hit_head" : model.hasHitChestClip ? "hit_chest" : undefined;
    if (!state) return;
    model.setState(state);
    const dur = (state === "hit_head" ? model.hitHeadDuration : model.hitChestDuration) ?? 0;
    rig.hitReactionUntil = performance.now() + dur * 1000;
  }

  private syncCapsuleRig(rig: PlayerRig, pose: PlayerPose): void {
    rig.group.visible = pose.alive;
    if (!pose.alive) return;
    const stance = pose.crouch ? PLAYER.crouchHeight / PLAYER.standHeight : 1;
    const h = pose.crouch ? PLAYER.crouchHeight : PLAYER.standHeight;
    rig.body!.scale.y = stance;
    rig.body!.position.y = h / 2;
    rig.head!.position.y = h - PLAYER.headRadius;
    rig.headY = rig.head!.position.y;
    rig.group.position.set(pose.x, pose.y, pose.z);
    // (capsule + head sphere are radially symmetric, so yaw needs no cosmetic rotation)
  }

  private syncModelRig(rig: PlayerRig, pose: PlayerPose, dtMs: number, now: number): void {
    const model = rig.model!;
    const wasAlive = rig.aliveWas ?? true;
    rig.aliveWas = pose.alive;

    if (!pose.alive) {
      if (wasAlive) {
        // Death edge: play the clip once, hold the rig visible for the shorter of
        // the clip's own length or DEATH_HOLD_MS, then hide it. Death always wins
        // over a hit reaction in progress — setState("death") below crossfades
        // away from it unconditionally (no reacting/interrupt check needed here).
        model.setState("death");
        const clipMs = (model.deathDuration ?? DEATH_HOLD_MS / 1000) * 1000;
        rig.deadHoldUntil = now + Math.min(DEATH_HOLD_MS, clipMs);
        rig.hitReactionUntil = undefined;
      }
      const holding = rig.deadHoldUntil !== undefined && now < rig.deadHoldUntil;
      rig.group.visible = holding;
      if (holding) model.update(dtMs / 1000);
      return;
    }

    rig.group.visible = true;
    if (!wasAlive) {
      // Respawn edge: snap back to idle and re-anchor the speed sample so the
      // teleport-to-spawn jump isn't read as an instantaneous sprint next frame.
      model.forceIdle();
      rig.deadHoldUntil = undefined;
      rig.hitReactionUntil = undefined;
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
    rig.headY = (pose.crouch ? PLAYER.crouchHeight : PLAYER.standHeight) - PLAYER.headRadius;

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
    // A hit_chest/hit_head one-shot in progress pushes locomotion selection aside
    // until its own duration elapses (playHitReaction sets this deadline) — at
    // which point setState(locomotion) resumes into whatever's CURRENT (not
    // whatever it was interrupted from), matching pose/speed same as any other frame.
    if (rig.hitReactionUntil === undefined || now >= rig.hitReactionUntil) {
      rig.hitReactionUntil = undefined;
      model.setState(locomotion);
    }
    model.update(dtSec);
  }

  private makeRig(team: number): PlayerRig {
    if (this.modelState === "ready" && this.modelGltf) return this.makeModelRig(team, this.modelGltf);
    return this.makeCapsuleRig(team);
  }

  /** Runs once, right after the player model finishes loading: swaps every
   *  currently-tracked capsule rig for a model rig of the same team, in place.
   *  Positions/pose are re-applied by the very next syncPlayers() tick, same as
   *  any newly-created rig — nothing special needs to happen here beyond the swap. */
  private upgradeCapsuleRigs(): void {
    for (const [id, rig] of this.players) {
      if (rig.kind !== "capsule") continue;
      this.disposeRig(rig);
      this.players.set(id, this.makeModelRig(rig.team, this.modelGltf!));
    }
  }

  private makeCapsuleRig(team: number): PlayerRig {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: TEAM_COLOR[team] ?? 0xaaaaaa, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER.radius, CAP_LEN, 4, 10), mat);
    body.position.y = PLAYER.standHeight / 2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(PLAYER.headRadius, 12, 10), mat);
    head.position.y = PLAYER.standHeight - PLAYER.headRadius;
    group.add(body);
    group.add(head);
    this.scene.add(group);
    return { group, team, kind: "capsule", body, head };
  }

  private makeModelRig(team: number, gltf: GLTF): PlayerRig {
    const group = new THREE.Group();
    const model = clonePlayerRig(gltf);
    const object = model.object;

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
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });
    applyTeamTint(object, TEAM_COLOR[team] ?? 0xaaaaaa);

    group.add(object);
    this.scene.add(group);
    return {
      group,
      team,
      kind: "model",
      modelRoot: object,
      model,
      baseScale,
      localMinY: box.min.y,
      aliveWas: true,
    };
  }

  private disposeRig(rig: PlayerRig): void {
    this.scene.remove(rig.group);
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
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else (m as THREE.Material).dispose();
    });
  }

  // --- tracers ----------------------------------------------------------------

  /** Spawn a tracer that TRAVELS from `origin` to `origin + dir*dist` at
   *  {@link TRACER_SPEED} (a moving segment, not a static beam) — see
   *  {@link updateTracers}, which owns the per-frame position/opacity. */
  addTracer(origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, dist: number, hit: boolean): void {
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
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, segLen), mat);
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
    });
  }

  // --- VFX/SFX polish (remote flashes, casings, impacts, footsteps) -------------
  // Thin wiring only — `vfx.ts` owns the pools and per-frame aging.

  /** Distance to the first map box the ray enters within `maxT`, or `maxT` itself
   *  if none (a pure client-side wall stop — used by main.ts to give a
   *  self-authoritative tracer a plausible endpoint without server round-trip). */
  wallDistance(origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, maxT: number): number {
    return Math.min(maxT, nearestBox(origin, dir, this.boxes, maxT));
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

  /** The currently-rendered world position of a remote player's rig, near eye
   *  height (feet + the head mesh's local Y, which already accounts for crouch) —
   *  used to anchor their muzzle flash/casing/tracer start to where they visually
   *  are, since the wire shot origin is stale by their RTT plus our own render
   *  interpolation delay. `undefined` if the rig isn't tracked (e.g. just left). */
  getRemoteMuzzleAnchor(id: string): { x: number; y: number; z: number } | undefined {
    const rig = this.players.get(id);
    if (!rig) return undefined;
    return { x: rig.group.position.x, y: rig.group.position.y + (rig.headY ?? 0), z: rig.group.position.z };
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
  stepFootRemote(id: string, pos: { x: number; y: number; z: number }, dtMs: number, listenerPos: { x: number; y: number; z: number }): void {
    this.vfx.stepFoot(id, pos, dtMs / 1000, true, listenerPos);
  }

  /** Advance each tracer's travelling segment: `headDist` is how far its leading
   *  edge has moved from `origin` at {@link TRACER_SPEED}; the segment is the
   *  [headDist − segLen, headDist] window (clamped to not go behind the muzzle),
   *  so it grows out of the muzzle over the first `segLen / TRACER_SPEED`
   *  seconds, then cruises at a constant on-screen length. Brightness stays flat
   *  until the last {@link TRACER_FADE_MS} before the head reaches `dist`, then a
   *  short fade; once it arrives, the tracer is removed outright (no beam left
   *  hanging at the impact point). */
  private updateTracers(now: number): void {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]!;
      const headDist = TRACER_SPEED * ((now - t.born) / 1000);
      if (headDist >= t.dist) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mat.dispose();
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
      const remainingMs = ((t.dist - headDist) / TRACER_SPEED) * 1000;
      t.mat.opacity = remainingMs < TRACER_FADE_MS ? t.baseOpacity * (remainingMs / TRACER_FADE_MS) : t.baseOpacity;
    }
  }

  render(): void {
    const now = performance.now();
    this.updateTracers(now);
    this.stepFx(now);
    this.vfx.update(now);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
  ctx.strokeStyle = "rgba(150,170,200,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
