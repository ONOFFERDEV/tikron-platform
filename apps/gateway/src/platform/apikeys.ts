import { randomToken, sha256Hex } from "./crypto.js";
import { projectIdForKeyHash } from "./db.js";

const KEY_PREFIX = "tk_live_";
const PREFIX_DISPLAY_LEN = 12;
const CACHE_TTL_MS = 60_000;

export interface GeneratedKey {
  /** The full secret — shown to the developer exactly once. */
  key: string;
  /** First 12 chars, safe to store/display for identification. */
  prefix: string;
  /** SHA-256 hex of the full key (what we persist). */
  hash: string;
}

/** Mint `tk_live_<32 random bytes base64url>` and its stored hash + display prefix. */
export async function generateApiKey(): Promise<GeneratedKey> {
  const key = KEY_PREFIX + randomToken(32);
  return { key, prefix: key.slice(0, PREFIX_DISPLAY_LEN), hash: await sha256Hex(key) };
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
