import { describe, it, expect } from "vitest";
import { LoadingFlow, type StageDef } from "../demo/loading.js";

const STAGES: StageDef[] = [
  { id: "assets", label: "Loading assets", weight: 3 },
  { id: "matchmake", label: "Finding a match", weight: 1 },
];

describe("LoadingFlow (shooter demo loading state machine)", () => {
  it("starts idle at zero and activates the first stage on start()", () => {
    const flow = new LoadingFlow(STAGES);
    expect(flow.view().status).toBe("idle");
    expect(flow.view().progress).toBe(0);

    flow.start();
    const v = flow.view();
    expect(v.status).toBe("loading");
    expect(v.stages[0]!.status).toBe("active");
    expect(v.stages[1]!.status).toBe("pending");
    expect(v.label).toBe("Loading assets");
  });

  it("blends stage progress by weight", () => {
    const flow = new LoadingFlow(STAGES);
    flow.start();

    // Half of the 3-weight asset stage → 0.5 * 3 / 4 = 0.375 overall.
    flow.setProgress("assets", 0.5);
    expect(flow.view().progress).toBeCloseTo(0.375, 5);

    // Completing the heavy stage advances to the light one at 3/4 overall.
    flow.complete("assets");
    const v = flow.view();
    expect(v.progress).toBeCloseTo(0.75, 5);
    expect(v.stages[1]!.status).toBe("active");
    expect(v.label).toBe("Finding a match");
  });

  it("reaches done at full progress when every stage completes", () => {
    const flow = new LoadingFlow(STAGES);
    flow.start();
    flow.complete("assets");
    flow.complete("matchmake");
    const v = flow.view();
    expect(v.status).toBe("done");
    expect(v.progress).toBe(1);
    expect(v.label).toBe("Ready");
  });

  it("surfaces a failure and its message, then reset()s back to idle", () => {
    const flow = new LoadingFlow(STAGES);
    flow.start();
    flow.setProgress("assets", 1);
    flow.complete("assets");
    flow.fail("matchmake", "matchmake failed: HTTP 503");

    const failed = flow.view();
    expect(failed.status).toBe("error");
    expect(failed.error).toBe("matchmake failed: HTTP 503");
    expect(failed.failedStage).toBe("matchmake");
    // Progress holds at the completed-asset fraction (0.75) while errored.
    expect(failed.progress).toBeCloseTo(0.75, 5);

    flow.reset();
    const cleared = flow.view();
    expect(cleared.status).toBe("idle");
    expect(cleared.progress).toBe(0);
    expect(cleared.error).toBeUndefined();
  });

  it("notifies subscribers on every transition", () => {
    const flow = new LoadingFlow(STAGES);
    const seen: number[] = [];
    flow.onChange((v) => seen.push(v.progress));
    flow.start();
    flow.setProgress("assets", 0.5);
    flow.complete("assets");
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(seen[seen.length - 1]).toBeCloseTo(0.75, 5);
  });
});
