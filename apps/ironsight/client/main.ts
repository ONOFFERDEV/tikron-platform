/**
 * ironsight client entry point (W-B). Wires the network layer, input, local
 * prediction, the three.js scene, the DOM HUD, and synth audio into one frame
 * loop:
 *   - per authoritative state (`onStateChange`): reconcile the local player,
 *     buffer remote poses for interpolation, and detect damage/death/phase edges;
 *   - per render frame (`rAF`): drive intents (under the 90/s budget), predict the
 *     local player, sample remotes ~100 ms in the past, and render.
 *
 * The auto-nickname quick-join is implicit: `Net.connect()` funnels straight into
 * the single arena room; the lobby UI is an M2 concern.
 */
import { Net, type ShotEvent } from "./net.js";
import { Input } from "./input.js";
import { Predictor } from "./predict.js";
import { SceneRig } from "./scene.js";
import { Hud } from "./hud.js";
import { initAudio, playBoom, playFire, playHit, playKill, playSwap } from "./audio.js";
import { HIP_FOV, INTERP_DELAY_MS } from "./config.js";
import { WEAPONS } from "../src/config.js";
import type { ArenaPlayer, ArenaState } from "../src/schema.js";

interface Pose {
  x: number; y: number; z: number; yaw: number; pitch: number;
  crouch: boolean; team: number; alive: boolean;
}
interface Snap {
  time: number;
  players: Map<string, Pose>;
}

const RESPAWN_MS = 3000; // mirrors MATCH.respawnMs (client countdown only)

