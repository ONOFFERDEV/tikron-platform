import type { ModeId } from "../../src/modes.js";
import { preparationStageLabel } from "./copy.js";

export type PlayerFlowState =
  | { readonly kind: "menu" }
  | { readonly kind: "connecting"; readonly attempt: number }
  | { readonly kind: "preparing"; readonly stage: string }
  | { readonly kind: "recovery"; readonly stage: string; readonly reason: string }
  | { readonly kind: "control-required"; readonly retry: boolean }
  | { readonly kind: "warmup"; readonly seconds: number | null }
  | { readonly kind: "active" }
  | { readonly kind: "reloading"; readonly label: string }
  | { readonly kind: "training"; readonly step: string }
  | { readonly kind: "gameplay-menu" }
  | { readonly kind: "settings"; readonly captureAction: string | null; readonly saveFailed: boolean }
  | { readonly kind: "dead"; readonly redeploySeconds: number | null }
  | { readonly kind: "awaiting-results" }
  | { readonly kind: "results" }
  | { readonly kind: "reconnecting" }
  | { readonly kind: "expired" };

export type PlayerFlowEvent =
  | { readonly type: "return-to-menu" }
  | { readonly type: "connect-requested" }
  | { readonly type: "connected"; readonly preparationStage: string }
  | { readonly type: "preparation-stage"; readonly stage: string }
  | { readonly type: "preparation-complete" }
  | { readonly type: "preparation-failed"; readonly stage: string; readonly reason: string }
  | { readonly type: "retry-requested" }
  | { readonly type: "control-acquired" }
  | { readonly type: "control-lost"; readonly rejected: boolean }
  | { readonly type: "warmup-updated"; readonly seconds: number | null }
  | { readonly type: "match-live" }
  | { readonly type: "reload-started"; readonly label: string }
  | { readonly type: "reload-ended" }
  | { readonly type: "training-step"; readonly step: string }
  | { readonly type: "gameplay-menu-opened" }
  | { readonly type: "settings-opened" }
  | { readonly type: "binding-capture-changed"; readonly action: string | null }
  | { readonly type: "settings-save-failed" }
  | { readonly type: "settings-save-recovered" }
  | { readonly type: "overlay-closed" }
  | { readonly type: "player-died"; readonly redeploySeconds: number | null }
  | { readonly type: "player-respawned" }
  | { readonly type: "results-pending" }
  | { readonly type: "results-received" }
  | { readonly type: "round-reset"; readonly live: boolean }
  | { readonly type: "reconnecting" }
  | { readonly type: "reconnected"; readonly live: boolean }
  | { readonly type: "connection-expired" };

const isControlState = (state: PlayerFlowState): boolean =>
  state.kind === "active" || state.kind === "warmup" || state.kind === "training" || state.kind === "reloading";

export function playerFlowReducer(state: PlayerFlowState, event: PlayerFlowEvent): PlayerFlowState {
  switch (event.type) {
    case "return-to-menu": return { kind: "menu" };
    case "connect-requested":
      return state.kind === "connecting" ? state : { kind: "connecting", attempt: 1 };
    case "connected":
      return state.kind === "connecting" || state.kind === "reconnecting"
        ? { kind: "preparing", stage: event.preparationStage }
        : state;
    case "preparation-stage":
      return state.kind === "preparing" && state.stage !== event.stage ? { kind: "preparing", stage: event.stage } : state;
    case "preparation-complete":
      return state.kind === "preparing" ? { kind: "control-required", retry: false } : state;
    case "preparation-failed":
      return state.kind === "preparing"
        ? { kind: "recovery", stage: event.stage, reason: event.reason }
        : state;
    case "retry-requested":
      return state.kind === "recovery" ? { kind: "preparing", stage: state.stage } : state;
    case "control-acquired":
      return state.kind === "control-required" || state.kind === "gameplay-menu" ? { kind: "active" } : state;
    case "control-lost":
      if (!(isControlState(state) || state.kind === "control-required")) return state;
      const retry = event.rejected || state.kind === "control-required" && state.retry;
      return state.kind === "control-required" && state.retry === retry ? state : { kind: "control-required", retry };
    case "warmup-updated": {
      if (!isControlState(state)) return state;
      const seconds = finiteSeconds(event.seconds);
      return state.kind === "warmup" && state.seconds === seconds ? state : { kind: "warmup", seconds };
    }
    case "match-live":
      return state.kind === "active" ? state : state.kind === "warmup" || isControlState(state) ? { kind: "active" } : state;
    case "reload-started":
      return state.kind === "active" ? { kind: "reloading", label: event.label } : state;
    case "reload-ended":
      return state.kind === "reloading" ? { kind: "active" } : state;
    case "training-step":
      return isControlState(state) ? { kind: "training", step: event.step } : state;
    case "gameplay-menu-opened":
      return isControlState(state) || state.kind === "control-required" ? { kind: "gameplay-menu" } : state;
    case "settings-opened":
      return state.kind === "gameplay-menu" || state.kind === "menu"
        ? { kind: "settings", captureAction: null, saveFailed: false }
        : state;
    case "binding-capture-changed":
      return state.kind === "settings" ? { ...state, captureAction: event.action } : state;
    case "settings-save-failed":
      return state.kind === "settings" ? { ...state, saveFailed: true } : state;
    case "settings-save-recovered":
      return state.kind === "settings" ? { ...state, saveFailed: false } : state;
    case "overlay-closed":
      return state.kind === "settings" || state.kind === "gameplay-menu" ? { kind: "control-required", retry: false } : state;
    case "player-died":
      return state.kind === "expired" || state.kind === "reconnecting" ? state : { kind: "dead", redeploySeconds: finiteSeconds(event.redeploySeconds) };
    case "player-respawned":
      return state.kind === "dead" ? { kind: "control-required", retry: false } : state;
    case "results-pending":
      return state.kind === "expired" || state.kind === "reconnecting" ? state : { kind: "awaiting-results" };
    case "results-received":
      return state.kind === "expired" || state.kind === "reconnecting" ? state : { kind: "results" };
    case "round-reset":
      return state.kind === "results" || state.kind === "awaiting-results"
        ? event.live ? { kind: "active" } : { kind: "warmup", seconds: null }
        : state;
    case "reconnecting": return state.kind === "expired" || state.kind === "reconnecting" ? state : { kind: "reconnecting" };
    case "reconnected":
      return state.kind === "reconnecting" ? event.live ? { kind: "active" } : { kind: "warmup", seconds: null } : state;
    case "connection-expired": return state.kind === "expired" ? state : { kind: "expired" };
  }
}

