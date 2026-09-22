/**
 * Application-level content compatibility contract.
 *
 * `CONTENT_REVISION` changes when authored layout/rules content can no longer be
 * replayed safely by an older client. It is deliberately separate from the
 * room's `stateVersion`; deployments that change either contract advance both.
 */
export const CONTENT_REVISION = 4;

export const STABLE_CONTENT_IDS = {
  maps: ["arena1", "arena2", "arena3"],
  modes: ["tdm", "ffa", "dom", "practice"],
  weapons: [0, 1, 2, 3, 4],
} as const;

export const CONTENT_RELOAD_GUIDANCE =
  "GAME CONTENT UPDATED - RELOAD REQUIRED";

export type ContentMismatch = {
  readonly expected: number;
  readonly received: number | null;
  readonly action: "reload";
};

export function readContentRevision(payload: unknown): number | null {
  if (typeof payload !== "object" || payload === null || !("revision" in payload)) return null;
  return readContentRevisionValue(payload.revision);
}

export function readContentRevisionValue(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
