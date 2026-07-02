import type { DefineRoomOptions, OccupancyReport } from "./define-room.js";

/** Options for {@link platformReporter}. */
export interface PlatformReporterOptions {
  /**
   * Resolve the project API key (`tk_live_...`) from the room's env. Return
   * `undefined` to disable reporting — the reporter becomes a no-op — so a game
   * runs unchanged when no key is configured.
   */
  apiKey: (env: unknown) => string | undefined;
  /** Ingest endpoint. Defaults to the hosted Tikron dashboard. */
  endpoint?: string;
}

/** The hosted Tikron usage-ingest endpoint. */
const DEFAULT_ENDPOINT = "https://tikron.dev/api/ingest/occupancy";
/** At most one report per room per this interval (except first + final). */
const THROTTLE_MS = 10_000;

/**
 * Build a {@link DefineRoomOptions.reportOccupancy} hook that reports a
 * self-hosted room's live occupancy to the Tikron platform, so a game hosted on
 * the developer's OWN Cloudflare account is metered on the hosted dashboard
 * exactly like a gateway-hosted room.
 *
 * ```ts
 * defineRoom(MyRoom, {
 *   reportOccupancy: platformReporter({ apiKey: (env) => (env as Env).TIKRON_API_KEY }),
 * });
 * ```
 *
 * Behavior:
 * - **No key → no-op.** When `apiKey(env)` is undefined the report is dropped, so
 *   a game runs with no platform coupling until a key is set.
 * - **Throttled.** At most one POST per room per {@link THROTTLE_MS}, EXCEPT the
 *   first report for a room and every `count === 0` report (final leave — it
 *   closes the room-hours accrual), which always send.
 * - **Best-effort.** The POST is fire-and-forget and every error is swallowed —
 *   reporting can never break a room.
 *
 * Throttle state is a `Map` keyed by roomId, created once when the reporter is
 * built (at module load, in the `defineRoom` wiring) and living for the DO
 * isolate's lifetime. It is intentionally isolate-local (not durable): an
 * eviction resets it, costing at most one extra report after a cold start.
 */
export function platformReporter(
  options: PlatformReporterOptions,
): NonNullable<DefineRoomOptions["reportOccupancy"]> {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const lastSentAt = new Map<string, number>();

  return (env, report) => {
    const apiKey = options.apiKey(env);
    if (!apiKey) return; // no key → reporting disabled

    const now = Date.now();
    const isFinal = report.count === 0;
    const prev = lastSentAt.get(report.roomId);
    // Throttle only established, non-final reports. A first report (prev
    // undefined) and every final (count 0) report always send.
    if (prev !== undefined && !isFinal && now - prev < THROTTLE_MS) return;

    if (isFinal) lastSentAt.delete(report.roomId); // room closed → a re-open reports immediately
    else lastSentAt.set(report.roomId, now);

    send(endpoint, apiKey, report);
  };
}

/** Fire-and-forget POST; swallows every error (synchronous throw or rejection). */
function send(endpoint: string, apiKey: string, report: OccupancyReport): void {
  const body = JSON.stringify({
    roomId: report.roomId,
    count: report.count,
    sessions: report.sessions,
    seq: report.seq,
    messages: report.messages,
  });
  try {
    const res = fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body,
    });
    void Promise.resolve(res).catch(() => {});
  } catch {
    // fetch threw synchronously (e.g. unavailable) — reporting must never throw.
  }
}
