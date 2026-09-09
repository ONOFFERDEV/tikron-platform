import { playDroneCue } from './audio.js';
import { SupportHud } from './support-hud.js';
import { MORTAR } from '../src/mortar.js';
import { playMortarWhistle } from './audio.js';
import { playSupportCue } from './audio.js';
import { SignalHud } from './signal-hud.js';
import { CoreCollision } from '../src/core-gate.js';
import { playSignalCue } from './audio.js';
import { RecoilPrediction, recoilSample } from "../src/recoil.js";
import { footGrounded, hostileFoley } from "./spatial-audio.js";
import { reloadPose, remoteReloadProgress } from "./reload-presentation.js";
import { WeaponHandling, isSprinting } from "../src/handling.js";
import { setMasterVolume, isMuted, playSlide, playLanding, playTraversal, playLaunch } from "./audio.js";
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
import { parseRigInspect } from "./rig-inspect-query.js";
import { startRigInspector } from "./rig-inspect.js";
import { startMapInspector } from "./map-inspect.js";
import { startWeaponInspector } from "./weapon-inspect.js";
import { PING } from "../src/ping.js";
import { TacticalMap } from "./tactical-map.js";
import { Net, type ShotEvent } from "./net.js";
import { Input } from "./input.js";
import { Predictor } from "./predict.js";
import { SceneRig } from "./scene.js";
import { startMatchInspector } from "./match-inspect.js";
import { Hud } from "./hud.js";
import { TrainingCoach } from './training-coach.js';
import { resolveMode } from "./mode-select.js";
import { wireQuitConfirm, closeGameplayMenus } from "./quit-confirm.js";
import { SettingsStore } from "./settings.js";
import { inspectThreatAudio, initAudio, setAudioMap, setAudioListener, playBoom, playFire, playHit, playHurt, playKill, playSwap, playReloadCue } from "./audio.js";
import { HIP_FOV, INTERP_DELAY_MS } from "./config.js";
import { PLAYER } from "../src/config.js";
import { accuracySpread, dirFromAngles, jitter } from "../src/weapons.js";
import type { FireClaim } from "../src/hitscan.js";
import { MODE_ORDER, mapForRoom, practiceMapKeyFromRoomId, isTeamless, PRACTICE_SHOWCASE_LABELS } from "../src/modes.js";
import type { ArenaPlayer, ArenaState } from "../src/schema.js";
import { GAME } from "../src/game-config.js";

const WEAPONS = GAME.weapons;
const WEAPON = { swapMs: GAME.weaponMeta.swapMs };
const DEFAULT_WEAPON_SPEC = WEAPONS[GAME.weaponMeta.defaultIndex]!;

interface Pose {
  x: number; y: number; z: number; yaw: number; pitch: number;
  crouch: boolean; team: number; alive: boolean; weapon: number; reloadEnd: number;
}
interface Snap {
  time: number;
  players: Map<string, Pose>;
}

const RESPAWN_MS = GAME.feel.respawnDisplayMs; // mirrors MATCH.respawnMs (client countdown only)
const RESYNC_RELOAD_MS = 2000; // beat to show the failure message before reloading

