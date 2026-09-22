import type { MapDef } from "../src/map/types.js";
import { mapCallout } from "./map-presentation.js";
import { formatBinding, type SettingsStore } from "./settings.js";
import { COPY } from "./ui/copy.js";
import { createUiButton, createUiKeycap } from "./ui/primitives.js";
import {
  TrainingProgress,
  type TrainingCheckpoint,
  type TrainingRouteSpec,
  type TrainingStepId,
} from "./training-progress.js";

export interface TrainingCoachOptions {
  readonly spec: TrainingRouteSpec;
  readonly settings: SettingsStore;
  readonly onFreeTraining: () => void;
  readonly onMenu: () => void;
}

interface StepContent {
  readonly title: string;
  readonly detail: string;
  readonly binding: string | null;
  readonly action: string | null;
}

export function createTrainingRouteSpec(map: MapDef): TrainingRouteSpec | null {
  switch (map.presentation) {
    case "relay": return { route: "relay" };
    case "undertow": return { route: "undertow", objective: map.caps.a };
    case "switchyard": {
      const points = map.patrolWaypoints ?? [];
      const labels = COPY.maps.arena3.routes;
      const checkpoints = labels.map((label, index): TrainingCheckpoint | null => {
        const point = points.find(candidate => mapCallout(map, candidate.x, candidate.z) === label);
        if (point === undefined) return null;
        const ids = ["rail-embankment", "loading-yard", "rail-cut"] as const;
        const id = ids[index];
        return id === undefined ? null : { id, x: point.x, z: point.z, radius: 5 };
      });
      const first = checkpoints[0];
      const second = checkpoints[1];
      const third = checkpoints[2];
      return first !== null && first !== undefined && second !== null && second !== undefined && third !== null && third !== undefined
        ? { route: "switchyard", checkpoints: [first, second, third] }
        : null;
    }
    case undefined: return null;
  }
}

export class TrainingCoach {
  readonly progress: TrainingProgress;
  private readonly card = document.createElement("aside");
  private readonly heading = document.createElement("strong");
  private readonly detail = document.createElement("p");
  private readonly key = document.createElement("div");
  private readonly guidance = document.createElement("div");
  private readonly meter = document.createElement("progress");
  private readonly track = document.createElement("div");
  private readonly actions = document.createElement("div");
  private readonly settings: SettingsStore;
  private nextGuidanceAt = 0;
  private lastStep: TrainingStepId | null = null;
  private lastSettings: ReturnType<SettingsStore["get"]> | null = null;

  constructor(options: TrainingCoachOptions) {
    this.progress = new TrainingProgress(options.spec);
    this.settings = options.settings;
    this.card.id = "trainingCoach";
    this.card.className = "ui-surface training-coach";
    this.card.hidden = true;
    this.card.setAttribute("aria-label", "훈련 안내");
    this.heading.setAttribute("role", "status");
    this.heading.setAttribute("aria-live", "polite");
    this.heading.setAttribute("aria-atomic", "true");
    this.key.className = "training-coach__key";
    this.guidance.className = "training-coach__guidance";
    this.guidance.setAttribute("aria-live", "off");
    this.meter.max = 1;
    this.meter.setAttribute("aria-label", "현재 훈련 진행률");
    this.track.className = "training-coach__track";
    this.actions.className = "training-coach__actions";
    this.actions.append(
      createUiButton({ label: COPY.training.freeTraining, tone: "accent", onClick: options.onFreeTraining }),
      createUiButton({ label: "출격 화면으로", onClick: options.onMenu }),
    );
    this.card.append(this.heading, this.detail, this.key, this.guidance, this.meter, this.track, this.actions);
    const style = document.createElement("style");
    style.textContent = trainingCoachCss;
    document.head.append(style);
    document.body.append(this.card);
  }

