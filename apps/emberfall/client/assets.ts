/**
 * AssetRegistry — the heart of the swap system (PLAN-EMBERFALL.md §6.1).
 *
 * Loads `/assets/manifest.json`, then resolves each logical id
 * (`getUnitVisual`) to either a lazily-loaded, cached GLB driven by an
 * `AnimationMixer`, or a code-built procedural primitive with code-driven
 * tween animation. Both paths implement the same {@link AnimController}
 * interface and are returned behind the same {@link UnitVisual} shape, so
 * callers (units.ts) never know or care which one they got — swapping a
 * manifest entry from `primitive` to `model` requires no caller changes.
 *
 * If a GLB is missing, unlisted, or fails to fetch/parse, the registry never
 * rejects — it logs a warning and falls back to the procedural primitive.
 * The game is fully playable with zero downloaded assets.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  parseManifest,
  resolveFallbackPrimitive,
  resolveVisualSource,
  type AnimState,
  type IdleMotion,
  type Manifest,
  type ManifestEntry,
  type ManifestParseResult,
  type PrimitiveKind,
  type ResolvedSource,
} from "./manifest.js";

export {
  parseManifest,
  resolveFallbackPrimitive,
  resolveVisualSource,
  type AnimState,
  type IdleMotion,
  type Manifest,
  type ManifestEntry,
  type ManifestParseResult,
  type PrimitiveKind,
  type ResolvedSource,
};

/** Drives a unit's animation state machine, regardless of visual source. */
export interface AnimController {
  setState(state: AnimState): void;
  update(dt: number): void;
  /** Explicitly reverses a terminal "death" state on unit revival. `setState` alone can't
   *  do this — death is intentionally terminal there, so a stray idle/walk sync received
   *  while still dead never overwrites the death pose. Only this call may unlock it. */
  revive(): void;
}

/** Model-source-agnostic result: a scene-ready object plus its animation controller. */
export interface UnitVisual {
  object: THREE.Object3D;
  anim: AnimController;
  /** See {@link ManifestEntry.faceOffset}. Defaults to 0. */
  faceOffset: number;
}

const DEFAULT_MANIFEST_URL = "/assets/manifest.json";

export class AssetRegistry {
  private manifest: Manifest = {};
  private readonly loader = new GLTFLoader();
  private readonly gltfCache = new Map<string, Promise<GLTF>>();

  constructor(private readonly manifestUrl: string = DEFAULT_MANIFEST_URL) {}

  /** Fetches and validates the manifest. Malformed entries are dropped with a console warning, never thrown. */
  async load(): Promise<void> {
    const res = await fetch(this.manifestUrl);
    if (!res.ok) throw new Error(`failed to fetch ${this.manifestUrl}: ${res.status} ${res.statusText}`);
    const raw: unknown = await res.json();
    const { manifest, errors } = parseManifest(raw);
    for (const err of errors) console.warn(`[assets] manifest: ${err}`);
    this.manifest = manifest;
  }

  /**
   * Resolves a unit's visual: a cached/lazy-loaded GLB with an anim state
   * machine, or a tinted procedural fallback. Never rejects.
   */
  async getUnitVisual(logicalId: string): Promise<UnitVisual> {
    const source = resolveVisualSource(this.manifest, logicalId);
    if (source.kind === "model") {
      try {
        const [gltf, ...animGltfs] = await Promise.all([
          this.loadModel(source.path),
          ...source.animSources.map((path) => this.loadModel(path)),
        ]);
        // Clips from animSource GLBs (e.g. a shared KayKit rig) are appended
        // after the model's own clips; AnimationMixer binds by node name, so
        // they drive the model as long as bone names match.
        const clips = [...gltf.animations, ...animGltfs.flatMap((g) => g.animations)];
        return buildModelVisual(gltf, clips, source);
      } catch (err) {
        console.warn(`[assets] "${logicalId}" model load failed (${source.path}), using procedural fallback`, err);
      }
    }
    const primitive = source.kind === "primitive" ? source : resolveFallbackPrimitive(this.manifest);
    return buildPrimitiveVisual(primitive);
  }

