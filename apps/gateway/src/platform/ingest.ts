import type { Env } from "../index.js";
import type { Matchmaker } from "../matchmaker.js";
import { resolveProjectId } from "./apikeys.js";

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

function error(code: string, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
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
  const header = request.headers.get("Authorization") ?? "";
  const apiKey = header.startsWith(BEARER) ? header.slice(BEARER.length).trim() : "";
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
