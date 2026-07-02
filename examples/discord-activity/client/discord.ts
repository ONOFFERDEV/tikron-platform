import { DiscordSDK } from "@discord/embedded-app-sdk";
import { PartySocket } from "partysocket";
import type { TransportFactory } from "@playedge/client";

/**
 * All Discord-specific code lives here, isolated from the game/render code in
 * `main.ts`. The rest of the app treats "am I inside Discord?" as a single boolean
 * and gets a room id + display name back — so the exact same client runs in the
 * plain-browser dev fallback (`?dev=1`) with none of this loaded at runtime.
 */

declare global {
  /** Injected at runtime by public/config.js (the Discord application/client id). */
  // eslint-disable-next-line no-var
  var __DISCORD_CLIENT_ID__: string | undefined;
}

export interface DiscordSession {
  /** Room id to join — one Discord channel maps to one room. */
  roomId: string;
  /** The player's Discord display name (the server still validates it). */
  name: string;
}

/** The plain-browser fallback is opt-in via `?dev=1` (Activities can't run outside Discord). */
export function isDevFallback(): boolean {
  return new URLSearchParams(location.search).has("dev");
}

/**
 * Proxy-aware party prefix. Inside Discord an Activity runs in a sandboxed iframe on
 * `<clientId>.discordsays.com`, and every network request is routed through the
 * Discord proxy. Prefixing the WS path with `.proxy/` makes the proxy forward it —
 * per your Developer Portal URL Mapping (PREFIX `/` → TARGET your workers.dev host) —
 * to `wss://<workers.dev>/parties/<party>/<room>`. In the dev fallback there is no
 * proxy, so the default `parties` prefix hits the local worker directly.
 *
 * (Discord made the `.proxy/` prefix optional in 2025-07, but it still works on every
 * client, so the template keeps it for maximum compatibility.)
 */
export function partyPrefix(discord: boolean): string {
  return discord ? ".proxy/parties" : "parties";
}

/** The same proxy rule for plain HTTP — used for the token-exchange endpoint. */
export function httpBase(discord: boolean): string {
  return discord ? "/.proxy" : "";
}

/**
 * A PartySocket transport that honors the proxy prefix. It mirrors the SDK's default
 * transport but sets `prefix`, which is the one thing the built-in factory doesn't
 * expose — everything else (arraybuffer frames, 4001 takeover handling) is identical.
 */
export function proxyTransport(discord: boolean): TransportFactory {
  return (opts) => {
    const socket = new PartySocket({
      host: opts.host,
      room: opts.room,
      party: opts.party,
      prefix: partyPrefix(discord),
      query: opts.query,
      WebSocket: opts.WebSocketPolyfill as never,
    });
    // Binary state frames must arrive as ArrayBuffer, not the WebSocket default Blob.
    socket.binaryType = "arraybuffer";
    // 4001 = session taken over by a newer connection: stop auto-reconnecting so two
    // transports don't steal the seat from each other in a loop.
    socket.addEventListener("close", (e) => {
      if ((e as CloseEvent).code === 4001) socket.close();
    });
    return {
      send: (data) => socket.send(data),
      close: () => socket.close(),
      onMessage: (cb) => socket.addEventListener("message", (e) => cb((e as MessageEvent).data)),
      onOpen: (cb) => socket.addEventListener("open", () => cb()),
      onClose: (cb) => socket.addEventListener("close", () => cb()),
      onError: (cb) => socket.addEventListener("error", (e) => cb(e)),
    };
  };
}

/**
 * Run the Discord handshake: `ready()` → `authorize()` → server token exchange →
 * `authenticate()`. Returns the channel-derived room id and the player's display name.
 * Throws if no client id is configured (see public/config.js).
 */
export async function connectDiscord(): Promise<DiscordSession> {
  const clientId = globalThis.__DISCORD_CLIENT_ID__;
  if (!clientId) {
    throw new Error(
      "No Discord client id. Set globalThis.__DISCORD_CLIENT_ID__ in public/config.js, " +
        "or append ?dev=1 to run the plain-browser fallback.",
    );
  }

  const sdk = new DiscordSDK(clientId);
  await sdk.ready();

  // OAuth2 authorization-code grant. The `identify` scope yields the user's global_name.
  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds"],
  });

  // Exchange the code for an access token on our worker (needs the client secret,
  // which never touches the browser). Routed through the proxy inside Discord.
  const res = await fetch(`${httpBase(true)}/api/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`token exchange failed: HTTP ${res.status}`);
  const { access_token } = (await res.json()) as { access_token: string };

  const auth = await sdk.commands.authenticate({ access_token });
  const name = auth.user.global_name ?? auth.user.username;

  // One Activity channel = one room. channelId can be null (e.g. a DM) — fall back
  // to a per-user room so the Activity still opens.
  const roomId = sdk.channelId ?? `dm-${auth.user.id}`;
  return { roomId, name };
}