  update(now: number, serverNow: number, active: boolean, x: number, z: number, aiming: boolean, dtMs: number): void {
    this.progress.sample(active, x, z, aiming, dtMs);
    const step = this.progress.step;
    this.card.hidden = !active && step !== "complete";
    this.card.dataset.step = step;
    this.actions.hidden = step !== "complete";

    const settings = this.settings.get();
    if (step !== this.lastStep || settings !== this.lastSettings) {
      const content = stepContent(step, settings);
      this.heading.textContent = content.title;
      this.detail.textContent = content.detail;
      if (step === 'complete') {
        const words = content.detail.split(' ');
        const phrase = document.createElement('span');
        phrase.className = 'training-coach__phrase';
        phrase.textContent = words.splice(-3).join(' ');
        this.detail.replaceChildren(words.join(' ') + ' ', phrase);
      }
      this.key.replaceChildren();
      if (content.binding !== null && content.action !== null) {
        this.key.append(createUiKeycap(content.binding, content.action, content.binding ? "default" : "unbound"));
      }
      this.lastStep = step;
      this.lastSettings = settings;
    }

    if (now >= this.nextGuidanceAt) {
      this.nextGuidanceAt = now + 250;
      this.updateProgress(serverNow, x, z);
    }
    const current = stepIndex(step, this.progress.route);
    const total = stepCount(this.progress.route);
    this.track.textContent = step === "complete" ? `${total} / ${total}` : `${current} / ${total}`;
  }

  private updateProgress(serverNow: number, x: number, z: number): void {
    const step = this.progress.step;
    if (step === "reload") {
      const progress = this.progress.reloadProgress(serverNow);
      this.meter.hidden = progress === null;
      this.meter.value = progress ?? 0;
      this.guidance.textContent = progress === null ? "재장전 서버 확인 대기" : `${Math.round(progress * 100)}%`;
      return;
    }
    if (step === "reach-objective" || step === "hold-objective") {
      this.meter.hidden = step !== "hold-objective";
      this.meter.value = this.progress.heldMs / this.progress.objectiveHoldMs;
      this.guidance.textContent = step === "hold-objective"
        ? `A 구역 유지 ${(this.progress.heldMs / 1_000).toFixed(1)} / ${(this.progress.objectiveHoldMs / 1_000).toFixed(1)}초`
        : `A 거점까지 ${Math.ceil(this.progress.objectiveDistance)}m`;
      return;
    }
    if (this.progress.spec.route === "switchyard" && step !== "complete") {
      const checkpoint = this.progress.spec.checkpoints[stepIndex(step, "switchyard")];
      this.meter.hidden = true;
      this.guidance.textContent = checkpoint === undefined ? "" : `${Math.ceil(Math.hypot(checkpoint.x - x, checkpoint.z - z))}m`;
      return;
    }
    this.meter.hidden = true;
    this.guidance.textContent = step === "complete" ? "훈련 완료" : "";
  }
}

function stepContent(step: TrainingStepId, settings: ReturnType<SettingsStore["get"]>): StepContent {
  const reload = formatBinding(settings.binds.reload);
  const ping = formatBinding(settings.binds.ping);
  switch (step) {
    case "move": return { title: "이동", detail: "엄폐 사이를 4m 이동하십시오.", binding: movementBinding(settings), action: "이동" };
    case "aim": return { title: "조준", detail: "조준 상태를 0.5초 유지하십시오.", binding: "마우스 오른쪽", action: "조준" };
    case "hit": return { title: "명중", detail: "통신소 서쪽의 표적을 맞히고 서버 확인을 기다리십시오.", binding: "마우스 왼쪽", action: "사격" };
    case "reload": return { title: "재장전", detail: "탄약이 실제로 장전될 때까지 서버 진행을 확인합니다.", binding: reload, action: "재장전" };
    case "ping": return { title: "위치 표시", detail: ping ? "경로를 조준하고 위치를 표시하십시오." : "설정에서 위치 표시 키를 지정하십시오.", binding: ping, action: "위치 표시" };
    case "reach-objective": return { title: "A 거점 접근", detail: "미니맵의 A 거점으로 이동하십시오.", binding: movementBinding(settings), action: "이동" };
    case "hold-objective": return { title: "A 거점 유지", detail: "구역을 벗어나지 말고 점령 시간을 채우십시오. 연습 점수는 오르지 않습니다.", binding: null, action: null };
    case "reach-rail-embankment": return { title: COPY.maps.arena3.routes[0], detail: "철도 둑의 엄폐 경로를 확인하십시오.", binding: movementBinding(settings), action: "이동" };
    case "reach-loading-yard": return { title: COPY.maps.arena3.routes[1], detail: "하역장 중앙 통로로 이동하십시오.", binding: movementBinding(settings), action: "이동" };
    case "reach-rail-cut": return { title: COPY.maps.arena3.routes[2], detail: "남측 선로 절개지까지 경로를 완주하십시오.", binding: movementBinding(settings), action: "이동" };
    case "complete": return { title: "훈련 완료", detail: "자유 훈련을 계속하거나 출격 화면으로 돌아갈 수 있습니다.", binding: null, action: null };
  }
}

