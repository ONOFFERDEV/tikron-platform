/**
 * Live connection to the `field-room` party: mirrors the room's authoritative
 * `EmberState` into the `UnitRenderer` (spawn/update/remove diffing +
 * `EntitySmoother` easing), routes the `combat` developer message into anim
 * triggers + a floating-number queue, and exposes `send()` for intents.
 *
 * The pure pieces (state diffing, cooldown tracking, the floating-number
 * queue) are plain functions with no DOM/three dependency — see
 * `test/client-net.test.ts`. `NetSession` is the DOM/three-touching glue on
 * top of them and is exercised by the 2-client WS smoke test instead.
 */
import { GameClient, EntitySmoother, type Room } from "@tikron/client";
import {
  EmberSchema,
  type EmberState,
  type EmberUnit,
  type CastTargetIntent,
} from "../src/rooms/ember-schema.js";
import { EMBERFALL_CONTENT } from "../src/content/emberfall-content.js";
import type { ItemInstance, EquipSlot, SavedZone } from "../src/types.js";
import type { UnitData } from "./units.js";
import type { UnitRenderer } from "./units.js";
import { MOB_KOREAN_NAMES, LEVEL_UP_FLAVOR, VILLAGE_RESPAWN_TEXT, randomLine, BOSS_LINES, type BossEvent } from "./lore.js";
import {
  setDeathOverlay,
  showToast,
  showBossBar,
  updateBossBar,
  hideBossBar,
  showBossLine,
  showBossBanner,
  runEndingBanners,
  showPhaseFlash,
} from "./ui.js";
import { createVfxSystem, type VfxSystem } from "./vfx.js";
import { playSfx } from "./audio.js";

/** Party (kebab-case of the Durable Object binding — AGENTS.md rule 4), one per zone room. */
export const FIELD_PARTY = "field-room";
export const VILLAGE_PARTY = "village-room";
export const DUNGEON_PARTY = "dungeon-room";

/** `SavedZone` -> the party that serves it (mirrors `index.ts`'s `defineRoom` bindings). */
export const ZONE_PARTY: Readonly<Record<SavedZone, string>> = {
  emberhold: VILLAGE_PARTY,
  "ashen-fields": FIELD_PARTY,
  "ember-depths": DUNGEON_PARTY,
};

// --- content lookups (built once; @tikron/rpg content is isomorphic, safe to bundle) ---

/** npcDefId -> display name, sourced from the content pack (single source of truth). */
export const NPC_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  EMBERFALL_CONTENT.npcs.map((n) => [n.id, n.name ?? n.id] as const),
);

/** npcDefId -> manifest logical id. `EmberUnit.kind` doubles as the visual key for
 *  players/most NPCs, but a couple of species ids don't match their manifest entry
 *  1:1 (e.g. `goblin_scout` ships art as `unit.goblin`), so this stays an explicit map. */
const NPC_VISUALS: Readonly<Record<string, string>> = {
  wolf: "unit.wolf",
  goblin_scout: "unit.goblin",
  goblin_thrower: "unit.goblin_thrower",
  boar: "unit.boar",
  goblin_shaman: "unit.goblin_shaman",
  boss_chief: "unit.boss_chief",
  // M3 dungeon roster (§3.3): commander shares the wraith mesh, ember_lord the boss_lord mesh.
  skeleton_warrior: "unit.skeleton",
  skeleton_archer: "unit.skeleton_archer",
  wraith: "unit.wraith",
  golem: "unit.golem",
  wraith_commander: "unit.wraith",
  ember_lord: "unit.boss_lord",
};

/** skillId -> SkillDef, for hotbar display (name/cooldownMs/manaCost/targetType). */
export const SKILL_BY_ID: Readonly<Record<string, (typeof EMBERFALL_CONTENT.skills)[number]>> = Object.fromEntries(
  EMBERFALL_CONTENT.skills.map((s) => [s.id, s] as const),
);

// --- pure: unit presentation -----------------------------------------------------------

/** Resolves an `EmberUnit`'s manifest logical id (`unit.warrior`, `unit.wolf`, ...). */
export function visualForUnit(u: Pick<EmberUnit, "kind" | "class">): string {
  if (u.kind === "player") return `unit.${u.class === "none" ? "warrior" : u.class}`;
  return NPC_VISUALS[u.kind] ?? "fallback";
}

