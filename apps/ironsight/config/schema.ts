/**
 * `GameConfig` — the data surface of ironsight, extracted per PLAN-IRONSIGHT M4
 * ("config 추출 → gg 블루프린트 #2"). Mirrors the boundary rule and loader shape
 * of `gg`'s quarterview-arpg blueprint (`D:\gg\blueprints\quarterview-arpg\config`):
 * thresholds, counts, tuning numbers, colors, and strings live here; the loops,
 * state machines, and render pipeline that consume them stay in `src`/`client`.
 *
 * Consumers (arena-room.ts, bots.ts, index.ts, and the client modules) read the
 * loaded instance via `src/game-config.ts`'s `GAME` (wired in M4 W2/W3). The one
 * exception is `modes.ts`, which keeps importing `MODES`/`TEAM` from
 * `src/config.ts` directly: `ironsight.config.ts` imports `MODE_ORDER` FROM
 * modes.ts, so modes.ts reading `GAME` back would close an ESM cycle — and since
 * `GAME.modes` derives from the same objects by reference, both reads are
 * value-identical anyway. Every value here is either imported directly from the
 * existing exported constant it lifts (guaranteeing the two can never drift) or,
 * where no exported symbol existed (an inline literal in a consumer file), moved
 * here as the single definition — `ironsight.config.ts`'s own doc comments cite
 * the original source for each group, and `test/config.test.ts` spot-checks them.
 *
 * `WeaponSpec` (`../src/config.js`) and `MapDef` (`../src/map/types.js`) are reused
 * verbatim, unchanged — this config only supplies instances of them.
 */

import type { WeaponSpec } from "../src/config.js";
import type { MapDef } from "../src/map/types.js";
import type { ModeId } from "../src/modes.js";

// ── meta ──────────────────────────────────────────────────────────────────────

/** Deployment/identity metadata. `workerName`/`party` mirror `wrangler.jsonc`'s
 *  `name` and the kebab-case Durable Object party (AGENTS.md rule 4). */
export interface MetaConfig {
  id: string;
  title: string;
  workerName: string;
  party: string;
  compatibilityDate: string;
}

// ── arena / player / move ─────────────────────────────────────────────────────

/** Arena extents (src/config.ts's `ARENA`). MUST stay in lock-step with every
 *  map's `bounds` and the wire codec's quant ranges — see {@link assertMapsFitArena}. */
export interface ArenaConfig {
  width: number;
  depth: number;
  ceiling: number;
}

/** Player capsule + head sphere, metres (src/config.ts's `PLAYER`). */
export interface PlayerConfig {
  radius: number;
  standHeight: number;
  crouchHeight: number;
  standEye: number;
  crouchEye: number;
  headRadius: number;
  maxHp: number;
}

/** Movement model (src/config.ts's `MOVE`; `maxDtMs` is derived from the tick
 *  rate, not an independent data slot, so it's omitted here). */
export interface MoveConfig {
  walk: number;
  sprint: number;
  crouch: number;
  gravity: number;
  jumpSpeed: number;
}

// ── weapons / grenade ─────────────────────────────────────────────────────────

/** Weapon-handling tunables shared across all weapons (src/config.ts's `WEAPON`
 *  + `DEFAULT_WEAPON`/`PISTOL_INDEX`). */
export interface WeaponMetaConfig {
  defaultIndex: number;
  pistolIndex: number;
  swapMs: number;
}

/** Frag grenade (src/config.ts's `GRENADE`), plus `muzzleOffset` — arena-room.ts's
 *  `handleNade` spawns the projectile this far ahead of the eye along the aim ray
 *  ("clears the thrower's own body/cover"), a literal not currently in `GRENADE`. */
export interface GrenadeConfig {
  count: number;
  fuseMs: number;
  radius: number;
  maxDamage: number;
  throwSpeed: number;
  restitution: number;
  projRadius: number;
  throwCooldownMs: number;
  muzzleOffset: number;
}

// ── match flow / lag comp ─────────────────────────────────────────────────────

/** TDM match flow (src/config.ts's `MATCH`) plus room-level literals that
 *  aren't currently in `MATCH` (`maxInputsPerSecond`/`aoiViewRadius` — set
 *  directly on `ArenaRoomImpl` in arena-room.ts's `onReady`/`aoi`; `capNeutral` —
 *  the dom cap gauge's neutral starting value, `onReady`/`resetMatch` init
 *  `capA/B/C` to it). Kept flat here (not nested under `modes.dom`) so it stays
 *  spot-checked field-by-field rather than caught by a blanket `toEqual` against
 *  `MODES.dom` (a W2 finding — see test/config.test.ts's equivalence block). */
