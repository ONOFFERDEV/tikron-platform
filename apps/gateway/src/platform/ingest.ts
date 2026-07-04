import type { ScoreMode } from "@tikron/server";
import type { Env } from "../index.js";
import type { Matchmaker } from "../matchmaker.js";
import { resolveProjectId, scopeForKey } from "./apikeys.js";
import { boardCount, boardExists, leaderboardBoardsCap, submitScore } from "./db.js";

/**
 * Self-hosted usage ingest: `POST /api/ingest/occupancy`.
 *
 * Games that self-host their rooms (on the developer's OWN Cloudflare account)
 * report live occupancy here so the hosted dashboard meters them exactly like
 * gateway-hosted rooms — the dashboard needs zero changes. The report is
 * authenticated by the project's API key (`Authorization: Bearer tk_live_...`)
 * and the owning project is attributed from the KEY, never from the body.
 *
 * The report is forwarded into the SAME metering path gateway rooms use
 * (`Matchmaker.report()`), under a namespaced room id (`ext:{projectId}:{roomId}`)
 * so a self-hosted room can never collide with a gateway room id (a UUID) or with
 * another project's room id in the metering ledger. Namespacing also keeps
 * self-hosted rooms OUT of the lobby / matchmaking for free: `report()` only
 * registers a matchmakable room for ids the matchmaker itself created via
 * `reserve()`; an unknown id is metered and then returns, so it never lands in
 * the `rooms` map that `/api/rooms` and `reserve()` enumerate.
 */

const BEARER = "Bearer ";
const MAX_ROOM_ID = 128;
const MAX_SESSIONS = 64;
/** Abuse guard: a single room can never legitimately hold this many seats. */
const MAX_COUNT = 1024;

interface OccupancyInput {
  roomId: string;
  count: number;
  sessions: string[];
  seq: number;
  messages: number;
}

/**
 * Permissive CORS so self-hosted workers on any domain can POST. The rest of the
 * gateway's JSON API sets no CORS headers (its callers are same-origin browser
 * pages or server-side workers); this route is the one endpoint reached
 * cross-origin, so it opts in locally rather than changing the global policy.
 */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

/**
 * A machine-readable error body. `message` is OPTIONAL and additive: old callers
 * that pass only (code, status) keep emitting `{error: code}` byte-for-byte, so
 * existing occupancy-ingest assertions are unchanged. Routes that can be fixed by
 * the caller (wrong key scope, cap hit) pass an ACTIONABLE message so an AI agent
 * reading the response can self-correct without human help.
 */
function error(code: string, status: number, message?: string): Response {
  const body = message === undefined ? { error: code } : { error: code, message };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/** Extract a `Bearer <key>` token, or "" when absent/malformed. */
function bearer(request: Request): string {
  const header = request.headers.get("Authorization") ?? "";
  return header.startsWith(BEARER) ? header.slice(BEARER.length).trim() : "";
}

function matchmaker(env: Env): DurableObjectStub<Matchmaker> {
  return env.Matchmaker.get(env.Matchmaker.idFromName("global"));
}

/** Validate an OccupancyReport-shaped body; returns null on any malformed field. */
function parseReport(body: unknown): OccupancyInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const { roomId, count, seq } = b;
  if (typeof roomId !== "string" || roomId.length < 1 || roomId.length > MAX_ROOM_ID) return null;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0 || count > MAX_COUNT) {
    return null;
  }
  if (typeof seq !== "number" || !Number.isInteger(seq) || seq < 0) return null;

  let messages = 0;
  if (b.messages !== undefined) {
    if (typeof b.messages !== "number" || !Number.isInteger(b.messages) || b.messages < 0) {
      return null;
    }
    messages = b.messages;
  }

  let sessions: string[] = [];
  if (b.sessions !== undefined) {
    if (!Array.isArray(b.sessions)) return null;
    // Keep only string entries and cap the length — extras are ignored, not an error.
    sessions = b.sessions.filter((s): s is string => typeof s === "string").slice(0, MAX_SESSIONS);
  }

  return { roomId, count, sessions, seq, messages };
}

