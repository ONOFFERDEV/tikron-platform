import type { EmberClass } from "./content/hotbar.js";
import type { ItemInstance, EquipSlot, SavedCharacter, SavedZone } from "./types.js";

/**
 * D1 CRUD + anonymous-token character persistence (PLAN-EMBERFALL-M2 §2/§4). No
 * gameplay/engine logic here — this module only reads/writes the `characters` table
 * (`migrations/0001_characters.sql` + `0002_nickname_norm.sql`). Callers (`index.ts`'s
 * `/api/char/*` routes, `rooms/ember-room-base.ts`'s join/save hooks) always pass their
 * own `D1Database` handle explicitly (no ambient/global D1 access here), which is also
 * what keeps this module trivially unit-testable against a fake D1.
 *
 * Token model (§4): a save token is a bare random uuid (`crypto.randomUUID()`) — no
 * HMAC, since a `token_hash` row lookup IS the authentication (same trick as
 * `apps/gateway/src/platform/db.ts`'s API-key hashing). `crypto.subtle` is available
 * here (this runs in a Cloudflare Worker/Durable Object, not a Figma plugin iframe —
 * see the [[figma-iframe-no-subtlecrypto]] caveat does NOT apply on this platform).
 */

interface CharacterRow {
  id: string;
  nickname: string;
  class: string;
  level: number;
  xp: number;
  gold: number;
  zone: string;
  x: number;
  y: number;
  hp: number;
  mp: number;
  inventory_json: string;
  equipment_json: string;
  play_ms: number;
  created_at: number;
  updated_at: number;
}

/** Crash-recovery TTL for a claimed session (PLAN-EMBERFALL-M2-SECFIX FIX-1/FIX-2): a
 *  session whose heartbeat (`active_seen_at`) is older than this is presumed dead, so a
 *  fresh connect for the same token can steal its claim instead of being locked out by
 *  a Durable Object that died without ever running `releaseSession`. Comfortably above
 *  `ember-room-base.ts`'s 60s periodic-save heartbeat cadence so a live room never gets
 *  reclaimed out from under itself. */
const SESSION_CLAIM_TTL_MS = 90_000;

