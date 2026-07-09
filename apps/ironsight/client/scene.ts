/**
 * Three.js presentation: the FPS camera, arena1 geometry (imported from the shared
 * map so walls cost zero wire bytes), remote-player capsules, the procedural rifle
 * viewmodel with sway/bob/recoil, muzzle flash, and tracers. Pure rendering — it
 * holds no authority; `main.ts` feeds it poses each frame.
 *
 * Coordinate system is the server's directly: x∈[0,60] east, z∈[0,40] north, y up
 * (ground 0). yaw 0 → +z, increasing yaw → +x, so the camera forward is
 * (sin yaw·cos pitch, sin pitch, cos yaw·cos pitch) — identical to the server's
 * `aimDir`, which keeps the crosshair (screen centre) honest with hit registration.
 */
import * as THREE from "three";
import { ARENA1_BOXES } from "../src/map/arena1.js";
import { ARENA, PLAYER } from "../src/config.js";
import { TEAM_COLOR } from "./config.js";

const EYE_UP = new THREE.Vector3(0, 1, 0);
const FWD_Z = new THREE.Vector3(0, 0, 1);
const TRACER_LIFE_MS = 130;
const MUZZLE_LIFE_MS = 55;
const CAP_LEN = PLAYER.standHeight - 2 * PLAYER.radius;

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

interface PlayerRig {
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  team: number;
}

interface Tracer {
  mesh: THREE.Mesh;
  born: number;
  mat: THREE.MeshBasicMaterial;
}

export class SceneRig {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly players = new Map<string, PlayerRig>();
  private readonly tracers: Tracer[] = [];

  // Viewmodel + its animated offsets.
  private readonly viewmodel = new THREE.Group();
  private readonly muzzle: THREE.Mesh;
  private readonly muzzleLight: THREE.PointLight;
  private muzzleFiredAt = -1e9;
  private bobPhase = 0;
  private recoil = 0; // 0..1, decays; drives kick-back + muzzle rise
  private swayX = 0;
  private swayY = 0;

