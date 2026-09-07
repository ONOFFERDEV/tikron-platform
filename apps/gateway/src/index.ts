import {
  Server,
  routePartykitRequest,
  type Connection,
  type ConnectionContext,
} from "partyserver";
import {
  PROTOCOL_VERSION,
  ClientMessageType,
  ServerMessageType,
  encode,
  decodeClientMessage,
  ProtocolError,
  type ServerMessage,
} from "@tikron/protocol";
import { defineRoom, type DefineRoomOptions } from "@tikron/server";
import { MovementRoomImpl } from "./rooms/movement-room.js";
import { TicTacToeImpl } from "./rooms/tic-tac-toe.js";
import { AgarRoomImpl } from "./rooms/agar-room.js";
import { ShooterRoomImpl } from "./rooms/shooter-room.js";
import { MmoRoomImpl } from "./rooms/mmo-room.js";
import { Matchmaker, isExternalRoom, unprefixExternalRoom } from "./matchmaker.js";
import {
  enforceConnection,
  handleLeaderboard,
  handlePlatformApi,
  resolveProject,
} from "./platform/api.js";
import { getProject, recordScore } from "./platform/db.js";
import { handleIngest, handleScoreIngest } from "./platform/ingest.js";
import { verifyJwt } from "./platform/jwt.js";
import { isLocationHint, resolveLocationHint, LOCATION_HINTS_LIST } from "./region.js";

export { Matchmaker };

export interface Env {
  GameRoom: DurableObjectNamespace<GameRoom>;
  MovementRoom: DurableObjectNamespace;
  TicTacToe: DurableObjectNamespace;
  AgarRoom: DurableObjectNamespace;
  ShooterRoom: DurableObjectNamespace;
  MmoRoom: DurableObjectNamespace;
  Matchmaker: DurableObjectNamespace<Matchmaker>;
  /** Platform database (M5). Absent → API-key enforcement + metering are skipped. */
  DB?: D1Database;
  /** "1" disables key enforcement and enables dev auth (local dev + tests only). */
  DEV_MODE?: string;
  /** Keyless /parties connects fall back to this project (metered demo) when set. */
  DEMO_PROJECT_ID?: string;
  /** HMAC secret for dashboard session cookies. */
  SESSION_SECRET?: string;
  /** GitHub OAuth app credentials for the dashboard login. */
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  /**
   * Canonical public hostname (e.g. "tikron.dev"). When set, www.<host> gets a
   * 301 to the apex and the GitHub OAuth flow is pinned to it, so redirect_uri
   * always matches the OAuth app's registered callback (host-only cookies and
   * the state check then live on one origin too).
   */
  CANONICAL_HOST?: string;
  /**
   * Comma-separated GitHub user ids allowed to moderate the public showcase
   * (approve/reject/feature/delete any submission). Exposed to the dashboard as
   * `isAdmin` on the session, never as the id list itself.
   */
  ADMIN_GITHUB_IDS?: string;
}

/**
 * M0 hello-room: a raw partyserver Durable Object (echo/broadcast/presence).
 * Kept as a minimal reference; framework-based rooms use `@tikron/server`.
 */
export class GameRoom extends Server<Env> {
  static override options = { hibernate: true };

  override onConnect(conn: Connection, _ctx: ConnectionContext): void {
    const peers = [...this.getConnections()].map((c) => c.id).filter((id) => id !== conn.id);

    this.sendTo(conn, {
      t: ServerMessageType.Welcome,
      connectionId: conn.id,
      room: this.name,
      protocol: PROTOCOL_VERSION,
      peers,
    });

    this.relay({ t: ServerMessageType.PeerJoined, connectionId: conn.id }, conn.id);
  }

  override onMessage(conn: Connection, raw: string | ArrayBuffer): void {
    let msg;
    try {
      msg = decodeClientMessage(raw);
    } catch (err) {
      this.sendTo(conn, {
        t: ServerMessageType.Error,
        code: "bad_message",
        message: err instanceof ProtocolError ? err.message : "invalid message",
      });
      return;
    }

    switch (msg.t) {
      case ClientMessageType.Hello:
        this.relay(
          { t: ServerMessageType.PeerJoined, connectionId: conn.id, name: msg.name },
          conn.id,
        );
        break;
      case ClientMessageType.Echo:
        this.sendTo(conn, { t: ServerMessageType.Echo, text: msg.text });
        break;
      case ClientMessageType.Broadcast:
        this.relay({ t: ServerMessageType.Broadcast, from: conn.id, text: msg.text }, conn.id);
        break;
    }
  }

  override onClose(conn: Connection): void {
    this.relay({ t: ServerMessageType.PeerLeft, connectionId: conn.id }, conn.id);
  }

  private sendTo(conn: Connection, message: ServerMessage): void {
    conn.send(encode(message));
  }

  private relay(message: ServerMessage, exceptId: string): void {
    this.broadcast(encode(message), [exceptId]);
  }
}

