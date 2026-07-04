import { randomToken, sha256Hex } from "./crypto.js";
import { projectIdForKeyHash } from "./db.js";

/**
 * A key's capability class, DERIVED FROM ITS PREFIX — never a stored column.
 * `public` (`tk_pub_`) keys are for the browser: connect / matchmake / read. A
 * `secret` (`tk_live_`) key additionally authorizes server-side ingest (usage +
 * scores) and MUST be kept off the client. Because the stored SHA-256 hash binds
 * the WHOLE key string (prefix included), a `tk_pub_` key can't be presented as a
 * `tk_live_` one — the hash wouldn't resolve — so the prefix is a tamper-proof
 * scope marker with no schema change.
 */
export type KeyScope = "public" | "secret";

const PREFIX: Record<KeyScope, string> = { public: "tk_pub_", secret: "tk_live_" };
const PREFIX_DISPLAY_LEN = 12;
const CACHE_TTL_MS = 60_000;

/** Classify a presented (or stored-prefix) key by its prefix. Anything not
 *  starting with `tk_live_` is treated as `public` (the least-privileged class,
 *  which also keeps legacy/unknown-shaped keys out of secret-only routes). */
export function scopeForKey(keyOrPrefix: string): KeyScope {
  return keyOrPrefix.startsWith(PREFIX.secret) ? "secret" : "public";
}

export interface GeneratedKey {
  /** The full secret — shown to the developer exactly once. */
  key: string;
  /** First 12 chars, safe to store/display for identification. */
  prefix: string;
  /** SHA-256 hex of the full key (what we persist). */
  hash: string;
  /** The class this key was minted as (derivable from `prefix`). */
  scope: KeyScope;
}

/**
 * Mint `tk_pub_`/`tk_live_<32 random bytes base64url>` (per `scope`, default
 * publishable) and its stored hash + display prefix. Defaulting to `public`
 * means a key handed straight into a browser is the safe class by default.
 */
export async function generateApiKey(scope: KeyScope = "public"): Promise<GeneratedKey> {
  const key = PREFIX[scope] + randomToken(32);
  return { key, prefix: key.slice(0, PREFIX_DISPLAY_LEN), hash: await sha256Hex(key), scope };
}

interface CacheEntry {
  projectId: string | null;
  expiresAt: number;
}
// Per-isolate cache keyed by key hash. Revocations propagate within one TTL.
const cache = new Map<string, CacheEntry>();

/** Resolve an API key to its project id (null when unknown/revoked), cached ~60s. */
export async function resolveProjectId(db: D1Database, apiKey: string): Promise<string | null> {
  const hash = await sha256Hex(apiKey);
  const now = Date.now();
  const hit = cache.get(hash);
  if (hit && hit.expiresAt > now) return hit.projectId;
  const projectId = await projectIdForKeyHash(db, hash);
  cache.set(hash, { projectId, expiresAt: now + CACHE_TTL_MS });
  return projectId;
}

/** Test hook: clear the in-memory resolution cache. */
export function _clearKeyCache(): void {
  cache.clear();
}