/** Resolves a unit's nameplate text: "You" for the local player, the class name for
 *  other players, the content pack's name for NPCs. */
export function unitDisplayName(id: string, u: Pick<EmberUnit, "kind" | "class">, myId: string): string {
  if (u.kind === "player") {
    if (id === myId) return "You";
    return u.class === "none" ? "Player" : u.class[0]!.toUpperCase() + u.class.slice(1);
  }
  return MOB_KOREAN_NAMES[u.kind] ?? NPC_NAMES[u.kind] ?? u.kind;
}

/** Optional gear fields Wave B2 will add to `EmberUnit` (`ember-schema.ts` §7 — "weapon:
 *  str(16), armor: str(16)"), not landed yet at the time this file was written. Reading
 *  them through an intersection with an OPTIONAL shape (rather than editing the shared
 *  schema, which is B2's file) compiles whether or not the real fields exist yet, and
 *  keeps working unchanged once B2 adds them. */
function gearOf(u: EmberUnit): { weapon: string; armor: string } {
  const g = u as EmberUnit & { weapon?: string; armor?: string };
  return { weapon: g.weapon ?? "", armor: g.armor ?? "" };
}

/** Maps one `EmberUnit` (wire state) to `units.ts`'s `UnitData`, optionally overriding
 *  position/facing with an eased sample (from `EntitySmoother`) instead of the raw state).
 *  `weaponVisual`/`armorVisual` are omitted entirely when the unit has no gear override
 *  (class-default appearance) — see `gearOf` — so this stays byte-for-byte compatible
 *  with callers that deep-equal the result (test/client-net.test.ts). */
export function toUnitData(
  id: string,
  u: EmberUnit,
  myId: string,
  eased?: { x: number; y: number; angle: number },
): UnitData {
  const gear = gearOf(u);
  return {
    id,
    kind: u.kind,
    visual: visualForUnit(u),
    x: eased?.x ?? u.x,
    y: eased?.y ?? u.y,
    facing: eased?.angle ?? u.facing,
    hp: u.hp,
    maxHp: u.maxHp,
    name: unitDisplayName(id, u, myId),
    dead: !u.alive,
    ...(gear.weapon ? { weaponVisual: gear.weapon } : {}),
    ...(gear.armor ? { armorVisual: gear.armor } : {}),
  };
}

// --- pure: state-diff mirroring ---------------------------------------------------------

export interface UnitDiff {
  /** Ids present in the new state but not `knownIds` — need `UnitRenderer.spawn`. */
  spawn: string[];
  /** Ids in `knownIds` but absent from the new state — need `UnitRenderer.remove`. */
  remove: string[];
}

/** Diffs the previous known unit-id set against a new state's `units` map. Pure. */
export function diffUnits(knownIds: ReadonlySet<string>, units: Readonly<Record<string, unknown>>): UnitDiff {
  const nextIds = Object.keys(units);
  const nextSet = new Set(nextIds);
  const spawn = nextIds.filter((id) => !knownIds.has(id));
  const remove = [...knownIds].filter((id) => !nextSet.has(id));
  return { spawn, remove };
}

// --- pure: cast target resolution --------------------------------------------------------

/** Resolves a hotbar `cast` intent's target from the skill's `targetType`, the current
 *  click-target (if any), and the caster's own position (for "point" skills with no
 *  target selected — aims at the caster's feet rather than dropping the cast). Pure. */
export function resolveCastTarget(
  skillId: string,
  targetId: string | null,
  myId: string,
  units: Readonly<Record<string, EmberUnit>>,
): CastTargetIntent {
  const skill = SKILL_BY_ID[skillId];
  const type = skill?.targetType;
  if (type === "self" || type === undefined) return undefined;
  if (type === "point") {
    const t = targetId ? units[targetId] : units[myId];
    return t ? { pos: { x: t.x, y: t.y } } : undefined;
  }
  if (type === "friendly" && !targetId) return { unitId: myId };
  return targetId ? { unitId: targetId } : undefined;
}

// --- pure: cooldown tracker ---------------------------------------------------------------

/** skillId -> the clock-ms at which its cooldown ends. Immutable; `nowMs` is the caller's
 *  clock (render timing, not a gameplay decision — the server is the only cooldown gate). */
export type CooldownState = Readonly<Record<string, number>>;