function matchmaker(env: Env) {
  return env.Matchmaker.get(env.Matchmaker.idFromName("global"));
}

/**
 * Player-token auth for a room connection (wired as {@link DefineRoomOptions.onAuth}).
 * Off unless the project opted in (`require_player_auth`). Returns:
 *   - `true`  — connection allowed WITHOUT a verified identity (dev / unmetered
 *               rooms, or a project with enforcement off). `client.auth` stays
 *               undefined; leaderboards then key by the session id.
 *   - `{id, claims}` — a valid player JWT: the verified `sub` becomes
 *               `client.auth.id`, a DURABLE identity that survives reconnects and
 *               new tabs (what rooms should key rankings/bans by).
 *   - `false` — enforcement on and the token is missing / invalid → rejected.
 * Extracted (vs inline) so it can be unit-tested directly — the object vs boolean
 * distinction isn't observable on the wire.
 */
export async function playerOnAuth(
  env: Env,
  info: { roomId: string; projectId: string | null; token: string | null; session: string | null },
) {
  if (!info.projectId || !env.DB) return true; // dev / unmetered rooms — no player auth
  const project = await getProject(env.DB, info.projectId);
  if (!project || project.require_player_auth !== 1) return true; // enforcement off
  if (!info.token) return false;
  const claims = await verifyJwt(project.player_jwt_secret, info.token);
  return claims ? { id: claims.sub, claims } : false;
}

/**
 * Rooms report live occupancy to the matchmaker on every join / final leave (and
 * on a periodic heartbeat), and validate self-supplied session keys against the
 * ones the matchmaker issued for the room.
 */
const roomOptions: DefineRoomOptions = {
  reportOccupancy: (env, { roomId, count, sessions, seq, projectId, messages }) =>
    matchmaker(env as Env).report(roomId, count, sessions, seq, projectId ?? undefined, messages),
  validateSession: (env, { roomId, session }) =>
    matchmaker(env as Env).validateSession(roomId, session),
  // Player-token auth, off unless the project opted in (require_player_auth). A
  // valid token now yields the verified identity ({id, claims} → client.auth), not
  // just a boolean, so room code can key on a durable player id (see playerOnAuth).
  onAuth: (env, info) => playerOnAuth(env as Env, info),
  // Server-authoritative leaderboard writes. Fire-and-forget upserts to D1 (no
  // ordering seq needed: "max"/"sum" are order-independent and "last" reflects
  // the write that lands last). A null project (dev-mode) writes to the shared
  // "dev" scope so dev reads see the same rows; no DB → a no-op.
  services: {
    submitScore: (env, { projectId, board, playerId, score, displayName, mode, period }) => {
      const e = env as Env;
      if (!e.DB) return;
      return recordScore(e.DB, {
        projectId: projectId ?? "dev",
        board,
        playerId,
        score,
        displayName: displayName ?? null,
        mode: mode ?? "max",
        period,
      });
    },
  },
};

/** Realtime .io example — Simulation + MovementValidation modules. */
export const MovementRoom = defineRoom(MovementRoomImpl, roomOptions);

/** Turn-based guardrail example — genre-agnostic core only, no tick. */
export const TicTacToe = defineRoom(TicTacToeImpl, roomOptions);

/** Flagship .io demo — Simulation + MovementValidation + binary delta + AOI. */
export const AgarRoom = defineRoom(AgarRoomImpl, roomOptions);

/** FPS proof-of-concept — hitscan shooter with subtick timestamps + lag compensation. */
export const ShooterRoom = defineRoom(ShooterRoomImpl, roomOptions);

/** MMORPG example — integrates the @tikron/rpg combat engine (skills, buffs, aggro, XP). */
export const MmoRoom = defineRoom(MmoRoomImpl, roomOptions);

/** Largest party `/api/matchmake?party=` will place in one call. */
const MAX_PARTY = 16;

/**
 * The room (Durable Object) name in `/parties/<party>/<room>`, decoded — the
 * router decodes it too, so a guard reading the raw segment could be slipped a
 * percent-encoded name. Malformed escapes fall back to the raw segment.
 */
