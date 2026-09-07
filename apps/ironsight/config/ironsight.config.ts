import { VISUALS } from "./visuals.js";
/**
 * ironsight's `GameConfig` instance — the live values, lifted per PLAN-IRONSIGHT
 * M4 W1. Two lifting strategies, per field group:
 *
 *  - **Imported** groups reference the existing exported constant directly
 *    (`ARENA`, `WEAPONS`, `MODE_ORDER`, `ARENA1`, `TEAM_COLOR`, …) — the config
 *    value and the constant the room/client already imports are the SAME object,
 *    so they can never drift and `test/config.test.ts`'s equivalence checks are
 *    reference equality.
 *  - **Transcribed** groups copy an inline literal that has no exported symbol to
 *    import (a hex color inside `client/scene.ts`'s constructor, a string inside
 *    `client/hud.ts`'s template) — each group's doc comment below cites the exact
 *    source file so a future edit to the source is easy to find and re-sync.
 *
 * Since M4 W2/W3, room and client consumers read this data through
 * `src/game-config.ts`'s `GAME` (modes.ts excepted — see `schema.ts`'s header for
 * the ESM-cycle rationale). For transcribed groups this file IS the single
 * definition; the cited source locations are historical provenance, not a second
 * copy to keep in sync.
 */

import {
  ARENA,
  PLAYER,
  HIT,
  MOVE,
  WEAPONS,
  WEAPON,
  DEFAULT_WEAPON,
  PISTOL_INDEX,
  GRENADE,
  MATCH,
  LAG,
  MODES,
} from "../src/config.js";
import { MODE_ORDER } from "../src/modes.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";
import {
  MOUSE_SENSITIVITY,
  LOOK_SEND_MS,
  MOVE_KEEPALIVE_MS,
  INTERP_DELAY_MS,
  RECONCILE_SOFT_M,
  RECONCILE_SNAP_M,
  RECONCILE_FRAC,
  RECONCILE_TAU_MS,
  TEAM_COLOR,
  TEAM_COLOR_DIM,
  HIP_FOV,
  ADS_FOV,
} from "../client/config.js";
import { defineConfig, type GameConfig } from "./schema.js";

