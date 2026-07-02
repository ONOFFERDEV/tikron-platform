import { routePartykitRequest } from "partyserver";
import { defineRoom } from "@playedge/server";
import { CursorRoomImpl } from "./cursor-room.js";

export interface Env {
  CursorRoom: DurableObjectNamespace;
  /** Discord application (client) id. Set as a wrangler var (also in public/config.js). */
  DISCORD_CLIENT_ID?: string;
  /** Discord client secret. Set via `wrangler secret put DISCORD_CLIENT_SECRET` — never commit it. */
  DISCORD_CLIENT_SECRET?: string;
}

/**
 * The binding `CursorRoom` maps to the URL party `cursor-room`:
 *   wss://<host>/parties/cursor-room/<channel-id>
 * One Discord channel id becomes one room id, so everyone in a voice channel shares
 * a room automatically.
 */
export const CursorRoom = defineRoom(CursorRoomImpl);

/**
 * Exchange a Discord OAuth2 authorization `code` for an access token. This runs on
 * the worker because it needs the client SECRET, which must never reach the browser;
 * the client only ever receives the short-lived access token it passes to
 * `authenticate()`. Inside Discord the browser calls this via `/.proxy/api/token`,
 * which the Discord proxy forwards here as `/api/token`.
 */
async function handleToken(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return Response.json({ error: "discord_not_configured" }, { status: 500 });
  }
  const { code } = (await request.json().catch(() => ({}))) as { code?: string };
  if (!code) return Response.json({ error: "missing_code" }, { status: 400 });

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) return Response.json({ error: "token_exchange_failed" }, { status: 502 });
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) return Response.json({ error: "no_access_token" }, { status: 502 });
  return Response.json({ access_token: data.access_token });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/token") return handleToken(request, env);
    return (await routePartykitRequest(request, env)) ?? new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
