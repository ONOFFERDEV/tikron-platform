/**
 * Client-only tunables (feel + presentation). Everything that affects the
 * simulation lives on the server side and is imported from `../src/config.js`
 * (the single source of truth); this module holds ONLY values the server never
 * sees — mouse feel, interpolation delay, correction thresholds, and colours.
 */

/** Mouse look sensitivity (rad per pixel of pointer-lock movement). */
export const MOUSE_SENSITIVITY = 0.0022;
/** Invert the vertical look axis. */
export const INVERT_Y = false;

/**
 * Input rate budget (server caps at 90/s — see the room's `maxInputsPerSecond`).
 * look ~30/s + fire ≤10/s + move-on-change ~8/s stays comfortably under it.
 */
export const LOOK_SEND_MS = 33; // ≈30 look updates/s while turning
export const MOVE_KEEPALIVE_MS = 250; // resend held intent even without a change (≈4/s insurance)

/** Remote-player interpolation delay (render others ~this far in the past). */
export const INTERP_DELAY_MS = 100;

/**
 * Local-player prediction reconciliation. Both sides run the SAME integrator from
 * the SAME intent, so drift is small: below `SOFT` we trust the local prediction
 * (crisp, zero input lag), above it we nudge a fraction toward the server each
 * frame, and a gap past `SNAP` is a teleport/respawn and cuts straight.
 */
export const RECONCILE_SOFT_M = 0.15; // below this, ignore the server echo entirely
export const RECONCILE_SNAP_M = 2.5; // above this, snap (respawn / hard desync)
export const RECONCILE_FRAC = 0.2; // per-state fraction of the error to absorb
export const RECONCILE_TAU_MS = 80; // render-offset decay time constant

/** Team tints (0 = red, 1 = blue — matches TEAM in the server config). */
export const TEAM_COLOR = [0xe8563a, 0x3a7ce8] as const;
export const TEAM_COLOR_DIM = [0x7a2c20, 0x1f3f78] as const;
