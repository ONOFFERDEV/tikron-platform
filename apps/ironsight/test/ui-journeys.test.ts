import { describe, expect, it } from "vitest";
import { qualifyJourneyCase, scenarioHandlers, summarizeJourneyComposition } from "../scripts/aside-scenarios/ui-journeys.mjs";

describe("Aside player-journey qualification", () => {
  it("exports the two canonical scenario handlers", () => {
    expect(Object.keys(scenarioHandlers)).toEqual(["ui-training", "ui-results", "final-player-journey"]);
  });

  it("never upgrades synthetic inspector state to a real journey pass", () => {
    const result = qualifyJourneyCase("layout", {
      authority: "synthetic-inspector",
      attemptComplete: true,
      passed: true,
    }, [{ path: "layout.png", bytes: 1 }]);
    expect(result.verdict).toBe("UNQUALIFIED");
  });

  it("requires a completed trusted-input attempt and a captured artifact", () => {
    expect(qualifyJourneyCase("missing-input", { authority: "none", attemptComplete: false }).verdict).toBe("UNQUALIFIED");
    expect(qualifyJourneyCase("missing-artifact", { authority: "trusted-input", attemptComplete: true, passed: true }).verdict).toBe("UNQUALIFIED");
    expect(qualifyJourneyCase("observed", { authority: "trusted-input", attemptComplete: true, passed: true }, [{ path: "state.png", bytes: 1 }]).verdict).toBe("PASS");
  });

  it("reports an observed mismatch as failure only after the real attempt completes", () => {
    const result = qualifyJourneyCase("mismatch", {
      authority: "trusted-input",
      attemptComplete: true,
      passed: false,
      reason: "authoritative_state_mismatch",
    }, [{ path: "state.png", bytes: 1 }]);
    expect(result).toMatchObject({ verdict: "FAIL", reasons: [{ code: "authoritative_state_mismatch" }] });
  });

  it("keeps final composition unqualified until every required real journey and live WAV exists", () => {
    const passCase = (id: string, path: string) => ({ id, verdict: "PASS" as const, artifacts: [{ path, bytes: 10 }] });
    const incomplete = summarizeJourneyComposition([
      { id: "ui-training", inputProvenance: "Aside trusted input", cases: [passCase("training", "training.png")] },
    ], ["ui-training", "ui-results", "perf-audio-combat"]);
    expect(incomplete).toMatchObject({ missing: ["ui-results", "perf-audio-combat"], liveJourneys: false, liveAudio: false });

    const complete = summarizeJourneyComposition([
      { id: "ui-training", inputProvenance: "Aside trusted input", cases: [passCase("training", "training.png")] },
      { id: "ui-results", inputProvenance: "Aside actual input", cases: [passCase("results", "results.png")] },
      { id: "perf-audio-combat", inputProvenance: "Aside live AudioContext", cases: [passCase("audio", "mix.wav")] },
    ], ["ui-training", "ui-results", "perf-audio-combat"]);
    expect(complete).toMatchObject({ missing: [], failed: [], unqualified: [], liveJourneys: true, liveAudio: true, caseCount: 3 });
  });
});