  /** Static (non-animated) prop visual — same source resolution as units, minus the anim controller. */
  async getPropVisual(logicalId: string): Promise<THREE.Object3D> {
    return (await this.getUnitVisual(logicalId)).object;
  }

  private loadModel(path: string): Promise<GLTF> {
    let pending = this.gltfCache.get(path);
    if (!pending) {
      pending = this.loader.loadAsync(path);
      this.gltfCache.set(path, pending);
    }
    return pending;
  }
}

function buildModelVisual(
  gltf: GLTF,
  clips: THREE.AnimationClip[],
  source: Extract<ResolvedSource, { kind: "model" }>,
): UnitVisual {
  // SkeletonUtils.clone (not Object3D#clone) so skinned-mesh bone bindings
  // survive spawning multiple instances of the same cached GLB.
  const object = cloneSkeleton(gltf.scene) as THREE.Object3D;
  object.scale.setScalar(source.scale);
  object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  if (source.tint) applyModelTint(object, source.tint, source.emissive, source.emissiveIntensity);
  const anim = new GltfAnimController(object, clips, source.anims, source.idleMotion);
  return { object, anim, faceOffset: source.faceOffset };
}

/**
 * Colors an untextured/default-material GLB (the AI-generated meshes ship with
 * only POSITION+NORMAL — no materials of their own). Each mesh whose material
 * carries no texture map gets a fresh flat `MeshStandardMaterial` in `tint`
 * (plus optional ember `emissive`). Baked normals already read the low-poly
 * facets, so `flatShading` stays off. Meshes that DO carry a texture map are a
 * real authored material and are left untouched — this only fills in the blanks.
 */
function applyModelTint(object: THREE.Object3D, tint: string, emissive?: string, emissiveIntensity?: number): void {
  const color = new THREE.Color(tint);
  const emissiveColor = emissive ? new THREE.Color(emissive) : undefined;
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const replace = (m: THREE.Material): THREE.Material => {
      if ((m as { map?: unknown }).map instanceof THREE.Texture) return m; // authored/textured — keep
      const next = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05 });
      if (emissiveColor) {
        next.emissive = emissiveColor.clone();
        next.emissiveIntensity = emissiveIntensity ?? 1;
      }
      return next;
    };
    node.material = Array.isArray(node.material) ? node.material.map(replace) : replace(node.material);
  });
}

function buildPrimitiveVisual(source: Extract<ResolvedSource, { kind: "primitive" }>): UnitVisual {
  if (source.primitive === "capsule") {
    const parts = buildHumanoidPrimitive(source.tint);
    parts.root.scale.setScalar(source.scale);
    return { object: parts.root, anim: new ProceduralAnimController(parts), faceOffset: source.faceOffset };
  }
  const object = buildStaticPrimitive(source.primitive, source.tint);
  object.scale.setScalar(source.scale);
  return { object, anim: new NullAnimController(), faceOffset: source.faceOffset };
}

class NullAnimController implements AnimController {
  setState(): void {}
  update(): void {}
  revive(): void {}
}

// ---------------------------------------------------------------------------
// GLB path: AnimationMixer-driven controller.
// ---------------------------------------------------------------------------

const ONE_SHOT_STATES: readonly AnimState[] = ["attack", "cast", "hit", "death"];

// "float" idleMotion: a ±0.15 vertical sine bob (~2.4s period) plus a very slow
// yaw drift, applied to the model object itself (a child of the unit root, so it
// composes with — never fights — the root's facing rotation set in units.ts).
const FLOAT_AMPLITUDE = 0.15;
const FLOAT_ANGULAR = (Math.PI * 2) / 2.4;
const FLOAT_YAW_RATE = 0.25; // rad/s

class GltfAnimController implements AnimController {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<AnimState, THREE.AnimationAction>();
  private current: THREE.AnimationAction | undefined;
  private state: AnimState = "idle";
  /** Enabled only for a clip-less GLB whose entry asked for "float" — a model with
   *  real clips keeps its clips and ignores idleMotion entirely. */
  private readonly floatEnabled: boolean;
  private readonly root: THREE.Object3D;
  private readonly floatBaseY: number;
  private floatT = 0;