export const NO_COOLDOWNS: CooldownState = {};

/** Starts (or extends) `skillId`'s cooldown sweep. Idempotent while one is already ticking
 *  so calling it from both `skillStarted` and `skillFired` for the same cast never resets
 *  the sweep partway through. */
export function startCooldown(state: CooldownState, skillId: string, nowMs: number, cooldownMs: number): CooldownState {
  if (!(cooldownMs > 0)) return state;
  const existing = state[skillId];
  if (existing !== undefined && existing > nowMs) return state;
  return { ...state, [skillId]: nowMs + cooldownMs };
}

/** Milliseconds left on `skillId`'s cooldown sweep, floored at 0. */
export function cooldownRemainingMs(state: CooldownState, skillId: string, nowMs: number): number {
  const end = state[skillId];
  return end === undefined ? 0 : Math.max(0, end - nowMs);
}

/** 0 (just started) .. 1 (about to fire) cast-bar progress for `skillId`, timed against
 *  the render clock from `startMs` (a local edge-detect on the unit's `cast` field
 *  going non-empty — see main.ts's `castTracker`). Instant skills (no `castTimeMs`)
 *  report 1 (full bar) rather than dividing by zero. Render timing only — the server
 *  is the sole authority on when the cast actually completes. */
export function castProgress(skillId: string, startMs: number, nowMs: number): number {
  const castTimeMs = SKILL_BY_ID[skillId]?.castTimeMs ?? 0;
  if (castTimeMs <= 0) return 1;
  return Math.max(0, Math.min(1, (nowMs - startMs) / castTimeMs));
}

// --- pure: floating combat-text queue ------------------------------------------------------

export type FloatKind = "damage" | "heal" | "xp" | "info";

export interface FloatingNumber {
  readonly id: number;
  readonly unitId: string;
  readonly text: string;
  readonly kind: FloatKind;
  readonly bornMs: number;
}

/** Appends one floating number and returns the new queue + next id. Pure. */
export function pushFloatingNumber(
  queue: readonly FloatingNumber[],
  nextId: number,
  entry: { unitId: string; text: string; kind: FloatKind; bornMs: number },
): { queue: FloatingNumber[]; nextId: number } {
  return { queue: [...queue, { ...entry, id: nextId }], nextId: nextId + 1 };
}

/** Drops entries older than `maxAgeMs`. Pure. */
export function pruneFloatingNumbers(queue: readonly FloatingNumber[], nowMs: number, maxAgeMs: number): FloatingNumber[] {
  return queue.filter((f) => nowMs - f.bornMs < maxAgeMs);
}

// --- combat events (typed locally to avoid a server import — same precedent as
// apps/gateway/demo/mmo-client.ts's `CombatEventLite`: the room's `combat` batch also
// carries variants outside this union; the switch in `NetSession` simply never matches them) --

export type CombatEventLite =
  | { t: "skillStarted"; caster: string; skillId: string }
  | { t: "skillFired"; caster: string; skillId: string; target?: string }
  | { t: "damaged"; source: string; target: string; amount: number }
  | { t: "healed"; source: string; target: string; amount: number }
  | { t: "death"; unit: string; killer?: string }
  | { t: "resurrected"; unit: string }
  | { t: "xpGained"; unit: string; amount: number }
  | { t: "levelUp"; unit: string; level: number };

// --- pure: owner-only inventory message (PLAN-EMBERFALL-M2 §7 — not synced state) --------

/** The `"inv"` message body a room sends to its own client on inventory/equipment/gold
 *  change (§7's "shooter 'ammo' pattern" — never broadcast, never part of `EmberState`). */
export interface InventoryView {
  inventory: readonly ItemInstance[];
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
  gold: number;
}

function isItemInstance(v: unknown): v is ItemInstance {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.defId === "string" && typeof o.qty === "number" && (o.uid === undefined || typeof o.uid === "string");
}

const EQUIP_SLOTS: readonly EquipSlot[] = ["weapon", "armor", "trinket"];

/** Validates an `"inv"` payload of unknown shape (Wave B2 hasn't landed yet at the time
 *  of writing — this is defensive parsing against the contract, not a live server
 *  response). Returns `null` for anything malformed rather than throwing, so a stray or
 *  future-shaped message never crashes the render loop. */
