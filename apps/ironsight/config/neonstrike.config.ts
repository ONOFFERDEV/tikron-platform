import { RECOIL } from "../src/recoil.js";
/**
 * NEONSTRIKE — the M4 W3 second-theme demo. Proves the ironsight room/client
 * CODE is genre/theme-agnostic once every consumer reads `GAME` instead of
 * scattered constants: this file supplies a wholly different weapon roster
 * (new names + retuned stats, still passing the TTK balance heuristic —
 * see test/ttk-lib.ts), a full neon-cyberpunk palette, retitled/retexted UI,
 * a synth-audio variant, and swapped team colors — fed into the SAME
 * `src/rooms/arena-room.ts`/`client/*.ts` that ship ironsight.
 *
 * `arena`/`player`/`move`/`grenade`/`match`/`lag`/`modes`/`maps`/`bots`/`camera`/
 * `feel` are DELIBERATELY reused verbatim from ironsight (imported, not
 * retyped) — the swap is scoped to identity/weapons/palette/text/audio/teams,
 * per the W3 brief; the maps' wire-frozen bounds and the match-flow/lag
 * coupling constants stay untouched so the loader's coupling asserts pass
 * trivially on the reused side, and the swap doesn't have to re-litigate
 * physics/timing that isn't part of this theme's identity.
 *
 * This module is NOT wired into `src/game-config.ts` by default — the ironsight
 * app ships `ironsightConfig`. It's loaded only for the W3 swap-and-verify
 * exercise (see the swap procedure recorded in the W3 report).
 */

import { ARENA, WORLD_LIMITS, PLAYER, HIT, MOVE, GRENADE, MATCH, LAG } from "../src/config.js";
import { MODE_ORDER } from "../src/modes.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";
import { MOUSE_SENSITIVITY, LOOK_SEND_MS, MOVE_KEEPALIVE_MS, INTERP_DELAY_MS, RECONCILE_SOFT_M, RECONCILE_SNAP_M, RECONCILE_FRAC, RECONCILE_TAU_MS, HIP_FOV, ADS_FOV } from "../client/config.js";
import { defineConfig, type GameConfig } from "./schema.js";

