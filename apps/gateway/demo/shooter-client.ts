import {
  GameClient,
  InputPredictor,
  SnapshotBuffer,
  RenderPredictor,
  EntitySmoother,
  type Room,
} from "@tikron/client";
import { ShooterSchema, SHOOTER, SHOOTER_PROFILE, WEAPONS, type ShooterState } from "../src/rooms/shooter-schema.js";
import { makeCrates, rayCoverDistance, type Crate } from "../src/rooms/shooter-crates.js";
import { makePickups, pushOutOfCrates, type PickupSpot } from "../src/rooms/shooter-map.js";
import { LoadingFlow, type LoadingView } from "./loading.js";

/**
 * FPS proof-of-concept client. Shows the full FPS-grade SDK usage: **subtick input
 * timestamps** (each `send` is stamped with its server-clock time) so the room can
 * rewind lag compensation to the exact shot instant, **input batching** (one WS
 * frame per ~tick to stay under the Durable Object inbound rate), client-side
 * prediction for the local player, server reconciliation, and interpolation for
 * everyone else. WASD to move, mouse to aim, click to shoot.
 *
 * The shell around the netcode is a drop-in/drop-out arena: a branded start screen,
 * a staged loading bar (asset preload → matchmake → connect → first frame), and a
 * sprite renderer that falls back to the original vector art when the asset manifest
 * (or any key in it) is missing. Deterministic crate cover is generated client-side
 * from `state.seed` when the server supplies one — purely visual, never authoritative.
 *
 * Bundled to public/shooter.js by `pnpm --filter @tikron/gateway build:demo`.
 */
type Vec = { x: number; y: number };

/** The room capacity advertised to the matchmaker and shown in the HUD (n/MAX). */
const MAX_PLAYERS = 64;
/** Kill-feed glyph per damage source (the `by` field): weapon index or zone. */
const KILL_GLYPHS: Record<string, string> = { w0: "•", w1: "∴", w2: "≡", zone: "◍" };
/** Weapon-tinted tracer colour (rifle amber / shotgun orange / smg blue), tasteful alpha. */
function weaponTracerColor(w: number): string {
  return w === 1 ? "rgba(255,159,67,0.55)" : w === 2 ? "rgba(88,166,255,0.5)" : "rgba(242,204,96,0.5)";
}
/** Asset manifest location; every listed file resolves relative to this folder. */
const ASSET_BASE = "/assets/shooter/";

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("status")!;
const lbEl = document.getElementById("lb");
const gateEl = document.getElementById("gate")!;
const playBtn = document.getElementById("play") as HTMLButtonElement;
const nickInput = document.getElementById("nick") as HTMLInputElement;
const startPanel = document.getElementById("start-panel")!;
const loadingPanel = document.getElementById("loading-panel")!;
const barFill = document.getElementById("bar-fill")!;
const barPct = document.getElementById("bar-pct")!;
const stageLabelEl = document.getElementById("stage-label")!;
const stageListEl = document.getElementById("stage-list")!;
const retryBtn = document.getElementById("retry") as HTMLButtonElement;

const client = new GameClient(location.host, {
  party: "shooter-room",
  stateCodec: ShooterSchema,
  // FPS-grade netcode: stamp inputs with a subtick server-clock time (rewind pins
  // the hitscan to the exact shot instant) and coalesce inputs into ~one frame/tick.
  subtickTimestamps: true,
  inputBatchMs: 33,
});

// ---------------------------------------------------------------------------
// Assets (sprites + audio) — all optional; the renderer falls back to vectors.
// ---------------------------------------------------------------------------
type SpriteKey = "playerBody" | "enemyBody" | "crate" | "muzzleFlash";
type AudioKey = "shot" | "hit" | "death";
interface Manifest {
  sprites?: Partial<Record<SpriteKey, string>>;
  audio?: Partial<Record<AudioKey, string>>;
}
const sprites: Partial<Record<SpriteKey, HTMLImageElement>> = {};
const sounds: Partial<Record<AudioKey, HTMLAudioElement>> = {};
let assetsReady = false;
let audioUnlocked = false;

function resolveAsset(name: string): string {
  if (/^(https?:)?\/\//.test(name) || name.startsWith("/")) return name;
  return ASSET_BASE + name;
}

function loadImage(url: string, onSettled: () => void): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      onSettled();
      resolve(img);
    };
    img.onerror = () => {
      onSettled();
      resolve(null);
    };
    img.src = url;
  });
}

function loadAudio(url: string, onSettled: () => void): Promise<HTMLAudioElement | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      onSettled();
      resolve(ok ? audio : null);
    };
    audio.addEventListener("canplaythrough", () => finish(true), { once: true });
    audio.addEventListener("error", () => finish(false), { once: true });
    // Best-effort: some browsers won't fire canplaythrough until a gesture — don't
    // let a slow/edge decode stall the loading bar; the clip still plays once ready.
    setTimeout(() => finish(true), 4000);
    audio.preload = "auto";
    audio.volume = 0.25;
    audio.src = url;
    audio.load();
  });
}

/**
 * Fetch the manifest and preload every listed sprite/sound, reporting a real 0..1
 * fraction as each asset settles (a missing file counts as settled, not fatal). If
 * the manifest itself is absent the demo runs fully on the vector fallback.
 */
async function preloadAssets(onProgress: (fraction: number) => void): Promise<void> {
  if (assetsReady) {
    onProgress(1);
    return;
  }
  let manifest: Manifest | null = null;
  try {
    const res = await fetch(`${ASSET_BASE}manifest.json`, { cache: "no-cache" });
    if (res.ok) manifest = (await res.json()) as Manifest;
  } catch {
    manifest = null;
  }

  const spriteEntries = Object.entries(manifest?.sprites ?? {}) as [SpriteKey, string][];
  const audioEntries = Object.entries(manifest?.audio ?? {}) as [AudioKey, string][];
  const total = spriteEntries.length + audioEntries.length;
  if (total === 0) {
    assetsReady = true;
    onProgress(1);
    return;
  }

  let settled = 0;
  const bump = () => {
    settled += 1;
    onProgress(settled / total);
  };

  await Promise.all([
    ...spriteEntries.map(async ([key, file]) => {
      const img = await loadImage(resolveAsset(file), bump);
      if (img) sprites[key] = img;
    }),
    ...audioEntries.map(async ([key, file]) => {
      const audio = await loadAudio(resolveAsset(file), bump);
      if (audio) sounds[key] = audio;
    }),
  ]);
  assetsReady = true;
  onProgress(1);
}

function unlockAudio(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;
  // A user gesture (the PLAY click) is in progress; nudge each clip so later
  // programmatic plays are allowed by the browser's autoplay policy.
  for (const audio of Object.values(sounds)) {
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => {
        /* stays locked until the next gesture; sfx are non-essential */
      });
  }
}

function playSound(key: AudioKey): void {
  const base = sounds[key];
  if (!base || !audioUnlocked) return;
  const clip = base.cloneNode(true) as HTMLAudioElement;
  clip.volume = base.volume;
  void clip.play().catch(() => {});
}

// ---------------------------------------------------------------------------
// Deterministic crate cover — derived from the room seed, SHARED with the
// server (src/rooms/shooter-crates.ts): the same boxes we draw are the ones
// the server's hitscan treats as cover, so what looks like cover IS cover.
// ---------------------------------------------------------------------------
let crates: Crate[] = [];
let crateSeed: number | null = null;
/** Seed-derived pickup spots, built alongside the crates when the seed first arrives. */
let pickupSpots: PickupSpot[] = [];
/** Newest snapshot's broken-crate set (raw, un-lerped) — the collision/render skip source. */
let latestBroken: ShooterState["broken"] = {};
/** True when crate index `i` is destroyed this round (skip collision, LOS and drawing). */
const isBrokenIdx = (i: number): boolean => latestBroken[String(i)] !== undefined;

