/**
 * The player color palette — the shared contract between server and client.
 *
 * The room assigns each player a stable palette *index* (see {@link colorFor}) and
 * stores only that integer in state; the browser maps the index back to a hex color
 * when rendering. Keeping the palette in one dependency-free module (no server or DOM
 * imports) lets both sides import it without the client bundle pulling in room code.
 */
export const PALETTE = [
  "#5865F2", // blurple
  "#57F287", // green
  "#FEE75C", // yellow
  "#EB459E", // fuchsia
  "#ED4245", // red
  "#3BA55D", // dark green
  "#FAA61A", // orange
  "#00B0F4", // blue
] as const;

/** Stable palette index for a client id (same id → same color across reconnects). */
export function colorFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}
