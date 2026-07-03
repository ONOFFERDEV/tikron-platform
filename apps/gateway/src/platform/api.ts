import type { Env } from "../index.js";
import type { Matchmaker } from "../matchmaker.js";
import {
  createApiKey,
  createProject,
  deleteProject,
  deleteShowcaseGame,
  getProject,
  getShowcaseGame,
  listApiKeys,
  listApprovedShowcase,
  listPendingShowcase,
  listProjects,
  listShowcaseByOwner,
  revokeApiKey,
  setShowcaseStatus,
  submitShowcaseGame,
  topScores,
  upsertUser,
  usageForProject,
  type ProjectRow,
  type ShowcaseRow,
} from "./db.js";
import { generateApiKey, resolveProjectId } from "./apikeys.js";
import { exchangeGithubCode, githubAuthorizeUrl } from "./github.js";
import { signJwt } from "./jwt.js";
import {
  readSession,
  sessionClearCookie,
  sessionSetCookie,
  signSession,
  type Session,
} from "./session.js";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function devBypass(env: Env): boolean {
  return env.DEV_MODE === "1" || !env.DB;
}

function matchmaker(env: Env): DurableObjectStub<Matchmaker> {
  return env.Matchmaker.get(env.Matchmaker.idFromName("global"));
}

// --- showcase helpers ---

const SHOWCASE_GENRES = new Set(["io", "fps", "casual", "board", "racing", "action", "other"]);

/** Session is a showcase moderator (env allow-list of GitHub ids). */
function isAdmin(env: Env, session: Session | null): boolean {
  if (!session || !env.ADMIN_GITHUB_IDS) return false;
  return env.ADMIN_GITHUB_IDS.split(",")
    .map((s) => s.trim())
    .includes(session.githubId);
}

/** Accept a same-origin path ("/x") or an absolute http(s) URL; reject the rest
 *  (notably `javascript:` / `data:` — this feeds <img src> and a link target). */
