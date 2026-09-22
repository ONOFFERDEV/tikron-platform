import { FIELD_UI_COPY } from "./copy.js";
import type { CombatHudSnapshot, ObjectiveOwner, ObjectiveStatus } from "./combat-hud.js";

export type CombatHudViewModel = {
  readonly events: readonly string[];
  readonly objectives: readonly { readonly id: string; readonly label: string; readonly owner: ObjectiveOwner }[];
  readonly reload: string;
  readonly telemetry: string;
  readonly telemetryReady: boolean;
};

const ownerText: Readonly<Record<ObjectiveOwner, string>> = { friendly: "아군", enemy: "적군", neutral: "미점령" };
const statusText: Readonly<Record<ObjectiveStatus, string>> = { stable: "확보", capturing: "점령 중", contested: "경합" };

export function combatHudViewModel(snapshot: CombatHudSnapshot): CombatHudViewModel {
  const reload = snapshot.reload.status === "active" ? "재장전 · 진행 중"
    : snapshot.reload.status === "interrupted" ? "재장전 · 중단" : "";
  const telemetryReady = snapshot.latency.status === "ready";
  return {
    events: snapshot.events.map(event => event.text),
    objectives: snapshot.objectives.map(objective => ({ id: objective.id, label: `${ownerText[objective.owner]} · ${statusText[objective.status]}`, owner: objective.owner })),
    reload,
    telemetry: telemetryReady ? `입력 지연 · 유효 ${snapshot.latency.validSamples}회 · 시계 오차 ±${snapshot.latency.clockUncertaintyMs.toFixed(1)}ms` : FIELD_UI_COPY.hud.telemetryBefore,
    telemetryReady,
  };
}

const css = `
#authoritativeCombatHud{position:fixed;inset:0;z-index:var(--ui-z-hud);pointer-events:none;color:var(--ui-text-primary);font:500 var(--ui-type-hud)/1.4 var(--ui-font-body)}
#combatEventLog{position:absolute;inset-block-start:var(--ui-safe-edge);inset-inline-end:var(--ui-safe-edge);display:grid;gap:var(--ui-space-1);inline-size:min(23rem,calc(100vw - var(--ui-safe-edge)*2));margin:0;padding:0;list-style:none}
#combatEventLog li{padding:var(--ui-space-2) var(--ui-space-3);border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent);background:var(--ui-hud-backing);overflow-wrap:anywhere}
#combatEventLog li[data-kind="shot-blocked"],#combatEventLog li[data-kind="reload-interrupted"]{border-inline-start-color:var(--ui-warning)}
#combatEventLog li[data-kind="confirmed-hit"]{border-inline-start-color:var(--ui-success)}#combatEventLog li[data-kind="confirmed-kill"]{border-inline-start-color:var(--ui-enemy)}
#combatObjectives{position:absolute;inset-block-start:6.75rem;inset-inline-start:50%;display:flex;gap:var(--ui-space-2);margin:0;padding:0;list-style:none;transform:translateX(-50%)}
#combatObjectives li{min-inline-size:4.5rem;padding:var(--ui-space-2);border-block-start:var(--ui-border-emphasis) solid var(--ui-neutral);background:var(--ui-hud-backing);text-align:center}
#combatObjectives li[data-owner="friendly"]{border-block-start-color:var(--ui-ally)}#combatObjectives li[data-owner="enemy"]{border-block-start-color:var(--ui-enemy)}
#combatReload{position:absolute;inset-inline-end:var(--ui-safe-edge);inset-block-end:8.5rem;padding:var(--ui-space-2) var(--ui-space-3);border-inline-end:var(--ui-border-emphasis) solid var(--ui-accent);background:var(--ui-hud-backing)}
#combatTelemetry{position:absolute;inset-inline-start:var(--ui-safe-edge);inset-block-start:12.25rem;padding:var(--ui-space-2) var(--ui-space-3);border-inline-start:var(--ui-border-emphasis) solid var(--ui-border-strong);background:var(--ui-hud-backing);color:var(--ui-text-secondary)}#combatTelemetry[data-ready="true"]{border-inline-start-color:var(--ui-success)}
@media(max-width:800px){#combatEventLog{inset-block-start:6rem;inline-size:min(18rem,calc(100vw - var(--ui-safe-edge)*2))}#combatObjectives{inset-block-start:12.5rem}#combatTelemetry{inset-block-start:9.75rem}#combatReload{inset-block-end:10.5rem}}
@media(max-width:520px){#combatEventLog{max-block-size:6rem;overflow:hidden}#combatObjectives{inset-inline-start:var(--ui-safe-edge);transform:none}#combatTelemetry{display:none}}
`;

export class CombatHudPresenter {
  private readonly root = document.createElement("aside");
  private readonly events = document.createElement("ol");
  private readonly objectives = document.createElement("ul");
  private readonly reload = document.createElement("div");
  private readonly telemetry = document.createElement("div");
  private signature = "";

  constructor(container: HTMLElement, installStyles = true) {
    if (installStyles && !document.getElementById("combat-hud-styles")) {
      const style = document.createElement("style"); style.id = "combat-hud-styles"; style.textContent = css; document.head.append(style);
    }
    this.root.id = "authoritativeCombatHud"; this.root.setAttribute("aria-label", "서버 확인 전투 정보");
    this.events.id = "combatEventLog"; this.events.setAttribute("aria-label", FIELD_UI_COPY.hud.serverEvents); this.events.setAttribute("aria-live", "polite");
    this.objectives.id = "combatObjectives"; this.objectives.setAttribute("aria-label", "거점 상태");
    this.reload.id = "combatReload"; this.reload.setAttribute("role", "status");
    this.telemetry.id = "combatTelemetry"; this.telemetry.title = "신뢰할 수 있는 실제 입력 표본이 있을 때만 측정 가능으로 표시합니다.";
    this.root.append(this.events, this.objectives, this.reload, this.telemetry); container.append(this.root);
  }

  render(snapshot: CombatHudSnapshot): void {
    const model = combatHudViewModel(snapshot); const signature = JSON.stringify(model); if (signature === this.signature) return; this.signature = signature;
    this.events.replaceChildren(...snapshot.events.map((event, index) => { const row = document.createElement("li"); row.dataset.kind = event.kind; row.textContent = model.events[index] ?? event.text; return row; }));
    this.objectives.replaceChildren(...model.objectives.map(objective => { const row = document.createElement("li"), id = document.createElement("strong"), status = document.createElement("span"); row.dataset.owner = objective.owner; id.textContent = objective.id; status.textContent = objective.label; row.append(id, document.createElement("br"), status); return row; }));
    this.reload.hidden = model.reload.length === 0; this.reload.textContent = model.reload;
    this.telemetry.dataset.ready = String(model.telemetryReady); this.telemetry.textContent = model.telemetry;
  }

  dispose(): void { this.root.remove(); }
}