/** Handle `POST /api/ingest/occupancy` (and its CORS preflight). */
export async function handleIngest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return error("method_not_allowed", 405);

  // Auth by project API key. Unlike /parties + /api/matchmake, this endpoint never
  // honors the DEV_MODE key-enforcement bypass (`resolveProject`): a self-hosted
  // report has no other way to attribute usage, so it is ALWAYS key-authenticated.
  const apiKey = bearer(request);
  if (!apiKey) return error("missing_api_key", 401);

  // Resolve the key → project (cached, same lookup as /parties enforcement). With
  // no platform DB there is nothing to meter against, so accept and no-op rather
  // than reject — a gateway without a DB simply doesn't meter (as everywhere else).
  let projectId: string | null = null;
  if (env.DB) {
    projectId = await resolveProjectId(env.DB, apiKey);
    if (!projectId) return error("invalid_api_key", 401);
  }

  const report = parseReport(await request.json().catch(() => null));
  if (!report) return error("bad_request", 400);

  if (projectId) {
    const roomKey = `ext:${projectId}:${report.roomId}`;
    // Fire the report through the shared metering path, attributed to the KEY's
    // project. Awaited so the RPC (and its storage write) completes before 204.
    await matchmaker(env).report(
      roomKey,
      report.count,
      report.sessions,
      report.seq,
      projectId,
      report.messages,
    );
  }

  return new Response(null, { status: 204, headers: CORS });
}

// --- self-hosted leaderboard score ingest: `POST /api/ingest/score` -----------
//
// Twin of the occupancy ingest above: a self-hosted room (running on the
// developer's OWN Cloudflare account, wired with `platformLeaderboard()`) posts a
// score here and it lands in the SAME per-project `leaderboards` table the hosted
// rooms write, read back cross-origin via `GET /api/leaderboard`. Project
// attribution is from the KEY, never the body. Unlike connect/read (a public-key
// path), writing scores is a SECRET-key action, so a `tk_pub_` key is refused.

const MAX_BOARD = 64;
const MAX_PLAYER_ID = 128;
const MAX_DISPLAY_NAME = 64;

/** Per-project token bucket (isolate-local): steady 30/s, burst 60. Bounds a
 *  single project's submit rate without a per-submit D1 read. A determined
 *  spammer across many isolates can still exceed the intended daily total — an
 *  exact cross-isolate daily quota is phase-2 (needs a dedicated DO). */
const RATE_PER_SEC = 30;
const RATE_BURST = 60;
interface Bucket {
  tokens: number;
  last: number;
}
const buckets = new Map<string, Bucket>();

function rateOk(projectId: string): boolean {
  const now = Date.now();
  let b = buckets.get(projectId);
  if (!b) {
    b = { tokens: RATE_BURST, last: now };
    buckets.set(projectId, b);
  } else {
    b.tokens = Math.min(RATE_BURST, b.tokens + ((now - b.last) / 1000) * RATE_PER_SEC);
    b.last = now;
  }
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

/** Isolate-local set of (projectId, board) pairs already known to exist / be
 *  under cap. Lets almost every submit skip the board-cap D1 read entirely.
 *  Keyed by JSON.stringify so a board name containing spaces can't alias. */
const knownBoards = new Set<string>();

/**
 * True if a score may be written to `board`. Cached boards pass with zero D1
 * reads. On an isolate's first sight of a board it costs one `COUNT(DISTINCT
 * board)`: under the cap → allowed (and cached); at/over the cap → allowed only
 * if the board already exists (a write there doesn't grow the count), else
 * rejected. So a brand-new board past the cap is the only thing blocked.
 */
async function allowBoard(db: D1Database, projectId: string, board: string): Promise<boolean> {
  const key = JSON.stringify([projectId, board]);
  if (knownBoards.has(key)) return true;
  const cap = await leaderboardBoardsCap(db);
  if ((await boardCount(db, projectId)) < cap) {
    knownBoards.add(key);
    return true;
  }
  if (await boardExists(db, projectId, board)) {
    knownBoards.add(key);
    return true;
  }
  return false;
}

interface ScoreInput {
  board: string;
  playerId: string;
  score: number;
  displayName: string | null;
  mode: ScoreMode;
}

/** Validate a score-submit body; null on any malformed field. */
function parseScore(body: unknown): ScoreInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const { board, playerId, score } = b;
  if (typeof board !== "string" || board.length < 1 || board.length > MAX_BOARD) return null;
  if (typeof playerId !== "string" || playerId.length < 1 || playerId.length > MAX_PLAYER_ID) {
    return null;
  }
  if (typeof score !== "number" || !Number.isFinite(score)) return null;

  let displayName: string | null = null;
  if (b.displayName !== undefined && b.displayName !== null) {
    if (typeof b.displayName !== "string") return null;
    displayName = b.displayName.slice(0, MAX_DISPLAY_NAME);
  }

  let mode: ScoreMode = "max";
  if (b.mode !== undefined) {
    if (b.mode !== "max" && b.mode !== "sum" && b.mode !== "last") return null;
    mode = b.mode;
  }

  return { board, playerId, score, displayName, mode };
}