function isSafeUrl(v: unknown): v is string {
  if (typeof v !== "string" || v.length === 0 || v.length > 2048) return false;
  if (v.startsWith("/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function kebab(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "game"
  );
}

/** Wire shape for a showcase game. `live` merges the matchmaker's current
 *  room/player counts (only for games linked to a project). */
function showcaseView(r: ShowcaseRow, live?: { rooms: number; players: number }) {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    tagline: r.tagline,
    thumbnailUrl: r.thumbnail_url,
    playUrl: r.play_url,
    genres: r.genres ? r.genres.split(",").filter(Boolean) : [],
    author: r.author,
    status: r.status,
    featured: r.featured === 1,
    projectId: r.project_id,
    livePlayers: live?.players ?? 0,
    liveRooms: live?.rooms ?? 0,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

// --- API-key resolution / connection enforcement (used by /parties/* + matchmake) ---

export type ProjectResolution =
  | { ok: true; projectId: string | null }
  | { ok: false; status: number; code: string };

/**
 * Resolve the calling project from `?apiKey=`. Dev bypass → { projectId: null }.
 * A MISSING key falls back to `env.DEMO_PROJECT_ID` when configured — that keeps
 * the public demos alive in production while still metering and capping them
 * under a real (demo) project. An INVALID key never falls back.
 */
export async function resolveProject(env: Env, url: URL): Promise<ProjectResolution> {
  if (devBypass(env)) return { ok: true, projectId: null };
  const apiKey = url.searchParams.get("apiKey");
  if (!apiKey) {
    if (env.DEMO_PROJECT_ID) return { ok: true, projectId: env.DEMO_PROJECT_ID };
    return { ok: false, status: 401, code: "missing_api_key" };
  }
  const projectId = await resolveProjectId(env.DB!, apiKey);
  if (!projectId) return { ok: false, status: 401, code: "invalid_api_key" };
  return { ok: true, projectId };
}

export type ConnectionGate =
  | { ok: true; request: Request }
  | { ok: false; status: number; code: string };

/**
 * Enforce API-key + room-hours cap on a room connection, and forward the resolved
 * project to the room DO via `_project`. Concurrent-room caps are a reserve-time
 * concern (blocking here would lock out reconnects to an existing room), so only
 * the monthly room-hours budget is enforced on connect.
 */
export async function enforceConnection(env: Env, request: Request, url: URL): Promise<ConnectionGate> {
  const resolved = await resolveProject(env, url);
  if (!resolved.ok) return resolved;
  if (resolved.projectId === null) return { ok: true, request };

  const cap = await matchmaker(env).checkCaps(resolved.projectId, false);
  if (cap) return { ok: false, status: 403, code: cap };

  const u = new URL(url.toString());
  u.searchParams.set("_project", resolved.projectId);
  return { ok: true, request: new Request(u.toString(), request) };
}

// --- public leaderboard read ---

/**
 * Public top-N read: `GET /api/leaderboard?board=<name>&limit=50`. Resolved to the
 * calling project by `?apiKey=` (missing key → `DEMO_PROJECT_ID` when set;
 * dev-mode / null project → the shared "dev" scope). Returns ranked entries with
 * a short edge-cache — this is a hot, public read that tolerates 10s of staleness.
 */
export async function handleLeaderboard(env: Env, url: URL): Promise<Response> {
  const resolved = await resolveProject(env, url);
  if (!resolved.ok) return json({ error: resolved.code }, resolved.status);
  const board = url.searchParams.get("board");
  if (!board) return json({ error: "missing_board" }, 400);

  const scope = resolved.projectId ?? "dev";
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
  const rows = env.DB ? await topScores(env.DB, scope, board, limit) : [];
  const body = rows.map((r, i) => ({
    rank: i + 1,
    playerId: r.player_id,
    displayName: r.display_name,
    score: r.score,
  }));
  return json(body, 200, { "Cache-Control": "public, max-age=10" });
}

// --- dashboard session helpers ---

async function requireSession(env: Env, request: Request): Promise<Session | null> {
  if (!env.SESSION_SECRET) return null;
  return readSession(env.SESSION_SECRET, request);
}

/** Fetch a project only if the session owns it. Returns a typed failure otherwise. */
async function ownedProject(
  env: Env,
  session: Session,
  projectId: string,
): Promise<{ ok: true; project: ProjectRow } | { ok: false; res: Response }> {
  const project = env.DB ? await getProject(env.DB, projectId) : null;
  if (!project) return { ok: false, res: json({ error: "not_found" }, 404) };
  if (project.owner_github_id !== session.githubId) {
    return { ok: false, res: json({ error: "forbidden" }, 403) };
  }
  return { ok: true, project };
}

// --- platform REST router (returns null when the path is not a platform route) ---

export async function handlePlatformApi(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  const path = url.pathname;
  const method = request.method;

  // --- auth ---
  if (path === "/api/platform/auth/github/login" && method === "GET") {
    if (!env.GITHUB_CLIENT_ID) return json({ error: "github_not_configured" }, 500);
    // Pin the whole OAuth round-trip to the canonical host: the GitHub app's
    // registered callback is host-exact, so a login started from an alias host
    // (www, workers.dev) would otherwise die with a redirect_uri mismatch.
    if (env.CANONICAL_HOST && url.hostname !== env.CANONICAL_HOST) {
      const canonical = new URL(url.toString());
      canonical.hostname = env.CANONICAL_HOST;
      return Response.redirect(canonical.toString(), 302);
    }
    const redirectUri = `${url.origin}/api/platform/auth/github/callback`;
    const state = crypto.randomUUID();
    return Response.redirect(githubAuthorizeUrl(env.GITHUB_CLIENT_ID, redirectUri, state), 302);
  }

  if (path === "/api/platform/auth/github/callback" && method === "GET") {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET || !env.DB) {
      return json({ error: "github_not_configured" }, 500);
    }
    const code = url.searchParams.get("code");
    if (!code) return json({ error: "missing_code" }, 400);
    const user = await exchangeGithubCode(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET, code);
    if (!user) return json({ error: "oauth_failed" }, 401);
    await upsertUser(env.DB, user);
    const token = await signSession(env.SESSION_SECRET, {
      githubId: user.githubId,
      login: user.login,
      avatarUrl: user.avatarUrl,
      iat: Date.now(),
    });
    return new Response(null, {
      status: 302,
      headers: { Location: "/dashboard/", "Set-Cookie": sessionSetCookie(token) },
    });
  }

  if (path === "/api/platform/auth/dev" && method === "POST") {
    if (env.DEV_MODE !== "1") return json({ error: "not_available" }, 403);
    if (!env.SESSION_SECRET || !env.DB) return json({ error: "not_configured" }, 500);
    const body = (await request.json().catch(() => ({}))) as { login?: string };
    const login = body.login?.trim();
    if (!login) return json({ error: "missing_login" }, 400);
    const githubId = `dev-${login}`;
    await upsertUser(env.DB, { githubId, login, avatarUrl: null });
    const token = await signSession(env.SESSION_SECRET, {
      githubId,
      login,
      avatarUrl: null,
      iat: Date.now(),
    });
    return json({ githubId, login }, 200, { "Set-Cookie": sessionSetCookie(token) });
  }

  if (path === "/api/platform/auth/logout" && method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": sessionClearCookie() });
  }

  if (path === "/api/platform/me" && method === "GET") {
    const session = await requireSession(env, request);
    if (!session) return json({ error: "unauthenticated" }, 401);
    // avatarUrl is a string in the dashboard contract; dev-login sessions have none.
    return json({
      githubId: session.githubId,
      login: session.login,
      avatarUrl: session.avatarUrl ?? "",
      isAdmin: isAdmin(env, session),
    });
  }

  // --- public showcase read + authed submit/moderation ---
  if (path === "/api/platform/showcase" || path.startsWith("/api/platform/showcase/")) {
    return handleShowcase(request, url, env);
  }

  // --- everything below requires a session ---
  if (path === "/api/platform/projects" || path.startsWith("/api/platform/projects/")) {
    const session = await requireSession(env, request);
    if (!session) return json({ error: "unauthenticated" }, 401);
    if (!env.DB) return json({ error: "not_configured" }, 500);
    return handleProjects(request, url, env, session);
  }

  return null;
}

/**
 * Showcase router (`/api/platform/showcase*`). The list read is PUBLIC (no
 * session); submit / "my games" / moderation all require a session, and the
 * moderation routes additionally require admin (env allow-list).
 */
async function handleShowcase(request: Request, url: URL, env: Env): Promise<Response> {
  const method = request.method;
  const rest = url.pathname.slice("/api/platform/showcase".length); // "" | "/mine" | "/pending" | "/:id[/status]"

  // Public gallery read — approved games, with live counts merged in.
  if ((rest === "" || rest === "/") && method === "GET") {
    if (!env.DB) return json([]);
    const rows = await listApprovedShowcase(env.DB);
    const pids = [...new Set(rows.map((r) => r.project_id).filter((p): p is string => !!p))];
    let live: Record<string, { rooms: number; players: number }> = {};
    if (pids.length > 0) {
      try {
        live = await matchmaker(env).liveCountsForProjects(pids);
      } catch {
        live = {}; // live counts are best-effort — never fail the gallery on them
      }
    }
    const body = rows.map((r) => showcaseView(r, r.project_id ? live[r.project_id] : undefined));
    return json(body, 200, { "Cache-Control": "public, max-age=10" });
  }

  // --- everything below requires a session ---
  const session = await requireSession(env, request);
  if (!session) return json({ error: "unauthenticated" }, 401);
  if (!env.DB) return json({ error: "not_configured" }, 500);
  const db = env.DB;
  const admin = isAdmin(env, session);

  // POST /api/platform/showcase — submit a game (defaults to pending).
  if ((rest === "" || rest === "/") && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 64) return json({ error: "invalid_title" }, 400);
    if (!isSafeUrl(body.thumbnailUrl)) return json({ error: "invalid_thumbnail" }, 400);
    if (!isSafeUrl(body.playUrl)) return json({ error: "invalid_play_url" }, 400);
    const tagline = typeof body.tagline === "string" ? body.tagline.trim().slice(0, 140) : "";
    const author = typeof body.author === "string" ? body.author.trim().slice(0, 64) : "";
    const genresIn = Array.isArray(body.genres) ? body.genres : [];
    const genres = [
      ...new Set(
        genresIn.filter((g): g is string => typeof g === "string" && SHOWCASE_GENRES.has(g)),
      ),
    ];
    // Optional project link — must be owned by the submitter (drives live counts).
    let projectId: string | null = null;
    if (typeof body.projectId === "string" && body.projectId) {
      const owned = await ownedProject(env, session, body.projectId);
      if (!owned.ok) return owned.res;
      projectId = body.projectId;
    }
    const id = crypto.randomUUID();
    const slug = `${kebab(title).slice(0, 48)}-${id.slice(0, 6)}`;
    const row = await submitShowcaseGame(db, {
      id,
      projectId,
      ownerGithubId: session.githubId,
      slug,
      title,
      tagline,
      thumbnailUrl: body.thumbnailUrl as string,
      playUrl: body.playUrl as string,
      genres: genres.join(","),
      author,
    });
    return json(showcaseView(row), 201);
  }

  // GET /api/platform/showcase/mine — the session's own submissions, any status.
  if (rest === "/mine" && method === "GET") {
    const rows = await listShowcaseByOwner(db, session.githubId);
    return json(rows.map((r) => showcaseView(r)));
  }

  // GET /api/platform/showcase/pending — moderation queue (admin only).
  if (rest === "/pending" && method === "GET") {
    if (!admin) return json({ error: "forbidden" }, 403);
    const rows = await listPendingShowcase(db);
    return json(rows.map((r) => showcaseView(r)));
  }

  // /:id[/status]
  const parts = rest.split("/").filter(Boolean); // [id] | [id, "status"]
  const id = parts[0];
  const sub = parts[1];

  // POST /api/platform/showcase/:id/status — approve | reject | pending (+featured).
  if (id && sub === "status" && method === "POST") {
    if (!admin) return json({ error: "forbidden" }, 403);
    const body = (await request.json().catch(() => ({}))) as { status?: string; featured?: boolean };
    const status = body.status;
    if (status !== "approved" && status !== "rejected" && status !== "pending") {
      return json({ error: "invalid_status" }, 400);
    }
    const ok = await setShowcaseStatus(
      db,
      id,
      status,
      typeof body.featured === "boolean" ? body.featured : undefined,
    );
    return ok ? json({ ok: true }) : json({ error: "not_found" }, 404);
  }

  // DELETE /api/platform/showcase/:id — owner or admin. Non-owners get 404
  // (existence is hidden), mirroring the project-delete contract.
  if (id && sub === undefined && method === "DELETE") {
    if (!admin) {
      const row = await getShowcaseGame(db, id);
      if (!row || row.owner_github_id !== session.githubId) return json({ error: "not_found" }, 404);
    }
    const ok = await deleteShowcaseGame(db, id, session.githubId, admin);
    return ok ? json({ ok: true }) : json({ error: "not_found" }, 404);
  }

  return json({ error: "method_not_allowed" }, 405);
}