export interface MatchConfig {
  maxClients: number;
  killTarget: number;
  timeLimitMs: number;
  intermissionMs: number;
  respawnMs: number;
  spawnProtectMs: number;
  warmupMinPlayers: number;
  warmupMs: number;
  assistWindowMs: number;
  killstreakThresholds: readonly number[];
  fillToPlayers: number;
  maxInputsPerSecond: number;
  aoiViewRadius: number;
  capNeutral: number;
}

/** Server-side lag compensation (src/config.ts's `LAG`). Split out of `MATCH` to
 *  mirror the source module's own grouping, and because `interpolationMs` is
 *  load-time coupled to `feel.interpDelayMs` (client render delay) — see
 *  {@link assertInterpCoupling}. */
export interface LagConfig {
  depthMs: number;
  interpolationMs: number;
}

// ── modes / maps ──────────────────────────────────────────────────────────────

/** Game mode tunables (src/modes.ts's `MODE_ORDER` + src/config.ts's `MODES`),
 *  plus `mapFor` — the data half of modes.ts's `mapForMode()` function (tdm/ffa/
 *  practice → "arena1", dom → "arena2"). */
export interface ModesConfig {
  /** Wire encoding: append-only — an existing index must never move (modes.ts's
   *  own doc comment on `MODE_ORDER`). See {@link assertModesWireOrder}. */
  order: readonly ModeId[];
  tdm: { killTarget: number };
  ffa: { killTarget: number };
  dom: { captureRadius: number; capturePerSec: number; pointsPer2s: number; scoreTarget: number };
  /** Mode id → key into {@link GameConfig.maps}. */
  mapFor: Record<ModeId, string>;
}

/** Every map, keyed by an arbitrary string id (`"arena1"`, `"arena2"`) that
 *  {@link ModesConfig.mapFor} references. Reuses the blueprint `MapDef` shape verbatim. */
export type MapsConfig = Record<string, MapDef>;

// ── bots ──────────────────────────────────────────────────────────────────────

/** Filler-bot brain defaults (src/bots.ts's `BotBrainOptions` defaults + the
 *  module-private `CLOSE_THREAT_M`/`OBJECTIVE_ARRIVE_M` dom-only constants). */
export interface BotsConfig {
  aimNoiseRad: number;
  reactionMs: number;
  aimHeight: number;
  strafeZ: number;
  strafeAmp: number;
  strafePeriodMs: number;
  closeThreatM: number;
  objectiveArriveM: number;
}

// ── teams ─────────────────────────────────────────────────────────────────────

/** Team tints (client/config.ts's `TEAM_COLOR`/`TEAM_COLOR_DIM`) + the spawn
 *  facing yaw baked into arena-room.ts's `initPlayer`/`spawnInto` (index 0 = red
 *  faces `π/2`, index 1 = blue faces `3π/2`). */
export interface TeamsConfig {
  colors: readonly [number, number];
  colorsDim: readonly [number, number];
  spawnFacingYaw: readonly [number, number];
  /** CSS hex strings for HUD text/score accents (hud.ts's `#ff8a6e`/`#7db0ff` —
   *  a lighter tint than `colors`, used only for text, not 3D materials). A W2
   *  finding: hud.ts repeated these 3 times; this is their single source. */
  uiText: readonly [string, string];
}

// ── text ──────────────────────────────────────────────────────────────────────

/** All localized/display strings, transcribed from client/mode-select.ts,
 *  client/quit-confirm.ts, client/hud.ts, and client/main.ts (none of these
 *  export their strings today, so every field here is a verbatim copy — see
 *  ironsight.config.ts's doc comment for the exact source lines). */
export interface TextConfig {
  /** mode-select.ts's fullscreen menu heading. */
  title: string;
  /** hud.ts's "CLICK TO PLAY" overlay hint line. */
  controlsHint: string;
  modeLabels: Record<ModeId, { ko: string; en: string }>;
  /** `continueLabel`/`quitLabel` name the BUTTON's action, not a generic dialog
   *  verb — a W3 finding: the original `confirm`/`cancel` field names read
   *  backwards (`confirm` held the "continue playing" button's text). */
  quit: { prompt: string; continueLabel: string; quitLabel: string };
  hud: {
    /** hud.ts's own in-overlay heading — distinct from {@link TextConfig.title}
     *  (mode-select's menu heading), a different string at a different screen. */
    gameTitle: string;
    clickToPlay: string;
    connecting: string;
    connectionFailed: string;
    eliminated: string;
    eliminatedByFmt: string;
    respawnInFmt: string;
    respawningNow: string;
    winsFmt: string;
    draw: string;
    warmup: string;
    restartVotesFmt: string;
    voteHint: string;
    yourScoreFmt: string;
    streakFmt: string;
    hp: string;
    vs: string;
  };
  killfeedIcons: { head: string; blast: string; body: string };
  nadeIcon: string;
  botNameFmt: string;
  selfName: string;
}