function movementBinding(settings: ReturnType<SettingsStore["get"]>): string {
  return [settings.binds.forward, settings.binds.left, settings.binds.back, settings.binds.right]
    .map(formatBinding)
    .join(" / ");
}

function stepCount(route: TrainingRouteSpec["route"]): number {
  switch (route) {
    case "relay": return 6;
    case "undertow": return 2;
    case "switchyard": return 3;
  }
}

function stepIndex(step: TrainingStepId, route: TrainingRouteSpec["route"]): number {
  const steps: Readonly<Record<TrainingRouteSpec["route"], readonly TrainingStepId[]>> = {
    relay: ["move", "aim", "hit", "reload", "ping", "complete"],
    undertow: ["reach-objective", "hold-objective", "complete"],
    switchyard: ["reach-rail-embankment", "reach-loading-yard", "reach-rail-cut", "complete"],
  };
  const index = steps[route].indexOf(step);
  return Math.max(0, index);
}

export const trainingCoachCss = `
.training-coach[data-step="complete"]{padding-block:var(--ui-space-3)}.training-coach[data-step="complete"] .training-coach__actions{margin-block-start:var(--ui-space-2)}.training-coach__phrase{display:inline-block;white-space:nowrap}
.training-coach{position:fixed;inset-block-start:calc(var(--ui-safe-edge) + 316px);inset-inline-start:var(--ui-safe-edge);inline-size:min(320px,calc(100vw - 2 * var(--ui-safe-edge)));padding:var(--ui-space-4);border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent);border-radius:var(--ui-radius-panel);background:var(--ui-hud-backing);color:var(--ui-text-primary);pointer-events:none;z-index:var(--ui-z-notice)}.training-coach[hidden]{display:none}.training-coach>strong{display:block;font:700 var(--ui-type-hud)/1.4 var(--ui-font-body)}.training-coach>p{margin:var(--ui-space-2) 0;color:var(--ui-text-secondary);font:500 var(--ui-type-hud)/1.5 var(--ui-font-body);text-wrap:pretty}.training-coach__key{margin-block:var(--ui-space-2)}.training-coach__guidance{color:var(--ui-warning);font:500 var(--ui-type-hud)/1.4 var(--ui-font-body)}.training-coach progress{inline-size:100%;block-size:var(--ui-space-2);margin-block-start:var(--ui-space-2);accent-color:var(--ui-accent)}.training-coach__track{margin-block-start:var(--ui-space-2);color:var(--ui-accent);font:700 var(--ui-type-meta)/1.4 var(--ui-font-body);font-variant-numeric:tabular-nums}.training-coach__actions{display:flex;flex-wrap:wrap;gap:var(--ui-space-2);margin-block-start:var(--ui-space-4);pointer-events:auto}.training-coach__actions[hidden]{display:none}@media(max-height:650px),(max-width:800px){.training-coach{inset-block-start:202px}}
`;