async function handleProjects(
  request: Request,
  url: URL,
  env: Env,
  session: Session,
): Promise<Response> {
  const db = env.DB!;
  const method = request.method;
  const rest = url.pathname.slice("/api/platform/projects".length); // "" | "/:id" | "/:id/..."

  // /api/platform/projects
  if (rest === "" || rest === "/") {
    if (method === "GET") {
      const rows = await listProjects(db, session.githubId);
      return json(rows.map(projectView));
    }
    if (method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { name?: string };
      const name = body.name?.trim();
      if (!name) return json({ error: "missing_name" }, 400);
      const row = await createProject(db, {
        id: crypto.randomUUID(),
        ownerGithubId: session.githubId,
        name,
        playerJwtSecret: crypto.randomUUID().replace(/-/g, ""),
      });
      return json(projectView(row), 201);
    }
    return json({ error: "method_not_allowed" }, 405);
  }

  // /:id[/...]
  const parts = rest.split("/").filter(Boolean); // [id, sub?, subid?]
  const projectId = parts[0]!;
  const sub = parts[1];

  // DELETE /api/platform/projects/:id — remove a project and its keys.
  // Handled before the shared ownedProject() check (which 403s non-owners),
  // because the delete contract hides existence: a non-owner or an unknown id
  // both get 404, never 403.
  if (sub === undefined && method === "DELETE") {
    const target = await getProject(db, projectId);
    if (!target || target.owner_github_id !== session.githubId) {
      return json({ error: "not_found" }, 404);
    }
    // Guard the public demo-metering project against accidental deletion.
    if (env.DEMO_PROJECT_ID && projectId === env.DEMO_PROJECT_ID) {
      return json({ error: "protected_project" }, 403);
    }
    // Atomically delete the project + its API keys (usage_daily is kept for
    // billing/history). Live rooms are NOT force-closed: existing sockets
    // expire naturally, while new connects fail key validation (the key rows
    // are gone). Matchmaker bookkeeping self-prunes via heartbeat/prune.
    await deleteProject(db, projectId);
    return json({ ok: true });
  }

  const owned = await ownedProject(env, session, projectId);
  if (!owned.ok) return owned.res;
  const project = owned.project;

  if (sub === undefined) {
    if (method === "GET") return json(projectView(project));
    return json({ error: "method_not_allowed" }, 405);
  }

  if (sub === "keys") {
    const keyId = parts[2];
    if (keyId === undefined && method === "GET") {
      const keys = await listApiKeys(db, projectId);
      return json(
        keys.map((k) => ({
          id: k.id,
          prefix: k.key_prefix,
          createdAt: new Date(k.created_at).toISOString(),
          revokedAt: isoOrNull(k.revoked_at),
        })),
      );
    }
    if (keyId === undefined && method === "POST") {
      const gen = await generateApiKey();
      const row = await createApiKey(db, {
        id: crypto.randomUUID(),
        projectId,
        keyHash: gen.hash,
        keyPrefix: gen.prefix,
      });
      // The full key is returned exactly once — it is never stored in the clear.
      return json(
        { id: row.id, key: gen.key, prefix: gen.prefix, createdAt: new Date(row.created_at).toISOString() },
        201,
      );
    }
    if (keyId !== undefined && method === "DELETE") {
      const ok = await revokeApiKey(db, projectId, keyId);
      return ok ? json({ ok: true }) : json({ error: "not_found" }, 404);
    }
    return json({ error: "method_not_allowed" }, 405);
  }

  if (sub === "usage" && method === "GET") {
    const days = Number(url.searchParams.get("days") ?? "30");
    const rows = await usageForProject(db, projectId, Number.isFinite(days) ? days : 30);
    return json(
      rows.map((r) => ({
        day: r.day,
        roomHours: r.room_hours,
        peakCcu: r.peak_ccu,
        messages: r.messages,
      })),
    );
  }

  if (sub === "rooms" && method === "GET") {
    const rooms = await matchmaker(env).roomsForProject(projectId);
    return json(rooms);
  }

  if (sub === "limits" && method === "GET") {
    const limits = await matchmaker(env).projectLimits(projectId);
    // Wire shape is the dashboard contract (`caps.monthRoomHours`); the internal
    // caps type keeps the config-key-aligned name `roomHoursPerMonth`.
    return json({
      caps: {
        monthRoomHours: limits.caps.roomHoursPerMonth,
        concurrentRooms: limits.caps.concurrentRooms,
        playersPerRoom: limits.caps.playersPerRoom,
      },
      monthRoomHours: limits.monthRoomHours,
      liveRooms: limits.liveRooms,
    });
  }

  if (sub === "player-token" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { playerId?: string };
    const playerId = body.playerId?.trim();
    if (!playerId) return json({ error: "missing_player_id" }, 400);
    const nowS = Math.floor(Date.now() / 1000);
    const token = await signJwt(project.player_jwt_secret, {
      sub: playerId,
      iat: nowS,
      exp: nowS + 3600,
    });
    return json({ token });
  }

  return json({ error: "not_found" }, 404);
}

// Wire shape follows the dashboard contract: timestamps are ISO-8601 STRINGS
// (D1 stores epoch ms). The dashboard's runtime guards reject numbers.
function isoOrNull(epochMs: number | null): string | null {
  return epochMs === null ? null : new Date(epochMs).toISOString();
}

function projectView(p: ProjectRow) {
  return {
    id: p.id,
    name: p.name,
    ownerGithubId: p.owner_github_id,
    requirePlayerAuth: p.require_player_auth === 1,
    createdAt: new Date(p.created_at).toISOString(),
  };
}
