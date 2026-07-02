// Typed D1 query helpers for the platform tables. Keeps SQL in one place.

import type { ScoreMode } from "@playedge/server";

export interface UserRow {
  github_id: string;
  login: string;
  avatar_url: string | null;
  created_at: number;
}

export interface ProjectRow {
  id: string;
  owner_github_id: string;
  name: string;
  player_jwt_secret: string;
  require_player_auth: number;
  created_at: number;
}

export interface ApiKeyRow {
  id: string;
  project_id: string;
  key_hash: string;
  key_prefix: string;
  created_at: number;
  revoked_at: number | null;
}

export interface UsageRow {
  project_id: string;
  day: string;
  room_hours: number;
  peak_ccu: number;
  messages: number;
}

/** Free-tier caps (from the `config` table; adjustable without a deploy). */
export interface Caps {
  roomHoursPerMonth: number;
  concurrentRooms: number;
  playersPerRoom: number;
}

export async function upsertUser(
  db: D1Database,
  u: { githubId: string; login: string; avatarUrl: string | null },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (github_id, login, avatar_url, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(github_id) DO UPDATE SET login = excluded.login, avatar_url = excluded.avatar_url`,
    )
    .bind(u.githubId, u.login, u.avatarUrl, Date.now())
    .run();
}

export async function createProject(
  db: D1Database,
  p: { id: string; ownerGithubId: string; name: string; playerJwtSecret: string },
): Promise<ProjectRow> {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO projects (id, owner_github_id, name, player_jwt_secret, require_player_auth, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
    )
    .bind(p.id, p.ownerGithubId, p.name, p.playerJwtSecret, now)
    .run();
  return {
    id: p.id,
    owner_github_id: p.ownerGithubId,
    name: p.name,
    player_jwt_secret: p.playerJwtSecret,
    require_player_auth: 0,
    created_at: now,
  };
}

export async function listProjects(db: D1Database, ownerGithubId: string): Promise<ProjectRow[]> {
  const res = await db
    .prepare(`SELECT * FROM projects WHERE owner_github_id = ? ORDER BY created_at DESC`)
    .bind(ownerGithubId)
    .all<ProjectRow>();
  return res.results ?? [];
}

export async function getProject(db: D1Database, id: string): Promise<ProjectRow | null> {
  return db.prepare(`SELECT * FROM projects WHERE id = ?`).bind(id).first<ProjectRow>();
}

export async function createApiKey(
  db: D1Database,
  k: { id: string; projectId: string; keyHash: string; keyPrefix: string },
): Promise<ApiKeyRow> {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO api_keys (id, project_id, key_hash, key_prefix, created_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    )
    .bind(k.id, k.projectId, k.keyHash, k.keyPrefix, now)
    .run();
  return {
    id: k.id,
    project_id: k.projectId,
    key_hash: k.keyHash,
    key_prefix: k.keyPrefix,
    created_at: now,
    revoked_at: null,
  };
}

export async function listApiKeys(db: D1Database, projectId: string): Promise<ApiKeyRow[]> {
  const res = await db
    .prepare(`SELECT * FROM api_keys WHERE project_id = ? ORDER BY created_at DESC`)
    .bind(projectId)
    .all<ApiKeyRow>();
  return res.results ?? [];
}

/** Resolve an active (non-revoked) key by its SHA-256 hash → owning project id. */
export async function projectIdForKeyHash(db: D1Database, keyHash: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT project_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL`)
    .bind(keyHash)
    .first<{ project_id: string }>();
  return row?.project_id ?? null;
}