async function main(): Promise<void> {
  if (new URLSearchParams(location.search).get("inspect") === "match") { startMatchInspector(); return; }
  if (new URLSearchParams(location.search).get("inspect") === "map") { startMapInspector(); return; }
  if (new URLSearchParams(location.search).get("inspect") === "weapon") { startWeaponInspector(); return; }
  const inspect = parseRigInspect(location.search);
  if (inspect) { startRigInspector(inspect); return; }
  // Single shared store: Input reads live sensitivity/invertY/binds from it every
  // event, and both settings-panel entry points (quit-confirm, mode-select) mutate
  // this SAME instance so a change made in the panel takes effect immediately.
  // Constructed before Hud since Hud's controls-hint reads live binds from it.
  const settings = new SettingsStore();
  const hud = new Hud(settings);
  initAudio();
  setMasterVolume(settings.get().volume);

  // Shows the fullscreen mode menu (and awaits a pick) only when the page has no
  // valid `?mode=` — a deep link resolves immediately with no menu. Either way,
  // `location.search` carries the chosen mode by the time Net.connect() reads it.
  await resolveMode(settings);
  hud.showLockPrompt(true, GAME.text.hud.connecting);

  const net = await Net.connect();
  let me0 = await waitForSelf(net);
  if (!me0) {
    // waitForSelf timed out: state (or our own player entry in it) never arrived,
    // so mapForRoom below would fall back to mode 0's map even in a dom/ffa room —
    // client and server would render different geometry for an already-broken
    // session. Net.connect() itself never surfaces a fatal error (it retries with
    // backoff forever), so mirror that "keep the user informed, don't proceed"
    // idiom here the only way a stuck session can recover: reload from scratch.
    hud.showLockPrompt(true, GAME.text.hud.connectionFailed);
    setTimeout(() => location.reload(), RESYNC_RELOAD_MS);
    return;
  }
  // The map is derived from the mode the server actually placed us in (state.mode,
  // synced on join) plus the matchmake response's own room id — same single
  // source of truth (mapForRoom) the room itself resolves from its own id, so
  // a practice session's arena2/arena3 pick can never diverge from the server.
  const map = mapForRoom(MODE_ORDER[net.state?.mode ?? 0] ?? "tdm", net.roomId);

  if (net.state?.mode === 3) hud.setTrainingSite(practiceMapKeyFromRoomId(net.roomId) === 'arena1', map.presentation === 'undertow');
  const training = net.state?.mode === 3 ? new TrainingCoach(practiceMapKeyFromRoomId(net.roomId) === 'arena1', settings,
    map.presentation === 'undertow' ? map.caps.a : undefined) : null;

  // Mount the canvas INSIDE #app — the shell's fixed full-screen #app div otherwise stacks
  // above a body-mounted canvas and swallows every click (pointer lock never requested;
  // live-debug finding: mousedown target was DIV#app, requestPointerLock calls = 0).
  setAudioMap(map);
  const coreCollision = new CoreCollision(map);
  const openAudioMap = { ...map, boxes:coreCollision.open };
  let lastCoreOpen: boolean | undefined;
  const remoteFoley = new Map<string, { phase: string; y: number }>();
  const scene = new SceneRig(map, document.getElementById("app") ?? document.body);
  hud.showLockPrompt(true, 'Preparing arena / Loading weapons and effects...');
  await scene.prepare();
  me0 = net.state?.players[net.myId] ?? me0;
  scene.onReloadCue(playReloadCue);
  const tacticalMap = new TacticalMap(map, training?.progress.objective, settings);
  const signalHud = new SignalHud(playSignalCue);
  const supportHud = new SupportHud(playSupportCue, map.bounds.width, map.bounds.depth, settings);
  net.room.onMessage('support', payload => supportHud.receive(payload, net.serverNow(), net.state, net.myId));
  net.room.onMessage('mortar', payload => supportHud.receiveMortar(payload, net.serverNow(), net.state, net.myId));
  net.room.onMessage('drone', payload => supportHud.receiveDrone(payload, net.serverNow(), net.state, net.myId));
  net.room.onMessage('droneRally', payload => supportHud.rally(payload, net.serverNow()));
  net.room.onMessage('mortarDenied', payload => supportHud.denyMortar(payload, net.serverNow()));
  const whistled = new Set<string>();

  let lastPingAt = -Infinity;
  const input = new Input(
    scene.canvas,
    me0?.yaw ?? 0,
    settings,
    wireQuitConfirm(settings, () => input.lock(), () => net.state?.phase !== "ended" && net.online),
    (slot) => net.sendSwitch(slot),
    (dir) => {
      const cur = net.state?.players[net.myId]?.weapon ?? 0;
      const next = (((cur + dir) % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
      net.sendSwitch(next + 1);
    },
    () => net.sendNade(),
    (intent) => {
      const state = net.state, now = performance.now();
      if (!net.online || state?.phase !== 'live' || !state.players[net.myId]?.alive || state.mode === 1 || now - lastPingAt < PING.cooldownMs) return;
      lastPingAt = now;
      net.room.send('ping', { yaw: input.yaw, pitch: input.pitch, intent });
    },
    () => { if (net.online && net.state?.players[net.myId]?.alive && supportHud.mortarInfo().available)
      net.room.send('mortar', { yaw: input.yaw, pitch: input.pitch }); },
  );
  net.room.onMessage('teamPing', payload => {
    const ping = tacticalMap.receivePing(payload, net.serverNow());
    const state = net.state;
    if (ping) training?.progress.confirmPing(ping.from, net.myId,
      net.online && state?.phase === 'live' && !!state.players[net.myId]?.alive &&
      document.pointerLockElement === scene.canvas);
  });
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
  const voteRestart = () => {
    if (net.state?.phase !== "ended" || voteSent || !net.online) return;
    voteSent = true;
    hud.markVoteSent();
    net.sendVoteRestart();
  };
  let resultsShownAt = Infinity;
  hud.setMatchActions(voteRestart, () => {
    net.room.leave();
    const url = new URL(location.href); url.searchParams.delete('mode');
    location.replace(url.href);
  });
  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyR" || e.repeat || (e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable]'))) return;
    // A reload pressed as the result arrives must not immediately dismiss it.
    // The explicit rematch button remains available without this keyboard grace.
    if (performance.now() - resultsShownAt < 1000) return;
    voteRestart();
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
    audioProbe: inspectThreatAudio,
    preparationInfo: () => scene.getPreparationInfo(),
    signalInfo: () => ({ ...scene.inspectSignal(), serverNow:net.serverNow() }),
    droneInfo: () => ({ ...supportHud.droneInfo(), effects: scene.inspectDrone(), serverNow: net.serverNow() }),
    mortarInfo: () => ({ ...supportHud.mortarInfo(), effects: scene.inspectMortar(), serverNow: net.serverNow() }),
    supportInfo: () => ({ ...supportHud.inspect(), aircraft: scene.inspectSupport(), serverNow: net.serverNow() }),
    viewmodelInfo: () => scene.viewmodelDiagnostics(),
    movementInfo: () => ({ launching: predictor.isLaunching, traversing: predictor.isTraversing, traversalProgress: predictor.traversalProgress, sliding: predictor.isSliding, progress: predictor.slideProgress,
      grounded: predictor.isGrounded, crouch: predictor.crouch, pos: { ...predictor.pos } }),
    recoilInfo: () => ({ ...recoil.state, ...recoilSample(recoil.state, WEAPONS[curWeapon] ?? DEFAULT_WEAPON_SPEC, net.serverNow(), handling.adsProgress >= 1) }),
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
  const recoil = new RecoilPrediction();
  net.onRecoilSync((seq, state) => recoil.reconcile(seq, state));
  let handling = new WeaponHandling();
  // Client-side mirror of the server's fire-drop conditions (arena-room.ts's
  // handleFire: mid-reload, empty mag, mid weapon-swap), so predicted-only local
  // feedback (recoil/sound/tracer/casing — see the frame loop below) never fires
  // for a shot the server will silently drop. All three resync from the "ammo"
  // unicast, which is authoritative, so a wrong prediction is bounded by the
  // shots in flight (~RTT/fireInterval) and self-corrects within about one RTT —
  // never a lasting desync. `mag` starts null until the explicit syncView reply;
  // a fresh spawn has a full mag, while reconnect requests its actual remainder.
  let mag: number | null = null;
  let reloadUntil = -1; // performance.now()-based; -1 = not reloading
  let swapUntil = -1; // performance.now()-based; -1 = no pending swap cooldown
  net.onFireBlocked((authoritativeMag, slot) => { if (slot === curWeapon + 1) mag = authoritativeMag; });
  net.onAmmo((e) => {
    scene.setReload(e.reloadMs ?? 0, WEAPONS[e.weapon - 1]?.reloadMs ?? e.reloadMs ?? 1);
    hud.setAmmo(e.mag, e.reserve, e.reloadMs);
    mag = e.mag;
    reloadUntil = e.reloadMs ? performance.now() + e.reloadMs : -1;
    // ammo.weapon is the SLOT (1–5, WeaponSpec.slot); everything client-side indexes 0–4.
    const idx = e.weapon - 1;
    hud.setWeapon(idx);
    if (idx !== curWeapon && idx >= 0) {
      recoil.reset(net.fireSeq);
      curWeapon = idx;
      scene.setWeapon(idx);
      net.setFireInterval(idx);
      swapUntil = performance.now() + WEAPON.swapMs;
      playSwap();
    }
  });
  net.onHit((e) => {
    training?.progress.confirmHit();
    hud.showHitmarker(e.head);
    playHit(e.head);
  });
  net.onKill((e) => {
    hud.addKill(name(e.killer), name(e.victim), e.part, e.killerTeam, e.assist ? name(e.assist) : undefined,
      { weapon: e.weapon, localKill: e.killer === net.myId && e.killer !== e.victim, localVictim: e.victim === net.myId });
    if (e.victim === net.myId) {
      killerName = name(e.killer);
      killerId = e.killer;
    }
    if (e.killer === net.myId && e.killer !== e.victim) playKill();
  });
  net.onStreak((e) => { if ((![3, 5, 7].includes(e.count) || net.state?.mode === 1) && !supportHud.announcing(net.serverNow())) hud.showStreak(name(e.id), e.count); });
  const remoteSlides = new Map<string, () => void>();
  net.room.onMessage('traversal', payload => {
    const e = payload as { id:string; kind:string; x:number; y:number; z:number };
    const p=net.state?.players[e.id], me=net.state?.players[net.myId];
    if (p?.alive) (e.kind === 'launch' ? playLaunch : playTraversal)(e.id === net.myId ? undefined : e,
      e.id === net.myId ? 1 : hostileFoley(p.team,me?.team ?? p.team,isTeamless(MODE_ORDER[net.state?.mode ?? 0] ?? 'tdm')));
  });
  net.room.onMessage('slide', payload => {
    const e = payload as { id: string; active: boolean; x: number; y: number; z: number };
    if (e.id === net.myId) return;
    remoteSlides.get(e.id)?.(); remoteSlides.delete(e.id);
    const p = net.state?.players[e.id], me = net.state?.players[net.myId];
    if (e.active && p?.alive) remoteSlides.set(e.id, playSlide(e, e,
      hostileFoley(p.team, me?.team ?? p.team, isTeamless(MODE_ORDER[net.state?.mode ?? 0] ?? 'tdm'))));
  });
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
      // e.weapon is the SLOT (1-5, WeaponSpec.slot) — same conversion the
      // "ammo" handler above already uses for this shooter's OWN weapon.
      const tracerSpeed = WEAPONS[e.weapon - 1]?.tracerSpeed ?? DEFAULT_WEAPON_SPEC.tracerSpeed;
      scene.addTracer(anchor, dir, e.dist, e.hit, tracerSpeed);
      scene.spawnCasing(anchor, dir);
      scene.spawnMuzzleFlash(anchor, dir, e.weapon - 1);
      playFire(e.weapon - 1, anchor);
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
    playBoom(e);
  });

  net.room.onMessage('droneShot', payload => {
    if (!payload || typeof payload !== 'object') return;
    const p=payload as {origin:{x:number;y:number;z:number};point:{x:number;y:number;z:number}};
    if (!p.origin || !p.point || ![p.origin.x,p.origin.y,p.origin.z,p.point.x,p.point.y,p.point.z].every(Number.isFinite)) return;
    const d=Math.hypot(p.point.x-p.origin.x,p.point.y-p.origin.y,p.point.z-p.origin.z);if(d<.01 || d>23)return;
    const dir={x:(p.point.x-p.origin.x)/d,y:(p.point.y-p.origin.y)/d,z:(p.point.z-p.origin.z)/d};
    scene.addTracer(p.origin,dir,d,false,120);scene.spawnMuzzleFlash(p.origin,dir);playDroneCue(p.origin,'fire');
  });
  net.room.onMessage('mortarImpact', payload => {
    if (!payload || typeof payload !== 'object') return;
    const p = payload as { x: number; y: number; z: number };
    if ([p.x,p.y,p.z].every(Number.isFinite)) playBoom(p);
  });

  const droneLocks = new Map<string,number>();
  let previousPhase = net.state?.phase;
  net.onHurt(bearing => hud.showDamageDirection(bearing));
  const ingest = (raw: unknown) => {
    const state = raw as ArenaState;
    if (state.coreOpen !== lastCoreOpen) {
      lastCoreOpen = state.coreOpen;
      predictor.setCoreOpen(state.coreOpen); scene.setCoreOpen(state.coreOpen);
      setAudioMap(state.coreOpen ? openAudioMap : map);
    }
    if (state.phase === "live" && previousPhase !== "live") {
      reloadUntil = -1; swapUntil = -1; mag = null; handling = new WeaponHandling(); recoil.reset(net.fireSeq);
      scene.setReload(0, 1); net.requestSync();
    }
    previousPhase = state.phase;
    if (state.phase !== "ended") matchEnd = null;
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
        handling = new WeaponHandling(); recoil.reset(net.fireSeq);
        deathAt = performance.now();
        respawnSent = false;
        deathCam = buildDeathCam(predictor.eye(), input.yaw, input.pitch, killerId, net.myId, state);
      }
      if (!wasAlive && me.alive) {
        // Adopt the authoritative arrival view once. Keeping the corpse's look
        // would immediately send it back and erase the server's spawn facing.
        input.yaw = me.yaw;
        input.pitch = me.pitch;
        hud.clearDamage();
        deathCam = null;
        killerId = undefined;
        // Mirrors server death cleanup; syncView supplies the fresh loadout.
        mag = null;
        reloadUntil = -1;
        scene.setReload(0, 1);
        swapUntil = -1;
        net.requestSync();
      }
      prevHp = me.hp;
      wasAlive = me.alive;
    }
    // Buffer every player's pose for interpolation (rendered ~INTERP_DELAY in the past).
    const players = new Map<string, Pose>();
    for (const [id, p] of Object.entries(state.players)) {
      players.set(id, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, crouch: p.crouch, team: p.team, alive: p.alive, weapon: p.weapon, reloadEnd: p.reloadEnd });
    }
    buf.push({ time: performance.now(), players });
    while (buf.length > 24) buf.shift();
  };
  net.room.onStateChange(ingest);
  if (net.state) ingest(net.state);
  net.requestSync();

  hud.showLockPrompt(true, GAME.text.hud.clickToPlay);

  // --- render loop ----------------------------------------------------------
  let last = performance.now();
  let wasOnline = net.online;
  let wasEnded = false;
  let motionX = predictor.eye().x;
  let stopSlide: (() => void) | undefined;
  let motionZ = predictor.eye().z;
  let prevYaw = input.yaw;
  let prevPitch = input.pitch;
  // FPS: count rendered frames, publish twice a second (user-visible next to ping).
  let fpsFrames = 0;
  let fpsWindowStart = last;
  const onAds = (held: boolean): void => {
    scene.setAds(held, handling.adsProgress);
    // Zoom slows the turn: scale look sensitivity by the live FOV ratio.
    input.sensScale = scene.currentFov / HIP_FOV;
  };

  function frame(now: number): void {
    const dt = Math.min(100, now - last);
    last = now;
    const state = net.state;

    // Intents (net enforces the send budget).
    if (net.online !== wasOnline) {
      buf.length = 0; handling = new WeaponHandling(); recoil.reset(net.fireSeq);
      if (!net.online && document.pointerLockElement) document.exitPointerLock();
      if (net.online) {
        const restored = net.state?.players[net.myId];
        if (restored) predictor.pos = { x: restored.x, y: restored.y, z: restored.z };
        net.requestSync();
      }
      wasOnline = net.online;
    }
    const intent = net.online && state?.phase !== "ended" ? input.intent() : { mx: 0, mz: 0, jump: false, crouch: false, sprint: false };
    const active = net.online && state?.phase !== "ended" && !!state?.players[net.myId]?.alive;
    intent.ads = active && input.adsHeld;
    // Fire/aim cancel sprint before sending the intent; server enforces recovery.
    if (input.isFiring || intent.ads) intent.sprint = false;
    net.setMoveIntent(intent, now);
    net.setLook(input.yaw, input.pitch, now);
    predictor.frame(dt, intent, input.yaw);
    input.consumeJump();
    if (input.consumeReload()) net.reload();

    const me = state?.players[net.myId];
    const phase = state?.phase ?? "live";
    const alive = me?.alive ?? false;
    handling.update(now, WEAPONS[curWeapon] ?? DEFAULT_WEAPON_SPEC, predictor.isTraversing || isSprinting(intent, predictor.isGrounded), intent.ads === true,
      !active || now < reloadUntil || now < swapUntil);
    training?.update(now, active && document.pointerLockElement === scene.canvas, me?.x ?? 0, me?.z ?? 0,
      handling.adsProgress >= 1, dt);

    // Camera from prediction (local, immediate) — needed here already: a confirmed
    // shot below anchors its tracer/casing to this same live eye position.
    const eye = predictor.eye();

    const spec = WEAPONS[curWeapon] ?? DEFAULT_WEAPON_SPEC;
    const shotNow = net.serverNow();
    const kick = recoilSample(recoil.state, spec, shotNow, handling.adsProgress >= 1);
    const aimYaw = input.yaw + kick.yaw;
    const aimPitch = Math.max(-Math.PI / 2 + .01, Math.min(Math.PI / 2 - .01, input.pitch + kick.pitch));

    // Firing (server fire interval is the truth; net gates, we kick locally).
    if (net.online && input.isFiring && alive && phase === "live" && handling.canFire) {
      // net.tryFire only mirrors the fire-rate cap — it still sends "fire" so the
      // server (the real authority) can act on it regardless of our own gate
      // below. canPredictFire mirrors the REST of the server's drop conditions
      // (mid-reload, empty mag, mid weapon-swap) so local-only feedback — recoil,
      // fire sound, and the self-authoritative tracer/casing below — never shows
      // for a shot the server will silently drop; it never touches the network
      // send itself.
      // Hybrid hit registration (hitscan.ts's FireClaim): the raycast itself is
      // cheap, but it's still deferred inside this lambda so it only runs once
      // net.tryFire's own fire-rate gate has actually passed (a held trigger
      // renders far more often than the weapon can fire). Multi-pellet weapons
      // (the shotgun) send no claim at all — one claim can't represent several
      // simultaneous pellet hits (see arena-room.ts's handleFire).
      const computeClaim = (): FireClaim | null | undefined => {
        const spec = WEAPONS[curWeapon];
        if (!spec || spec.pellets !== 1) return undefined;
        // Same deterministic offset and stance cone as the server; independent,
        // center-biased noise only affects the accuracy cone, never the pattern.
        const moving = intent.mx !== 0 || intent.mz !== 0;
        const acc = accuracySpread(spec, moving, predictor.isGrounded, handling.adsProgress >= 1, me?.crouch ?? false, kick.index);
        const claimDir = dirFromAngles(aimYaw + jitter(acc, Math.random), aimPitch + jitter(acc, Math.random));
        return scene.raycastHitClaim(eye, claimDir, spec.range) ?? null;
      };
      if (net.tryFire(now, computeClaim, { yaw: input.yaw, pitch: input.pitch }) && canPredictFire(now, mag, reloadUntil, swapUntil)) {
        recoil.fire(net.fireSeq, spec, shotNow);
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
        const aimDir = dirFromAngles(aimYaw, aimPitch);
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
        scene.addTracer(muzzle, muzzleDir, muzzleDist, false, WEAPONS[curWeapon]?.tracerSpeed ?? DEFAULT_WEAPON_SPEC.tracerSpeed);
        scene.spawnCasing(muzzle, muzzleDir);
      }
    }

    scene.reducedMotion = settings.get().reducedMotion;
    const signal = state ? signalHud.update(state, net.serverNow(), net.online) : undefined;
    if (signal) scene.updateSignal(signal);
    const support = state ? supportHud.update(state, net.myId, net.serverNow(), net.online, signal?.phase === 'blackout', input.locked) : undefined;
    scene.updateSupport(support?.flights ?? [], net.serverNow());
    scene.updateMortar(supportHud.mortarInfo().strikes, net.serverNow());
    scene.updateDrone(supportHud.droneInfo().flights, net.serverNow());
    for (const f of supportHud.droneInfo().flights) if (f.lock && f.lock.fireAt>net.serverNow() && droneLocks.get(f.owner)!==f.lock.fireAt) {
      droneLocks.set(f.owner,f.lock.fireAt);if(input.locked)playDroneCue(f,'lock');
    }
    for (const id of droneLocks.keys()) if (!supportHud.droneInfo().flights.some(f=>f.owner===id)) droneLocks.delete(id);
    for (const s of supportHud.mortarInfo().strikes) for (let round = 0; round < MORTAR.rounds; round++) {
      const key = `${s.owner}:${s.startedAt}:${round}`, until = s.startedAt + MORTAR.warningMs + round * MORTAR.intervalMs - net.serverNow();
      if (until > 0 && until <= 700 && !whistled.has(key)) {
        whistled.add(key); if (whistled.size > 24) whistled.delete(whistled.values().next().value!);
        if (input.locked) playMortarWhistle(s);
      }
    }
    if (scene.updateTraversal(dt, predictor.isSliding, isSprinting(intent, predictor.isGrounded), predictor.isGrounded, active, predictor.isTraversing, predictor.isLaunching))
      playLanding(predictor.pos);
    if (active && predictor.isSliding && !stopSlide) stopSlide = playSlide(predictor.pos);
    if ((!active || !predictor.isSliding) && stopSlide) { stopSlide(); stopSlide = undefined; }
    for (const [id, stop] of remoteSlides) if (!net.online || !state?.players[id]?.alive) { stop(); remoteSlides.delete(id); }

    // While dead, hold the frozen death-cam view instead of following input look.
    if (deathCam) {
      scene.setView(deathCam.eye, deathCam.yaw, deathCam.pitch);
    } else {
      const viewKick = recoilSample(recoil.state, spec, shotNow, handling.adsProgress >= 1);
      scene.setView(eye, input.yaw + viewKick.yaw, Math.max(-Math.PI / 2 + .01, Math.min(Math.PI / 2 - .01, input.pitch + viewKick.pitch)));
    }
    setAudioListener(scene.camera.position, deathCam?.yaw ?? input.yaw);
    onAds(alive && input.adsHeld);
    const dYaw = wrapPi(input.yaw - prevYaw);
    const dPitch = input.pitch - prevPitch;
    prevYaw = input.yaw;
    prevPitch = input.pitch;
    const moving = intent.mx !== 0 || intent.mz !== 0;
    const travelled = Math.hypot(eye.x - motionX, eye.z - motionZ);
    const speed01 = alive && dt > 0 && travelled < 1
      ? Math.min(1, travelled / (dt / 1000) / GAME.move.sprint) : 0;
    motionX = eye.x; motionZ = eye.z;
    scene.reducedMotion = settings.get().reducedMotion;
    setMasterVolume(settings.get().volume);
    scene.updateViewmodel(dt, speed01, dYaw, dPitch, predictor.isGrounded);
    if (!alive) scene.hideViewmodel();
    scene.stepFootSelf(predictor.pos, dt, alive && predictor.isGrounded && !predictor.isSliding);

    // Remote players interpolated in the past.
    const poses = sampleRemotes(buf, now - INTERP_DELAY_MS, interpScratch);
    scene.syncPlayers(poses, net.myId, dt, undefined, net.serverNow());
    for (const [id, p] of poses) {
      if (id === net.myId || !p.alive) { remoteFoley.delete(id); continue; }
      const previous = remoteFoley.get(id);
      const threatGain = hostileFoley(p.team, net.state?.players[net.myId]?.team ?? p.team,
        isTeamless(MODE_ORDER[net.state?.mode ?? 0] ?? 'tdm'));
      scene.stepFootRemote(id, p, dt, eye, threatGain, footGrounded(p, map) && !remoteSlides.has(id));
      const phase = reloadPose(remoteReloadProgress(p.alive, p.reloadEnd,
        WEAPONS[p.weapon]?.reloadMs ?? 1, net.serverNow())).phase;
      // Seed on AOI entry; never replay an already-running phase.
      if (previous && previous.phase !== phase) playReloadCue(phase, { x: p.x, y: p.y + 1, z: p.z }, threatGain);
      remoteFoley.set(id, { phase, y: p.y });
    }
    for (const id of remoteFoley.keys()) if (!poses.has(id)) remoteFoley.delete(id);
    scene.render();

    // HUD.
    if (me) {
      hud.setHp(me.hp);
      hud.setNades(me.nades);
    }
    if (state) { hud.setScores(state.redScore, state.blueScore); hud.setMatchContext(state, net.serverNow(), net.myId); }
    input.updateCommunication(net.online && state?.phase === 'live' && !!state.players[net.myId]?.alive && state.mode !== 1);
    if (state) tacticalMap.update(state, net.myId, input.yaw, now, net.serverNow(), net.online && input.locked, support);
    const mode = state?.mode ?? 0;
    const modeId = MODE_ORDER[mode] ?? "tdm";
    const teamless = isTeamless(modeId);
    hud.setMode(mode);
    hud.setWarmup(phase === "warmup");
    if (mode === 2 && state) hud.setCaps(state.capA, state.capB, state.capC);
    else hud.hideCaps();
    if (modeId === "ffa" && state) {
      const rows = Object.entries(state.players)
        .map(([id, p]) => ({ name: name(id), k: p.k, d: p.d, isMe: id === net.myId }))
        .sort((a, b) => b.k - a.k || a.d - b.d)
        .slice(0, 8);
      hud.setLeaderboard(rows);
    }
    hud.setSpread(Math.min(1, accuracySpread(spec, moving, predictor.isGrounded, handling.adsProgress >= 1, me?.crouch ?? false, kick.index) / .05));
    fpsFrames++;
    if (now - fpsWindowStart >= 500) {
      hud.setFps((fpsFrames * 1000) / (now - fpsWindowStart));
      fpsFrames = 0;
      fpsWindowStart = now;
    }
    hud.setPing(net.rttMs, net.online, now, net.connectionExpired);

    hud.setMuted(isMuted() || settings.get().volume === 0);
    if (phase === 'ended' || !net.online) closeGameplayMenus();
    // Overlay precedence: match end > death > pointer-lock prompt.
    if (phase === "ended" && !wasEnded) {
      resultsShownAt = now;
      if (document.pointerLockElement) document.exitPointerLock();
    }
    wasEnded = phase === "ended";
    if (!net.online) {
      hud.showConnection(net.connectionExpired);
    } else if (phase === "ended" && matchEnd) {
      // "draw" is a literal wire value (the no-score timeout), not a player id — name()
      // must not be applied to it or it renders as a garbled "draw WINS" in FFA.
      const winnerLabel = teamless && matchEnd.winner !== "draw" ? name(matchEnd.winner) : matchEnd.winner;
      hud.showMatchEnd(winnerLabel, matchEnd.red, matchEnd.blue, me?.k ?? 0, me?.d ?? 0, teamless, {
        won: teamless ? matchEnd.winner === net.myId : matchEnd.winner === (me?.team === 0 ? 'red' : 'blue'),
        rows: Object.entries(state?.players ?? {}).map(([id, p]) => ({
          name: name(id), k: p.k, d: p.d, team: p.team, isMe: id === net.myId,
        })),
      });
    } else if (phase === "ended") {
      hud.showLockPrompt(true, "ROUND COMPLETE · Receiving results…");
    } else if (me && !me.alive) {
      const left = Math.max(0, RESPAWN_MS - (now - deathAt)) / 1000;
      hud.showDeath(left, killerName);
      if (left <= 0 && !respawnSent) {
        net.respawn();
        respawnSent = true;
      }
    } else if (!input.locked) {
      hud.showLockPrompt(true, input.lockRetry ? 'Click again to resume mouse control' : GAME.text.hud.clickToPlay);
    } else {
      hud.hideOverlay();
    }

    hud.update(now, input.yaw);
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
      pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, crouch: false, team: 0, alive: false, weapon: 0, reloadEnd: 0 };
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
    pose.weapon = pb.weapon;
    pose.reloadEnd = pb.reloadEnd;
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
