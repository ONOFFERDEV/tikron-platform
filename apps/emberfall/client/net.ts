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
  return NPC_NAMES[u.kind] ?? u.kind;
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
  | { t: "skillFired"; caster: string; skillId: string }
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

// --- NetSession: DOM/three-touching glue (not unit-tested; covered by the WS smoke test) --

export interface NetCallbacks {
  onWelcome(myId: string): void;
  onUnitsSynced(myId: string, units: Readonly<Record<string, EmberUnit>>): void;
  /** Own-caster skillStarted/skillFired events, pre-filtered, for the cooldown sweep. */
  onOwnCast(skillId: string): void;
  onLevelUp(unitId: string, level: number, isSelf: boolean): void;
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

  constructor(
    private readonly units: UnitRenderer,
    private readonly callbacks: NetCallbacks,
  ) {}

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
    if (!this.playSessionId) this.playSessionId = crypto.randomUUID();
    const client = new GameClient(host, { party, stateCodec: EmberSchema, authToken: charToken });
    const room = await client.joinOrCreate(roomId, { _session: this.playSessionId });
    this.room = room;
    this.myId = room.connectionId ?? "";
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
          break;
        case "skillFired":
          this.units.trigger(ev.caster, "attack");
          if (ev.caster === this.myId) this.callbacks.onOwnCast(ev.skillId);
          break;
        case "damaged":
          this.units.trigger(ev.target, "hit");
          if (ev.amount > 0) this.pushFloat(ev.target, `-${Math.round(ev.amount)}`, "damage", now);
          break;
        case "healed":
          if (ev.amount > 0) this.pushFloat(ev.target, `+${Math.round(ev.amount)}`, "heal", now);
          break;
        case "death":
          this.units.trigger(ev.unit, "death");
          break;
        case "resurrected":
          this.pushFloat(ev.unit, "Revived", "info", now);
          break;
        case "xpGained":
          if (ev.unit === this.myId) this.pushFloat(ev.unit, `+${ev.amount} xp`, "xp", now);
          break;
        case "levelUp":
          this.callbacks.onLevelUp(ev.unit, ev.level, ev.unit === this.myId);
          break;
        default:
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
    }
    this.smoother.prune(this.knownIds);
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

  leave(): void {
    this.room?.leave();
  }
}