// ---------------------------------------------------------------------------
// Netcode + view state
// ---------------------------------------------------------------------------
/** Pre-spawn placeholder position — the map centre, so the distance to any real spawn
 *  (the empty-room spawn box is centre ± spawnCenterJitter) stays well inside the
 *  first-frame snap; the old {1000,1000} seed was a leftover from the 2000² map. The
 *  first authoritative frame always snaps `continuous` to the real spawn regardless. */
const WORLD_CENTER = SHOOTER.world / 2;
const predictor = new InputPredictor<Vec, Vec>(
  { x: WORLD_CENTER, y: WORLD_CENTER },
  { apply: (_s, i) => ({ ...i }) },
);
const buffer = new SnapshotBuffer<ShooterState>({
  delayMs: 60, // starting point; the adaptive controller owns it from here
  lerp: lerpState,
  // Bridge a late/lost frame by extrapolating ~half an RTT along the last
  // segment's velocity instead of freezing (lerpState with t > 1 extrapolates
  // positions linearly; discrete fields already take the newest value).
  maxExtrapolationMs: 50,
  // 30 Hz flush + measured jitter: settles near the floor on a clean network
  // (≈40 ms less added latency than the old fixed 100 ms), grows under jitter.
  // 60 Hz flush: 2×interval + headroom lands near 40 ms on a clean network —
  // let the controller settle there instead of pinning at the old 20 Hz floor.
  adaptiveDelay: { minMs: 30, maxMs: 200 },
});

/**
 * Local-player render predictor — the SDK's continuous-integration model. It owns the
 * continuously integrated position (this — not `predictor.predicted` — is the
 * camera/render reference, so on-screen motion is uniform at frame rate instead of
 * pulsing with the 20 Hz tick), the decaying server-correction offset, and the
 * budget-clamped send bookkeeping. Built from the SAME {@link SHOOTER_PROFILE} the
 * room validates with — one budget, two sides.
 */
const motion = RenderPredictor.fromProfile({ x: WORLD_CENTER, y: WORLD_CENTER }, SHOOTER_PROFILE, {
  // Predict crate collision with the SAME pushout the server applies (shooter-map.ts)
  // so contact never rubber-bands. The closure reads the live module `crates` array
  // (empty until the seed lands) and `latestBroken`, so destroyed cover stops blocking.
  constrain: (pos) => pushOutOfCrates(pos, SHOOTER.playerRadius, crates, isBrokenIdx),
});
/** Remote-entity easing on top of the interpolation buffer: rounds off the coarse
 *  steps that AOI priority tiers deliver for far players. */
const smoother = new EntitySmoother();
/** Camera center in world units — tracks the (already smooth) render position 1:1. */
const cam: Vec = { x: WORLD_CENTER, y: WORLD_CENTER };
/** Wall-clock ms of the previous render, for a frame-rate-independent integration dt. */
let lastRenderMs = 0;

let myId = "";
let seq = 0;
let aim = 0; // radians, player -> mouse
const mouse: Vec = { x: 0, y: 0 };
const keys = new Set<string>();

// ---------------------------------------------------------------------------
// Touch controls — dual floating virtual sticks. Active only on coarse-pointer
// devices; the keyboard/mouse path is untouched otherwise. The render loop reads
// `stickMove` in place of the WASD vector and the send loop reads `stickAim.dir`
// in place of the mouse-vs-centre angle (aim PERSISTS at its last value when the
// right stick is released — it never snaps back to 0).
// ---------------------------------------------------------------------------
const isTouch = matchMedia("(pointer: coarse)").matches;
/** Left-stick move vector, magnitude ≤ 1 (direction only — the integrator runs at full speed). */
let stickMove: Vec = { x: 0, y: 0 };
/** Right-stick aim: `dir` is the last aimed angle, `active` gates it over the mouse, `fire` auto-fires. */
const stickAim = { active: false, dir: 0, fire: false };
/** Stick radius (px): knob clamp + the 60%-of-radius auto-fire threshold. */
const STICK_R = 56;
/** Pointer ids owning each stick (-1 = free); extra touches on the same half are ignored. */
let movePointerId = -1;
let aimPointerId = -1;
/** Screen-space origin (touch-down point) and current knob position of each floating stick. */
const moveOrigin: Vec = { x: 0, y: 0 };
const moveKnob: Vec = { x: 0, y: 0 };
const aimOrigin: Vec = { x: 0, y: 0 };
const aimKnob: Vec = { x: 0, y: 0 };
/** Local shot trigger — wired up in startGame (mousedown + touch auto-fire both call it). */
let tryFire: () => void = () => {};
/** Live tracers to draw for a few frames after a `shot` event (weapon-tinted). */
const tracers: { ox: number; oy: number; tx: number; ty: number; hit: boolean; color?: string; until: number }[] = [];
/** Transient world-space effects (muzzle flashes, death/respawn/pickup rings, blasts). */
type Effect =
  | { kind: "muzzle"; x: number; y: number; dir: number; until: number }
  | { kind: "impact"; x: number; y: number; until: number } // shot stopped by a crate
  | { kind: "death" | "respawn"; x: number; y: number; until: number }
const effects: Effect[] = [];
/** Floating damage numbers for OWN confirmed hits — world-anchored, rising as they fade. */
const damageNumbers: { x: number; y: number; dmg: number; until: number }[] = [];
/** Crosshair hit-marker expiry (wall-clock ms) — armed by an own shot that connected. */
let hitMarkerUntil = 0;
/** Kill feed (newest first), each entry expiring on its own timer. */
const killFeed: { text: string; mine: boolean; until: number }[] = [];
/** Own consecutive-kill counter (reset on own death) + the killstreak banner. */
let killStreak = 0;
let streakBannerText = "";
let streakBannerUntil = 0;
/** Round-over overlay: the top players and the wall-clock ms it fades at. */
let roundTop: { id: string; nick?: string; score: number }[] = [];
let roundOverUntil = 0;
/** Locally equipped weapon (optimistic; the state echo confirms via own player `w`). */
let myWeapon = 0;
/** Per-player red hit-flash expiry (server clock–independent, wall-clock ms). */
const hitFlash = new Map<string, number>();
/** Where each player was DRAWN this frame (self = render pos, remotes = smoothed) — anchors shot visuals to sprites instead of trailing server positions. */
const lastDrawn = new Map<string, { x: number; y: number }>();
/** Previous liveness per player, to detect death/respawn transitions. */
const prevAlive = new Map<string, boolean>();
/** Sample the interpolation buffer on the server's clock (set once connected). */
let sampleServerNow: () => number = () => performance.now();
let nickname = "";
let running = false;

function lerpState(a: ShooterState, b: ShooterState, t: number): ShooterState {
  const players: ShooterState["players"] = {};
  for (const id of Object.keys(b.players)) {
    const pb = b.players[id]!;
    const pa = a.players[id];
    // Positions lerp; every discrete field (aim, hp, score, alive, w, sp, db) adopts
    // the newest snapshot's value.
    players[id] = pa ? { ...pb, x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t } : pb;
  }
  // Spread `b` so every other discrete/global field (seed, pickups, broken, zone,
  // roundEndMs) takes the newest snapshot's value; positions override.
  return { ...b, players };
}

// ---------------------------------------------------------------------------
// Loading flow — a pure state machine drives the branded progress bar.
// ---------------------------------------------------------------------------
const flow = new LoadingFlow([
  { id: "assets", label: "Loading assets", weight: 3 },
  { id: "matchmake", label: "Finding a match", weight: 1 },
  { id: "connect", label: "Joining the arena", weight: 1 },
  { id: "spawn", label: "Spawning in", weight: 1 },
]);
flow.onChange(renderLoading);