export function parseInventoryMessage(raw: unknown): InventoryView | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.inventory) || !o.inventory.every(isItemInstance)) return null;
  if (typeof o.gold !== "number") return null;
  const equipment: Partial<Record<EquipSlot, ItemInstance>> = {};
  if (typeof o.equipment === "object" && o.equipment !== null) {
    for (const slot of EQUIP_SLOTS) {
      const v = (o.equipment as Record<string, unknown>)[slot];
      if (isItemInstance(v)) equipment[slot] = v;
    }
  }
  return { inventory: o.inventory as ItemInstance[], equipment, gold: o.gold };
}

// --- pure: zone-transfer message (PLAN-EMBERFALL-M2 §6 — portal contact -> transfer) -----

export interface TransferTarget {
  zone: SavedZone;
  party: string;
  room: string;
}

const SAVED_ZONES: readonly SavedZone[] = ["emberhold", "ashen-fields", "ember-depths"];

/** Validates a `"transfer" {zone, party, room}` payload (§6). Wave B1 hasn't wired the
 *  server side of this yet at the time of writing — parsed defensively against the
 *  documented contract shape so the client is ready the moment it lands. */
export function parseTransferPayload(raw: unknown): TransferTarget | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.party !== "string" || o.party.length === 0) return null;
  if (typeof o.room !== "string" || o.room.length === 0) return null;
  if (typeof o.zone !== "string" || !(SAVED_ZONES as readonly string[]).includes(o.zone)) return null;
  return { zone: o.zone as SavedZone, party: o.party, room: o.room };
}

// --- pure: loot-overflow notice (PLAN-EMBERFALL-M2-SECFIX FIX-5) -----------------------

/** Validates a `"lootOverflow" {overflow}` payload — a killer's inventory was too full
 *  to hold every dropped unit. Returns the overflow count, or `null` for anything
 *  malformed/non-positive (never surface a bogus or zero-count notice). */
export function parseLootOverflow(raw: unknown): number | null {
  if (typeof raw !== "object" || raw === null) return null;
  const overflow = (raw as Record<string, unknown>).overflow;
  return typeof overflow === "number" && overflow > 0 ? overflow : null;
}

// --- pure: boss-event + telegraph messages (M3 §7 — server send side lands next wave) -----

/** The two bosses the room drives via `"bossEvent"` (§7.2/§7.3). `boss_chief` (§7.1) still
 *  runs off the existing Enrage hook and sends no `bossEvent`, so it is not a wire value. */
export type WireBoss = "wraith_commander" | "ember_lord";

export interface BossEventMsg {
  boss: WireBoss;
  unitId: string;
  ev: BossEvent;
}

const WIRE_BOSSES: readonly WireBoss[] = ["wraith_commander", "ember_lord"];
const BOSS_EVENTS: readonly BossEvent[] = ["engage", "half", "phase_summon", "phase_aoe", "enrage", "defeated"];

/** Validates a `"bossEvent" {boss, unitId, ev}` payload against the §7 contract. Defensive
 *  (the server send side isn't wired yet) — returns `null` for any unknown boss/event. */
export function parseBossEvent(raw: unknown): BossEventMsg | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.unitId !== "string" || o.unitId.length === 0) return null;
  if (typeof o.boss !== "string" || !(WIRE_BOSSES as readonly string[]).includes(o.boss)) return null;
  if (typeof o.ev !== "string" || !(BOSS_EVENTS as readonly string[]).includes(o.ev)) return null;
  return { boss: o.boss as WireBoss, unitId: o.unitId, ev: o.ev as BossEvent };
}

export interface TelegraphMsg {
  x: number;
  y: number;
  r: number;
  ms: number;
}

/** Validates a `"telegraph" {x, y, r, ms}` AOE-warning payload. Returns `null` unless the
 *  radius is positive and the delay non-negative (a zero/negative decal is never useful). */
export function parseTelegraph(raw: unknown): TelegraphMsg | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.x !== "number" || typeof o.y !== "number") return null;
  if (typeof o.r !== "number" || !(o.r > 0)) return null;
  if (typeof o.ms !== "number" || !(o.ms >= 0)) return null;
  return { x: o.x, y: o.y, r: o.r, ms: o.ms };
}

/** After a connect/zone-transfer the server restores the local unit's hp with a resurrect,
 *  so my own unit gets a spurious `"resurrected"` combat event on join. Its presentation
 *  (toast/float/vfx/sfx) is suppressed for this window after connect — a real post-death
 *  revive always happens well after this. Other units' resurrects are never suppressed. */