  constructor(container: HTMLElement = document.body) {
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene.background = new THREE.Color(0x1a2030);
    this.scene.fog = new THREE.Fog(0x1a2030, 40, 110);

    this.camera = new THREE.PerspectiveCamera(78, 1, 0.05, 300);

    this.scene.add(new THREE.HemisphereLight(0xc2d4f2, 0x3a4656, 1.5));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
    key.position.set(25, 45, 15);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0x60708a, 0.9));

    this.buildArena();

    const vm = this.buildViewmodel();
    this.viewmodel.add(vm.group);
    this.muzzle = vm.muzzle;
    this.muzzleLight = vm.light;
    this.camera.add(this.viewmodel);
    this.scene.add(this.camera); // camera must be in the graph for its viewmodel child to render

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
      new THREE.MeshStandardMaterial({ map: floorTex, color: 0x49546a, roughness: 1, metalness: 0 }),
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
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c3444, roughness: 1 });
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

    // Cover / dividers / platforms from the shared map.
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x93a1ba, roughness: 0.85, metalness: 0.05 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xc4cee0 });
    for (const b of ARENA1_BOXES) {
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
    }
  }

  // --- viewmodel --------------------------------------------------------------

  private buildViewmodel(): { group: THREE.Group; muzzle: THREE.Mesh; light: THREE.PointLight } {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x424956, roughness: 0.55, metalness: 0.4 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x5f6b82, roughness: 0.45, metalness: 0.55 });

    const part = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      g.add(m);
    };
    // Receiver body, barrel, magazine, stock, sight — a blocky low-poly AR.
    part(0.09, 0.12, 0.5, 0, 0, -0.15, metal); // receiver
    part(0.05, 0.05, 0.42, 0, 0.02, -0.5, accent); // barrel
    part(0.08, 0.2, 0.1, 0, -0.16, -0.05, accent); // magazine
    part(0.07, 0.09, 0.22, 0, -0.02, 0.22, metal); // stock
    part(0.03, 0.06, 0.03, 0, 0.09, -0.28, accent); // front sight

    const muzzle = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    muzzle.position.set(0, 0.02, -0.74);
    g.add(muzzle);

    const light = new THREE.PointLight(0xffcc77, 0, 6, 2);
    light.position.set(0, 0.02, -0.74);
    g.add(light);

    // Rest pose: lower-right of the view.
    g.position.set(0.22, -0.2, -0.5);
    g.rotation.y = -0.05;
    return { group: g, muzzle, light };
  }

  /** Kick the viewmodel on a confirmed local shot. */
  fireRecoil(): void {
    this.recoil = Math.min(1, this.recoil + 0.6);
    this.muzzleFiredAt = performance.now();
    (this.muzzle.material as THREE.MeshBasicMaterial).opacity = 0.9;
    this.muzzle.rotation.z = Math.random() * Math.PI;
    this.muzzleLight.intensity = 3;
  }

  /**
   * Animate the viewmodel: bob from movement, sway lagging the look delta, and the
   * decaying recoil kick. `speed01` is 0..1 horizontal speed, `dLook` the yaw+pitch
   * delta this frame (for sway).
   */
  updateViewmodel(dtMs: number, speed01: number, dYaw: number, dPitch: number, grounded: boolean): void {
    const dt = dtMs / 1000;
    this.bobPhase += dt * (6 + speed01 * 8) * (grounded ? 1 : 0.2);
    const bobAmt = speed01 * 0.02;
    const bx = Math.cos(this.bobPhase) * bobAmt;
    const by = Math.abs(Math.sin(this.bobPhase)) * bobAmt;

    // Sway eases toward an offset proportional to the look delta, then relaxes.
    this.swayX += (-dYaw * 0.35 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (dPitch * 0.35 - this.swayY) * Math.min(1, dt * 10);
    this.swayX = clamp(this.swayX, -0.06, 0.06);
    this.swayY = clamp(this.swayY, -0.06, 0.06);

    this.recoil *= Math.exp(-dtMs / 70);
    const kick = this.recoil;
    this.viewmodel.position.set(0.22 + bx + this.swayX, -0.2 + by + this.swayY - kick * 0.02, -0.5 + kick * 0.08);
    this.viewmodel.rotation.x = kick * 0.25;
    this.viewmodel.rotation.y = -0.05 + this.swayX * 0.5;

    if (performance.now() - this.muzzleFiredAt > MUZZLE_LIFE_MS) {
      (this.muzzle.material as THREE.MeshBasicMaterial).opacity = 0;
      this.muzzleLight.intensity = 0;
    }
  }

  // --- camera -----------------------------------------------------------------

  setView(eye: { x: number; y: number; z: number }, yaw: number, pitch: number): void {
    this.camera.position.set(eye.x, eye.y, eye.z);
    const cp = Math.cos(pitch);
    this.camera.up.copy(EYE_UP);
    this.camera.lookAt(eye.x + Math.sin(yaw) * cp, eye.y + Math.sin(pitch), eye.z + Math.cos(yaw) * cp);
  }

  // --- players ----------------------------------------------------------------

  /** Sync the remote-player rigs to `poses` (keyed by id); `selfId` is never drawn. */
  syncPlayers(poses: Map<string, PlayerPose>, selfId: string): void {
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
      rig.group.visible = pose.alive;
      if (!pose.alive) continue;
      const stance = pose.crouch ? PLAYER.crouchHeight / PLAYER.standHeight : 1;
      const h = pose.crouch ? PLAYER.crouchHeight : PLAYER.standHeight;
      rig.body.scale.y = stance;
      rig.body.position.y = h / 2;
      rig.head.position.y = h - PLAYER.headRadius;
      rig.group.position.set(pose.x, pose.y, pose.z);
      // (capsule + head sphere are radially symmetric, so yaw needs no cosmetic rotation)
    }
    for (const [id, rig] of [...this.players]) {
      if (!seen.has(id)) {
        this.disposeRig(rig);
        this.players.delete(id);
      }
    }
  }

  private makeRig(team: number): PlayerRig {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: TEAM_COLOR[team] ?? 0xaaaaaa, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER.radius, CAP_LEN, 4, 10), mat);
    body.position.y = PLAYER.standHeight / 2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(PLAYER.headRadius, 12, 10), mat);
    head.position.y = PLAYER.standHeight - PLAYER.headRadius;
    group.add(body);
    group.add(head);
    this.scene.add(group);
    return { group, body, head, team };
  }

  private disposeRig(rig: PlayerRig): void {
    this.scene.remove(rig.group);
    rig.body.geometry.dispose();
    rig.head.geometry.dispose();
    (rig.body.material as THREE.Material).dispose();
  }

  // --- tracers ----------------------------------------------------------------

  addTracer(origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, dist: number, hit: boolean): void {
    const len = Math.max(0.5, dist);
    const d = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
    const mid = new THREE.Vector3(origin.x, origin.y, origin.z).addScaledVector(d, len / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: hit ? 0xff7755 : 0xffe08a,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, len), mat);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(FWD_Z, d);
    this.scene.add(mesh);
    this.tracers.push({ mesh, born: performance.now(), mat });
  }

  private updateTracers(now: number): void {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]!;
      const age = now - t.born;
      if (age >= TRACER_LIFE_MS) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mat.dispose();
        this.tracers.splice(i, 1);
      } else {
        t.mat.opacity = 0.85 * (1 - age / TRACER_LIFE_MS);
      }
    }
  }

  render(): void {
    this.updateTracers(performance.now());
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
