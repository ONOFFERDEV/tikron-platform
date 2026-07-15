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
import { resolveMode } from "./mode-select.js";
import { wireQuitConfirm } from "./quit-confirm.js";
import { initAudio, playBoom, playFire, playHit, playHurt, playKill, playSwap } from "./audio.js";
import { HIP_FOV, INTERP_DELAY_MS } from "./config.js";
import { PLAYER } from "../src/config.js";
import { dirFromAngles } from "../src/weapons.js";
import { MODE_ORDER, mapForMode, isTeamless, PRACTICE_SHOWCASE_LABELS } from "../src/modes.js";
import type { ArenaPlayer, ArenaState } from "../src/schema.js";
import { GAME } from "../src/game-config.js";

const WEAPONS = GAME.weapons;
const WEAPON = { swapMs: GAME.weaponMeta.swapMs };

interface Pose {
  x: number; y: number; z: number; yaw: number; pitch: number;
  crouch: boolean; team: number; alive: boolean;
}
interface Snap {
  time: number;
  players: Map<string, Pose>;
}

const RESPAWN_MS = GAME.feel.respawnDisplayMs; // mirrors MATCH.respawnMs (client countdown only)
const RESYNC_RELOAD_MS = 2000; // beat to show the failure message before reloading

async function main(): Promise<void> {
  const hud = new Hud();
  initAudio();

  // Shows the fullscreen mode menu (and awaits a pick) only when the page has no
  // valid `?mode=` — a deep link resolves immediately with no menu. Either way,
  // `location.search` carries the chosen mode by the time Net.connect() reads it.
  await resolveMode();
  hud.showLockPrompt(true, GAME.text.hud.connecting);

  const net = await Net.connect();
  const me0 = await waitForSelf(net);
  if (!me0) {
    // waitForSelf timed out: state (or our own player entry in it) never arrived,
    // so mapForMode below would fall back to mode 0's map even in a dom/ffa room —
    // client and server would render different geometry for an already-broken
    // session. Net.connect() itself never surfaces a fatal error (it retries with
    // backoff forever), so mirror that "keep the user informed, don't proceed"
    // idiom here the only way a stuck session can recover: reload from scratch.
    hud.showLockPrompt(true, GAME.text.hud.connectionFailed);
    setTimeout(() => location.reload(), RESYNC_RELOAD_MS);
    return;
  }
  // The map is derived from the mode the server actually placed us in (state.mode,
  // synced on join) rather than guessed client-side — same single source of truth
  // (mapForMode) the room itself resolves from modeFromRoomId.
  const map = mapForMode(MODE_ORDER[net.state?.mode ?? 0] ?? "tdm");

  // Mount the canvas INSIDE #app — the shell's fixed full-screen #app div otherwise stacks
  // above a body-mounted canvas and swallows every click (pointer lock never requested;
  // live-debug finding: mousedown target was DIV#app, requestPointerLock calls = 0).
  const scene = new SceneRig(map, document.getElementById("app") ?? document.body);

  const input = new Input(
    scene.canvas,
    me0?.yaw ?? 0,
    wireQuitConfirm(() => input.lock()),
    (slot) => net.sendSwitch(slot),
    (dir) => {
      const cur = net.state?.players[net.myId]?.weapon ?? 0;
      const next = (((cur + dir) % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
      net.sendSwitch(next + 1);
    },
    () => net.sendNade(),
  );
  input.pitch = me0?.pitch ?? 0;
  const predictor = new Predictor(map);
  if (me0) predictor.pos = { x: me0.x, y: me0.y, z: me0.z };

  const name = (id: string): string => {
    if (id === net.myId) return GAME.text.selfName;
    if (id in PRACTICE_SHOWCASE_LABELS) return PRACTICE_SHOWCASE_LABELS[id]!;
    if (id.startsWith("bot-")) return GAME.text.botNameFmt.replace("{n}", id.slice(4));
    return id.slice(0, 4);
  };

  // Restart-vote keybind: R while phase==="ended" (input.ts's own KeyR is the
  // live-play reload edge — this is a separate listener gated to the end-of-match
  // overlay, and sends at most once per match end via voteSent).
  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyR" || e.repeat) return;
    if (net.state?.phase !== "ended" || voteSent) return;
    voteSent = true;
    net.sendVoteRestart();
  });

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
    renderInfo: () => scene.getRenderInfo(),
    camPos: () => ({ x: scene.camera.position.x, y: scene.camera.position.y, z: scene.camera.position.z }),
    hitboxDiag: () => scene.getHitboxDiagnostics(),
  };

  // --- discrete event + state edge handling ---------------------------------
  const buf: Snap[] = [];
  // Reused across every render frame's sampleRemotes() call (up to 144/s) — the
  // interpolated result is consumed and discarded within the same frame, so
  // mutating pooled Pose objects in place avoids allocating a fresh Map + one
  // object literal per remote player every frame (see perf investigation notes
  // on sampleRemotes below).
  const interpScratch = new Map<string, Pose>();
  let prevHp = me0?.hp ?? 100;
  let wasAlive = me0?.alive ?? true;
  let deathAt = -1;
  let respawnSent = false;
  let killerName: string | undefined;
  let killerId: string | undefined;
  let deathCam: { eye: { x: number; y: number; z: number }; yaw: number; pitch: number } | null = null;
  let matchEnd: { winner: string; red: number; blue: number } | null = null;
  let voteSent = false; // at most one restart-vote send per match end; re-armed below

  let curWeapon = 0;
  // Client-side mirror of the server's fire-drop conditions (arena-room.ts's
  // handleFire: mid-reload, empty mag, mid weapon-swap), so predicted-only local
  // feedback (recoil/sound/tracer/casing — see the frame loop below) never fires
  // for a shot the server will silently drop. All three resync from the "ammo"
  // unicast, which is authoritative, so a wrong prediction is bounded by the
  // shots in flight (~RTT/fireInterval) and self-corrects within about one RTT —
  // never a lasting desync. `mag` starts `null` (unknown) rather
  // than 0 — the server never proactively pushes ammo on join/spawn/respawn, only
  // in reaction to a fire/reload/switch, so a literal 0 default would wrongly gate
  // out the very first shot after every spawn; `null` means "not yet synced,
  // assume fireable" (true in practice, since every spawn starts with a full mag).
  let mag: number | null = null;
  let reloadUntil = -1; // performance.now()-based; -1 = not reloading
  let swapUntil = -1; // performance.now()-based; -1 = no pending swap cooldown
  net.onAmmo((e) => {
    hud.setAmmo(e.mag, e.reserve, e.reloadMs);
    mag = e.mag;
    reloadUntil = e.reloadMs ? performance.now() + e.reloadMs : -1;
    // ammo.weapon is the SLOT (1–5, WeaponSpec.slot); everything client-side indexes 0–4.
    const idx = e.weapon - 1;
    hud.setWeapon(idx);
    if (idx !== curWeapon && idx >= 0) {
      curWeapon = idx;
      scene.setWeapon(idx);
      net.setFireInterval(idx);
      swapUntil = performance.now() + WEAPON.swapMs;
      playSwap();
    }
  });
  net.onHit((e) => {
    hud.showHitmarker(e.head);
    playHit(e.head);
  });
  net.onKill((e) => {
    hud.addKill(name(e.killer), name(e.victim), e.part, e.killerTeam, e.assist ? name(e.assist) : undefined);
    if (e.victim === net.myId) {
      killerName = name(e.killer);
      killerId = e.killer;
    }
    if (e.killer === net.myId && e.killer !== e.victim) playKill();
  });
  net.onStreak((e) => hud.showStreak(name(e.id), e.count));
  net.onShot((e: ShotEvent) => {
    const dir = { x: e.dx, y: e.dy, z: e.dz };
    // Self shots already got their tracer/casing at the moment of firing (see the
    // frame loop below) — the wire origin here is this shooter's server-known
    // position as of ~their RTT ago, stale by the time it echoes back to them.
    // Remote shots have no local equivalent, so anchor them to that player's
    // CURRENTLY RENDERED rig position instead of the (also stale, and further
    // delayed by our own render-interpolation) wire origin.
    if (e.from !== net.myId) {
      const anchor = scene.getRemoteMuzzleAnchor(e.from) ?? { x: e.ox, y: e.oy, z: e.oz };
      scene.addTracer(anchor, dir, e.dist, e.hit);
      scene.spawnCasing(anchor, dir);
      scene.spawnMuzzleFlash(anchor, dir);
    }
    // Impact FX stays wire-authoritative for everyone — it's the true world-space
    // hit/wall location the server computed, unaffected by muzzle-position lag.
    const impactDist = Math.max(0.5, e.dist);
    scene.spawnImpact(
      { x: e.ox + e.dx * impactDist, y: e.oy + e.dy * impactDist, z: e.oz + e.dz * impactDist },
      dir,
      e.hit,
    );
    // Remote hit-reaction: never the local player (no first-person body model) —
    // whoever fired, either shooter or victim can be self, so this checks the
    // VICTIM id specifically, not e.from. `?? []` guards the deploy-transition
    // window where a not-yet-updated server emits shots without `hits`.
    for (const h of e.hits ?? []) {
      if (h.id !== net.myId) scene.playHitReaction(h.id, h.head);
    }
  });
  net.onMatchEnd((e) => {
    matchEnd = { winner: e.winner, red: e.red, blue: e.blue };
  });
  net.onVote((e) => hud.setVoteStatus(e.count, e.need));
  net.onNadeSpawn((e) => scene.spawnNade(e));
  net.onNadeBounce((e) => scene.bounceNade(e));
  net.onNadeBoom((e) => {
    scene.boomNade(e);
    playBoom();
  });

  net.room.onStateChange((raw) => {
    const state = raw as ArenaState;
    if (state.phase === "live") matchEnd = null;
    // Re-arm the restart vote once the match is no longer "ended" (routes through
    // "warmup" first on a successful vote — see arena-room's enterWarmup).
    if (state.phase !== "ended") {
      voteSent = false;
      hud.resetVoteStatus();
    }
    const me = state.players[net.myId];
    if (me) {
      predictor.reconcile({ x: me.x, y: me.y, z: me.z });
      predictor.setAlive(me.alive);
      if (me.alive && me.hp < prevHp) {
        hud.flashDamage();
        playHurt();
      }
      if (wasAlive && !me.alive) {
        deathAt = performance.now();
        respawnSent = false;
        deathCam = buildDeathCam(predictor.eye(), input.yaw, input.pitch, killerId, net.myId, state);
      }
      if (!wasAlive && me.alive) {
        deathCam = null;
        killerId = undefined;
        // Mirrors the server clearing reloadUntil/swapUntil on death; mag goes
        // back to "unknown" since a fresh spawn's mag isn't pushed until the next
        // fire/reload/switch (see the `mag` declaration above).
        mag = null;
        reloadUntil = -1;
        swapUntil = -1;
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

  hud.showLockPrompt(true, GAME.text.hud.clickToPlay);

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

    // Camera from prediction (local, immediate) — needed here already: a confirmed
    // shot below anchors its tracer/casing to this same live eye position.
    const eye = predictor.eye();

    // Firing (server fire interval is the truth; net gates, we kick locally).
    if (input.isFiring && alive && phase === "live") {
      // net.tryFire only mirrors the fire-rate cap — it still sends "fire" so the
      // server (the real authority) can act on it regardless of our own gate
      // below. canPredictFire mirrors the REST of the server's drop conditions
      // (mid-reload, empty mag, mid weapon-swap) so local-only feedback — recoil,
      // fire sound, and the self-authoritative tracer/casing below — never shows
      // for a shot the server will silently drop; it never touches the network
      // send itself.
      if (net.tryFire(now) && canPredictFire(now, mag, reloadUntil, swapUntil)) {
        scene.fireRecoil(curWeapon);
        playFire(curWeapon);
        if (mag !== null) mag -= 1; // predicted decrement; the next "ammo" resyncs it
        // Self-authoritative tracer/casing: waiting for the "shot" echo (see
        // onShot above) would draw them from this shooter's server-known position
        // as of ~RTT ago — a stride behind while moving (the reported bug). Fire
        // them locally instead, from the live predicted eye/look direction; the
        // endpoint is a client-side wall stop (or the weapon's range if nothing's
        // in the way) since the actual hit/miss distance is only known
        // server-side — `spawnImpact` (still wire-authoritative below) carries
        // the real hit location regardless.
        const aimDir = dirFromAngles(input.yaw, input.pitch);
        const range = WEAPONS[curWeapon]?.range ?? 100;
        const aimDist = scene.wallDistance(eye, aimDir, range);
        const endpoint = {
          x: eye.x + aimDir.x * aimDist,
          y: eye.y + aimDir.y * aimDist,
          z: eye.z + aimDir.z * aimDist,
        };
        // The tracer/casing themselves start at the viewmodel's muzzle, not the
        // eye — anchoring to the eye made them appear to fire from dead centre of
        // the screen. Re-aim from muzzle toward the SAME endpoint above (the
        // crosshair's true impact point is unchanged; only where the visible
        // beam originates moves).
        const muzzle = scene.getSelfMuzzlePos();
        const toEnd = { x: endpoint.x - muzzle.x, y: endpoint.y - muzzle.y, z: endpoint.z - muzzle.z };
        const muzzleDist = Math.hypot(toEnd.x, toEnd.y, toEnd.z);
        const muzzleDir = muzzleDist > 1e-6
          ? { x: toEnd.x / muzzleDist, y: toEnd.y / muzzleDist, z: toEnd.z / muzzleDist }
          : aimDir;
        scene.addTracer(muzzle, muzzleDir, muzzleDist, false);
        scene.spawnCasing(muzzle, muzzleDir);
      }
    }

    // While dead, hold the frozen death-cam view instead of following input look.
    if (deathCam) {
      scene.setView(deathCam.eye, deathCam.yaw, deathCam.pitch);
    } else {
      scene.setView(eye, input.yaw, input.pitch);
    }
    onAds(input.adsHeld);
    const dYaw = wrapPi(input.yaw - prevYaw);
    const dPitch = input.pitch - prevPitch;
    prevYaw = input.yaw;
    prevPitch = input.pitch;
    const moving = intent.mx !== 0 || intent.mz !== 0;
    const speed01 = moving ? (intent.sprint && intent.mz > 0 ? 1 : 0.6) : 0;
    scene.updateViewmodel(dt, speed01, dYaw, dPitch, predictor.isGrounded);
    scene.stepFootSelf(predictor.pos, dt, alive && predictor.isGrounded);

    // Remote players interpolated in the past.
    const poses = sampleRemotes(buf, now - INTERP_DELAY_MS, interpScratch);
    scene.syncPlayers(poses, net.myId, dt);
    for (const [id, p] of poses) {
      if (id !== net.myId && p.alive) scene.stepFootRemote(id, p, dt, eye);
    }
    scene.render();

    // HUD.
    if (me) {
      hud.setHp(me.hp);
      hud.setNades(me.nades);
    }
    if (state) hud.setScores(state.redScore, state.blueScore);
    const mode = state?.mode ?? 0;
    const modeId = MODE_ORDER[mode] ?? "tdm";
    const teamless = isTeamless(modeId);
    hud.setMode(mode);
    hud.setWarmup(phase === "warmup");
    if (mode === 2 && state) hud.setCaps(state.capA, state.capB, state.capC);
    else hud.hideCaps();
    if (teamless && state) {
      const rows = Object.entries(state.players)
        .map(([id, p]) => ({ name: name(id), k: p.k, d: p.d, isMe: id === net.myId }))
        .sort((a, b) => b.k - a.k || a.d - b.d)
        .slice(0, 8);
      hud.setLeaderboard(rows);
    }
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
      // "draw" is a literal wire value (the no-score timeout), not a player id — name()
      // must not be applied to it or it renders as a garbled "draw WINS" in FFA.
      const winnerLabel = teamless && matchEnd.winner !== "draw" ? name(matchEnd.winner) : matchEnd.winner;
      hud.showMatchEnd(winnerLabel, matchEnd.red, matchEnd.blue, me?.k ?? 0, me?.d ?? 0, teamless);
    } else if (me && !me.alive) {
      const left = Math.max(0, RESPAWN_MS - (now - deathAt)) / 1000;
      hud.showDeath(left, killerName);
      if (left <= 0 && !respawnSent) {
        net.respawn();
        respawnSent = true;
      }
    } else if (!input.locked) {
      hud.showLockPrompt(true, GAME.text.hud.clickToPlay);
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

/** Interpolate every player's pose at `renderTime` from the snapshot buffer.
 *  `scratch` is mutated and returned in the interpolation case — the caller
 *  uses the result within the same frame and never holds onto it across
 *  frames, so reusing pooled Pose objects here (instead of a fresh Map + one
 *  object literal per remote player) avoids allocating garbage every single
 *  render frame (up to 144/s) purely to be dropped a moment later. The two
 *  early-return cases below already alias an existing buffered snapshot's Map
 *  (no interpolation needed, so no new object to build either way). */
function sampleRemotes(buf: Snap[], renderTime: number, scratch: Map<string, Pose>): Map<string, Pose> {
  if (buf.length === 0) {
    scratch.clear(); // only true at startup, before the first snapshot arrives
    return scratch;
  }
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
  for (const id of scratch.keys()) {
    if (!b.players.has(id)) scratch.delete(id);
  }
  for (const [id, pb] of b.players) {
    const pa = a.players.get(id) ?? pb;
    let pose = scratch.get(id);
    if (!pose) {
      pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, crouch: false, team: 0, alive: false };
      scratch.set(id, pose);
    }
    pose.x = lerp(pa.x, pb.x, t);
    pose.y = lerp(pa.y, pb.y, t);
    pose.z = lerp(pa.z, pb.z, t);
    pose.yaw = lerpAngle(pa.yaw, pb.yaw, t);
    pose.pitch = lerp(pa.pitch, pb.pitch, t);
    pose.crouch = pb.crouch;
    pose.team = pb.team;
    pose.alive = pb.alive;
  }
  return scratch;
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

/** Client-side mirror of arena-room.ts's `handleFire` drop conditions: mid
 *  weapon-swap, mid-reload, or an empty magazine. `mag === null` means "not yet
 *  synced" — treated as fireable, since a fresh spawn always starts with a full
 *  mag and the server never proactively pushes ammo before the first fire/reload/
 *  switch. Used only to gate LOCAL feedback (recoil/sound/tracer/casing); the
 *  actual "fire" send is never gated by this. */
function canPredictFire(now: number, mag: number | null, reloadUntil: number, swapUntil: number): boolean {
  if (swapUntil >= 0 && now < swapUntil) return false;
  if (reloadUntil >= 0 && now < reloadUntil) return false;
  if (mag !== null && mag <= 0) return false;
  return true;
}

/** Snapshot the death-cam view once: a frozen eye position aimed at the killer's
 *  live pose at the moment of death (falls back to holding the current look
 *  direction when there's no killer to aim at — suicide, disconnect, or self). */
function buildDeathCam(
  eye: { x: number; y: number; z: number },
  yaw: number,
  pitch: number,
  killerId: string | undefined,
  myId: string,
  state: ArenaState,
): { eye: { x: number; y: number; z: number }; yaw: number; pitch: number } {
  const killer = killerId && killerId !== myId ? state.players[killerId] : undefined;
  if (!killer) return { eye, yaw, pitch };
  const dx = killer.x - eye.x;
  const dz = killer.z - eye.z;
  const dy = killer.y + (killer.crouch ? PLAYER.crouchEye : PLAYER.standEye) - eye.y;
  return { eye, yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

void main();