  constructor(
    root: THREE.Object3D,
    clips: THREE.AnimationClip[],
    animMap: Partial<Record<AnimState, string>>,
    idleMotion?: IdleMotion,
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    this.root = root;
    this.floatBaseY = root.position.y;
    for (const [state, clipName] of Object.entries(animMap) as [AnimState, string][]) {
      const clip = THREE.AnimationClip.findByName(clips, clipName);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      if (ONE_SHOT_STATES.includes(state)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions.set(state, action);
    }
    this.floatEnabled = idleMotion === "float" && this.actions.size === 0;
    this.play("idle");
  }

  setState(state: AnimState): void {
    if (this.state === "death") return; // terminal
    const restart = ONE_SHOT_STATES.includes(state);
    if (state === this.state && !restart) return;
    this.state = state;
    this.play(state, restart);
  }

  revive(): void {
    if (this.state !== "death") return;
    this.state = "idle";
    this.play("idle"); // fades out the clamped death action, fades in idle
  }

  update(dt: number): void {
    this.mixer.update(dt);
    if (this.floatEnabled) this.updateFloat(dt);
    if (this.current && this.state !== "idle" && this.state !== "walk" && this.state !== "death") {
      const clip = this.current.getClip();
      if (this.current.time >= clip.duration - 0.001) this.setState("idle");
    }
  }

  /** Advances (or, while dead, settles) the "float" idle motion. Death freezes the
   *  bob and drops the model back to its base height so a corpse doesn't hover. */
  private updateFloat(dt: number): void {
    if (this.state === "death") {
      this.root.position.y = this.floatBaseY;
      return;
    }
    this.floatT += dt;
    this.root.position.y = this.floatBaseY + Math.sin(this.floatT * FLOAT_ANGULAR) * FLOAT_AMPLITUDE;
    this.root.rotation.y += dt * FLOAT_YAW_RATE;
  }

  private play(state: AnimState, restart = false): void {
    const next = this.actions.get(state) ?? this.actions.get("idle");
    if (!next) return;
    if (next === this.current && !restart) return;
    next.reset().fadeIn(0.15).play();
    if (this.current && this.current !== next) this.current.fadeOut(0.15);
    this.current = next;
  }
}

// ---------------------------------------------------------------------------
// Procedural fallback: capsule body + sphere head + weapon box, all tinted
// per manifest entry, animated by code (no clips, no assets required).
// ---------------------------------------------------------------------------

interface HumanoidParts {
  root: THREE.Group;
  torso: THREE.Group;
  body: THREE.Mesh;
  weapon: THREE.Mesh;
  weaponBaseY: number;
  glow: THREE.Mesh;
  glowMat: THREE.MeshBasicMaterial;
}

function buildHumanoidPrimitive(tint: string): HumanoidParts {
  const root = new THREE.Group();
  const torso = new THREE.Group();
  root.add(torso);

  const bodyMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.75, metalness: 0.05 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), bodyMat);
  body.position.y = 0.28 + 0.35;
  body.castShadow = true;
  torso.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bodyMat);
  head.position.y = body.position.y + 0.35 + 0.22;
  head.castShadow = true;
  torso.add(head);

  const weaponMat = new THREE.MeshStandardMaterial({ color: "#2b2f36", roughness: 0.4, metalness: 0.3 });
  const weaponBaseY = body.position.y + 0.1;
  const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), weaponMat);
  weapon.position.set(0.32, weaponBaseY, 0);
  weapon.castShadow = true;
  torso.add(weapon);

  const glowMat = new THREE.MeshBasicMaterial({ color: "#8fe3ff", transparent: true, opacity: 0 });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), glowMat);
  glow.position.set(0.32, weaponBaseY + 0.35, 0);
  torso.add(glow);

  return { root, torso, body, weapon, weaponBaseY, glow, glowMat };
}

