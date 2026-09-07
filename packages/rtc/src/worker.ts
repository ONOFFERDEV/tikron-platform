/**
 * Cloudflare Worker side of `@tikron/rtc`: one route that hands the browser a
 * list of ICE servers, minted from YOUR OWN Cloudflare Realtime TURN key.
 *
 * The data plane stays on your account — TURN relay bytes bill to your key,
 * inside your own free tier. Tikron never proxies media, and there is no
 * platform-hosted ICE service to depend on.
 *
 * Without the key it degrades to STUN-only rather than failing: P2P still
 * connects on most networks, and a game that only wants a data channel keeps
 * working. It never returns 5xx — a broken ICE route must not break a match.
 */

/** JSON shape of one entry, matching the browser's `RTCIceServer`. */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceServersBody {
  iceServers: IceServer[];
}

export interface IceServersOptions {
  /** Cloudflare Realtime TURN key id (`env.TURN_KEY_ID`). Omit for STUN-only. */
  keyId?: string;
  /** Cloudflare Realtime TURN API token (`env.TURN_KEY_API_TOKEN`). Omit for STUN-only. */
  apiToken?: string;
  /** Requested credential lifetime in seconds. Default 3600. */
  ttlSec?: number;
  /** How long a minted list is reused per isolate. Default 30 min, inside the 1h TTL. */
  cacheMs?: number;
  /** Override for tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

const STUN_ONLY: IceServersBody = { iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] };
const DEFAULT_TTL_SEC = 3600;
const DEFAULT_CACHE_MS = 30 * 60 * 1000;
const MINT_URL = "https://rtc.live.cloudflare.com/v1/turn/keys";

/**
 * Per-isolate mint cache. Module scope on purpose: the documented recipe
 * builds a fresh handler on every request, so a closure-scoped cache would
 * never hit. Keyed by key id so a rotated key is not served from the old one.
 */
let cache: { keyId: string; body: IceServersBody; expiresAt: number } | null = null;

/** Credentials expire and are per-caller: no proxy or browser may hold on to them. */
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Build the `GET /api/ice` handler:
 *
 * ```ts
 * if (url.pathname === "/api/ice") {
 *   return iceServersHandler({ keyId: env.TURN_KEY_ID, apiToken: env.TURN_KEY_API_TOKEN })(request);
 * }
 * ```
 */
export function iceServersHandler(
  opts: IceServersOptions = {},
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "GET") {
      return Response.json({ error: "method_not_allowed" }, { status: 405, headers: NO_STORE });
    }
    return Response.json(await iceServers(opts), { headers: NO_STORE });
  };
}

async function iceServers(opts: IceServersOptions): Promise<IceServersBody> {
  const { keyId, apiToken } = opts;
  // No key configured — STUN-only, uncached so a later secret rotation takes
  // effect immediately (and it costs nothing to recompute).
  if (!keyId || !apiToken) return STUN_ONLY;

  const now = Date.now();
  if (cache && cache.keyId === keyId && cache.expiresAt > now) return cache.body;

  const doFetch = opts.fetchImpl ?? fetch;
  const ttlSec = opts.ttlSec ?? DEFAULT_TTL_SEC;
  try {
    const res = await doFetch(`${MINT_URL}/${keyId}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: ttlSec }),
    });
    if (!res.ok) {
      // Status only. The token is in the request and the credentials are in the
      // body; neither belongs in a log line.
      console.warn("[tikron/rtc] TURN mint failed", res.status);
      return STUN_ONLY;
    }

    const data = (await res.json()) as { iceServers?: IceServer | IceServer[] };
    const raw = data.iceServers;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (list.length === 0) return STUN_ONLY;

    const body: IceServersBody = { iceServers: list };
    // Never serve a credential past its own life: half the TTL is the margin.
    const holdMs = Math.min(opts.cacheMs ?? DEFAULT_CACHE_MS, ttlSec * 500);
    cache = { keyId, body, expiresAt: now + holdMs };
    return body;
  } catch {
    // Network or API failure — degrade rather than fail the request.
    console.warn("[tikron/rtc] TURN mint failed", "network error");
    return STUN_ONLY;
  }
}
