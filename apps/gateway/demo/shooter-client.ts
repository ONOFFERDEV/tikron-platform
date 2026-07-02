import { GameClient, InputPredictor, SnapshotBuffer, type Room } from "@tikron/client";
import { stepToward } from "@tikron/sim";
import { ShooterSchema, SHOOTER, type ShooterState } from "../src/rooms/shooter-schema.js";
import { LoadingFlow, type LoadingView } from "./loading.js";
import { followCamera, smoothAxis, smoothAngle, type Cam } from "./camera.js";

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
type SpriteKey = "playerBody" | "enemyBody" | "groundTile" | "crate" | "muzzleFlash";
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
// Deterministic crate cover — visual only, derived from the room seed if present.
// ---------------------------------------------------------------------------
interface Crate {
  x: number;
  y: number;
  size: number;
}
/** xorshift32 PRNG — a compact deterministic generator seeded from the room. */
function xorshift32(seed: number): () => number {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s >>> 0;
  };
}
function makeCrates(seed: number): Crate[] {
  const rng = xorshift32(seed);
  const unit = () => rng() / 0xffffffff;
  const margin = 80;
  const span = SHOOTER.world - margin * 2;
  const crates: Crate[] = [];
  for (let i = 0; i < 44; i++) {
    crates.push({ x: margin + unit() * span, y: margin + unit() * span, size: 26 + unit() * 28 });
  }
  return crates;
}
let crates: Crate[] = [];
let crateSeed: number | null = null;

// ---------------------------------------------------------------------------
// Netcode + view state
// ---------------------------------------------------------------------------
const predictor = new InputPredictor<Vec, Vec>({ x: 1000, y: 1000 }, { apply: (_s, i) => ({ ...i }) });
const buffer = new SnapshotBuffer<ShooterState>({ delayMs: 100, lerp: lerpState });

/**
 * Smoothed camera center in world units. It eases toward `predictor.predicted`
 * each frame instead of tracking it directly, so the per-frame nudges from server
 * reconciliation don't translate the whole world (the "map shakes" symptom). Seeded
 * to the predictor's initial center so the first frame doesn't glide in from origin.
 */
const cam: Cam = { x: 1000, y: 1000 };
/** Wall-clock ms of the previous render, for a frame-rate-independent camera step. */
let lastRenderMs = 0;
/** Camera easing time constant (ms): larger = smoother but laggier. ~60 ms low-passes
 *  the ~20 Hz reconcile nudges while keeping the follow responsive for aiming. */
const CAM_SMOOTH_MS = 60;
/** A camera gap this large (world units) teleports instead of easing. Normal per-tick
 *  motion is ≤ maxSpeed·stepMs ≈ 25 u, so only respawns / big corrections snap. */
const CAM_SNAP_DIST = 300;

/**
 * Per-remote-entity smoothed render state (position + facing), eased on top of the
 * interpolation buffer each frame. AOI priority tiers refresh far players at a lower
 * rate, so their buffered position/aim arrive in coarse steps that pop; the extra
 * exponential pass rounds those corners. Cleared when an entity leaves the AOI view
 * so a re-entry snaps in fresh rather than gliding from its stale last position.
 */
const entityRender = new Map<string, { x: number; y: number; aim: number }>();
/** Entity easing time constant (ms) — a touch softer than the camera's since far
 *  players update least often. */
const ENTITY_SMOOTH_MS = 100;
/** Entity teleport threshold (world units): a jump this large snaps (respawn / warp)
 *  rather than sliding across the map, matching the camera's rule. */
const ENTITY_SNAP_DIST = 300;