// ── palette ───────────────────────────────────────────────────────────────────

/** Scene/VFX colors, all `0xRRGGBB`, transcribed from client/scene.ts and
 *  client/vfx.ts (neither exports them today). */
export interface PaletteConfig {
  sceneBg: number;
  fog: { color: number; near: number; far: number };
  floor: number;
  walls: number;
  coverBox: number;
  coverEdge: number;
  muzzle: number;
  muzzleLight: number;
  grenadeMesh: number;
  tracerHit: number;
  tracerMiss: number;
  boom: { light: number; ring: number; parts: number };
  impactBlood: number;
  impactSpark: number;
  casing: number;
  viewmodel: {
    metal: number;
    accent: number;
    dark: number;
    /** Emissive accent for GLB-modeled viewmodel weapons (weaponVis.models) — a
     *  subtle glow, not a base color; the procedural box-built weapons (VM_METAL/
     *  VM_ACCENT/VM_DARK) don't use this at all. */
    modelEmissive: number;
  };
  /** Scene lighting rig colors (scene.ts's constructor `HemisphereLight`/
   *  `DirectionalLight`/`AmbientLight` — a W2 finding, not itemized in the
   *  original W1 catalogue). Intensities stay as code-side art tuning. */
  lights: { hemiSky: number; hemiGround: number; key: number; ambient: number };
}

// ── camera / feel ─────────────────────────────────────────────────────────────

/** FOV (client/config.ts's `HIP_FOV`/`ADS_FOV`) + the near/far clip planes
 *  transcribed from client/scene.ts's `THREE.PerspectiveCamera(78, 1, 0.05, 300)`. */
export interface CameraConfig {
  hipFov: number;
  /** Per-weapon ADS FOV, indexed like {@link GameConfig.weapons}. */
  adsFov: readonly number[];
  near: number;
  far: number;
}

/** Client-only feel tunables (client/config.ts, reused verbatim), plus
 *  `respawnDisplayMs` — main.ts's own `RESPAWN_MS` duplicate of `match.respawnMs`
 *  (see {@link assertRespawnCoupling}). */
export interface FeelConfig {
  mouseSensitivity: number;
  invertY: boolean;
  lookSendMs: number;
  moveKeepaliveMs: number;
  interpDelayMs: number;
  reconcileSoftM: number;
  reconcileSnapM: number;
  reconcileFrac: number;
  reconcileTauMs: number;
  respawnDisplayMs: number;
}

// ── audio ─────────────────────────────────────────────────────────────────────

/** Per-weapon gunshot crack character (client/audio.ts's `FIRE_PARAMS`). */
export interface FireParam {
  bp: number;
  dur: number;
  gain: number;
  thump: number;
}

/** Synthesized SFX params transcribed from client/audio.ts (fully procedural —
 *  no asset files). `fireParams` is length-coupled to `weapons`/`weaponVis.recoil`/
 *  `camera.adsFov` — see {@link assertParallelArrayLengths}. */