const RESURRECT_SUPPRESS_MS = 3000;

/** Client-side anti-spam gate for the Space dash (ms). The SERVER owns the real 4s cooldown;
 *  this only swallows key-repeat so a held Space doesn't flood intents. Kept a touch under the
 *  server's window so a legitimately-ready dash is never dropped by the local gate. */
const DASH_MIN_INTERVAL_MS = 3500;
/** Full lunge distance (units) — mirrors the server's `DASH_DISTANCE`. Used only to build the
 *  fallback target aimed along the unit's heading when the cursor isn't over the ground. */
const DASH_DISTANCE = 5;

interface DashEvent {
  unit: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/** Validates a `"dash"` broadcast (`ember-room-base.ts` `handleDash`) — the dashing unit and
 *  its from/to sim-plane coordinates, for the client trail + self-snap. */
export function parseDashEvent(raw: unknown): DashEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.unit !== "string") return null;
  const { fromX, fromY, toX, toY } = o;
  if (![fromX, fromY, toX, toY].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return { unit: o.unit, fromX: fromX as number, fromY: fromY as number, toX: toX as number, toY: toY as number };
}

// --- NetSession: DOM/three-touching glue (not unit-tested; covered by the WS smoke test) --

export interface NetCallbacks {
  onWelcome(myId: string): void;
  onUnitsSynced(myId: string, units: Readonly<Record<string, EmberUnit>>): void;
  /** Own-caster skillStarted/skillFired events, pre-filtered, for the cooldown sweep. */
  onOwnCast(skillId: string): void;
  onLevelUp(unitId: string, level: number, isSelf: boolean): void;
  /** This client's own unit took a `"damaged"` combat event, pre-filtered to
   *  `target === this.myId` — the attacker's unit id. The caller decides whether to
   *  actually switch its current target (a live, manually-selected target should never
   *  be stolen by this). */
  onDamaged(source: string): void;
  /** Owner-only inventory/equipment/gold snapshot (§7) — render from this, not synced state. */
  onInventory(view: InventoryView): void;
  /** Portal-contact zone transfer (§6) — the caller owns the fade/reconnect dance. */
  onTransfer(target: TransferTarget): void;
  /** The room rejected this client's character token (no seat spawned) — see
   *  `ember-room-base.ts`'s `joinWithCharacter`. Only reachable if a stale/invalid token
   *  slipped past `index.ts`'s pre-seat `onAuth` gate (defense in depth, not the normal path). */
  onCharError(code: string): void;
}

/** Owns the room connection, the per-unit `EntitySmoother`, and the floating-number
 *  queue. `tick()` must run every render frame (not just on state sync) so smoothing
 *  stays frame-rate-independent even for AOI-throttled remote units. */
export class NetSession {
  private room: Room | null = null;
  private myId = "";
  private readonly smoother = new EntitySmoother({ smoothTimeMs: 90, snapDistance: 25 });
  private knownIds = new Set<string>();
  private latestUnits: Readonly<Record<string, EmberUnit>> = {};
  private floating: FloatingNumber[] = [];
  private nextFloatId = 1;
  /** Random per-play-session id (PLAN-EMBERFALL-M2-SECFIX FIX-1/FIX-2 "Path F"), minted
   *  once on this instance's first `connect()` and reused for every subsequent
   *  reconnect/zone transfer — kept in memory only (never localStorage), since it's a
   *  Tikron session key, not a save credential. Sent as `?_session=`, where it doubles
   *  as `client.id`/`PeerJoined.connectionId` (peer-visible — but it's just a random id,
   *  never the character's save token). */
  private playSessionId: string | null = null;
  /** The unit id of the boss whose top HP bar is currently shown (E2), or `null`. Set on a
   *  `"bossEvent"` engage, cleared on defeat; drives the per-frame `updateBossBar` in `tick`. */
  private bossUnitId: string | null = null;
  /** `performance.now()` at the last successful `connect()` (join/zone-transfer), gating the
   *  spurious join-time `"resurrected"` self-event — see `RESURRECT_SUPPRESS_MS`. */
  private connectedAtMs = 0;
  /** `performance.now()` of the last dash intent sent — the local anti-spam gate (DASH_MIN_INTERVAL_MS). */
  private lastDashAt = Number.NEGATIVE_INFINITY;
  private readonly vfx: VfxSystem;

