import { AGAR, MOVEMENT } from "./schemas.js";

export type ScenarioName = "agar" | "movement" | "ttt-json";

export const SCENARIO_NAMES: ScenarioName[] = ["agar", "movement", "ttt-json"];

export function isScenarioName(v: string): v is ScenarioName {
  return (SCENARIO_NAMES as string[]).includes(v);
}

/** Static, per-scenario wire + simulation parameters (derived, not serialized). */
export interface Scenario {
  name: ScenarioName;
  /** partyserver party (kebab-case of the DO binding). */
  party: string;
  /** True when authoritative state arrives as binary delta frames (tag 0x01/0x02). */
  binary: boolean;
  /** True when the room echoes an `s:ack` per processed input seq. */
  sendsAcks: boolean;
  /** Expected state-frame cadence in ms (for jitter), or null for mutation-only rooms. */
  expectedCadenceMs: number | null;
  /** Soft world bound the random walk stays inside. */
  world: number;
  /**
   * Max per-input displacement in world units. Kept under the room's speed
   * budget (maxSpeed × stepMs / 1000) with headroom so `validateMovement` does
   * not reject and snap the player back.
   */
  maxStep: number;
  /** True when the driver sends {x,y} "move" inputs each tick. */
  moves: boolean;
}

const SPEED_HEADROOM = 0.9;

export function getScenario(name: ScenarioName): Scenario {
  switch (name) {
    case "agar":
      return {
        name,
        party: "agar-room",
        binary: true,
        sendsAcks: true,
        expectedCadenceMs: AGAR.stepMs,
        world: AGAR.world,
        maxStep: (AGAR.maxSpeed * AGAR.stepMs) / 1000 * SPEED_HEADROOM,
        moves: true,
      };
    case "movement":
      return {
        name,
        party: "movement-room",
        binary: true,
        sendsAcks: true,
        expectedCadenceMs: MOVEMENT.stepMs,
        world: MOVEMENT.world,
        maxStep: (MOVEMENT.maxSpeed * MOVEMENT.stepMs) / 1000 * SPEED_HEADROOM,
        moves: true,
      };
    case "ttt-json":
      return {
        name,
        party: "tic-tac-toe",
        binary: false,
        sendsAcks: false,
        expectedCadenceMs: null,
        world: 0,
        maxStep: 0,
        moves: false,
      };
  }
}
