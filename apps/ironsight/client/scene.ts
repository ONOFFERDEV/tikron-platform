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
import { nearestBox, type Box } from "../src/physics.js";
import type { MapDef } from "../src/map/types.js";
import { ARENA, PLAYER } from "../src/config.js";
import { ADS_FOV, HIP_FOV, TEAM_COLOR } from "./config.js";
import { Vfx } from "./vfx.js";

const EYE_UP = new THREE.Vector3(0, 1, 0);
const FWD_Z = new THREE.Vector3(0, 0, 1);
const TRACER_LIFE_MS = 130;
const MUZZLE_LIFE_MS = 55;
const CAP_LEN = PLAYER.standHeight - 2 * PLAYER.radius;
/** Viewmodel recoil kick per weapon (indexed like WEAPONS: AR/SMG/Shotgun/Sniper/Pistol). */
const VM_RECOIL = [0.4, 0.2, 0.7, 0.9, 0.3] as const;
const NADE_GRAVITY = -22; // matches the server's grenade integrator
const SWAP_DOWN_MS = 120;
const SWAP_UP_MS = 230; // down+up = the server's 350 ms switch delay

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
  private readonly boxes: readonly Box[];
  private readonly players = new Map<string, PlayerRig>();
  private readonly tracers: Tracer[] = [];

  // Viewmodel + its animated offsets.
  private readonly viewmodel = new THREE.Group();
  private readonly weaponHolder = new THREE.Group();
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

    this.scene.background = new THREE.Color(0x1a2030);
    this.scene.fog = new THREE.Fog(0x1a2030, 40, 110);

    this.camera = new THREE.PerspectiveCamera(78, 1, 0.05, 300);

    this.scene.add(new THREE.HemisphereLight(0xc2d4f2, 0x3a4656, 1.5));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
    key.position.set(25, 45, 15);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0x60708a, 0.9));

    this.vfx = new Vfx(this.scene);
    this.buildArena();

    const vm = this.buildViewmodel();
    this.viewmodel.add(vm.group);
    this.muzzle = vm.muzzle;
    this.muzzleLight = vm.light;
    this.camera.add(this.viewmodel);
    this.scene.add(this.camera); // camera must be in the graph for its viewmodel child to render
    this.weaponHolder.add(buildWeaponMesh(0));

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
    for (const b of this.boxes) {
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
    g.add(this.weaponHolder); // the per-weapon mesh is swapped inside this holder

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
      new THREE.MeshStandardMaterial({ color: 0x3f5a3a, roughness: 0.6, metalness: 0.3 }),
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
    const light = new THREE.PointLight(0xffb066, 60, e.r * 4, 2);
    light.position.set(e.x, e.y + 0.3, e.z);
    this.scene.add(light);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffcc88, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(e.x, Math.max(0.05, e.y) + 0.05, e.z);
    this.scene.add(ring);
    const partMat = new THREE.MeshBasicMaterial({
      color: 0xffa050, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false,
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
          disposeWeaponMesh(this.weaponHolder);
          this.weaponHolder.add(buildWeaponMesh(this.weaponIndex));
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

  // --- VFX/SFX polish (remote flashes, casings, impacts, footsteps) -------------
  // Thin wiring only — `vfx.ts` owns the pools and per-frame aging.

  /** Distance to the first map box the ray enters within `maxT`, or `maxT` itself
   *  if none (a pure client-side wall stop — used by main.ts to give a
   *  self-authoritative tracer a plausible endpoint without server round-trip). */
  wallDistance(origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, maxT: number): number {
    return Math.min(maxT, nearestBox(origin, dir, this.boxes, maxT));
  }

  /** The currently-rendered world position of a remote player's rig, near eye
   *  height (feet + the head mesh's local Y, which already accounts for crouch) —
   *  used to anchor their muzzle flash/casing/tracer start to where they visually
   *  are, since the wire shot origin is stale by their RTT plus our own render
   *  interpolation delay. `undefined` if the rig isn't tracked (e.g. just left). */
  getRemoteMuzzleAnchor(id: string): { x: number; y: number; z: number } | undefined {
    const rig = this.players.get(id);
    if (!rig) return undefined;
    return { x: rig.group.position.x, y: rig.group.position.y + rig.head.position.y, z: rig.group.position.z };
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

// --- per-weapon procedural viewmodels -----------------------------------------

const VM_METAL = new THREE.MeshStandardMaterial({ color: 0x424956, roughness: 0.55, metalness: 0.4 });
const VM_ACCENT = new THREE.MeshStandardMaterial({ color: 0x5f6b82, roughness: 0.45, metalness: 0.55 });
const VM_DARK = new THREE.MeshStandardMaterial({ color: 0x2c313c, roughness: 0.6, metalness: 0.35 });

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

/** Remove + dispose the holder's current weapon mesh (materials are shared module constants). */
function disposeWeaponMesh(holder: THREE.Group): void {
  for (const child of [...holder.children]) {
    holder.remove(child);
    child.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
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