  constructor(
    private readonly units: UnitRenderer,
    private readonly callbacks: NetCallbacks,
  ) {
    this.vfx = createVfxSystem(this.units.getScene(), this.units);
  }

  get id(): string {
    return this.myId;
  }

  get state(): Readonly<Record<string, EmberUnit>> {
    return this.latestUnits;
  }

  /** Connects to `party`/`roomId`, authenticating with the character's save token via
   *  `?_auth=` (never peer-visible — `GameClientOptions.authToken`, verified server-side
   *  by the room's `onAuth`/`charOnAuth`) and identifying this browser tab's play
   *  session via `?_session=<playSessionId>` (a random id, reused across reconnects/zone
   *  transfers so the same session can reclaim its character — PLAN-EMBERFALL-M2-SECFIX
   *  FIX-1/FIX-2 "Path F"). Safe to call again after `leave()` for a zone transfer — each
   *  call opens a fresh `GameClient`/`Room` and resets this session's local mirror
   *  (smoother/known-ids/floating queue), since a new room means a new authoritative
   *  state stream. */
  async connect(host: string, party: string, roomId: string, charToken: string): Promise<void> {
    // Clear every unit rendered by the PRIOR connection (a zone transfer's old room's
    // other players/NPCs — reset()-ing the id bookkeeping without this would leave their
    // 3D objects orphaned in the scene forever, since the new room's state diff has no
    // memory of ids it never saw).
    for (const id of this.knownIds) {
      this.units.remove(id);
      this.smoother.delete(id);
    }
    this.knownIds = new Set();
    this.latestUnits = {};
    this.vfx.reset();
    // A prior room's boss bar must not survive a zone transfer (new room = fresh state stream).
    this.bossUnitId = null;
    hideBossBar();
    if (!this.playSessionId) this.playSessionId = crypto.randomUUID();
    const client = new GameClient(host, { party, stateCodec: EmberSchema, authToken: charToken });
    const room = await client.joinOrCreate(roomId, { _session: this.playSessionId });
    this.room = room;
    this.myId = room.connectionId ?? "";
    // Start the join-time resurrect-suppression window now (post-join), so the hp-restore
    // resurrect the server sends right after we enter the room doesn't play a revive cue.
    this.connectedAtMs = performance.now();
    room.onStateChange((s) => this.handleState(s as EmberState));
    room.onMessage("combat", (payload) => this.handleCombat(payload as CombatEventLite[]));
    room.onMessage("inv", (payload) => {
      const view = parseInventoryMessage(payload);
      if (view) this.callbacks.onInventory(view);
    });
    room.onMessage("transfer", (payload) => {
      const target = parseTransferPayload(payload);
      if (target) this.callbacks.onTransfer(target);
    });
    room.onMessage("charError", (payload) => {
      const code = typeof payload === "object" && payload !== null ? (payload as { code?: unknown }).code : undefined;
      this.callbacks.onCharError(typeof code === "string" ? code : "unknown");
    });
    room.onMessage("bossEvent", (payload) => {
      const msg = parseBossEvent(payload);
      if (msg) this.handleBossEvent(msg);
    });
    room.onMessage("telegraph", (payload) => {
      const t = parseTelegraph(payload);
      if (t) this.vfx.showTelegraph(t.x, t.y, t.r, t.ms);
    });
    room.onMessage("dash", (payload) => this.handleDash(payload));
    // FIX-5: no dedicated toast UI exists yet — a floating "Inventory full!" over the
    // local unit (the same mechanism `resurrected`'s "Revived" text uses) is the minimal
    // way to surface it instead of the drop silently vanishing.
    room.onMessage("lootOverflow", (payload) => {
      if (parseLootOverflow(payload) !== null) this.pushFloat(this.myId, "Inventory full!", "info", performance.now());
    });
    this.callbacks.onWelcome(this.myId);
  }

  private handleState(state: EmberState): void {
    const { spawn, remove } = diffUnits(this.knownIds, state.units);
    this.latestUnits = state.units;
    this.knownIds = new Set(Object.keys(state.units));
    for (const id of remove) {
      this.units.remove(id);
      this.smoother.delete(id);
    }
    for (const id of spawn) {
      const u = state.units[id];
      if (u) void this.units.spawn(toUnitData(id, u, this.myId));
    }
    this.callbacks.onUnitsSynced(this.myId, state.units);
  }