/** Soft-revoke a key scoped to a project. Returns true when a key was revoked. */
export async function revokeApiKey(
  db: D1Database,
  projectId: string,
  keyId: string,
): Promise<boolean> {
  const res = await db
    .prepare(`UPDATE api_keys SET revoked_at = ? WHERE id = ? AND project_id = ? AND revoked_at IS NULL`)
    .bind(Date.now(), keyId, projectId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function usageForProject(
  db: D1Database,
  projectId: string,
  days: number,
): Promise<UsageRow[]> {
  const res = await db
    .prepare(`SELECT * FROM usage_daily WHERE project_id = ? ORDER BY day DESC LIMIT ?`)
    .bind(projectId, Math.max(1, Math.floor(days)))
    .all<UsageRow>();
  return res.results ?? [];
}

/** Sum of room-hours for a project across the given UTC month prefix ("YYYY-MM"). */
export async function monthRoomHours(
  db: D1Database,
  projectId: string,
  monthPrefix: string,
): Promise<number> {
  const row = await db
    .prepare(`SELECT COALESCE(SUM(room_hours), 0) AS h FROM usage_daily WHERE project_id = ? AND day LIKE ?`)
    .bind(projectId, `${monthPrefix}-%`)
    .first<{ h: number }>();
  return row?.h ?? 0;
}

/**
 * Accumulate a day's usage: add room-hours + messages, and raise peak CCU to the
 * new max. Idempotent-friendly upsert on (project_id, day).
 */
export async function accrueUsage(
  db: D1Database,
  u: { projectId: string; day: string; roomHours: number; peakCcu: number; messages: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usage_daily (project_id, day, room_hours, peak_ccu, messages)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(project_id, day) DO UPDATE SET
         room_hours = room_hours + excluded.room_hours,
         peak_ccu = MAX(peak_ccu, excluded.peak_ccu),
         messages = messages + excluded.messages`,
    )
    .bind(u.projectId, u.day, u.roomHours, u.peakCcu, u.messages)
    .run();
}

// --- leaderboards (P5) ---

export interface LeaderboardEntry {
  player_id: string;
  display_name: string | null;
  score: number;
}

/**
 * Per-mode SET expression for the upsert. Keyed by the (typed, validated)
 * {@link ScoreMode}, never by raw input, so interpolating it into the SQL is safe.
 * `score` is the existing row's value, `excluded.score` the submitted one.
 */
const SCORE_SET: Record<ScoreMode, string> = {
  max: "MAX(score, excluded.score)",
  sum: "score + excluded.score",
  last: "excluded.score",
};

/**
 * Record a score for a player on a project's board. The board is created
 * implicitly on first submit; the row is upserted per {@link ScoreMode} (keep the
 * max, add, or overwrite). `display_name` is refreshed to the latest submitted.
 */
export async function submitScore(
  db: D1Database,
  s: {
    projectId: string;
    board: string;
    playerId: string;
    displayName: string | null;
    score: number;
    mode: ScoreMode;
  },
): Promise<void> {
  const setScore = SCORE_SET[s.mode] ?? SCORE_SET.max;
  await db
    .prepare(
      `INSERT INTO leaderboards (project_id, board, player_id, display_name, score, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, board, player_id) DO UPDATE SET
         score = ${setScore},
         display_name = excluded.display_name,
         updated_at = excluded.updated_at`,
    )
    .bind(s.projectId, s.board, s.playerId, s.displayName, s.score, Date.now())
    .run();
}

/**
 * Top-N entries for a project's board, highest score first (ties break to the
 * earlier achiever). `limit` is clamped to 1..100.
 */
export async function topScores(
  db: D1Database,
  projectId: string,
  board: string,
  limit: number,
): Promise<LeaderboardEntry[]> {
  const n = Math.max(1, Math.min(100, Math.floor(limit)));
  const res = await db
    .prepare(
      `SELECT player_id, display_name, score FROM leaderboards
       WHERE project_id = ? AND board = ?
       ORDER BY score DESC, updated_at ASC LIMIT ?`,
    )
    .bind(projectId, board, n)
    .all<LeaderboardEntry>();
  return res.results ?? [];
}

export async function loadCaps(db: D1Database): Promise<Caps> {
  const res = await db.prepare(`SELECT k, v FROM config`).all<{ k: string; v: string }>();
  const map = new Map((res.results ?? []).map((r) => [r.k, r.v]));
  const num = (k: string, d: number) => {
    const v = Number(map.get(k));
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  return {
    roomHoursPerMonth: num("free_room_hours_per_month", 5000),
    concurrentRooms: num("free_concurrent_rooms", 50),
    playersPerRoom: num("free_players_per_room", 20),
  };
}