export interface AudioConfig {
  fireParams: readonly FireParam[];
  /** Shared bandpass Q across every weapon's crack (playFire's `bp.Q.value`). */
  fireBandpassQ: number;
  /** Shared across every weapon's thump oscillator (playFire's `og.gain` start). */
  fireThumpGainStart: number;
  /** Thump frequency floor at the end of its ramp (`Math.max(45, p.thump / 3)`). */
  fireThumpFreqFloor: number;
  /** Fraction of `dur` the thump ramp takes (`t + p.dur * 0.9`). */
  fireThumpDecayFrac: number;
  /** Extra tail after `dur` before both oscillators stop (`t + p.dur + 0.02`). */
  fireStopTailSec: number;
  /** Shared white-noise buffer length backing gunshots + footsteps (`playFire`/`playFootstep`). */
  noiseBufferSec: number;
  /** Master gain node's unmuted value (`ensure()`'s `master.gain.value`). */
  masterGain: number;
  boom: {
    lpStart: number;
    lpEnd: number;
    lpRampSec: number;
    gainStart: number;
    gainRampSec: number;
    stopSec: number;
    subFreq: number;
    subGainRampUpSec: number;
    subGainPeak: number;
    subGainRampDownSec: number;
    subStopSec: number;
  };
  swap: { freqs: readonly [number, number]; gain: number; rampSec: number; stopSec: number; staggerSec: number };
  hit: { freqHead: number; freqBody: number; gain: number; rampSec: number; stopSec: number };
  hurt: { freqStart: number; freqEnd: number; freqRampSec: number; gain: number; gainRampSec: number; stopSec: number };
  kill: {
    freqs: readonly [number, number];
    gainPeak: number;
    rampUpSec: number;
    rampDownSec: number;
    stopSec: number;
    staggerSec: number;
  };
  footstep: { lpFreq: number; gain: number; rampSec: number; stopSec: number };
  /** Ambient wind bed, started once alongside the rest of the audio graph. */
  ambient: { lpFreq: number; lpQ: number; gain: number; bufferSec: number };
}

// ── weapon visuals ────────────────────────────────────────────────────────────

/** Viewmodel visuals (client/scene.ts's `VM_RECOIL`/`SWAP_DOWN_MS`/`SWAP_UP_MS`).
 *  `models` is optional — ironsight's weapons are procedural low-poly meshes built
 *  by `buildWeaponMesh(index)`; a future model swap would key off this map, with no
 *  loading logic implied by its mere presence in this wave. */
export interface WeaponVisConfig {
  /** Per-weapon recoil kick, indexed like {@link GameConfig.weapons}. */
  recoil: readonly number[];
  /** Lower-holder phase duration; `swapDownMs + swapUpMs` MUST equal
   *  `weaponMeta.swapMs` — see {@link assertSwapMsCoupling}. */
  swapDownMs: number;
  /** Raise-holder phase duration. */
  swapUpMs: number;
  models?: Record<number, string>;
}

// ── models (optional visual asset overrides) ─────────────────────────────────

/** Optional GLB model overrides for otherwise-procedural visuals. Absent (or an
 *  absent sub-field) means the existing procedural/capsule path — neonstrike
 *  carries no `models` at all, proving the client's fallback still holds. */
export interface ModelsConfig {
  /** Rigged remote-player character (client/rig-loader.ts). Normalized to
   *  `player.standHeight` with feet at y=0 on load, team-tinted via `teams.colors`. */
  player?: string;
}

// ── map dressing (optional visual-only Synty bundles) ────────────────────────

/** Optional per-map visual-dressing bundle GLBs (client/dressing-loader.ts +
 *  client/scene.ts), keyed by the same map id used in `MapsConfig` (e.g.
 *  "arena1"). Each bundle's own node transforms already place every object in
 *  world space (baked by is-armfix's manifest→bundle CLI from
 *  client/dressing/arena{1,2}.manifest.json — see that file's `hiddenBoxIndices`
 *  for which of the map's collision boxes it visually covers), so the client
 *  just adds the loaded scene at the origin. Absent (or a load failure) falls
 *  back to the existing procedural box/wall render — src/map/* collision data
 *  is never touched by this feature. */
export type MapDressingConfig = Record<string, string>;

// ── root ──────────────────────────────────────────────────────────────────────

/** The full data surface of one ironsight game. */
export interface GameConfig {
  meta: MetaConfig;
  arena: ArenaConfig;
  player: PlayerConfig;
  move: MoveConfig;
  weapons: readonly WeaponSpec[];
  weaponMeta: WeaponMetaConfig;
  grenade: GrenadeConfig;
  match: MatchConfig;
  lag: LagConfig;
  modes: ModesConfig;
  maps: MapsConfig;
  bots: BotsConfig;
  teams: TeamsConfig;
  text: TextConfig;
  palette: PaletteConfig;
  camera: CameraConfig;
  feel: FeelConfig;
  audio: AudioConfig;
  weaponVis: WeaponVisConfig;
  models?: ModelsConfig;
  mapDressing?: MapDressingConfig;
}

/** Identity helper: authors a `GameConfig` with full inference + excess-property
 *  checking. Reference/coupling validation is a separate step — see `load.ts`'s
 *  `loadConfig`/`validateConfig`. */
export function defineConfig(config: GameConfig): GameConfig {
  return config;
}
