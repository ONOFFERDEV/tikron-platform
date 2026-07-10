/**
 * The loaded, validated `GameConfig` instance — the single, gated entry point
 * every room/client consumer reads its game identity from (wired in M4 W2/W3;
 * `modes.ts` is the deliberate exception, see `config/schema.ts`'s header).
 * Swapping the imported config for another `GameConfig` instance (e.g.
 * `neonstrike.config.ts`) re-themes the entire game — the M4 W3 gate proved a
 * swap passes every `[blueprint]`-tagged test unchanged.
 */
import { loadConfig } from "../config/load.js";
import { ironsightConfig } from "../config/ironsight.config.js";

export const GAME = loadConfig(ironsightConfig);