let myId = "";
let seq = 0;
let aim = 0; // radians, player -> mouse
const mouse: Vec = { x: 0, y: 0 };
const keys = new Set<string>();
/** Live tracers to draw for a few frames after a `shot` event. */
const tracers: { ox: number; oy: number; tx: number; ty: number; hit: boolean; until: number }[] = [];
/** Transient world-space effects (muzzle flashes, death/respawn rings). */
type Effect = { kind: "muzzle"; x: number; y: number; dir: number; until: number } | { kind: "death" | "respawn"; x: number; y: number; until: number };
const effects: Effect[] = [];
/** Per-player red hit-flash expiry (server clock–independent, wall-clock ms). */
const hitFlash = new Map<string, number>();
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
    players[id] = pa
      ? { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t, aim: pb.aim, hp: pb.hp, score: pb.score, alive: pb.alive }
      : pb;
  }
  return { players, seed: b.seed };
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

  // Server-broadcast shots — tracer + muzzle flash + sfx; hit implies a connect.
  room.onMessage("shot", (payload) => {
    const p = payload as { ox: number; oy: number; dir: number; hitId?: string };
    const now = performance.now();
    tracers.push({
      ox: p.ox,
      oy: p.oy,
      tx: p.ox + Math.cos(p.dir) * SHOOTER.shotRange,
      ty: p.oy + Math.sin(p.dir) * SHOOTER.shotRange,
      hit: p.hitId !== undefined,
      until: now + 120,
    });
    effects.push({ kind: "muzzle", x: p.ox, y: p.oy, dir: p.dir, until: now + 80 });
    playSound("shot");
    if (p.hitId !== undefined) {
      hitFlash.set(p.hitId, now + 140);
      playSound("hit");
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener("mousedown", () => {
    // Client stamps the subtick ts automatically (subtickTimestamps: true).
    room.send("shoot", { dir: aim });
  });
  addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // Input loop at the tick rate: integrate the WASD velocity into the predicted
  // position, update aim, predict locally, and send one authoritative `move`.
  setInterval(() => {
    let vx = 0;
    let vy = 0;
    if (keys.has("w")) vy -= 1;
    if (keys.has("s")) vy += 1;
    if (keys.has("a")) vx -= 1;
    if (keys.has("d")) vx += 1;
    const len = Math.hypot(vx, vy) || 1;
    const desired: Vec = {
      x: predictor.predicted.x + (vx / len) * SHOOTER.maxSpeed * (SHOOTER.stepMs / 1000),
      y: predictor.predicted.y + (vy / len) * SHOOTER.maxSpeed * (SHOOTER.stepMs / 1000),
    };
    const stepped = vx === 0 && vy === 0 ? predictor.predicted : stepToward(predictor.predicted, desired, SHOOTER.maxSpeed, SHOOTER.stepMs);
    const next: Vec = { x: clamp(stepped.x, 0, SHOOTER.world), y: clamp(stepped.y, 0, SHOOTER.world) };
    // The self sprite is locked to the smoothed camera anchor (screen centre), so the
    // aim origin is simply screen centre — keeps the reticle consistent with the body.
    aim = Math.atan2(mouse.y - canvas.height / 2, mouse.x - canvas.width / 2);
    seq += 1;
    room.send("move", { x: next.x, y: next.y, aim });
    predictor.predict(seq, next);
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
  const me = st.players[myId];
  if (me) predictor.reconcile({ x: me.x, y: me.y }, room.lastAckSeq);

  if (crateSeed === null && typeof st.seed === "number") {
    crateSeed = st.seed;
    crates = makeCrates(st.seed);
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

function render(): void {
  if (!running) return;
  const me = predictor.predicted;
  const now = performance.now();
  // Ease the camera center toward the predicted player so reconciliation nudges don't
  // shake the world, then derive a pixel offset rounded to integers so the tiled
  // ground doesn't shimmer as the camera crosses sub-pixel boundaries.
  const dtMs = lastRenderMs === 0 ? 16 : now - lastRenderMs;
  lastRenderMs = now;
  const eased = followCamera(cam, me.x, me.y, dtMs, CAM_SMOOTH_MS, CAM_SNAP_DIST);
  cam.x = eased.x;
  cam.y = eased.y;
  const camX = Math.round(cam.x - canvas.width / 2);
  const camY = Math.round(cam.y - canvas.height / 2);

  drawGround(camX, camY);
  drawWorldBounds(camX, camY);
  drawCrates(camX, camY);

  // Tracers (under the players), fading as they expire.
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i]!;
    if (tr.until <= now) {
      tracers.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = tr.hit ? "#00e5a0" : "rgba(230,237,243,0.35)";
    ctx.lineWidth = tr.hit ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(tr.ox - camX, tr.oy - camY);
    ctx.lineTo(tr.tx - camX, tr.ty - camY);
    ctx.stroke();
  }

  drawEffects(camX, camY, now);

  const view = buffer.sample(sampleServerNow());
  const seen = new Set<string>();
  if (view) {
    for (const id of Object.keys(view.players)) {
      if (id === myId) continue;
      const pl = view.players[id]!;
      seen.add(id);
      // Ease each remote's buffered position/facing so low-rate tier updates don't pop.
      const prev = entityRender.get(id);
      const sm = prev
        ? {
            x: smoothAxis(prev.x, pl.x, dtMs, ENTITY_SMOOTH_MS, ENTITY_SNAP_DIST),
            y: smoothAxis(prev.y, pl.y, dtMs, ENTITY_SMOOTH_MS, ENTITY_SNAP_DIST),
            aim: smoothAngle(prev.aim, pl.aim, dtMs, ENTITY_SMOOTH_MS, Math.PI),
          }
        : { x: pl.x, y: pl.y, aim: pl.aim };
      entityRender.set(id, sm);
      drawPlayer(
        { aim: sm.aim, hp: pl.hp, score: pl.score, alive: pl.alive },
        sm.x - camX,
        sm.y - camY,
        false,
        hitFlash.get(id),
        now,
      );
    }
  }
  // Forget entities that left the AOI view so a re-entry snaps in rather than glides.
  for (const id of [...entityRender.keys()]) {
    if (!seen.has(id)) entityRender.delete(id);
  }

  // Local player: drawn at the smoothed camera anchor (not raw predicted) so its own
  // reconcile jitter doesn't wobble the sprite on screen — self and world share one
  // smoothed frame, keeping it locked to centre.
  const meState = view?.players[myId];
  // AOI delivers only players in view; the count always includes the local player.
  const visible = Math.max(view ? Object.keys(view.players).length : 0, 1);
  drawPlayer(
    { aim, hp: meState?.hp ?? SHOOTER.maxHp, score: meState?.score ?? 0, alive: meState?.alive ?? true },
    cam.x - camX,
    cam.y - camY,
    true,
    hitFlash.get(myId),
    now,
  );

  drawHud(meState?.hp ?? SHOOTER.maxHp, meState?.score ?? 0, visible);
  requestAnimationFrame(render);
}

function drawGround(camX: number, camY: number): void {
  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tile = 64;
  const startX = -(((camX % tile) + tile) % tile);
  const startY = -(((camY % tile) + tile) % tile);
  const ground = sprites.groundTile;
  if (ground) {
    for (let x = startX; x < canvas.width; x += tile) {
      for (let y = startY; y < canvas.height; y += tile) {
        ctx.drawImage(ground, x, y, tile, tile);
      }
    }
    return;
  }
  // Vector fallback: a faint grid so the camera motion reads clearly.
  ctx.strokeStyle = "rgba(35,43,54,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = startX; x < canvas.width; x += tile) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = startY; y < canvas.height; y += tile) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();
}

function drawWorldBounds(camX: number, camY: number): void {
  ctx.strokeStyle = "rgba(0,229,160,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-camX, -camY, SHOOTER.world, SHOOTER.world);
}

function drawCrates(camX: number, camY: number): void {
  if (crates.length === 0) return;
  const sprite = sprites.crate;
  for (const cr of crates) {
    const x = cr.x - camX;
    const y = cr.y - camY;
    if (x < -cr.size || y < -cr.size || x > canvas.width + cr.size || y > canvas.height + cr.size) continue;
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

function drawHud(hp: number, score: number, count: number): void {
  const pad = 14;
  const w = 190;
  const h = 76;
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
  ctx.textAlign = "start";
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