export const ironsightConfig: GameConfig = defineConfig({
  // meta.title is a fresh label (no prior "meta" concept existed in the source);
  // workerName/party/compatibilityDate are transcribed from wrangler.jsonc.
  meta: {
    id: "ironsight",
    title: "Ironsight",
    workerName: "ironsight",
    party: "arena-room",
    compatibilityDate: "2025-09-01",
  },

  // --- imported verbatim from src/config.ts -----------------------------------
  arena: ARENA,
  player: PLAYER,
  hit: HIT,
  move: MOVE,
  weapons: WEAPONS,
  weaponMeta: {
    defaultIndex: DEFAULT_WEAPON,
    pistolIndex: PISTOL_INDEX,
    swapMs: WEAPON.swapMs,
  },
  // GRENADE's fields verbatim + muzzleOffset transcribed from arena-room.ts's
  // handleNade (`pos: { x: p.x + dir.x * 0.6, ... }` — not in src/config.ts's GRENADE).
  grenade: { ...GRENADE, muzzleOffset: 0.6 },
  // match: MATCH's fields verbatim + two literals transcribed from
  // arena-room.ts's onReady (maxInputsPerSecond=90) and aoi (viewRadius=100) —
  // neither is in src/config.ts's MATCH today.
  match: {
    maxClients: MATCH.maxClients,
    killTarget: MATCH.killTarget,
    timeLimitMs: MATCH.timeLimitMs,
    intermissionMs: MATCH.intermissionMs,
    respawnMs: MATCH.respawnMs,
    spawnProtectMs: MATCH.spawnProtectMs,
    warmupMinPlayers: MATCH.warmupMinPlayers,
    warmupMs: MATCH.warmupMs,
    assistWindowMs: MATCH.assistWindowMs,
    killstreakThresholds: MATCH.killstreakThresholds,
    fillToPlayers: MATCH.fillToPlayers,
    maxInputsPerSecond: 90, // arena-room.ts onReady: this.maxInputsPerSecond = 90
    aoiViewRadius: 100, // arena-room.ts aoi: viewRadius: 100
    capNeutral: 100, // arena-room.ts onReady/resetMatch: capA/capB/capC init to 100
  },
  lag: LAG,

  modes: {
    order: MODE_ORDER,
    tdm: { killTarget: MODES.tdm.killTarget },
    ffa: { killTarget: MODES.ffa.killTarget },
    dom: {
      captureRadius: MODES.dom.captureRadius,
      capturePerSec: MODES.dom.capturePerSec,
      pointsPer2s: MODES.dom.pointsPer2s,
      scoreTarget: MODES.dom.scoreTarget,
    },
    // The data half of modes.ts's mapForMode(): dom → arena2, everything else → arena1.
    mapFor: { tdm: "arena1", ffa: "arena3", dom: "arena2", practice: "arena1" },
  },
  maps: { arena1: ARENA1, arena2: ARENA2, arena3: ARENA3 },

  // bots: src/bots.ts's BotBrainOptions defaults + its module-private
  // CLOSE_THREAT_M/OBJECTIVE_ARRIVE_M dom-only constants (neither is exported).
  bots: {
    aimNoiseRad: 0.045, // was 0.012 (0.7°) — owner: "bots are too good" (2026-09-07); 2.6° ≈ 0.9 m std-dev at 20 m
    reactionMs: 200, // 150 → 400 felt too easy → 200 (owner, 2026-09-07)
    aimHeight: 1.0,
    strafeZ: 11,
    strafeAmp: 1.2,
    strafePeriodMs: 700,
    closeThreatM: 8,
    objectiveArriveM: 2,
  },

  // teams: client/config.ts's tints + the spawn yaw transcribed from
  // arena-room.ts's initPlayer/spawnInto (`team === TEAM.red ? Math.PI / 2 : (3 * Math.PI) / 2`).
  teams: {
    colors: TEAM_COLOR,
    colorsDim: TEAM_COLOR_DIM,
    spawnFacingYaw: [Math.PI / 2, (3 * Math.PI) / 2],
    uiText: ["#ff8a6e", "#7db0ff"], // hud.ts's repeated text/score accent (W2 dedup finding)
  },

  // --- text: transcribed verbatim (no exported strings in any client module) --
  text: {
    title: "IRONSIGHT", // client/mode-select.ts's fullscreen menu <h1>
    controlsHintFmt: "{move} move · {sprint} sprint · {crouch} crouch · {jump} jump · {reload} reload · {grenade} grenade · 1–5 weapons · LMB fire · M mute", // client/hud.ts showLockPrompt
    modeLabels: {
      tdm: { ko: "팀 데스매치", en: "TEAM DEATHMATCH" },
      ffa: { ko: "개인전", en: "FREE-FOR-ALL" },
      dom: { ko: "거점 점령", en: "DOMINATION" },
      practice: { ko: "연습 모드", en: "PRACTICE" },
    },
    quit: {
      prompt: "게임을 나가시겠습니까?", // client/quit-confirm.ts
      continueLabel: "계속하기",
      quitLabel: "나가기",
    },
    hud: {
      gameTitle: "ironsight", // client/hud.ts showLockPrompt's <h1>ironsight</h1>
      clickToPlay: "CLICK TO PLAY", // client/main.ts
      connecting: "CONNECTING…", // client/main.ts
      connectionFailed: "CONNECTION FAILED — RELOADING…", // client/main.ts
      eliminated: "ELIMINATED", // client/hud.ts showDeath
      eliminatedByFmt: "eliminated by {killer}", // client/hud.ts showDeath
      respawnInFmt: "respawn in {s}s", // client/hud.ts showDeath
      respawningNow: "respawning…", // client/hud.ts showDeath (secondsLeft <= 0)
      winsFmt: "{winner} WINS", // client/hud.ts showMatchEnd
      draw: "DRAW", // client/hud.ts showMatchEnd
      warmup: "WARMUP", // client/hud.ts
      restartVotesFmt: "RESTART VOTES {count}/{need}", // client/hud.ts showMatchEnd
      voteHint: "PRESS R TO VOTE RESTART", // client/hud.ts showMatchEnd
      yourScoreFmt: "your score: {k} K / {d} D", // client/hud.ts showMatchEnd
      streakFmt: "{who} · {count} KILL STREAK", // client/hud.ts showStreak
      hp: "HP", // client/hud.ts
      vs: "vs", // client/hud.ts
    },
    killfeedIcons: { head: " ✷ ", blast: " 💥 ", body: " ➜ " }, // client/hud.ts addKill
    nadeIcon: "💣", // client/hud.ts setNades
    botNameFmt: "BOT{n}", // client/main.ts's name()
    selfName: "You", // client/main.ts's name()
    settings: {
      title: "설정",
      sensitivityLabel: "마우스 감도",
      invertYLabel: "상하 시점 반전",
      keybindingsTitle: "키 설정",
      actionLabels: {
        forward: "앞으로",
        back: "뒤로",
        left: "왼쪽",
        right: "오른쪽",
        jump: "점프",
        crouch: "앉기",
        sprint: "달리기",
        reload: "재장전",
        grenade: "수류탄",
      },
      captureHint: "아무 키나 누르세요…",
      resetAllLabel: "기본값 복원",
      closeLabel: "닫기",
      openLabel: "설정",
    },
  },

  // --- palette: transcribed verbatim from client/scene.ts + client/vfx.ts -----
  palette: {
    sceneBg: 0x1a2030, // scene.ts constructor: scene.background
    fog: { color: 0x1a2030, near: 40, far: 110 }, // scene.ts constructor: scene.fog
    floor: 0x49546a, // scene.ts buildArena
    walls: 0x2c3444, // scene.ts buildArena wallMat
    coverBox: 0x93a1ba, // scene.ts buildArena boxMat
    coverEdge: 0xc4cee0, // scene.ts buildArena edgeMat
    muzzle: 0xffdd88, // scene.ts buildViewmodel + vfx.ts buildMuzzle
    muzzleLight: 0xffcc77, // scene.ts buildViewmodel + vfx.ts buildMuzzle
    grenadeMesh: 0x3f5a3a, // scene.ts spawnNade
    tracerHit: 0xff7755, // scene.ts addTracer (hit === true)
    tracerMiss: 0xffe08a, // scene.ts addTracer (hit === false)
    boom: { light: 0xffb066, ring: 0xffcc88, parts: 0xffa050 }, // scene.ts boomNade
    impactBlood: 0x7a1414, // vfx.ts spawnImpact (hitPlayer)
    impactSpark: 0xffcf8a, // vfx.ts spawnImpact (else)
    casing: 0xc9a227, // vfx.ts buildCasing
    viewmodel: { metal: 0x424956, accent: 0x5f6b82, dark: 0x2c313c, modelEmissive: 0x00e5ff }, // scene.ts VM_METAL/VM_ACCENT/VM_DARK; modelEmissive = cyber-trooper-era cyan accent for GLB weapons
    lights: { hemiSky: 0xc2d4f2, hemiGround: 0x3a4656, key: 0xfff0d8, ambient: 0x60708a }, // scene.ts constructor
  },

  // --- camera: imported HIP_FOV/ADS_FOV + near/far transcribed from scene.ts ---
  camera: {
    hipFov: HIP_FOV,
    adsFov: ADS_FOV,
    near: 0.05, // scene.ts: new THREE.PerspectiveCamera(78, 1, 0.05, 300)
    far: 300,
  },

  // --- feel: imported from client/config.ts + respawnDisplayMs transcribed ----
  feel: {
    mouseSensitivity: MOUSE_SENSITIVITY,
    // Runtime invert-Y is now player-controlled via client/settings.ts's
    // Settings.invertY (localStorage-backed), not this static config field —
    // FeelConfig.invertY is unused dead weight kept only for schema parity.
    invertY: false,
    lookSendMs: LOOK_SEND_MS,
    moveKeepaliveMs: MOVE_KEEPALIVE_MS,
    interpDelayMs: INTERP_DELAY_MS,
    reconcileSoftM: RECONCILE_SOFT_M,
    reconcileSnapM: RECONCILE_SNAP_M,
    reconcileFrac: RECONCILE_FRAC,
    reconcileTauMs: RECONCILE_TAU_MS,
    respawnDisplayMs: 3000, // client/main.ts's RESPAWN_MS ("mirrors MATCH.respawnMs")
  },

  // --- audio: transcribed verbatim from client/audio.ts ------------------------
  audio: {
    fireParams: [
      { bp: 1600, dur: 0.09, gain: 0.9, thump: 180 }, // AR
      { bp: 2300, dur: 0.055, gain: 0.65, thump: 240 }, // SMG
      { bp: 650, dur: 0.18, gain: 1.1, thump: 110 }, // Shotgun
      { bp: 900, dur: 0.26, gain: 1.2, thump: 80 }, // Sniper
      { bp: 1300, dur: 0.08, gain: 0.75, thump: 200 }, // Pistol
    ],
    fireBandpassQ: 0.8,
    fireThumpGainStart: 0.5,
    fireThumpFreqFloor: 45,
    fireThumpDecayFrac: 0.9,
    fireStopTailSec: 0.02,
    noiseBufferSec: 0.5,
    masterGain: 0.5,
    boom: {
      lpStart: 900,
      lpEnd: 80,
      lpRampSec: 0.45,
      gainStart: 1.2,
      gainRampSec: 0.5,
      stopSec: 0.52,
      subFreq: 50,
      subGainRampUpSec: 0.02,
      subGainPeak: 0.6,
      subGainRampDownSec: 0.4,
      subStopSec: 0.42,
    },
    swap: { freqs: [420, 300], gain: 0.12, rampSec: 0.03, stopSec: 0.04, staggerSec: 0.06 },
    hit: { freqHead: 1400, freqBody: 900, gain: 0.28, rampSec: 0.06, stopSec: 0.07 },
    hurt: { freqStart: 180, freqEnd: 70, freqRampSec: 0.12, gain: 0.35, gainRampSec: 0.13, stopSec: 0.14 },
    kill: { freqs: [660, 990], gainPeak: 0.3, rampUpSec: 0.01, rampDownSec: 0.12, stopSec: 0.13, staggerSec: 0.07 },
    footstep: { lpFreq: 350, gain: 0.12, rampSec: 0.05, stopSec: 0.06 },
    ambient: { lpFreq: 500, lpQ: 0.5, gain: 0.05, bufferSec: 4 },
  },

  // --- weaponVis: transcribed verbatim from client/scene.ts --------------------
  weaponVis: {
    presentation: VISUALS,
    recoil: [0.4, 0.2, 0.7, 0.9, 0.3], // scene.ts's VM_RECOIL
    swapDownMs: 120, // scene.ts's SWAP_DOWN_MS
    swapUpMs: 230, // scene.ts's SWAP_UP_MS
    // No `models` (legacy per-file GLBs) — the cyber-trooper set is fully
    // superseded by `bundle` below, which now covers all 5 slots. Leaving a
    // populated `models` here would be a latent hazard, not a safety net: if
    // `bundle` ever failed to load, VM_WEAPON_TRANSFORMS (tuned for the Synty
    // meshes) would apply to the wrong geometry instead of the safe
    // procedural fallback. A future re-add is fine if a slot genuinely needs
    // a single-file override again.
    // Synty viewmodel weapon bundle: five muzzle-normalized (+Z), grip-origined
    // weapons merged into one texture-deduped GLB. Must stay a SINGLE-scene GLB —
    // a multi-scene merge makes GLTFLoader expose only the default scene, so the
    // other nodes silently resolve to the procedural fallback.
    bundle: {
      url: "/assets/models/weapons-vm.glb",
      nodes: {
        0: "wep_ar",
        1: "wep_smg",
        2: "wep_shotgun",
        3: "wep_sniper",
        4: "wep_pistol",
      },
    },
  },

  // --- models: rigged remote-player GLB (client/rig-loader.ts) ----------------
  models: {
    player: "/assets/models/player.glb",
  },

  // --- mapDressing: baked Synty visual-only bundles (client/dressing-loader.ts,
  // client/dressing/arena{1,2}.manifest.json) — absent/load-failure falls back
  // to the procedural box/wall render (client/scene.ts's buildArena).
  mapDressing: {
    arena1: "/assets/maps/arena1-dressing.glb",
    arena2: "/assets/maps/arena2-dressing.glb",
  },
});