function rowToCharacter(row: CharacterRow): SavedCharacter {
  return {
    id: row.id,
    nickname: row.nickname,
    class: row.class as EmberClass,
    level: row.level,
    xp: row.xp,
    gold: row.gold,
    zone: row.zone as SavedZone,
    x: row.x,
    y: row.y,
    hp: row.hp,
    mp: row.mp,
    inventory: JSON.parse(row.inventory_json) as ItemInstance[],
    equipment: JSON.parse(row.equipment_json) as Partial<Record<EquipSlot, ItemInstance>>,
    playMs: row.play_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const NICKNAME_RE = /^[a-zA-Z0-9가-힣_ ]{3,16}$/;

/** Trims/collapses whitespace and validates the charset+length (PLAN §2: 3-16 chars,
 *  `[a-zA-Z0-9가-힣_ ]`). Returns the normalized (casefolded) form used for the
 *  uniqueness index, or `null` when invalid. The RAW (non-casefolded, but
 *  trimmed/collapsed) string is what gets stored/displayed — see {@link createCharacter}. */
export function normalizeNickname(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!NICKNAME_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/** SHA-256 hex digest, used for `token_hash` (Web Crypto — available in workerd). */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const VALID_CLASSES: ReadonlySet<string> = new Set<EmberClass>(["warrior", "mage", "cleric"]);

/** Starting gold + safe-zone spawn for a brand-new character. Mirrors the current
 *  village stub's `playerSpawn` (`rooms/village-room.ts`'s `VILLAGE_ZONE`) — if Wave B1
 *  changes Emberhold's real spawn point, update both spots. */
const STARTING_GOLD = 50;
const STARTING_ZONE: SavedZone = "emberhold";
const STARTING_POS = { x: 30, y: 30 };
/** Large placeholder hp/mp for a fresh character — `ember-room-base.ts`'s restore path
 *  clamps `saved.hp / unit.maxHp` to 100%, so any value at least as large as any
 *  realistic maxHp reads as "full" without this module needing to know engine stat math. */
const FULL_POOL_PLACEHOLDER = 99_999;

export type CreateCharacterResult =
  | { ok: true; token: string; character: SavedCharacter }
  | { ok: false; error: "invalid_nickname" }
  | { ok: false; error: "invalid_class" }
  | { ok: false; error: "nickname_taken" };

/**
 * Create a brand-new level-1 character (PLAN-EMBERFALL-M2 §4). Nickname uniqueness is
 * enforced by the DB (`idx_characters_nickname_norm`), not a check-then-insert — an
 * `INSERT ... ON CONFLICT DO NOTHING` + `meta.changes` read avoids the TOCTOU race a
 * SELECT-first check would have.
 */
export async function createCharacter(
  db: D1Database,
  input: { nickname: string; class: string },
): Promise<CreateCharacterResult> {
  const norm = normalizeNickname(input.nickname);
  if (!norm) return { ok: false, error: "invalid_nickname" };
  if (!VALID_CLASSES.has(input.class)) return { ok: false, error: "invalid_class" };
  const cls = input.class as EmberClass;
  const nickname = input.nickname.trim().replace(/\s+/g, " ");

  const token = crypto.randomUUID();
  const tokenHash = await sha256Hex(token);
  const id = crypto.randomUUID();
  const now = Date.now();

  const character: SavedCharacter = {
    id,
    nickname,
    class: cls,
    level: 1,
    xp: 0,
    gold: STARTING_GOLD,
    zone: STARTING_ZONE,
    x: STARTING_POS.x,
    y: STARTING_POS.y,
    hp: FULL_POOL_PLACEHOLDER,
    mp: FULL_POOL_PLACEHOLDER,
    inventory: [],
    equipment: {},
    playMs: 0,
    createdAt: now,
    updatedAt: now,
  };

  const res = await db
    .prepare(
      `INSERT INTO characters
         (id, token_hash, nickname, nickname_norm, class, level, xp, gold,
          inventory_json, equipment_json, zone, x, y, hp, mp, created_at, updated_at, play_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
    )
    .bind(
      character.id,
      tokenHash,
      character.nickname,
      norm,
      character.class,
      character.level,
      character.xp,
      character.gold,
      JSON.stringify(character.inventory),
      JSON.stringify(character.equipment),
      character.zone,
      character.x,
      character.y,
      character.hp,
      character.mp,
      character.createdAt,
      character.updatedAt,
      character.playMs,
    )
    .run();

  if ((res.meta.changes ?? 0) === 0) return { ok: false, error: "nickname_taken" };
  return { ok: true, token, character };
}

/** Load a character by its save token, or `null` if the token is unrecognized. */
export async function loadCharacter(db: D1Database, token: string): Promise<SavedCharacter | null> {
  if (typeof token !== "string" || token.length === 0) return null;
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(`SELECT * FROM characters WHERE token_hash = ?`)
    .bind(tokenHash)
    .first<CharacterRow>();
  return row ? rowToCharacter(row) : null;
}

/**
 * Overwrite a character's mutable fields (everything except id/nickname/class/
 * createdAt — identity fields are never rewritten by a save). Returns `false` if the
 * token doesn't resolve to a row (should not happen for a token `loadCharacter`
 * already accepted, but the room's save path checks it defensively).
 *
 * Unconditional (no session-ownership check) — used for the token-authenticated
 * arrange/one-off paths (tests seeding D1 state directly). A room's own periodic/leave
 * saves go through {@link saveCharacterForSession} instead, which adds the
 * optimistic-concurrency guard FIX-2 needs.
 */
export async function saveCharacter(
  db: D1Database,
  token: string,
  character: SavedCharacter,
): Promise<boolean> {
  const tokenHash = await sha256Hex(token);
  const res = await db
    .prepare(
      `UPDATE characters SET
         level = ?, xp = ?, gold = ?, zone = ?, x = ?, y = ?, hp = ?, mp = ?,
         inventory_json = ?, equipment_json = ?, play_ms = ?, updated_at = ?
       WHERE token_hash = ?`,
    )
    .bind(
      character.level,
      character.xp,
      character.gold,
      character.zone,
      character.x,
      character.y,
      character.hp,
      character.mp,
      JSON.stringify(character.inventory),
      JSON.stringify(character.equipment),
      character.playMs,
      character.updatedAt,
      tokenHash,
    )
    .run();
  return (res.meta.changes ?? 0) > 0;
}

// --- session binding (PLAN-EMBERFALL-M2-SECFIX FIX-1/FIX-2: Path F) -----------------
//
// The save token moves onto Tikron's `?_auth=` channel (verified once, server-side, by
// `index.ts`'s `charOnAuth` — never becomes the Tikron session key, so it never
// round-trips through the `PeerJoined.connectionId` broadcast). `?_session=` carries a
// random per-play-session id instead; `claimSession` CAS-binds it to a character row
// (at most one LIVE session per character, closing the FIX-2 clone race), and every
// room-side lookup/save after that goes through the session id alone
// (`loadCharacterBySession`/`saveCharacterForSession`) — the raw save token never
// reaches a Room instance (only `charOnAuth`, in the `defineRoom` DO wrapper, ever
// sees it; see `ember-room-base.ts`'s docblock for why that boundary can't be crossed
// without a `packages/server` change, which this fix deliberately avoids).

export interface ClaimSessionResult {
  ok: boolean;
}

/**
 * CAS-claim `sessionId` as the sole live owner of the character behind `token`
 * (FIX-2). Succeeds when: nobody currently owns the row, `sessionId` already owns it
 * (idempotent reconnect/zone-transfer — `net.ts` reuses the same play-session id for
 * both), or the current owner's heartbeat is older than {@link SESSION_CLAIM_TTL_MS}
 * (crash recovery). Fails (returns `{ ok: false }`) only when a DIFFERENT, still-live
 * session already owns it — the caller (`charOnAuth`) rejects the connection, which is
 * exactly FIX-2's "same token, two concurrent connections" guard.
 */
export async function claimSession(
  db: D1Database,
  token: string,
  sessionId: string,
  now: number,
): Promise<ClaimSessionResult> {
  const tokenHash = await sha256Hex(token);
  const res = await db
    .prepare(
      `UPDATE characters SET active_session_id = ?, active_seen_at = ?
       WHERE token_hash = ?
         AND (active_session_id IS NULL OR active_session_id = ? OR active_seen_at < ?)`,
    )
    .bind(sessionId, now, tokenHash, sessionId, now - SESSION_CLAIM_TTL_MS)
    .run();
  return { ok: (res.meta.changes ?? 0) > 0 };
}

/**
 * Load the character currently claimed by `sessionId` — a room's `client.id`
 * (`ember-room-base.ts`'s `joinWithCharacter`/`rehydrateCharSessions`; the Tikron
 * session key IS `client.id` — see `define-room.ts`'s `_connect(conn, session)`).
 * `null` when no row is claimed by this session (never authenticated, or the claim was
 * since released/stolen).
 */
export async function loadCharacterBySession(db: D1Database, sessionId: string): Promise<SavedCharacter | null> {
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;
  const row = await db
    .prepare(`SELECT * FROM characters WHERE active_session_id = ?`)
    .bind(sessionId)
    .first<CharacterRow>();
  return row ? rowToCharacter(row) : null;
}

/** Release `sessionId`'s claim (`onSeatExpired` — the room's actual session-end path,
 *  since a dropped-then-reclaimed seat inside the reconnection window never reaches
 *  it) so a fresh connect for the same token can claim it immediately instead of
 *  waiting out {@link SESSION_CLAIM_TTL_MS}. No-op if this session doesn't currently
 *  hold the claim. */
export async function releaseSession(db: D1Database, sessionId: string): Promise<void> {
  await db
    .prepare(`UPDATE characters SET active_session_id = NULL WHERE active_session_id = ?`)
    .bind(sessionId)
    .run();
}

/**
 * Room-driven save with optimistic concurrency (FIX-2): writes only while `sessionId`
 * still owns the row's `active_session_id` claim, so a session that lost the ownership
 * race (superseded by a newer claim on the same token) skips the write instead of
 * clobbering the current owner's fresher save — the caller treats a `false` return as
 * "skip this save, the next periodic tick (or the new owner's own save) has it
 * covered," matching `saveAllDue`'s existing best-effort retry contract. Also refreshes
 * the crash-recovery heartbeat (`active_seen_at`) so a genuinely live, regularly-saving
 * session's claim never goes stale under {@link SESSION_CLAIM_TTL_MS}.
 */
export async function saveCharacterForSession(
  db: D1Database,
  sessionId: string,
  character: SavedCharacter,
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE characters SET
         level = ?, xp = ?, gold = ?, zone = ?, x = ?, y = ?, hp = ?, mp = ?,
         inventory_json = ?, equipment_json = ?, play_ms = ?, updated_at = ?, active_seen_at = ?
       WHERE active_session_id = ?`,
    )
    .bind(
      character.level,
      character.xp,
      character.gold,
      character.zone,
      character.x,
      character.y,
      character.hp,
      character.mp,
      JSON.stringify(character.inventory),
      JSON.stringify(character.equipment),
      character.playMs,
      character.updatedAt,
      character.updatedAt,
      sessionId,
    )
    .run();
  return (res.meta.changes ?? 0) > 0;
}
