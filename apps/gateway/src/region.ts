/**
 * Region placement hints for matchmaking.
 *
 * A Durable Object is created near whoever first addresses it, and stays there.
 * For a room that should live near its players (e.g. all in one geography), the
 * matchmaker records a Cloudflare `locationHint` at reservation time; the gateway
 * then passes it to `routePartykitRequest` on the FIRST connect, which forwards
 * it to `DurableObjectNamespace.get(id, { locationHint })`. The hint only affects
 * the instance that CREATES the DO — later connects with a different hint are
 * ignored by the platform — so it must ride the room's first-contact request.
 *
 * Placement itself is not observable locally (one workerd process), only the
 * plumbing: an invalid hint is rejected at matchmake time, a valid one is echoed
 * back for the client to forward and applied on connect.
 */

/**
 * Accepted Cloudflare location hints. A subset of `DurableObjectLocationHint`
 * (the platform also has `sam`, `apac-ne`, `apac-se`, which are intentionally
 * excluded from the public surface for now — add them here to accept them).
 */
export const LOCATION_HINTS = [
  "wnam",
  "enam",
  "weur",
  "eeur",
  "apac",
  "oc",
  "afr",
  "me",
] as const;

export type LocationHint = (typeof LOCATION_HINTS)[number];

/** Comma-joined list for agent-friendly validation errors. */
export const LOCATION_HINTS_LIST = LOCATION_HINTS.join(", ");

const HINT_SET = new Set<string>(LOCATION_HINTS);

/** Whether `value` is one of the accepted location hints. */
export function isLocationHint(value: string): value is LocationHint {
  return HINT_SET.has(value);
}

/**
 * The validated placement hint on a connect URL (`?region=`), or undefined when
 * absent/invalid. Invalid hints are ignored here (silently → default placement)
 * rather than failing the connect; validation with an error happens at the
 * `/api/matchmake` boundary, where an agent can act on the message.
 */
export function resolveLocationHint(url: URL): LocationHint | undefined {
  const region = url.searchParams.get("region");
  return region && isLocationHint(region) ? region : undefined;
}