function renderLoading(v: LoadingView): void {
  const pct = Math.round(v.progress * 100);
  barFill.style.width = `${pct}%`;
  barFill.classList.toggle("is-error", v.status === "error");
  barPct.textContent = `${pct}%`;
  stageLabelEl.textContent = v.label;
  stageLabelEl.classList.toggle("is-error", v.status === "error");
  retryBtn.hidden = v.status !== "error";
  stageListEl.innerHTML = v.stages
    .map((s) => {
      const mark = s.status === "done" ? "✓" : s.status === "error" ? "✕" : s.status === "active" ? "…" : "·";
      return `<li class="stage stage-${s.status}"><span class="stage-mark">${mark}</span>${escapeHtml(s.label)}</li>`;
    })
    .join("");
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/** Resolve once the room has delivered its first authoritative state frame. */
function firstFrame(room: Room, ms: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (room.state !== undefined) {
      resolve();
      return;
    }
    const t = setTimeout(() => {
      off();
      reject(new Error("no state received from the room"));
    }, ms);
    const off = room.onStateChange(() => {
      clearTimeout(t);
      off();
      resolve();
    });
  });
}

/** Guards against a double PLAY (button + Enter) launching two concurrent flows. */
let inFlight = false;

async function play(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  unlockAudio();
  nickname = nickInput.value.trim().slice(0, 24);
  startPanel.hidden = true;
  loadingPanel.hidden = false;
  flow.start();

  let stage = "assets";
  let room: Room | undefined;
  let aborted = false;
  try {
    stage = "assets";
    await preloadAssets((f) => flow.setProgress("assets", f));
    flow.complete("assets");

    stage = "matchmake";
    const m = await withTimeout(
      client.matchmake({ type: "shooter-room", maxClients: MAX_PLAYERS }),
      8000,
      "matchmaking timed out",
    );
    flow.complete("matchmake");

    stage = "connect";
    const joinPromise = client.joinOrCreate(m.roomId, {
      _session: m.sessionId,
      ...(m.region ? { region: m.region } : {}),
    });
    // If we abort at/after the timeout but the join resolves late, the socket would
    // otherwise leak — reclaim it as soon as it lands.
    void joinPromise.then(
      (r) => {
        if (aborted) r.leave();
      },
      () => {},
    );
    const roomHandle = await withTimeout(joinPromise, 8000, "could not join the room");
    room = roomHandle;
    flow.complete("connect");

    stage = "spawn";
    await withTimeout(firstFrame(roomHandle, 8000), 8500, "timed out waiting for the first state");
    flow.complete("spawn");

    startGame(roomHandle);
    gateEl.hidden = true;
  } catch (err) {
    aborted = true;
    room?.leave(); // close a room that opened before the failing stage
    flow.fail(stage, err instanceof Error ? err.message : String(err));
  } finally {
    inFlight = false;
  }
}