function buildStaticPrimitive(kind: Exclude<PrimitiveKind, "capsule">, tint: string): THREE.Object3D {
  if (kind === "tree") return buildTreePrimitive(tint);
  if (kind === "rock") return buildRockPrimitive(tint);
  return buildBoxPrimitive(tint);
}

function buildBoxPrimitive(tint: string): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.4, 0.9),
    new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85 }),
  );
  mesh.position.y = 0.7;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildTreePrimitive(tint: string): THREE.Object3D {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 1.2, 6),
    new THREE.MeshStandardMaterial({ color: "#4a3325", roughness: 0.9 }),
  );
  trunk.position.y = 0.6;
  trunk.castShadow = true;
  group.add(trunk);

  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(0.75, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85 }),
  );
  foliage.position.y = 1.7;
  foliage.castShadow = true;
  group.add(foliage);
  return group;
}

function buildRockPrimitive(tint: string): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5, 0),
    new THREE.MeshStandardMaterial({ color: tint, roughness: 0.95, flatShading: true }),
  );
  mesh.position.y = 0.35;
  mesh.rotation.set(0.3, 0.6, 0.1);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const ATTACK_DURATION = 0.35;
const HIT_DURATION = 0.25;
const DEATH_DURATION = 0.6;
const CAST_RAISE_DURATION = 0.25;

class ProceduralAnimController implements AnimController {
  private state: AnimState = "idle";
  private t = 0;

  constructor(private readonly parts: HumanoidParts) {}

  setState(state: AnimState): void {
    if (this.state === "death") return; // terminal
    if (state === this.state && state !== "attack" && state !== "hit") return;
    this.state = state;
    this.t = 0;
  }

  revive(): void {
    if (this.state !== "death") return;
    this.state = "idle";
    this.t = 0;
    // Death is the only state that leaves torso rotation/offset non-zero when interrupted
    // (see the death case below); clear it immediately rather than waiting for the next
    // update() tick, which would otherwise flash the lying-down pose for one frame.
    this.parts.torso.rotation.set(0, 0, 0);
    this.parts.torso.position.set(0, 0, 0);
  }

  update(dt: number): void {
    this.t += dt;
    const { torso, weapon, weaponBaseY, glow, glowMat } = this.parts;

    // Every branch fully resets the transforms it touches so state switches never leak a pose.
    torso.position.set(0, 0, 0);
    torso.rotation.set(0, 0, 0);
    weapon.position.set(0.32, weaponBaseY, 0);
    weapon.rotation.set(0, 0, 0);
    glowMat.opacity = 0;

    switch (this.state) {
      case "idle":
        torso.position.y = Math.sin(this.t * 2.2) * 0.03;
        break;
      case "walk": {
        const cycle = this.t * 7;
        torso.position.y = Math.abs(Math.sin(cycle)) * 0.06;
        torso.rotation.x = 0.12;
        weapon.rotation.z = Math.sin(cycle) * 0.3;
        break;
      }
      case "attack": {
        const p = Math.min(this.t / ATTACK_DURATION, 1);
        const lunge = Math.sin(p * Math.PI);
        torso.position.z = lunge * 0.25;
        weapon.rotation.z = -1.2 + lunge * 1.6;
        if (p >= 1) this.setState("idle");
        break;
      }
      case "cast": {
        const raise = Math.min(this.t / CAST_RAISE_DURATION, 1);
        weapon.rotation.z = raise * -1.4;
        weapon.position.y = weaponBaseY + raise * 0.3;
        glow.position.y = weapon.position.y + 0.1;
        glowMat.opacity = raise * (0.5 + Math.sin(this.t * 6) * 0.3);
        break;
      }
      case "hit": {
        const p = Math.min(this.t / HIT_DURATION, 1);
        const flinch = Math.sin(p * Math.PI);
        torso.rotation.x = -flinch * 0.3;
        torso.position.z = -flinch * 0.08;
        if (p >= 1) this.setState("idle");
        break;
      }
      case "death": {
        const p = Math.min(this.t / DEATH_DURATION, 1);
        torso.rotation.x = p * (Math.PI / 2);
        torso.position.y = -p * 0.15;
        break;
      }
    }
  }
}