function roomNameOf(url: URL): string {
  const raw = url.pathname.split("/")[3] ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Matchmaking is reachable CROSS-ORIGIN: a self-hosted game served from the
 * developer's own domain calls tikron.dev with `?apiKey=tk_pub_…` to get a room
 * on its own worker. The rest of the JSON API stays same-origin-only.
 */
const MATCHMAKE_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const CORS_ROUTES = new Set(["/api/matchmake", "/api/release"]);

/** REST matchmaking API: place players into rooms and browse the lobby. */
export async function handleApi(request: Request, url: URL, env: Env): Promise<Response> {
  const mm = matchmaker(env);
  const cors = CORS_ROUTES.has(url.pathname) ? MATCHMAKE_CORS : undefined;
  const json = (body: unknown, status = 200) =>
    Response.json(body, cors ? { status, headers: cors } : { status });
  if (cors && request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (url.pathname === "/api/matchmake") {
    const resolved = await resolveProject(env, url);
    if (!resolved.ok) return json({ error: resolved.code }, resolved.status);
    const type = url.searchParams.get("type") ?? "agar-room";
    const mode = url.searchParams.get("mode") ?? "";
    const max = Number(url.searchParams.get("max") ?? "8");
    const maxClients = Number.isFinite(max) ? max : 8;
    const region = url.searchParams.get("region") ?? undefined;
    if (region && !isLocationHint(region)) {
      return json(
        { error: "invalid_region", message: `region must be one of: ${LOCATION_HINTS_LIST}` },
        400,
      );
    }
    // Party matchmaking: reserve N seats in ONE room atomically. Absent → 1, and
    // the response keeps its single-player shape. The seat bound is the same
    // floor `reserve()` has always applied, so a nonsense `?max=` (0, negative,
    // fractional) still yields a 1-seat room instead of failing as a bad party.
    const partyParam = url.searchParams.get("party");
    const party = partyParam === null ? 1 : Number(partyParam);
    if (!Number.isInteger(party) || party < 1 || party > MAX_PARTY || party > Math.max(1, maxClients)) {
      return json({ error: "invalid_party" }, 400);
    }
    if (resolved.projectId) {
      const cap = await mm.checkCaps(resolved.projectId, true);
      if (cap) return json({ error: cap }, 403);
    }
    const result = await mm.reserveMany(
      type,
      mode,
      maxClients,
      party,
      resolved.projectId ?? undefined,
      region,
    );
    // A self-hosted room lives on the customer's worker: hand back its PLAIN id
    // (the `ext:{project}:` namespacing is a gateway internal) plus where to
    // reach it. Gateway-hosted rooms are unchanged, with no roomUrl.
    const body: Record<string, unknown> = {
      roomId: unprefixExternalRoom(resolved.projectId ?? "", result.roomId),
      sessionId: result.sessionIds[0],
    };
    if (party > 1) body.sessionIds = result.sessionIds;
    if (result.region) body.region = result.region;
    if (result.roomUrl) body.roomUrl = result.roomUrl;
    return json(body);
  }
  if (url.pathname === "/api/leaderboard") {
    return handleLeaderboard(env, url);
  }
  if (url.pathname === "/api/rooms") {
    const type = url.searchParams.get("type") ?? undefined;
    return Response.json(await mm.list(type));
  }
  if (url.pathname === "/api/release") {
    const session = url.searchParams.get("session");
    if (session) await mm.release(session);
    return json({ ok: true });
  }
  return new Response("not found", { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (env.CANONICAL_HOST && url.hostname === `www.${env.CANONICAL_HOST}`) {
      url.hostname = env.CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname.startsWith("/api/platform/")) {
      return (
        (await handlePlatformApi(request, url, env)) ??
        Response.json({ error: "not_found" }, { status: 404 })
      );
    }
    // Self-hosted usage reporting: key-authenticated occupancy ingest (needs the
    // request for its Authorization header + body, so it takes `request` not `url`).
    if (url.pathname === "/api/ingest/occupancy") return handleIngest(request, env);
    // Self-hosted leaderboard score ingest — twin of occupancy, but tk_live_ only.
    if (url.pathname === "/api/ingest/score") return handleScoreIngest(request, env);
    if (url.pathname.startsWith("/api/")) return handleApi(request, url, env);
    if (url.pathname.startsWith("/parties/")) {
      // A gateway-hosted room may never take a self-hosted room's key. Without this
      // anyone could connect to `/parties/<type>/ext:{victim}:{room}`, and the
      // hosted room it creates would report under the victim's registry entry —
      // pushing reportSeq past theirs so their real reports are dropped as stale.
      // Checked BEFORE enforceConnection so no dev-mode key bypass can reach it.
      if (isExternalRoom(roomNameOf(url))) {
        return Response.json({ error: "invalid_room" }, { status: 400 });
      }
      // Enforce API keys (unless dev-bypassed) and forward the project to the room.
      const gate = await enforceConnection(env, request, url);
      if (!gate.ok) return Response.json({ error: gate.code }, { status: gate.status });
      // Apply a placement hint (client-forwarded `?region=`) on the DO get. It only
      // affects the instance that creates the room, so passing it on every connect
      // is harmless — later connects to a placed room are ignored by the platform.
      const hint = resolveLocationHint(url);
      return (
        (await routePartykitRequest(gate.request, env, hint ? { locationHint: hint } : undefined)) ??
        new Response("not found", { status: 404 })
      );
    }
    // The dashboard lives in its own (private) worker on the zone route
    // `tikron.dev/dashboard*` — see ONOFFERDEV/tikron-dashboard. That route
    // takes precedence over this worker's custom domain, so no handling here.
    return (
      (await routePartykitRequest(request, env)) ?? new Response("not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
