import { routePartykitRequest } from "partyserver";
import { defineRoom } from "@tikron/server";
import { VillageRoomImpl } from "./rooms/village-room.js";
import { FieldRoomImpl } from "./rooms/field-room.js";
import { DungeonRoomImpl } from "./rooms/dungeon-room.js";
import * as persist from "./persist.js";

export interface Env {
  VillageRoom: DurableObjectNamespace;
  FieldRoom: DurableObjectNamespace;
  DungeonRoom: DurableObjectNamespace;
  /** Anonymous-token character storage (§5), CRUD in persist.ts. */
  DB: D1Database;
}

/**
 * Rejects a room connection before a seat is granted (real WebSocket close 4004,
 * `unauthorized`) unless it carries a real character token AND successfully CAS-claims
 * the connecting session as that character's sole live owner (PLAN-EMBERFALL-M2-SECFIX
 * FIX-1/FIX-2, "Path F").
 *
 * `token` (`?_auth=`, server-side only — never echoed to any client, see
 * `client/net.ts`'s `connect()`) is the character's save token; `session` (`?_session=`,
 * echoed to every peer in the room as `PeerJoined.connectionId`) is a random
 * per-play-session id the client mints once and reuses across reconnects/zone
 * transfers. Both are required: a stale/malformed connect with either missing is
 * rejected outright. `persist.claimSession` then CAS-binds `session` as the character's
 * exclusive claim in D1 — a second concurrent connection presenting the SAME token gets
 * a DIFFERENT session id and fails the claim (FIX-2: no more same-token self-clone).
 *
 * This is deploy-only defense in depth: it runs in the `defineRoom` DO wrapper (which
 * sees the real `env` directly, unlike a Room subclass — see `ember-room-base.ts`'s
 * docblock), and `createTestRoom`-based tests bypass it entirely (they call the room's
 * `_connect` directly, never `onConnect`) — those tests seed the session->character
 * claim into their fake D1 directly instead. `ember-room-base.ts`'s `joinWithCharacter`
 * performs the matching in-room lookup (`loadCharacterBySession`) that a client without
 * persistence configured must still get gated on, since `db` being set but `onJoin`
 * somehow reaching it unauthenticated has to fail closed too.
 */
async function charOnAuth(
  rawEnv: unknown,
  info: { roomId: string; projectId: string | null; token: string | null; session: string | null },
): Promise<boolean> {
  if (!info.token || !info.session) return false;
  const env = rawEnv as Env;
  const character = await persist.loadCharacter(env.DB, info.token);
  if (!character) return false;
  const claim = await persist.claimSession(env.DB, info.token, info.session, Date.now());
  return claim.ok;
}

/**
 * `defineRoom` turns each Room class into a Durable Object; the binding name
 * maps to a kebab-case URL party (AGENTS.md rule 4):
 *   VillageRoom -> wss://<host>/parties/village-room/<room-id>
 *   FieldRoom   -> wss://<host>/parties/field-room/<room-id>
 *   DungeonRoom -> wss://<host>/parties/dungeon-room/<room-id>
 */
export const VillageRoom = defineRoom(VillageRoomImpl, { onAuth: charOnAuth });
export const FieldRoom = defineRoom(FieldRoomImpl, { onAuth: charOnAuth });
export const DungeonRoom = defineRoom(DungeonRoomImpl, { onAuth: charOnAuth });

/** `{nickname, class}` -> `4xx` | `{token, character}` (PLAN-EMBERFALL-M2 §4). */
async function handleCharCreate(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const { nickname, class: cls } = body as { nickname?: unknown; class?: unknown };
  if (typeof nickname !== "string" || typeof cls !== "string") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await persist.createCharacter(env.DB, { nickname, class: cls });
  if (!result.ok) {
    const status = result.error === "nickname_taken" ? 409 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ token: result.token, character: result.character });
}

/** `{token}` -> `404 not_found` | `{character}` (PLAN-EMBERFALL-M2 §4). */
async function handleCharLoad(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const token = (body as { token?: unknown } | null)?.token;
  if (typeof token !== "string" || token.length === 0) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const character = await persist.loadCharacter(env.DB, token);
  if (!character) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ character });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return Response.json({ ok: true });
    }
    if (url.pathname === "/api/char/create" && request.method === "POST") {
      return handleCharCreate(request, env);
    }
    if (url.pathname === "/api/char/load" && request.method === "POST") {
      return handleCharLoad(request, env);
    }
    // No `/api/char/save` route: saves are room-authoritative (rooms write to D1
    // directly via the same worker binding) — a client-writable save endpoint would be
    // a forgery surface (PLAN-EMBERFALL-M2 §4).
    // Static assets (./public) are served automatically for matching paths before
    // this handler runs; anything else falls through to room routing.
    return (
      (await routePartykitRequest(request, env)) ?? new Response("not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
