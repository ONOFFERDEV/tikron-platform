export interface JourneyObservation {
  readonly authority: "trusted-input" | "synthetic-inspector" | "none";
  readonly attemptComplete: boolean;
  readonly passed?: boolean;
  readonly reason?: string;
}

export interface JourneyCase {
  readonly id: string;
  readonly verdict: "PASS" | "FAIL" | "UNQUALIFIED";
  readonly reasons: readonly { readonly code: string; readonly detail: string | null }[];
  readonly observations: JourneyObservation;
  readonly artifacts: readonly unknown[];
}

export function qualifyJourneyCase(id: string, observation: JourneyObservation, artifacts?: readonly unknown[]): JourneyCase;
export interface ComposedScenario {
  readonly id: string;
  readonly cases: readonly { readonly id: string; readonly verdict: "PASS" | "FAIL" | "UNQUALIFIED"; readonly artifacts: readonly { readonly path: string; readonly bytes: number }[] }[];
  readonly inputProvenance?: string;
}
export function summarizeJourneyComposition(completed: readonly ComposedScenario[], requiredIds: readonly string[]): {
  readonly missing: readonly string[];
  readonly failed: readonly string[];
  readonly unqualified: readonly string[];
  readonly artifacts: readonly { readonly path: string; readonly bytes: number }[];
  readonly liveJourneys: boolean;
  readonly liveAudio: boolean;
  readonly caseCount: number;
};
export const scenarioHandlers: Readonly<Record<"ui-training" | "ui-results" | "final-player-journey", (context: unknown) => Promise<unknown>>>;