// ---------------------------------------------------------------------------
// Game session
// ---------------------------------------------------------------------------
function startGame(room: Room): void {
  myId = room.connectionId ?? "";
  sampleServerNow = () => room.clock.serverNow();
  statusEl.textContent = `${nickname || myId.slice(0, 6)} · WASD move · mouse aim · click shoot`;
  // Publish the chosen display name; the room wires `nick` into the leaderboard
  // (string payload, server-clamped to 20 chars).
  if (nickname) room.send("nick", nickname);

  room.onMessage((msg) => {
    if (msg.t === "s:welcome" && (msg as { reconnected?: boolean }).reconnected) {
      statusEl.textContent = `reconnected as ${nickname || myId.slice(0, 6)} · seat preserved`;
    }
  });

  room.onStateChange((s) => ingestState(s as ShooterState, room));
  // Fold in the frame that unblocked the loading gate (it predates this handler).
  if (room.state !== undefined) ingestState(room.state as ShooterState, room);

  // The server refused an over-speed move and clamped us onto its speed-budget circle
  // (it advances toward the request, never freezes — see ShooterRoomImpl.handleMove).
  // correct() folds the error into the decaying offset so the view eases back rather
  // than teleporting (a large enough gap still cuts straight) AND rebases the send
  // clamp on the authoritative position so the very next send is in budget — one
  // rejection can never cascade.
  room.onMessage("rejected", (payload) => motion.correct(payload as Vec));

  // Server-broadcast shots — tracer + muzzle flash + sfx; hit implies a connect.
  // OWN shots already drew their muzzle/tracer/sound at mousedown (favor-the-
  // shooter feedback below), so only the authoritative hit result is folded in
  // here — drawing them again ~RTT later would double every effect.
  room.onMessage("shot", (payload) => {
    const p = payload as {
      from?: string;
      ox: number;
      oy: number;
      dir: number;
      dist?: number;
      w?: number;
      hitId?: string;
      dmg?: number;
    };
    const now = performance.now();
    const wIdx = typeof p.w === "number" ? p.w : 0;
    const range = WEAPONS[wIdx]?.range ?? SHOOTER.shotRange;
    // Authoritative tracer length: the victim, a crate face, or the weapon's max range.
    const dist = typeof p.dist === "number" ? p.dist : range;
    if (p.from !== myId) {
      // The server's ox/oy is the shooter's AUTHORITATIVE position, which trails the
      // local render (half an RTT + a tick) and leads remote interpolation — so a
      // moving shooter's tracer would spawn visibly behind (or ahead of) their sprite.
      // Anchor the visual to wherever the shooter is actually DRAWN this frame; the
      // server origin stays the fallback for shooters outside the view.
      const anchor = (p.from && lastDrawn.get(p.from)) || { x: p.ox, y: p.oy };
      const tx = anchor.x + Math.cos(p.dir) * dist;
      const ty = anchor.y + Math.sin(p.dir) * dist;
      tracers.push({
        ox: anchor.x,
        oy: anchor.y,
        tx,
        ty,
        hit: p.hitId !== undefined,
        color: weaponTracerColor(wIdx),
        until: now + 120,
      });
      effects.push({ kind: "muzzle", x: anchor.x, y: anchor.y, dir: p.dir, until: now + 80 });
      if (p.hitId === undefined && dist < range - 1) {
        effects.push({ kind: "impact", x: tx, y: ty, until: now + 110 }); // crate impact spark
      }
      playSound("shot");
    }
    if (p.hitId !== undefined) {
      hitFlash.set(p.hitId, now + 140);
      playSound("hit");
      // Own confirmed hit: crosshair hit-marker + a floating damage number rising off
      // the victim (their last drawn position — skip if they're not in view).
      if (p.from === myId) {
        hitMarkerUntil = now + 120;
        const victim = lastDrawn.get(p.hitId);
        if (victim && typeof p.dmg === "number") {
          damageNumbers.push({ x: victim.x, y: victim.y, dmg: p.dmg, until: now + 600 });
        }
      }
    }
  });

  // Global kill feed + own killstreak banners.
  room.onMessage("kill", (payload) => {
    const p = payload as { k: string; v: string; kn?: string; vn?: string; by: string };
    const glyph = KILL_GLYPHS[p.by] ?? "•";
    const killer = p.kn ?? p.k.slice(0, 6);
    const victim = p.vn ?? p.v.slice(0, 6);
    killFeed.unshift({ text: `${glyph} ${killer} ▸ ${victim}`, mine: p.k === myId, until: performance.now() + 4000 });
    while (killFeed.length > 5) killFeed.pop();
    if (p.k === myId) {
      killStreak += 1;
      const label = killStreak >= 8 ? "UNSTOPPABLE!" : killStreak >= 5 ? "RAMPAGE!" : killStreak >= 3 ? "KILLING SPREE!" : "";
      if (label) {
        streakBannerText = label;
        streakBannerUntil = performance.now() + 1600;
      }
    }
  });

  // Pickup collected: a pop ring at the spot, and a soft chime if it was ours.
  room.onMessage("grab", (payload) => {
    const p = payload as { id: string; i: number; kind: string };
    const s = pickupSpots[p.i];
    if (s) effects.push({ kind: "respawn", x: s.x, y: s.y, until: performance.now() + 350 });
    if (p.id === myId) playSound("hit");
  });

  // Round over: a 5 s centre overlay with the winner + runners-up.
  room.onMessage("round", (payload) => {
    const p = payload as { top?: { id: string; nick?: string; score: number }[] };
    roundTop = p.top ?? [];
    roundOverUntil = performance.now() + 5000;
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  // Client-side mirror of the server fire cooldown: gates the send (a shot
  // inside the window is ignored server-side anyway — don't spend rate-limit
  // budget on it) and the local effects. Both sides measure their own monotonic
  // span, so no clock sync is involved.
  let lastLocalShotAt = -Infinity;
  // Fire once, gated by the client-side cooldown mirror. Shared by the mouse
  // (mousedown) and touch (the right stick's auto-fire, called every render frame
  // while deflected past the threshold — the per-weapon cooldown rate-limits it).
  tryFire = () => {
    const nowW = performance.now();
    const spec = WEAPONS[myWeapon] ?? WEAPONS[0]!;
    // Client-side mirror of the equipped weapon's fire-rate cap.
    if (nowW - lastLocalShotAt < spec.cooldownMs) return;
    lastLocalShotAt = nowW;
    // Client stamps the subtick ts automatically (subtickTimestamps: true).
    room.send("shoot", { dir: aim });
    // Favor-the-shooter feedback: muzzle/tracer/sound NOW, not half an RTT later.
    // The authoritative outcome still comes from the server's rewound hitscan —
    // the own-shot branch of the `shot` handler above only folds in the hit.
    // Crates are shared with the server, so the local tracer clips at the SAME
    // cover the authoritative shot will stop at (broken crates skipped, no lying
    // tracers through boxes). The shotgun fans `rays` across `spread`, exactly as
    // the server does per ray.
    const me = lastDrawn.get(myId) ?? motion.renderPosition;
    const color = weaponTracerColor(myWeapon);
    for (let i = 0; i < spec.rays; i++) {
      const rayDir = spec.rays > 1 ? aim + (i / (spec.rays - 1) - 0.5) * spec.spread : aim;
      const cd = Math.cos(rayDir);
      const sd = Math.sin(rayDir);
      const dist = Math.min(
        spec.range,
        rayCoverDistance(crates, me.x, me.y, cd, sd, spec.range, isBrokenIdx),
      );
      const tx = me.x + cd * dist;
      const ty = me.y + sd * dist;
      tracers.push({ ox: me.x, oy: me.y, tx, ty, hit: false, color, until: nowW + 120 });
      if (dist < spec.range - 1) effects.push({ kind: "impact", x: tx, y: ty, until: nowW + 110 });
    }
    effects.push({ kind: "muzzle", x: me.x, y: me.y, dir: aim, until: nowW + 80 });
    playSound("shot");
  };
  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return; // left-click fires
    tryFire();
  });
  // Suppress the browser context menu over the canvas (right-click mid-game).
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // Dual floating virtual sticks (touch only). Left half → move, right half → aim.
  // A pointer that lands on a weapon button swaps the weapon and starts no stick.
  if (isTouch) {
    const localPoint = (e: PointerEvent): Vec => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault(); // stop scroll / double-tap zoom (CSS touch-action backs this up)
      const p = localPoint(e);
      // Weapon buttons win over stick assignment — a tap here never starts a stick.
      const hit = weaponButtonRects().find((b) => p.x >= b.x && p.x <= b.x + b.s && p.y >= b.y && p.y <= b.y + b.s);
      if (hit) {
        if (hit.w !== myWeapon) {
          myWeapon = hit.w;
          room.send("weapon", { w: hit.w }); // same optimistic echo as the Digit keys
        }
        return;
      }
      if (p.x < canvas.width / 2) {
        if (movePointerId !== -1) return; // one owner per half; ignore extra touches
        movePointerId = e.pointerId;
        moveOrigin.x = p.x;
        moveOrigin.y = p.y;
        moveKnob.x = p.x;
        moveKnob.y = p.y;
        stickMove = { x: 0, y: 0 };
      } else {
        if (aimPointerId !== -1) return;
        aimPointerId = e.pointerId;
        aimOrigin.x = p.x;
        aimOrigin.y = p.y;
        aimKnob.x = p.x;
        aimKnob.y = p.y;
        stickAim.active = true;
        stickAim.fire = false;
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      const p = localPoint(e);
      if (e.pointerId === movePointerId) {
        let dx = p.x - moveOrigin.x;
        let dy = p.y - moveOrigin.y;
        const mag = Math.hypot(dx, dy);
        if (mag > STICK_R) {
          dx = (dx / mag) * STICK_R;
          dy = (dy / mag) * STICK_R;
        }
        moveKnob.x = moveOrigin.x + dx;
        moveKnob.y = moveOrigin.y + dy;
        stickMove = { x: dx / STICK_R, y: dy / STICK_R }; // magnitude ≤ 1
      } else if (e.pointerId === aimPointerId) {
        const dx = p.x - aimOrigin.x;
        const dy = p.y - aimOrigin.y;
        const mag = Math.hypot(dx, dy);
        const clamped = Math.min(mag, STICK_R);
        if (mag > 0) {
          aimKnob.x = aimOrigin.x + (dx / mag) * clamped;
          aimKnob.y = aimOrigin.y + (dy / mag) * clamped;
        }
        if (mag > 12) stickAim.dir = Math.atan2(dy, dx); // 12px dead zone
        stickAim.fire = mag >= STICK_R * 0.6; // deflect ≥ 60% → auto-fire
      }
    });
    const endPointer = (e: PointerEvent): void => {
      if (e.pointerId === movePointerId) {
        movePointerId = -1;
        stickMove = { x: 0, y: 0 };
      } else if (e.pointerId === aimPointerId) {
        aimPointerId = -1;
        stickAim.active = false; // aim keeps its last dir — never snaps to 0
        stickAim.fire = false;
      }
    };
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
  }
  addEventListener("keydown", (e) => {
    keys.add(e.key.toLowerCase());
    // Weapon swap on 1/2/3 (Digit code or the bare key). Optimistic local echo; the
    // authoritative `w` on our own player confirms it.
    const w =
      e.code === "Digit1" || e.key === "1" ? 0 : e.code === "Digit2" || e.key === "2" ? 1 : e.code === "Digit3" || e.key === "3" ? 2 : -1;
    if (w >= 0 && w !== myWeapon) {
      myWeapon = w;
      room.send("weapon", { w });
    }
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // Send loop at the tick rate (20 Hz). Movement itself is integrated continuously in
  // the render loop; here we only snapshot that position, stamp the aim, and emit one
  // authoritative `move`. The wire/server contract is unchanged — the client just
  // decouples "how often I render" from "how often I send".
  //
  // sendPosition() is the single choke point every outgoing position passes through:
  // it clamps the snapshot to the server's per-move speed budget measured from the
  // last SENT position over the elapsed time since the last send (setInterval ticks
  // jitter late, so an unclamped snapshot could be over-budget despite legal speed —
  // the FPS rubber-banding bug). It takes the server clock — the same clock the SDK
  // stamps into this input's `ts` — so the client's budget and the delta the server
  // measures for this move agree (see ShooterRoomImpl.handleMove). Send exactly this
  // value and record exactly this value in the predictor; anything else reopens the
  // rubber-band path.
  setInterval(() => {
    // The self sprite sits at the screen centre, so the aim origin is screen centre.
    // Touch: take the right stick's angle while it's held; when released, `aim` keeps
    // its last value (stick inactive → leave it be) instead of snapping to 0.
    if (isTouch) {
      if (stickAim.active) aim = stickAim.dir;
    } else {
      aim = Math.atan2(mouse.y - canvas.height / 2, mouse.x - canvas.width / 2);
    }
    seq += 1;
    const sent = motion.sendPosition(room.clock.serverNow());
    room.send("move", { x: sent.x, y: sent.y, aim });
    predictor.predict(seq, sent);
  }, SHOOTER.stepMs);

  running = true;
  resizeCanvas();
  addEventListener("resize", resizeCanvas);
  requestAnimationFrame(render);
  void refreshLeaderboard();
  setInterval(() => void refreshLeaderboard(), 5000);
}

/** Push a state frame into the interp buffer and detect death/respawn/seed. */
function ingestState(st: ShooterState, room: Room): void {
  buffer.push(room.lastStateServerTime ?? performance.now(), st);
  // Newest broken-crate set drives collision prediction (the `constrain` closure) and
  // the broken-crate rendering skip — read raw, never lerped.
  latestBroken = st.broken;
  const me = st.players[myId];
  if (me) {
    predictor.reconcile({ x: me.x, y: me.y }, room.lastAckSeq);
    // Feed the authoritative echo to the render predictor: `alive` gates integration
    // (a dead player holding a key must not dead-reckon away) and arms the respawn
    // snap; reconcile() ignores small gaps (just send/RTT lag under this client-
    // authoritative model) and snaps only when `continuous` is known-stale — the
    // first frame ever (the WORLD_CENTER placeholder), a respawn, or a ≥ snap-
    // distance teleport — resetting the send clamp so the next send passes through.
    motion.alive = me.alive;
    motion.reconcile({ x: me.x, y: me.y });
  }

  if (crateSeed === null && typeof st.seed === "number") {
    crateSeed = st.seed;
    crates = makeCrates(st.seed, SHOOTER.world);
    // Same seed-derived spots the server grabs against (shooter-map.ts) — no wire cost.
    pickupSpots = makePickups(st.seed, SHOOTER.world, crates, SHOOTER.pickupCount);
  }

  const now = performance.now();
  const seenNow = new Set<string>();
  for (const id of Object.keys(st.players)) {
    const p = st.players[id]!;
    seenNow.add(id);
    const was = prevAlive.get(id);
    if (was === true && !p.alive) {
      effects.push({ kind: "death", x: p.x, y: p.y, until: now + 500 });
      playSound("death");
      if (id === myId) killStreak = 0; // a death breaks our streak
    } else if (was === false && p.alive) {
      effects.push({ kind: "respawn", x: p.x, y: p.y, until: now + 450 });
    }
    prevAlive.set(id, p.alive);
  }
  // Drop players that left view so a re-entry re-detects transitions cleanly.
  for (const id of [...prevAlive.keys()]) {
    if (!seenNow.has(id)) prevAlive.delete(id);
  }
}

interface LeaderRow {
  rank: number;
  playerId: string;
  displayName: string | null;
  score: number;
}

async function refreshLeaderboard(): Promise<void> {
  if (!lbEl) return;
  try {
    const res = await fetch("/api/leaderboard?board=shooter-top&limit=5");
    if (!res.ok) return;
    const rows = (await res.json()) as LeaderRow[];
    const items = rows
      .map((r) => `<li>${escapeHtml(r.displayName ?? r.playerId.slice(0, 6))} — ${r.score}</li>`)
      .join("");
    lbEl.innerHTML = `<b>shooter-top</b><ol>${items}</ol>`;
  } catch {
    /* leaderboard is best-effort; ignore transient fetch errors */
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function resizeCanvas(): void {
  const top = 72; // clears the fixed demo bar
  canvas.width = Math.max(320, Math.floor(window.innerWidth));
  canvas.height = Math.max(240, Math.floor(window.innerHeight - top));
}

const PLAYER_SIZE = 30;

/** Current WASD direction as a signed (un-normalized) vector; {0,0} when idle. */
function moveDir(): Vec {
  let x = 0;
  let y = 0;
  if (keys.has("w")) y -= 1;
  if (keys.has("s")) y += 1;
  if (keys.has("a")) x -= 1;
  if (keys.has("d")) x += 1;
  return { x, y };
}

function render(): void {
  if (!running) return;
  const now = performance.now();
  const dtMs = lastRenderMs === 0 ? 16 : now - lastRenderMs;
  lastRenderMs = now;

  // Integrate the local player continuously at frame rate (decoupled from the 20 Hz
  // send loop) so screen motion is uniform every frame instead of stepping ~25 u per
  // tick; frame() also melts any server-correction offset so a snapback eases in
  // (and skips integration while dead). The camera tracks this already-smooth render
  // position 1:1 — no easing, which would only add a trail / input lag — with integer
  // pixel snap to keep the tiled ground from shimmering as the offset crosses
  // sub-pixel boundaries.
  const dir = isTouch ? stickMove : moveDir();
  const { x: renderX, y: renderY } = motion.frame(dir.x, dir.y, dtMs);
  lastDrawn.set(myId, { x: renderX, y: renderY });
  // Touch auto-fire: hold the right stick past the threshold to keep shooting; the
  // per-weapon cooldown mirror inside tryFire() rate-limits the per-frame calls.
  if (isTouch && stickAim.fire) tryFire();
  cam.x = renderX;
  cam.y = renderY;
  const camX = Math.round(cam.x - canvas.width / 2);
  const camY = Math.round(cam.y - canvas.height / 2);

  drawGround(camX, camY);
  drawWorldBounds(camX, camY);
  drawCrates(camX, camY);

  // Sample the interp buffer once on the server clock — the zone, pickups and
  // every remote player read this same authoritative view for the frame.
  const view = buffer.sample(sampleServerNow());

  drawZone(view, camX, camY); // translucent red outside the shrink circle (world-space)
  drawPickups(view, camX, camY, now);

  // Tracers (under the players), fading as they expire.
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i]!;
    if (tr.until <= now) {
      tracers.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = tr.hit ? "#00e5a0" : tr.color ?? "rgba(230,237,243,0.35)";
    ctx.lineWidth = tr.hit ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(tr.ox - camX, tr.oy - camY);
    ctx.lineTo(tr.tx - camX, tr.ty - camY);
    ctx.stroke();
  }

  drawEffects(camX, camY, now);

  const seen = new Set<string>();
  if (view) {
    for (const id of Object.keys(view.players)) {
      if (id === myId) continue;
      const pl = view.players[id]!;
      seen.add(id);
      // Ease each remote's buffered position/facing so low-rate tier updates don't pop.
      const sm = smoother.update(id, { x: pl.x, y: pl.y, angle: pl.aim }, dtMs);
      lastDrawn.set(id, { x: sm.x, y: sm.y });
      drawPlayer(
        { aim: sm.angle, hp: pl.hp, score: pl.score, alive: pl.alive },
        sm.x - camX,
        sm.y - camY,
        false,
        hitFlash.get(id),
        now,
      );
      if (pl.alive && pl.sp) drawSpawnRing(sm.x - camX, sm.y - camY, now);
    }
  }
  // Forget entities that left the AOI view so a re-entry snaps in rather than glides.
  smoother.prune(seen);
  for (const id of [...lastDrawn.keys()]) {
    if (id !== myId && !seen.has(id)) lastDrawn.delete(id);
  }

  // Local player: drawn at the continuous render position (= camera centre) so it moves
  // uniformly with the world every frame and stays locked to screen centre.
  const meState = view?.players[myId];
  // AOI delivers only players in view; the count always includes the local player.
  const visible = Math.max(view ? Object.keys(view.players).length : 0, 1);
  const meAlive = meState?.alive ?? true;
  drawPlayer(
    { aim, hp: meState?.hp ?? SHOOTER.maxHp, score: meState?.score ?? 0, alive: meAlive },
    renderX - camX,
    renderY - camY,
    true,
    hitFlash.get(myId),
    now,
  );
  if (meAlive && meState?.sp) drawSpawnRing(renderX - camX, renderY - camY, now);
  // Damage-boost tag over our own HP bar while the boost is live.
  if (meAlive && meState?.db) {
    ctx.fillStyle = "#ff9f43";
    ctx.font = "bold 11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("×2", renderX - camX, renderY - camY - 34);
    ctx.textAlign = "start";
  }

  // Floating own-hit damage numbers (world-anchored), above the sprites.
  drawDamageNumbers(camX, camY, now);

  // Screen-space overlays.
  drawHud(meState?.hp ?? SHOOTER.maxHp, meState?.score ?? 0, visible, myWeapon, meState?.db ?? false);
  drawRadar(view, renderX, renderY);
  drawHitMarker(now);
  drawKillFeed(now);
  drawRoundUI(view, now);
  drawStreakBanner(now);
  // Outside-zone danger: a pulsing red vignette + a warning under the crosshair.
  if (view && meAlive && Math.hypot(renderX - view.zx, renderY - view.zy) > view.zr) {
    drawZoneWarning(now);
  }
  // Touch UI on top of everything: weapon buttons + the floating sticks.
  drawTouchControls();
  requestAnimationFrame(render);
}

/**
 * Weapon touch buttons: three 44px squares [1][2][3] stacked vertically, right-aligned
 * (14px pad) and sitting just above the bottom-right radar (168px + 14px pad). Shared by
 * the pointerdown hit-test and the renderer so tap targets and glyphs never drift.
 */
function weaponButtonRects(): { x: number; y: number; s: number; w: number }[] {
  const s = 44;
  const gap = 8;
  const pad = 14;
  const radarTop = canvas.height - 168 - pad;
  const x = canvas.width - pad - s;
  // Index w at [1][2][3] top-to-bottom; w=2 sits one gap above the radar.
  return [0, 1, 2].map((w) => ({ x, y: radarTop - gap - s - (2 - w) * (s + gap), s, w }));
}

/** Draw the touch weapon buttons and any active floating stick (screen-space, no camera). */
function drawTouchControls(): void {
  if (!isTouch) return;
  for (const b of weaponButtonRects()) {
    const active = b.w === myWeapon;
    ctx.fillStyle = "rgba(16,21,29,0.85)";
    ctx.strokeStyle = active ? "#00e5a0" : "#232b36";
    ctx.lineWidth = active ? 2 : 1;
    roundRect(b.x, b.y, b.s, b.s, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = active ? "#00e5a0" : "#8b98a8";
    ctx.font = "bold 18px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(b.w + 1), b.x + b.s / 2, b.y + b.s / 2 + 1);
    ctx.textBaseline = "alphabetic";
  }
  ctx.textAlign = "start";
  // Floating sticks: invisible until a finger owns them.
  if (movePointerId !== -1) drawStick(moveOrigin, moveKnob, "#00e5a0");
  if (aimPointerId !== -1) drawStick(aimOrigin, aimKnob, stickAim.fire ? "#ff6b6b" : "#58a6ff");
}

/** One floating stick: a translucent base ring at the origin + a neon/blue knob. */
function drawStick(origin: Vec, knob: Vec, knobColor: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, STICK_R, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(16,21,29,0.28)";
  ctx.fill();
  ctx.strokeStyle = "rgba(35,43,54,0.9)"; // #232b36-ish
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(knob.x, knob.y, 22, 0, Math.PI * 2);
  ctx.fillStyle = knobColor;
  ctx.fill();
  ctx.restore();
}

/**
 * Bottom-right radar. Shows the whole arena: crates (static), the view-radius
 * ring, yourself (neon, aim tick) and every player the server let you see. The
 * enemy dots are exactly the AOI-filtered state — the radar reveals nothing the
 * state stream didn't already contain, so it cannot be a wallhack.
 */
function drawRadar(view: ShooterState | undefined, selfX: number, selfY: number): void {
  const size = 168;
  const pad = 14;
  const x0 = canvas.width - size - pad;
  const y0 = canvas.height - size - pad;
  const s = size / SHOOTER.world; // world units -> radar px

  ctx.save();
  // Panel (matches the HUD styling).
  ctx.fillStyle = "rgba(16,21,29,0.82)";
  ctx.strokeStyle = "#232b36";
  ctx.lineWidth = 1;
  roundRect(x0, y0, size, size, 10);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  roundRect(x0, y0, size, size, 10);
  ctx.clip();

  // Crates — the same authoritative cover the hitscan uses (broken ones drop out).
  ctx.fillStyle = "rgba(139,152,168,0.5)";
  for (let i = 0; i < crates.length; i++) {
    if (isBrokenIdx(i)) continue;
    const cr = crates[i]!;
    const cs = Math.max(2, cr.size * s);
    ctx.fillRect(x0 + cr.x * s - cs / 2, y0 + cr.y * s - cs / 2, cs, cs);
  }

  // Shrink zone (red circle), so the safe area reads on the minimap too.
  if (view) {
    ctx.strokeStyle = "rgba(255,107,107,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x0 + view.zx * s, y0 + view.zy * s, view.zr * s, 0, Math.PI * 2);
    ctx.stroke();
  }

  // View-radius ring around yourself (what the AOI lets you see).
  ctx.strokeStyle = "rgba(0,229,160,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x0 + selfX * s, y0 + selfY * s, SHOOTER.viewRadius * s, 0, Math.PI * 2);
  ctx.stroke();

  // Everyone in the AOI view (red: alive enemies; dim: corpses).
  if (view) {
    for (const id of Object.keys(view.players)) {
      if (id === myId) continue;
      const pl = view.players[id]!;
      ctx.fillStyle = pl.alive ? "#ff6b6b" : "rgba(139,152,168,0.4)";
      ctx.beginPath();
      ctx.arc(x0 + pl.x * s, y0 + pl.y * s, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Self: neon dot + a short aim tick.
  const sx = x0 + selfX * s;
  const sy = y0 + selfY * s;
  ctx.fillStyle = "#00e5a0";
  ctx.beginPath();
  ctx.arc(sx, sy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#00e5a0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + Math.cos(aim) * 8, sy + Math.sin(aim) * 8);
  ctx.stroke();

  ctx.restore();
}

function drawGround(camX: number, camY: number): void {
  // Calm, flat arena. The old 64px photo-tile shimmered at scroll speed (every
  // frame re-rasterized a busy texture — genuinely eye-straining); a flat brand
  // ground + a sparse, low-contrast dot grid gives the camera the same motion
  // cue with none of the noise.
  ctx.fillStyle = "#0b0f15";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const grid = 56;
  const startX = -(((camX % grid) + grid) % grid);
  const startY = -(((camY % grid) + grid) % grid);
  ctx.fillStyle = "rgba(35,45,58,0.55)";
  for (let x = startX; x < canvas.width; x += grid) {
    for (let y = startY; y < canvas.height; y += grid) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

function drawWorldBounds(camX: number, camY: number): void {
  ctx.strokeStyle = "rgba(0,229,160,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-camX, -camY, SHOOTER.world, SHOOTER.world);
}

function drawCrates(camX: number, camY: number): void {
  if (crates.length === 0) return;
  const sprite = sprites.crate;
  for (let i = 0; i < crates.length; i++) {
    const cr = crates[i]!;
    const x = cr.x - camX;
    const y = cr.y - camY;
    if (x < -cr.size || y < -cr.size || x > canvas.width + cr.size || y > canvas.height + cr.size) continue;
    if (isBrokenIdx(i)) {
      // Destroyed cover: a flattened debris slab + a couple of scattered strokes.
      const h = cr.size / 2;
      ctx.fillStyle = "#0d1219";
      ctx.fillRect(x - h, y - cr.size / 6, cr.size, cr.size / 3);
      ctx.strokeStyle = "#2a333f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * h * 0.6;
        ctx.moveTo(x + ox, y - 3);
        ctx.lineTo(x + ox + 4, y + 4);
      }
      ctx.stroke();
      continue;
    }
    if (sprite) {
      ctx.drawImage(sprite, x - cr.size / 2, y - cr.size / 2, cr.size, cr.size);
    } else {
      ctx.fillStyle = "#161d27";
      ctx.strokeStyle = "#33404f";
      ctx.lineWidth = 2;
      ctx.fillRect(x - cr.size / 2, y - cr.size / 2, cr.size, cr.size);
      ctx.strokeRect(x - cr.size / 2, y - cr.size / 2, cr.size, cr.size);
    }
  }
}

function drawEffects(camX: number, camY: number, now: number): void {
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i]!;
    if (fx.until <= now) {
      effects.splice(i, 1);
      continue;
    }
    const x = fx.x - camX;
    const y = fx.y - camY;
    if (fx.kind === "muzzle") {
      const life = (fx.until - now) / 80; // 1 -> 0
      const flash = sprites.muzzleFlash;
      if (flash) {
        const s = 26 * (0.7 + life * 0.6);
        ctx.save();
        ctx.globalAlpha = life;
        ctx.translate(x + Math.cos(fx.dir) * 16, y + Math.sin(fx.dir) * 16);
        // muzzle.png points up (-Y); +90° aligns its nose with the aim vector.
        ctx.rotate(fx.dir + Math.PI / 2);
        ctx.drawImage(flash, -s / 2, -s / 2, s, s);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = life;
        ctx.fillStyle = "#f2cc60";
        const mx = x + Math.cos(fx.dir) * 18;
        const my = y + Math.sin(fx.dir) * 18;
        ctx.beginPath();
        ctx.arc(mx, my, 5 * (0.6 + life), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (fx.kind === "impact") {
      // Crate impact: a brief spark burst where the tracer stopped.
      const life = (fx.until - now) / 110; // 1 -> 0
      ctx.save();
      ctx.globalAlpha = life;
      ctx.strokeStyle = "#f2cc60";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.4;
        const r0 = 3 + (1 - life) * 3;
        const r1 = r0 + 5 + (1 - life) * 6;
        ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
        ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      }
      ctx.stroke();
      ctx.restore();
    } else {
      const total = fx.kind === "death" ? 500 : 450;
      const life = (fx.until - now) / total; // 1 -> 0
      const r = (1 - life) * (fx.kind === "death" ? 34 : 26) + 8;
      ctx.save();
      ctx.globalAlpha = life;
      ctx.strokeStyle = fx.kind === "death" ? "#ff6b6b" : "#00e5a0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawPlayer(
  p: { aim: number; hp: number; score: number; alive: boolean },
  x: number,
  y: number,
  isSelf: boolean,
  flashUntil: number | undefined,
  now: number,
): void {
  if (!p.alive) {
    ctx.strokeStyle = "rgba(230,237,243,0.25)";
    circle(x, y, 12, false);
    return;
  }
  const sprite = isSelf ? sprites.playerBody : sprites.enemyBody;
  const flashing = flashUntil !== undefined && flashUntil > now;
  if (sprite) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.aim);
    ctx.drawImage(sprite, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    if (flashing) {
      ctx.globalAlpha = 0.5;
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "#ff6b6b";
      ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    }
    ctx.restore();
  } else {
    // Vector fallback: filled circle + aim spoke.
    ctx.fillStyle = flashing ? "#ff6b6b" : isSelf ? "#00e5a0" : "#58a6ff";
    circle(x, y, 12, true);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(p.aim) * 20, y + Math.sin(p.aim) * 20);
    ctx.stroke();
  }
  // HP bar (screen-space, above the sprite).
  const w = 30;
  ctx.fillStyle = "rgba(16,21,29,0.9)";
  ctx.fillRect(x - w / 2, y - 26, w, 4);
  ctx.fillStyle = isSelf ? "#00e5a0" : "#58a6ff";
  ctx.fillRect(x - w / 2, y - 26, (w * Math.max(0, p.hp)) / SHOOTER.maxHp, 4);
  label(`${p.score}`, x, y + 30);
}

function drawHud(
  hp: number,
  score: number,
  count: number,
  weapon: number,
  db: boolean,
): void {
  const pad = 14;
  const w = 210;
  const h = 118;
  const x = pad;
  const y = canvas.height - h - pad;
  ctx.fillStyle = "rgba(16,21,29,0.85)";
  ctx.strokeStyle = "#232b36";
  ctx.lineWidth = 1;
  roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();

  // HP bar.
  const bx = x + 14;
  const by = y + 16;
  const bw = w - 28;
  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(bx, by, bw, 10);
  const frac = clamp(hp / SHOOTER.maxHp, 0, 1);
  ctx.fillStyle = frac > 0.5 ? "#00e5a0" : frac > 0.25 ? "#f2cc60" : "#ff6b6b";
  ctx.fillRect(bx, by, bw * frac, 10);
  ctx.fillStyle = "#e6edf3";
  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`HP ${Math.max(0, Math.round(hp))}`, bx, by + 26);
  ctx.textAlign = "right";
  ctx.fillText(`SCORE ${score}`, bx + bw, by + 26);
  ctx.textAlign = "left";
  ctx.fillStyle = "#8b98a8";
  ctx.fillText(`${count}/${MAX_PLAYERS} in view`, bx, by + 42);

  // Equipped weapon.
  const spec = WEAPONS[weapon] ?? WEAPONS[0]!;
  ctx.fillStyle = "#e6edf3";
  ctx.fillText(`WEAPON ${spec.name}`, bx, by + 60);
  // Damage-boost indicator (only while active).
  if (db) {
    ctx.fillStyle = "#ff9f43";
    ctx.fillText("DMG ×2", bx, by + 76);
  }
  // Controls hint (touch swaps the keyboard line for the stick legend).
  ctx.fillStyle = "#8b98a8";
  ctx.fillText(isTouch ? "sticks: move / aim · tap 1-3" : "1/2/3 swap weapons", bx, by + 92);
  ctx.textAlign = "start";
}

/** Pulsing neon ring around a spawn-protected player (self or remote). */
function drawSpawnRing(x: number, y: number, now: number): void {
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.25 * Math.sin(now / 150);
  ctx.strokeStyle = "#00e5a0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Floating `-N` damage numbers from own confirmed hits, rising ~24 px as they fade. */
function drawDamageNumbers(camX: number, camY: number, now: number): void {
  ctx.save();
  ctx.font = "bold 13px ui-monospace, monospace";
  ctx.textAlign = "center";
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const d = damageNumbers[i]!;
    if (d.until <= now) {
      damageNumbers.splice(i, 1);
      continue;
    }
    const life = (d.until - now) / 600; // 1 -> 0
    ctx.globalAlpha = life;
    ctx.fillStyle = "#ffd166";
    ctx.fillText(`-${d.dmg}`, d.x - camX, d.y - camY - (1 - life) * 24);
  }
  ctx.restore();
  ctx.textAlign = "start";
}

/** Crosshair hit-marker: 4 short diagonal ticks around screen centre, ~120 ms fade. */
function drawHitMarker(now: number): void {
  if (hitMarkerUntil <= now) return;
  const life = (hitMarkerUntil - now) / 120; // 1 -> 0
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.save();
  ctx.globalAlpha = life;
  ctx.strokeStyle = "#00e5a0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    ctx.moveTo(cx + sx * 6, cy + sy * 6);
    ctx.lineTo(cx + sx * 12, cy + sy * 12);
  }
  ctx.stroke();
  ctx.restore();
}

/** Top-right kill feed: newest on top, max 5, killer's name in neon when it's us. */
function drawKillFeed(now: number): void {
  for (let i = killFeed.length - 1; i >= 0; i--) {
    if (killFeed[i]!.until <= now) killFeed.splice(i, 1);
  }
  if (killFeed.length === 0) return;
  ctx.save();
  ctx.font = "12px ui-monospace, monospace";
  ctx.textAlign = "right";
  const rx = canvas.width - 16;
  let y = 200; // clears the HTML leaderboard panel in the top-right corner
  for (const k of killFeed.slice(0, 5)) {
    ctx.globalAlpha = Math.min(1, (k.until - now) / 400); // fade the last 400 ms
    ctx.fillStyle = k.mine ? "#00e5a0" : "#e6edf3";
    ctx.fillText(k.text, rx, y);
    y += 18;
  }
  ctx.restore();
  ctx.textAlign = "start";
}

/** Centre killstreak banner (KILLING SPREE! / RAMPAGE! / UNSTOPPABLE!), ~1.6 s. */
function drawStreakBanner(now: number): void {
  if (streakBannerUntil <= now) return;
  const life = (streakBannerUntil - now) / 1600; // 1 -> 0
  ctx.save();
  ctx.globalAlpha = Math.min(1, life * 2);
  ctx.font = "bold 34px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#00e5a0";
  ctx.shadowColor = "#00e5a0";
  ctx.shadowBlur = 16;
  ctx.fillText(streakBannerText, canvas.width / 2, canvas.height * 0.32);
  ctx.restore();
  ctx.textAlign = "start";
}

/** Top-centre round clock (M:SS) plus the 5 s round-over winner overlay. */
function drawRoundUI(view: ShooterState | undefined, now: number): void {
  if (view) {
    const remain = Math.max(0, view.roundEndMs - sampleServerNow());
    const mm = Math.floor(remain / 60000);
    const ss = Math.floor((remain % 60000) / 1000);
    const text = `${mm}:${String(ss).padStart(2, "0")}`;
    const w = 72;
    const hgt = 30;
    const x = canvas.width / 2 - w / 2;
    const y = 14;
    ctx.fillStyle = "rgba(16,21,29,0.85)";
    ctx.strokeStyle = "#232b36";
    ctx.lineWidth = 1;
    roundRect(x, y, w, hgt, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = remain <= 30000 ? "#ff6b6b" : "#e6edf3";
    ctx.font = "16px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, canvas.width / 2, y + 21);
    ctx.textAlign = "start";
  }

  if (roundOverUntil <= now) return;
  const life = (roundOverUntil - now) / 5000; // 1 -> 0
  ctx.save();
  ctx.globalAlpha = Math.min(1, life * 4); // fade over the last ~1.25 s
  ctx.textAlign = "center";
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.42;
  const win = roundTop[0];
  const winName = win ? win.nick ?? win.id.slice(0, 6) : "—";
  ctx.fillStyle = "#00e5a0";
  ctx.shadowColor = "#00e5a0";
  ctx.shadowBlur = 14;
  ctx.font = "bold 26px ui-monospace, monospace";
  ctx.fillText(`ROUND OVER — WINNER: ${winName}${win ? ` (${win.score})` : ""}`, cx, cy);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#8b98a8";
  ctx.font = "14px ui-monospace, monospace";
  for (let i = 1; i < Math.min(3, roundTop.length); i++) {
    const r = roundTop[i]!;
    ctx.fillText(`${i + 1}. ${r.nick ?? r.id.slice(0, 6)} — ${r.score}`, cx, cy + 18 + i * 20);
  }
  ctx.restore();
  ctx.textAlign = "start";
}

/** Translucent red fill OUTSIDE the shrink zone + the zone edge (world-space). */
function drawZone(view: ShooterState | undefined, camX: number, camY: number): void {
  if (!view) return;
  const zx = view.zx - camX;
  const zy = view.zy - camY;
  const zr = view.zr;
  ctx.save();
  // Even-odd fill of (whole screen) minus (zone circle) shades only the danger area.
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.arc(zx, zy, zr, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,60,60,0.08)";
  ctx.fill("evenodd");
  // Zone edge.
  ctx.beginPath();
  ctx.arc(zx, zy, zr, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,107,107,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** Danger feedback while outside the zone: a pulsing red edge vignette + warning text. */
function drawZoneWarning(now: number): void {
  const pulse = 0.25 + 0.2 * Math.sin(now / 200);
  const g = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    Math.min(canvas.width, canvas.height) * 0.35,
    canvas.width / 2,
    canvas.height / 2,
    Math.max(canvas.width, canvas.height) * 0.7,
  );
  g.addColorStop(0, "rgba(255,60,60,0)");
  g.addColorStop(1, `rgba(255,60,60,${pulse.toFixed(3)})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ff6b6b";
  ctx.font = "bold 14px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("OUTSIDE ZONE", canvas.width / 2, canvas.height / 2 + 30);
  ctx.restore();
  ctx.textAlign = "start";
}

/** Active pickups: hp = white cross on a green box, dmg = neon ×2 starburst; idle bob. */
function drawPickups(view: ShooterState | undefined, camX: number, camY: number, now: number): void {
  if (pickupSpots.length === 0) return;
  for (let i = 0; i < pickupSpots.length; i++) {
    if (view?.pickups[String(i)]?.on === false) continue; // missing spot counts as on
    const spot = pickupSpots[i]!;
    const x = spot.x - camX;
    const y = spot.y - camY - Math.sin(now / 300 + i) * 3; // gentle idle bob
    if (x < -20 || y < -20 || x > canvas.width + 20 || y > canvas.height + 20) continue;
    if (spot.kind === "hp") {
      ctx.fillStyle = "rgba(0,229,160,0.18)";
      ctx.strokeStyle = "#00e5a0";
      ctx.lineWidth = 1.5;
      roundRect(x - 9, y - 9, 18, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x, y + 5);
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x + 5, y);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.strokeStyle = "#ff9f43";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
        ctx.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
      }
      ctx.stroke();
      ctx.fillStyle = "#ff9f43";
      ctx.font = "bold 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("×2", x, y + 3);
      ctx.restore();
      ctx.textAlign = "start";
    }
  }
}


function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(x: number, y: number, r: number, fill: boolean): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) ctx.fill();
  else ctx.stroke();
}
function label(text: string, x: number, y: number): void {
  ctx.fillStyle = "#e6edf3";
  ctx.font = "12px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  ctx.textAlign = "start";
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// Wire up the start screen.
// ---------------------------------------------------------------------------
playBtn.addEventListener("click", () => void play());
nickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void play();
});
retryBtn.addEventListener("click", () => {
  loadingPanel.hidden = true;
  startPanel.hidden = false;
});