export const neonstrikeConfig: GameConfig = defineConfig({
  meta: {
    id: "neonstrike",
    title: "Neonstrike",
    workerName: "neonstrike-demo", // not a real deploy target — W3 swap demo only
    party: "arena-room",
    compatibilityDate: "2025-09-01",
  },

  // Reused verbatim — not part of this theme's identity (see file doc comment).
  arena: WORLD_LIMITS,
  player: PLAYER,
  hit: HIT,
  move: MOVE,

  // --- weapons: full retune, 5 slots, new names + stats -----------------------
  // Validated against test/ttk-lib.ts's balance heuristic before shipping here:
  // Scatter Cannon owns 5m, an automatic owns 15m, Pulse Rifle owns 30m, Ion
  // Railgun one-shots headshots at every range, ≥3 killers per band.
  // tracerSpeed: same series as ironsight's corresponding slot (AR-like/SMG/
  // shotgun-like/sniper-like/pistol) — this is a visual-only tuning axis, not
  // part of this theme's balance identity, so it's reused rather than retuned.
  weapons: [
    {
      adsMs: 250, sprintToFireMs: 120,
      recoil: RECOIL[0]!, slot: 1, name: "Pulse Rifle", damageBody: 30, damageHead: 58, fireIntervalMs: 95,
      mag: 32, reserve: 96, reloadMs: 1650, range: 105, pellets: 1, pelletSpread: 0,
      spreadStill: 0, spreadMove: 0.018, spreadAir: 0.045, falloffStart: 34, falloffEnd: 70, falloffMin: 0.72,
      tracerSpeed: 800,
    },
    {
      adsMs: 200, sprintToFireMs: 100,
      recoil: RECOIL[1]!, slot: 2, name: "Voltage SMG", damageBody: 23, damageHead: 34, fireIntervalMs: 58,
      mag: 27, reserve: 108, reloadMs: 1450, range: 78, pellets: 1, pelletSpread: 0,
      spreadStill: 0.004, spreadMove: 0.028, spreadAir: 0.058, falloffStart: 15, falloffEnd: 34, falloffMin: 0.5,
      tracerSpeed: 700,
    },
    {
      adsMs: 225, sprintToFireMs: 130,
      recoil: RECOIL[2]!, slot: 3, name: "Scatter Cannon", damageBody: 16, damageHead: 22, fireIntervalMs: 780,
      mag: 6, reserve: 24, reloadMs: 2500, range: 42, pellets: 8, pelletSpread: 0.05,
      spreadStill: 0, spreadMove: 0.02, spreadAir: 0.05, falloffStart: 7, falloffEnd: 24, falloffMin: 0.28,
      tracerSpeed: 500,
    },
    {
      adsMs: 400, sprintToFireMs: 150,
      recoil: RECOIL[3]!, slot: 4, name: "Ion Railgun", damageBody: 82, damageHead: 155, fireIntervalMs: 1350,
      mag: 5, reserve: 20, reloadMs: 3100, range: 105, pellets: 1, pelletSpread: 0,
      spreadStill: 0.0005, spreadMove: 0.125, spreadAir: 0.2, falloffStart: 105, falloffEnd: 106, falloffMin: 1,
      tracerSpeed: 1200,
    },
    {
      adsMs: 165, sprintToFireMs: 90,
      recoil: RECOIL[4]!, slot: 5, name: "Stinger Pistol", damageBody: 32, damageHead: 58, fireIntervalMs: 155,
      mag: 13, reserve: 52, reloadMs: 1350, range: 92, pellets: 1, pelletSpread: 0,
      spreadStill: 0.0018, spreadMove: 0.018, spreadAir: 0.045, falloffStart: 22, falloffEnd: 46, falloffMin: 0.72,
      tracerSpeed: 600,
    },
  ],
  weaponMeta: {
    defaultIndex: 0, // Pulse Rifle
    pistolIndex: 4, // Stinger Pistol (last slot)
    swapMs: 300, // must equal weaponVis.swapDownMs + swapUpMs (100 + 200)
  },
  // GRENADE/MATCH don't carry the W2-found literals (muzzleOffset/maxInputsPerSecond/
  // aoiViewRadius/capNeutral) — reused verbatim from ironsight's own config instance
  // values (not retuning scope for this theme).
  grenade: { ...GRENADE, muzzleOffset: 0.6 },
  match: { ...MATCH, maxInputsPerSecond: 90, aoiViewRadius: 100, capNeutral: 100 },
  lag: LAG,

  modes: {
    order: MODE_ORDER, // hard-fixed wire order — never retuned by a theme
    tdm: { killTarget: 50 },
    ffa: { killTarget: 30 },
    dom: { captureRadius: 4, capturePerSec: 25, pointsPer2s: 1, scoreTarget: 200 },
    mapFor: { tdm: "arena1", ffa: "arena3", dom: "arena2", practice: "arena1" },
  },
  maps: { arena1: ARENA1, arena2: ARENA2, arena3: ARENA3 }, // reused — bounds are wire-frozen

  bots: {
    aimNoiseRad: 0.012,
    reactionMs: 150,
    aimHeight: 1.0,
    strafeZ: 11,
    strafeAmp: 1.2,
    strafePeriodMs: 700,
    closeThreatM: 8,
    objectiveArriveM: 2,
  },

  teams: {
    colors: [0x00e5ff, 0xff2bd6], // neon cyan / magenta (was red/blue)
    colorsDim: [0x006b78, 0x7a1568],
    spawnFacingYaw: [Math.PI / 2, (3 * Math.PI) / 2], // structural, unchanged
    uiText: ["#5df3ff", "#ff7be8"],
  },

  text: {
    title: "NEONSTRIKE",
    controlsHintFmt: "{move} move · {sprint} sprint · {crouch} crouch · {jump} jump · {reload} reload · LMB fire · M mute",
    modeLabels: {
      tdm: { ko: "팀전", en: "TEAM CLASH" },
      ffa: { ko: "개인전", en: "FREE-FOR-ALL" },
      dom: { ko: "거점 점령", en: "GRID CONTROL" },
      practice: { ko: "시뮬레이션", en: "SIM MODE" },
    },
    quit: {
      prompt: "세션을 종료하시겠습니까?",
      continueLabel: "계속 접속",
      quitLabel: "로그아웃",
    },
    hud: {
      gameTitle: "neonstrike",
      clickToPlay: "JACK IN",
      connecting: "LINKING…",
      connectionFailed: "LINK LOST — RECONNECTING…",
      eliminated: "FLATLINED",
      eliminatedByFmt: "flatlined by {killer}",
      respawnInFmt: "respawn in {s}s",
      respawningNow: "respawning…",
      winsFmt: "{winner} WINS",
      draw: "DRAW",
      warmup: "WARMUP",
      restartVotesFmt: "RESTART VOTES {count}/{need}",
      voteHint: "PRESS R TO VOTE RESTART",
      yourScoreFmt: "your score: {k} K / {d} D",
      streakFmt: "{who} · {count} KILL STREAK",
      hp: "HP",
      vs: "vs",
    },
    killfeedIcons: { head: " ⚡ ", blast: " ✺ ", body: " ▸ " },
    nadeIcon: "💠",
    botNameFmt: "NPC{n}",
    selfName: "You",
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

  palette: {
    sceneBg: 0x05010f,
    fog: { color: 0x05010f, near: 35, far: 100 },
    floor: 0x120a24,
    walls: 0x1a0e30,
    coverBox: 0x2a1750,
    coverEdge: 0x00e5ff,
    muzzle: 0x00ffe5,
    muzzleLight: 0x00e5ff,
    grenadeMesh: 0xff00e5,
    tracerHit: 0xff2bd6,
    tracerMiss: 0x00e5ff,
    boom: { light: 0xff00e5, ring: 0x00ffe5, parts: 0xffe600 },
    impactBlood: 0xff0055,
    impactSpark: 0x00e5ff,
    casing: 0xffe600,
    viewmodel: { metal: 0x2a1750, accent: 0x00e5ff, dark: 0x0a0518, modelEmissive: 0x00e5ff },
    lights: { hemiSky: 0x6a3aff, hemiGround: 0x1a0e30, key: 0xff2bd6, ambient: 0x2a1750 },
  },

  camera: { hipFov: HIP_FOV, adsFov: ADS_FOV, near: 0.05, far: 300 }, // reused, not retuned

  feel: {
    mouseSensitivity: MOUSE_SENSITIVITY,
    // See ironsight.config.ts's matching comment — invertY is now player-owned
    // via client/settings.ts, this static field is unused schema filler.
    invertY: false,
    lookSendMs: LOOK_SEND_MS,
    moveKeepaliveMs: MOVE_KEEPALIVE_MS,
    interpDelayMs: INTERP_DELAY_MS,
    reconcileSoftM: RECONCILE_SOFT_M,
    reconcileSnapM: RECONCILE_SNAP_M,
    reconcileFrac: RECONCILE_FRAC,
    reconcileTauMs: RECONCILE_TAU_MS,
    respawnDisplayMs: MATCH.respawnMs, // must equal match.respawnMs
  },

  audio: {
    fireParams: [
      { bp: 1800, dur: 0.08, gain: 0.85, thump: 200 }, // Pulse Rifle
      { bp: 2600, dur: 0.05, gain: 0.6, thump: 260 }, // Voltage SMG
      { bp: 600, dur: 0.2, gain: 1.15, thump: 100 }, // Scatter Cannon
      { bp: 1100, dur: 0.3, gain: 1.25, thump: 70 }, // Ion Railgun
      { bp: 1500, dur: 0.075, gain: 0.7, thump: 220 }, // Stinger Pistol
    ],
    fireBandpassQ: 1.0,
    fireThumpGainStart: 0.45,
    fireThumpFreqFloor: 40,
    fireThumpDecayFrac: 0.85,
    fireStopTailSec: 0.02,
    noiseBufferSec: 0.5,
    masterGain: 0.5,
    boom: {
      lpStart: 1000, lpEnd: 90, lpRampSec: 0.4, gainStart: 1.3, gainRampSec: 0.55, stopSec: 0.57,
      subFreq: 45, subGainRampUpSec: 0.02, subGainPeak: 0.65, subGainRampDownSec: 0.42, subStopSec: 0.44,
    },
    swap: { freqs: [500, 350], gain: 0.14, rampSec: 0.028, stopSec: 0.038, staggerSec: 0.055 },
    hit: { freqHead: 1600, freqBody: 1000, gain: 0.3, rampSec: 0.055, stopSec: 0.065 },
    hurt: { freqStart: 200, freqEnd: 80, freqRampSec: 0.11, gain: 0.32, gainRampSec: 0.12, stopSec: 0.13 },
    kill: { freqs: [750, 1100], gainPeak: 0.32, rampUpSec: 0.01, rampDownSec: 0.11, stopSec: 0.12, staggerSec: 0.065 },
    footstep: { lpFreq: 400, gain: 0.11, rampSec: 0.045, stopSec: 0.055 },
    ambient: { lpFreq: 550, lpQ: 0.6, gain: 0.06, bufferSec: 4 },
  },

  weaponVis: {
    recoil: [0.35, 0.18, 0.65, 0.85, 0.28],
    swapDownMs: 100,
    swapUpMs: 200,
  },
});
