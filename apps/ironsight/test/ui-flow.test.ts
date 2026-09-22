import { describe, expect, it } from "vitest";
import {
  blocksGameplayInput,
  deploymentFlowContent,
  overlayForFlowState,
  playerFlowReducer,
  readDeploymentSelection,
  type PlayerFlowState,
} from "../client/ui/flow-state.js";

describe("deployment flow state", () => {
  it("resolves all modes and only the three training destinations from direct URLs", () => {
    expect(["tdm", "ffa", "dom", "practice"].map(mode => readDeploymentSelection(`?mode=${mode}`).mode))
      .toEqual(["tdm", "ffa", "dom", "practice"]);
    expect(["arena1", "arena2", "arena3"].map(map =>
      readDeploymentSelection(`?mode=practice&map=${map}`).trainingSite))
      .toEqual(["arena1", "arena2", "arena3"]);
    expect(readDeploymentSelection("?mode=tdm&map=arena3").trainingSite).toBe("arena1");
    expect(readDeploymentSelection("?mode=unknown&map=arena2")).toEqual({ mode: null, trainingSite: "arena1" });
  });

  it("does not report ready before preparation and real pointer control complete", () => {
    let state: PlayerFlowState = { kind: "menu" };
    state = playerFlowReducer(state, { type: "connect-requested" });
    expect(state).toEqual({ kind: "connecting", attempt: 1 });
    expect(blocksGameplayInput(state)).toBe(true);

    const duplicate = playerFlowReducer(state, { type: "connect-requested" });
    expect(duplicate).toBe(state);
    state = playerFlowReducer(state, { type: "connected", preparationStage: "scene" });
    state = playerFlowReducer(state, { type: "preparation-complete" });
    expect(state).toEqual({ kind: "control-required", retry: false });
    expect(overlayForFlowState(state)).toBe("control");

    state = playerFlowReducer(state, { type: "control-lost", rejected: true });
    expect(state).toEqual({ kind: "control-required", retry: true });
    state = playerFlowReducer(state, { type: "control-acquired" });
    expect(state).toEqual({ kind: "active" });
    expect(blocksGameplayInput(state)).toBe(false);
  });

  it("keeps warmup zero waiting until the authoritative live event", () => {
    const waiting = playerFlowReducer({ kind: "warmup", seconds: 1 }, {
      type: "warmup-updated",
      seconds: 0,
    });
    expect(waiting).toEqual({ kind: "warmup", seconds: 0 });
    expect(overlayForFlowState(waiting)).toBeNull();
    expect(playerFlowReducer(waiting, { type: "match-live" })).toEqual({ kind: "active" });
    expect(playerFlowReducer({ kind: "active" }, { type: "warmup-updated", seconds: Number.NaN }))
      .toEqual({ kind: "warmup", seconds: null });
  });

  it("exposes preparation failure recovery without inventing progress", () => {
    const preparing: PlayerFlowState = { kind: "preparing", stage: "weapons-and-effects" };
    const failed = playerFlowReducer(preparing, {
      type: "preparation-failed",
      stage: "weapons-and-effects",
      reason: "asset request failed",
    });
    expect(failed).toEqual({
      kind: "recovery",
      stage: "weapons-and-effects",
      reason: "asset request failed",
    });
    expect(overlayForFlowState(failed)).toBe("recovery");
    const content = deploymentFlowContent(failed);
    expect(content).toMatchObject({
      actions: "retry-menu",
      stage: "무기와 전투 효과 준비",
      detail: "전장 요소를 불러오지 못했습니다. 다시 시도하거나 출격 메뉴로 돌아가세요.",
    });
    expect(JSON.stringify(content)).not.toContain("weapons-and-effects");
    expect(deploymentFlowContent({ kind: "preparing", stage: "future-internal-stage" }))
      .toMatchObject({ stage: "전장 요소 확인 중" });
    expect(JSON.stringify(content)).not.toMatch(/\b\d{1,3}%/);
    expect(playerFlowReducer(failed, { type: "retry-requested" })).toEqual({
      kind: "preparing",
      stage: "weapons-and-effects",
    });
  });

  it("keeps reconnect and expiry blocking until a confirmed room state returns", () => {
    let state: PlayerFlowState = { kind: "active" };
    state = playerFlowReducer(state, { type: "reconnecting" });
    expect(overlayForFlowState(state)).toBe("recovery");
    expect(blocksGameplayInput(state)).toBe(true);
    state = playerFlowReducer(state, { type: "connection-expired" });
    expect(overlayForFlowState(state)).toBe("expired");
    expect(playerFlowReducer(state, { type: "reconnected", live: false })).toBe(state);
    expect(playerFlowReducer(state, { type: "player-died", redeploySeconds: 1 })).toBe(state);
    expect(playerFlowReducer(state, { type: "results-received" })).toBe(state);
    expect(playerFlowReducer(state, { type: "return-to-menu" })).toEqual({ kind: "menu" });
  });

  it("ignores stale completion events from the wrong lifecycle phase", () => {
    const connecting: PlayerFlowState = { kind: "connecting", attempt: 1 };
    expect(playerFlowReducer(connecting, { type: "preparation-complete" })).toBe(connecting);
    const results: PlayerFlowState = { kind: "results" };
    expect(playerFlowReducer(results, { type: "control-acquired" })).toBe(results);
    expect(overlayForFlowState(playerFlowReducer(results, { type: "connection-expired" }))).toBe("expired");
    const menu = playerFlowReducer({ kind: "active" }, { type: "gameplay-menu-opened" });
    expect(playerFlowReducer(menu, { type: "control-lost", rejected: false })).toBe(menu);
  });

  it("leaves death and results only on authoritative respawn or round phase changes", () => {
    expect(playerFlowReducer({ kind: "dead", redeploySeconds: 0 }, { type: "player-respawned" }))
      .toEqual({ kind: "control-required", retry: false });
    expect(playerFlowReducer({ kind: "results" }, { type: "round-reset", live: false }))
      .toEqual({ kind: "warmup", seconds: null });
    expect(playerFlowReducer({ kind: "awaiting-results" }, { type: "round-reset", live: true }))
      .toEqual({ kind: "active" });
    const active: PlayerFlowState = { kind: "active" };
    expect(playerFlowReducer(active, { type: "player-respawned" })).toBe(active);
  });
});