  private handleCombat(events: CombatEventLite[]): void {
    const now = performance.now(); // render timing only — the server owns cooldown truth
    for (const ev of events) {
      switch (ev.t) {
        case "skillStarted":
          this.units.trigger(ev.caster, "cast");
          if (ev.caster === this.myId) this.callbacks.onOwnCast(ev.skillId);
          this.vfx.startCast(ev.caster, ev.skillId, SKILL_BY_ID[ev.skillId]?.castTimeMs ?? 0);
          playSfx("castStart");
          break;
        case "skillFired":
          this.units.trigger(ev.caster, "attack");
          if (ev.caster === this.myId) this.callbacks.onOwnCast(ev.skillId);
          this.vfx.endCast(ev.caster);
          this.vfx.fireProjectile(ev.caster, ev.skillId, ev.target);
          this.vfx.meleeSwing(ev.caster, ev.skillId);
          playSfx(SKILL_BY_ID[ev.skillId]?.school === "ranged" ? "arrow" : "castFire");
          break;
        case "damaged":
          this.units.trigger(ev.target, "hit");
          if (ev.amount > 0) this.pushFloat(ev.target, `-${Math.round(ev.amount)}`, "damage", now);
          this.vfx.damageSpark(ev.target, ev.amount);
          if (ev.target === this.myId) {
            playSfx("hurt"); // distinct tone when it's my unit taking the hit
            this.callbacks.onDamaged(ev.source);
          } else {
            playSfx("hit");
          }
          break;
        case "healed":
          if (ev.amount > 0) this.pushFloat(ev.target, `+${Math.round(ev.amount)}`, "heal", now);
          this.vfx.healMote(ev.target, ev.amount);
          break;
        case "death":
          this.units.trigger(ev.unit, "death");
          if (ev.unit === this.myId) setDeathOverlay(true);
          this.vfx.deathPuff(ev.unit);
          playSfx("death");
          break;
        case "resurrected": {
          const isSelf = ev.unit === this.myId;
          // Suppress the spurious join-time self-resurrect (server restores my hp on join)
          // for a short window after connect — see RESURRECT_SUPPRESS_MS. Real revives land
          // well after connect; other units' resurrects are never suppressed.
          if (isSelf && now - this.connectedAtMs < RESURRECT_SUPPRESS_MS) break;
          this.pushFloat(ev.unit, "Revived", "info", now);
          if (isSelf) {
            setDeathOverlay(false);
            // No zone/respawn-cause signal reaches this event (E4) — always show the
            // village-hearth flavor line rather than guessing field vs. village.
            showToast(VILLAGE_RESPAWN_TEXT);
            playSfx("resurrect");
          }
          this.vfx.resurrectFlash(ev.unit);
          break;
        }
        case "xpGained":
          if (ev.unit === this.myId) this.pushFloat(ev.unit, `+${ev.amount} xp`, "xp", now);
          break;
        case "levelUp":
          if (ev.unit === this.myId) {
            this.pushFloat(ev.unit, randomLine(LEVEL_UP_FLAVOR), "info", now);
            playSfx("levelup");
          }
          this.callbacks.onLevelUp(ev.unit, ev.level, ev.unit === this.myId);
          this.vfx.levelUpBurst(ev.unit);
          break;
        default:
          break;
      }
    }
  }

  /** Maps a `"bossEvent"` (§7) to its on-screen dramatization: engage raises the boss bar and
   *  the entrance/aggro text; the phase beats flash the screen edge and show the phase line;
   *  defeat drops the bar and runs the closing dialogue (발렌) or the ending sequence (군주). */
  private handleBossEvent(msg: BossEventMsg): void {
    const lines = BOSS_LINES[msg.boss]?.[msg.ev];
    switch (msg.ev) {
      case "engage": {
        this.bossUnitId = msg.unitId;
        showBossBar(msg.unitId, MOB_KOREAN_NAMES[msg.boss] ?? NPC_NAMES[msg.boss] ?? msg.boss);
        if (lines?.banner) showBossBanner(lines.banner); // ember_lord 입장 배너
        if (lines?.line) showBossLine(lines.line); // 어그로 대사
        break;
      }
      case "half":
      case "phase_summon":
      case "phase_aoe":
      case "enrage": {
        // 발렌 hp50%는 대사(line), 군주 페이즈는 §7.3 배너 문구(banner) — 둘 다 보스 라인으로.
        const text = lines?.line ?? lines?.banner;
        if (text) showBossLine(text);
        showPhaseFlash();
        break;
      }
      case "defeated": {
        this.bossUnitId = null;
        hideBossBar();
        if (lines?.ending) {
          runEndingBanners(lines.ending); // 군주 엔딩 3연
        } else {
          if (lines?.line) showBossLine(lines.line); // 발렌 처치 대사
          if (lines?.banner) showBossBanner(lines.banner); // 발렌 초소 배너
        }
        break;
      }
    }
  }