// Actionable fix instructions carried in the error `message` (HARD rule: failures
// are LOUD + machine-readable + self-correctable).
const MSG_SCOPE_FORBIDDEN =
  'this is a tk_pub_ publishable key; ingest requires a tk_live_ secret key kept ' +
  'server-side — create one: POST /api/platform/projects/:id/keys {"scope":"secret"} ' +
  "or dashboard → Keys";
const MSG_CAP_BOARDS =
  "this project has reached its leaderboard board limit (config free_leaderboard_boards, " +
  "default 50) — reuse an existing board name, or raise the cap in the dashboard; new " +
  "board names are blocked to prevent unbounded D1 growth";
const MSG_CAP_RATE =
  "score submissions are rate-limited per project (30/s, burst 60) — batch or throttle " +
  "your server-side score writes and retry";

/** Handle `POST /api/ingest/score` (and its CORS preflight). */
export async function handleScoreIngest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return error("method_not_allowed", 405);

  const apiKey = bearer(request);
  if (!apiKey) return error("missing_api_key", 401);

  // No platform DB → nothing to write against; accept + no-op (mirrors occupancy).
  if (!env.DB) return new Response(null, { status: 204, headers: CORS });

  const projectId = await resolveProjectId(env.DB, apiKey);
  if (!projectId) return error("invalid_api_key", 401);

  // Scope from the presented key's prefix (hash-bound, unforgeable). A resolvable
  // tk_pub_ key is a valid key used on the wrong route — hence 403, not 401.
  if (scopeForKey(apiKey) !== "secret") {
    return error("key_scope_forbidden", 403, MSG_SCOPE_FORBIDDEN);
  }

  const score = parseScore(await request.json().catch(() => null));
  if (!score) return error("bad_request", 400);

  // Rate-limit BEFORE the board-cap lookup: rateOk is a cheap isolate-local
  // token-bucket decrement, whereas allowBoard can cost up to two D1 reads on an
  // unknown board. Checking rate first means a flood of unknown-board requests is
  // shed with 429 without ever hitting D1 — the board-cap reads only run for
  // rate-admitted submits.
  if (!rateOk(projectId)) return error("cap_leaderboard_rate", 429, MSG_CAP_RATE);
  if (!(await allowBoard(env.DB, projectId, score.board))) {
    return error("cap_leaderboard_boards", 403, MSG_CAP_BOARDS);
  }

  await submitScore(env.DB, {
    projectId,
    board: score.board,
    playerId: score.playerId,
    displayName: score.displayName,
    score: score.score,
    mode: score.mode,
  });
  return new Response(null, { status: 204, headers: CORS });
}

/** Test hook: reset the isolate-local board + rate caches between cases. */
export function _resetScoreCaches(): void {
  knownBoards.clear();
  buckets.clear();
}
