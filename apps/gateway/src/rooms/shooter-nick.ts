/**
 * Player nickname sanitization for the FPS demo — pure and server-import-free so
 * the room wires it up and the unit tests exercise it directly.
 *
 * The nick is client-supplied and flows to the public leaderboard as a display
 * name, so it is untrusted input: anything non-string is rejected, control
 * characters are stripped (they would corrupt a rendered scoreboard), ends are
 * trimmed, and the result is clamped to {@link MAX_NICK_LEN}. An input that
 * sanitizes to empty yields `null` — the caller keeps the previous nick / falls
 * back to a player-id stub rather than storing a blank.
 */

/** Longest stored nickname; longer inputs are clamped to this many characters. */
export const MAX_NICK_LEN = 20;

/** A C0 control (incl. tab/newline), DEL, or a C1 control — never valid in a name. */
function isControl(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

/**
 * Normalize an untrusted `nick` message payload to a safe stored nickname, or
 * `null` when it is not a usable string (wrong type, or empty after cleaning).
 */
export function sanitizeNick(payload: unknown): string | null {
  if (typeof payload !== "string") return null;
  let stripped = "";
  for (const ch of payload) {
    if (!isControl(ch.codePointAt(0)!)) stripped += ch;
  }
  const cleaned = stripped.trim().slice(0, MAX_NICK_LEN);
  return cleaned.length > 0 ? cleaned : null;
}