async function main(): Promise<void> {
  // Mount the canvas INSIDE #app — the shell's fixed full-screen #app div otherwise stacks
  // above a body-mounted canvas and swallows every click (pointer lock never requested;
  // live-debug finding: mousedown target was DIV#app, requestPointerLock calls = 0).
  const scene = new SceneRig(document.getElementById("app") ?? document.body);
  const hud = new Hud();
  initAudio();
  hud.showLockPrompt(true, "CONNECTING…");

  const net = await Net.connect();
  const me0 = await waitForSelf(net);

  const input = new Input(
    scene.canvas,
    me0?.yaw ?? 0,
    undefined,
    (slot) => net.sendSwitch(slot),
    (dir) => {
      const cur = net.state?.players[net.myId]?.weapon ?? 0;
      const next = (((cur + dir) % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
      net.sendSwitch(next + 1);
    },
    () => net.sendNade(),
  );
  input.pitch = me0?.pitch ?? 0;
  const predictor = new Predictor();
  if (me0) predictor.pos = { x: me0.x, y: me0.y, z: me0.z };

  const name = (id: string): string => (id === net.myId ? "You" : id.slice(0, 4));

  // Read-only introspection hook for E2E tooling / automated screenshots: the
  // authoritative state the client already holds, plus a look setter (equivalent to
  // moving the mouse — the server still validates every shot from its own yaw).
  (window as unknown as { ironsight?: unknown }).ironsight = {
    myId: net.myId,
    state: () => net.state,
    look: (yaw: number, pitch: number) => {
      input.yaw = yaw;
      input.pitch = pitch;
    },
  };

  // --- discrete event + state edge handling ---------------------------------
  const buf: Snap[] = [];
  let prevHp = me0?.hp ?? 100;
  let wasAlive = me0?.alive ?? true;
  let deathAt = -1;
  let respawnSent = false;
  let killerName: string | undefined;
  let matchEnd: { winner: string; red: number; blue: number } | null = null;

  let curWeapon = 0;
  net.onAmmo((e) => {
    hud.setAmmo(e.mag, e.reserve, e.reloadMs);
    // ammo.weapon is the SLOT (1–5, WeaponSpec.slot); everything client-side indexes 0–4.
    const idx = e.weapon - 1;
    hud.setWeapon(idx);
    if (idx !== curWeapon && idx >= 0) {
      curWeapon = idx;
      scene.setWeapon(idx);
      net.setFireInterval(idx);
      playSwap();
    }
  });
  net.onHit((e) => {
    hud.showHitmarker(e.head);
    playHit(e.head);
  });
  net.onKill((e) => {
    hud.addKill(name(e.killer), name(e.victim), e.part, e.killerTeam);
    if (e.victim === net.myId) killerName = name(e.killer);
    if (e.killer === net.myId && e.killer !== e.victim) playKill();
  });
  net.onShot((e: ShotEvent) => {
    scene.addTracer({ x: e.ox, y: e.oy, z: e.oz }, { x: e.dx, y: e.dy, z: e.dz }, e.dist, e.hit);
  });
  net.onMatchEnd((e) => {
    matchEnd = { winner: e.winner, red: e.red, blue: e.blue };
  });
  net.onNadeSpawn((e) => scene.spawnNade(e));
  net.onNadeBounce((e) => scene.bounceNade(e));
  net.onNadeBoom((e) => {
    scene.boomNade(e);
    playBoom();
  });

  net.room.onStateChange((raw) => {
    const state = raw as ArenaState;
    if (state.phase === "live") matchEnd = null;
    const me = state.players[net.myId];
    if (me) {
      predictor.reconcile({ x: me.x, y: me.y, z: me.z });
      predictor.setAlive(me.alive);
      if (me.alive && me.hp < prevHp) hud.flashDamage();
      if (wasAlive && !me.alive) {
        deathAt = performance.now();
        respawnSent = false;
      }
      prevHp = me.hp;
      wasAlive = me.alive;
    }
    // Buffer every player's pose for interpolation (rendered ~INTERP_DELAY in the past).
    const players = new Map<string, Pose>();
    for (const [id, p] of Object.entries(state.players)) {
      players.set(id, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, crouch: p.crouch, team: p.team, alive: p.alive });
    }
    buf.push({ time: performance.now(), players });
    while (buf.length > 24) buf.shift();
  });

  hud.showLockPrompt(true, "CLICK TO PLAY");

  // --- render loop ----------------------------------------------------------
  let last = performance.now();
  let prevYaw = input.yaw;
  let prevPitch = input.pitch;
  // FPS: count rendered frames, publish twice a second (user-visible next to ping).
  let fpsFrames = 0;
  let fpsWindowStart = last;
  const onAds = (held: boolean): void => {
    scene.setAds(held);
    // Zoom slows the turn: scale look sensitivity by the live FOV ratio.
    input.sensScale = scene.currentFov / HIP_FOV;
  };

  function frame(now: number): void {
    const dt = Math.min(100, now - last);
    last = now;
    const state = net.state;

    // Intents (net enforces the send budget).
    const intent = input.intent();
    net.setMoveIntent(intent, now);
    net.setLook(input.yaw, input.pitch, now);
    predictor.frame(dt, intent, input.yaw);
    input.consumeJump();
    if (input.consumeReload()) net.reload();

    const me = state?.players[net.myId];
    const phase = state?.phase ?? "live";
    const alive = me?.alive ?? false;

    // Firing (server fire interval is the truth; net gates, we kick locally).
    if (input.isFiring && alive && phase === "live") {
      if (net.tryFire(now)) {
        scene.fireRecoil(curWeapon);
        playFire(curWeapon);
      }
    }

    // Camera from prediction (local, immediate) — hide own body, show viewmodel.
    const eye = predictor.eye();
    scene.setView(eye, input.yaw, input.pitch);
    onAds(input.adsHeld);
    const dYaw = wrapPi(input.yaw - prevYaw);
    const dPitch = input.pitch - prevPitch;
    prevYaw = input.yaw;
    prevPitch = input.pitch;
    const moving = intent.mx !== 0 || intent.mz !== 0;
    const speed01 = moving ? (intent.sprint && intent.mz > 0 ? 1 : 0.6) : 0;
    scene.updateViewmodel(dt, speed01, dYaw, dPitch, predictor.isGrounded);

    // Remote players interpolated in the past.
    const poses = sampleRemotes(buf, now - INTERP_DELAY_MS);
    scene.syncPlayers(poses, net.myId);
    scene.render();

    // HUD.
    if (me) {
      hud.setHp(me.hp);
      hud.setNades(me.nades);
    }
    if (state) hud.setScores(state.redScore, state.blueScore);
    hud.setSpread(!predictor.isGrounded ? 1 : moving ? 0.5 : 0);
    fpsFrames++;
    if (now - fpsWindowStart >= 500) {
      hud.setFps((fpsFrames * 1000) / (now - fpsWindowStart));
      fpsFrames = 0;
      fpsWindowStart = now;
    }
    hud.setPing(net.rttMs);

    // Overlay precedence: match end > death > pointer-lock prompt.
    if (phase === "ended" && matchEnd) {
      hud.showMatchEnd(matchEnd.winner, matchEnd.red, matchEnd.blue, me?.k ?? 0, me?.d ?? 0);
    } else if (me && !me.alive) {
      const left = Math.max(0, RESPAWN_MS - (now - deathAt)) / 1000;
      hud.showDeath(left, killerName);
      if (left <= 0 && !respawnSent) {
        net.respawn();
        respawnSent = true;
      }
    } else if (!input.locked) {
      hud.showLockPrompt(true, "CLICK TO PLAY");
    } else {
      hud.hideOverlay();
    }

    hud.update(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/** Poll until the first authoritative state carrying the local player, or give up. */
async function waitForSelf(net: Net): Promise<ArenaPlayer | undefined> {
  for (let i = 0; i < 100; i++) {
    const me = net.state?.players[net.myId];
    if (me) return me;
    await new Promise((r) => setTimeout(r, 30));
  }
  return undefined;
}

/** Interpolate every player's pose at `renderTime` from the snapshot buffer. */
function sampleRemotes(buf: Snap[], renderTime: number): Map<string, Pose> {
  if (buf.length === 0) return new Map();
  if (buf.length === 1 || renderTime <= buf[0]!.time) return buf[0]!.players;
  const lastSnap = buf[buf.length - 1]!;
  if (renderTime >= lastSnap.time) return lastSnap.players;
  let a = buf[0]!;
  let b = lastSnap;
  for (let i = 0; i < buf.length - 1; i++) {
    if (renderTime >= buf[i]!.time && renderTime <= buf[i + 1]!.time) {
      a = buf[i]!;
      b = buf[i + 1]!;
      break;
    }
  }
  const span = b.time - a.time;
  const t = span <= 0 ? 1 : (renderTime - a.time) / span;
  const out = new Map<string, Pose>();
  for (const [id, pb] of b.players) {
    const pa = a.players.get(id) ?? pb;
    out.set(id, {
      x: lerp(pa.x, pb.x, t),
      y: lerp(pa.y, pb.y, t),
      z: lerp(pa.z, pb.z, t),
      yaw: lerpAngle(pa.yaw, pb.yaw, t),
      pitch: lerp(pa.pitch, pb.pitch, t),
      crouch: pb.crouch,
      team: pb.team,
      alive: pb.alive,
    });
  }
  return out;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function wrapPi(a: number): number {
  const tau = Math.PI * 2;
  let d = a % tau;
  if (d > Math.PI) d -= tau;
  else if (d < -Math.PI) d += tau;
  return d;
}
function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapPi(b - a) * t;
}

void main();