  private pushFloat(unitId: string, text: string, kind: FloatKind, bornMs: number): void {
    const { queue, nextId } = pushFloatingNumber(this.floating, this.nextFloatId, { unitId, text, kind, bornMs });
    this.floating = queue;
    this.nextFloatId = nextId;
  }

  /** Advances every known unit's `EntitySmoother` sample and mirrors it into the
   *  `UnitRenderer`. Returns the local player's eased world position for the camera
   *  rig, or `null` before the local unit has synced once. Call once per render frame. */
  tick(dtMs: number): { x: number; y: number } | null {
    let local: { x: number; y: number } | null = null;
    for (const id of this.knownIds) {
      const u = this.latestUnits[id];
      if (!u) continue;
      const eased = this.smoother.update(id, { x: u.x, y: u.y, angle: u.facing }, dtMs);
      this.units.update(toUnitData(id, u, this.myId, eased));
      if (id === this.myId) local = { x: eased.x, y: eased.y };
      // E2: keep the boss bar's fill in sync with the boss's live hp, piggybacking the
      // existing per-frame smoothing pass rather than adding a second traversal.
      if (id === this.bossUnitId) updateBossBar(id, u.maxHp > 0 ? u.hp / u.maxHp : 0);
    }
    this.smoother.prune(this.knownIds);
    this.vfx.tick(dtMs / 1000);
    return local;
  }

  /** Prunes and returns the current floating-number queue. Call once per render frame. */
  floatingNumbers(nowMs: number, maxAgeMs = 1100): FloatingNumber[] {
    this.floating = pruneFloatingNumbers(this.floating, nowMs, maxAgeMs);
    return this.floating;
  }

  send(type: string, payload?: unknown): void {
    this.room?.send(type, payload);
  }

  /** Space-dash intent. `target` is the ground point under the cursor (from `input.ts`), or
   *  `null` when the cursor isn't over the ground — then aim a full lunge along the local
   *  unit's heading. Only a POINT goes to the server; it caps the distance and resolves walls
   *  (`ember-room-base.ts` `handleDash`). Locally gated by `DASH_MIN_INTERVAL_MS` to swallow
   *  key-repeat (the server owns the real cooldown). */
  dash(target: { x: number; y: number } | null): void {
    const me = this.latestUnits[this.myId];
    if (!me || !me.alive) return; // dead players don't dash (the server enforces this too)
    const now = performance.now();
    if (now - this.lastDashAt < DASH_MIN_INTERVAL_MS) return;
    this.lastDashAt = now;
    const point = target ?? {
      x: me.x + Math.cos(me.facing) * DASH_DISTANCE,
      y: me.y + Math.sin(me.facing) * DASH_DISTANCE,
    };
    this.send("dash", { x: point.x, y: point.y });
  }

  /** A `"dash"` broadcast landed: paint the from->to trail, play the whoosh, and — for my own
   *  unit — drop its `EntitySmoother` sample so the next `tick()` snaps me to the new spot
   *  instead of gliding (a 5-unit hop is under the 25-unit snap threshold, so it would
   *  otherwise rubber-band; same "forget to snap" trick used on AOI re-entry / removal). */
  private handleDash(payload: unknown): void {
    const ev = parseDashEvent(payload);
    if (!ev) return;
    if (ev.unit === this.myId) this.smoother.delete(ev.unit);
    this.vfx.dashTrail(ev.fromX, ev.fromY, ev.toX, ev.toY);
    playSfx("dash");
  }

  leave(): void {
    this.room?.leave();
  }
}