function finiteSeconds(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.max(0, value);
}

export function overlayForFlowState(state: PlayerFlowState):
  "expired" | "recovery" | "results" | "results-wait" | "death" | "settings" | "menu" | "control" | null {
  switch (state.kind) {
    case "expired": return "expired";
    case "recovery":
    case "reconnecting": return "recovery";
    case "results": return "results";
    case "awaiting-results": return "results-wait";
    case "dead": return "death";
    case "settings": return "settings";
    case "menu":
    case "gameplay-menu": return "menu";
    case "connecting":
    case "preparing":
    case "control-required": return "control";
    case "warmup":
    case "active":
    case "reloading":
    case "training": return null;
  }
}

export function blocksGameplayInput(state: PlayerFlowState): boolean {
  return !(state.kind === "active" || state.kind === "warmup" || state.kind === "reloading" || state.kind === "training");
}

export interface DeploymentFlowContent {
  readonly eyebrow: string;
  readonly title: string;
  readonly detail: string;
  readonly stage: string | null;
  readonly actions: "none" | "retry" | "retry-menu";
}

export function deploymentFlowContent(state: PlayerFlowState): DeploymentFlowContent | null {
  switch (state.kind) {
    case "connecting": return { eyebrow: "연결", title: "전장에 연결 중", detail: "빈 자리를 확인하고 분대에 합류합니다.", stage: `연결 시도 ${state.attempt}`, actions: "none" };
    case "preparing": return { eyebrow: "출격 준비", title: "전장을 준비 중", detail: "필요한 전장 요소를 확인하고 있습니다.", stage: preparationStageLabel(state.stage), actions: "none" };
    case "recovery": return { eyebrow: "준비 실패", title: "전장을 준비하지 못했습니다", detail: "전장 요소를 불러오지 못했습니다. 다시 시도하거나 출격 메뉴로 돌아가세요.", stage: preparationStageLabel(state.stage), actions: "retry-menu" };
    case "control-required": return { eyebrow: "마우스 제어", title: state.retry ? "다시 눌러 전장으로 복귀" : "클릭하여 출격", detail: state.retry ? "브라우저가 마우스 제어 요청을 거부했습니다." : "준비가 끝났습니다. 마우스 제어를 시작하세요.", stage: null, actions: "retry" };
    case "reconnecting": return { eyebrow: "연결 복구", title: "전장에 다시 연결 중", detail: "자리를 유지한 채 서버 응답을 기다립니다.", stage: null, actions: "none" };
    case "expired": return { eyebrow: "연결 종료", title: "전장 연결이 만료되었습니다", detail: "새 전장에 합류하려면 출격 메뉴로 돌아가세요.", stage: null, actions: "retry-menu" };
    default: return null;
  }
}
export type DeploymentSiteId = "arena1" | "arena2" | "arena3";

export interface DeploymentSelection {
  readonly mode: ModeId | null;
  readonly trainingSite: DeploymentSiteId;
}

export function readDeploymentSelection(search: string): DeploymentSelection {
  const params = new URLSearchParams(search);
  const requestedMode = params.get("mode");
  const mode = requestedMode === "tdm" || requestedMode === "ffa" || requestedMode === "dom" || requestedMode === "practice"
    ? requestedMode
    : null;
  const requestedMap = params.get("map");
  const trainingSite = mode === "practice" && (requestedMap === "arena2" || requestedMap === "arena3")
    ? requestedMap
    : "arena1";
  return { mode, trainingSite };
}
