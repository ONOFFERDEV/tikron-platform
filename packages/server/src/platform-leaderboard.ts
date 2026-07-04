import type { DefineRoomOptions } from "./define-room.js";

/** Options for {@link platformLeaderboard}. */
export interface PlatformLeaderboardOptions {
  /**
   * Resolve the project API key (`tk_live_...`) from the room's env. Return
   * `undefined` to disable leaderboard writes — the hook becomes a no-op — so a
   * game runs unchanged when no key is configured.
   */
  apiKey: (env: unknown) => string | undefined;
  /** Score-ingest endpoint. Defaults to the hosted Tikron platform. */
  endpoint?: string;
}

/** The hosted Tikron score-ingest endpoint. */
const DEFAULT_ENDPOINT = "https://tikron.dev/api/ingest/score";

/**
 * Build a {@link DefineRoomOptions.services}.`submitScore` hook that records a
 * self-hosted room's leaderboard scores on the Tikron platform, so a game hosted
 * on the developer's OWN Cloudflare account writes to the hosted leaderboards
 * exactly like a gateway-hosted room. The twin of {@link platformReporter} for
 * occupancy.
 *
 * ```ts
 * defineRoom(MyRoom, {
 *   services: { submitScore: platformLeaderboard({ apiKey: (env) => (env as Env).TIKRON_API_KEY }) },
 * });
 * ```
 *
 * Behavior:
 * - **No key → no-op.** When `apiKey(env)` is undefined the submit is dropped, so
 *   a game runs with no platform coupling until a `tk_live_` key is set.
 * - **Best-effort.** The POST is fire-and-forget and can never throw into the
 *   room — a failing leaderboard write must not break gameplay.
 * - **Keeps one clue.** If the ingest endpoint answers `4xx` (a wrong/`tk_pub_`
 *   key, a bad endpoint, or a board cap), it logs `console.warn` ONCE — enough to
 *   let an AI agent debug "my scores aren't showing up" without spamming the log.
 *
 * Attribution is by the `tk_live_` key alone; the `projectId` the host threads in
 * (null for self-hosted rooms) is ignored — identical to the occupancy reporter.
 */
export function platformLeaderboard(
  options: PlatformLeaderboardOptions,
): NonNullable<NonNullable<DefineRoomOptions["services"]>["submitScore"]> {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  // One-shot so a persistently misconfigured key doesn't flood the log with a
  // warning on every score; the first clue is the one that matters.
  let warned4xx = false;

  return (env, entry) => {
    const apiKey = options.apiKey(env);
    if (!apiKey) return; // no key → leaderboard writes disabled

    const body = JSON.stringify({
      board: entry.board,
      playerId: entry.playerId,
      score: entry.score,
      displayName: entry.displayName,
      mode: entry.mode,
    });
    try {
      const res = fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body,
      });
      void Promise.resolve(res)
        .then((r) => {
          if (!warned4xx && r && r.status >= 400 && r.status < 500) {
            warned4xx = true;
            console.warn(
              `[tikron] platformLeaderboard: score ingest was rejected with ${r.status} at ${endpoint}. ` +
                "Scores are NOT being recorded. Likely causes: the key is not a tk_live_ secret key " +
                "(ingest requires one, kept server-side), a wrong endpoint, or a leaderboard cap. " +
                "Fix: check TIKRON_API_KEY. This warns once.",
            );
          }
        })
        .catch(() => {});
    } catch {
      // fetch threw synchronously (e.g. unavailable) — a leaderboard write must
      // never throw into the room.
    }
  };
}
