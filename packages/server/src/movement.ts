/**
 * @deprecated Moved to `@tikron/sim` so the client can import the SAME movement
 * math the server validates against (shared, isomorphic, zero-dep). Import from
 * `@tikron/sim` instead; this re-export is kept for backward compatibility.
 */
export { validateMovement } from "@tikron/sim";
export type { Vec2, MovementConfig, MovementResult } from "@tikron/sim";
