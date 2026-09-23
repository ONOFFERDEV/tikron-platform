import { DeploymentPresentation, type DeploymentCue, type DeploymentFrame } from './deployment-presentation.js';
import { matchBrief } from './match-presentation.js';
import type { ArenaState } from '../src/schema.js';
import { deploymentFlowContent, type PlayerFlowState } from './ui/flow-state.js';
import { modeCopy } from './ui/copy.js';

import { DEPLOYMENT_FIELD_CSS } from './ui/match-field-style.js';

import { SERVICE_FIELD_CSS } from './ui/service-field-style.js';

export interface DeploymentFlowActions {
  retry(): void;
  returnToMenu(): void;
}

export class DeploymentFlowPanel {
  readonly root = document.createElement('section');
  private readonly eyebrow = document.createElement('div');
  private readonly title = document.createElement('h1');
  private readonly detail = document.createElement('p');
  private readonly stage = document.createElement('div');
  private readonly actions = document.createElement('div');
  private readonly retry = document.createElement('button');
  private readonly menu = document.createElement('button');

  constructor(private readonly callbacks: DeploymentFlowActions, container: HTMLElement = document.body) {
    if (!document.getElementById('deployment-flow-styles')) {
      const style = document.createElement('style'); style.id = 'deployment-flow-styles'; style.textContent = SERVICE_FIELD_CSS; document.head.append(style);
    }
    this.root.id = 'deployment-flow'; this.root.hidden = true; this.root.setAttribute('role', 'status'); this.root.setAttribute('aria-live', 'polite');
    const panel = document.createElement('div'); panel.className = 'deployment-flow__panel';
    this.eyebrow.className = 'deployment-flow__eyebrow'; this.stage.className = 'deployment-flow__stage'; this.actions.className = 'deployment-flow__actions';
    this.retry.type = 'button'; this.retry.textContent = '다시 시도'; this.retry.addEventListener('click', () => this.callbacks.retry());
    this.menu.type = 'button'; this.menu.textContent = '출격 메뉴'; this.menu.addEventListener('click', () => this.callbacks.returnToMenu());
    this.actions.append(this.retry, this.menu); panel.append(this.eyebrow, this.title, this.detail, this.stage, this.actions); this.root.append(panel); container.append(this.root);
  }

  render(state: PlayerFlowState): void {
    const content = deploymentFlowContent(state);
    this.root.dataset.flow = state.kind; this.root.hidden = content === null;
    if (!content) return;
    this.eyebrow.textContent = content.eyebrow; this.title.textContent = content.title; this.detail.textContent = content.detail;
    this.stage.hidden = content.stage === null; this.stage.textContent = content.stage;
    this.actions.hidden = content.actions === 'none'; this.retry.hidden = content.actions === 'none'; this.menu.hidden = content.actions !== 'retry-menu';
  }

  dispose(): void { this.root.remove(); }
}

/** A peripheral, non-modal briefing. No camera/input/scene changes or animations;
 * Reduced motion sees exactly the same objective and authoritative countdown. */
export class DeploymentBanner {
  private readonly presentation = new DeploymentPresentation();
  private readonly root = document.createElement('section');
  private readonly kicker = document.createElement('div');
  private readonly count = document.createElement('div');
  private readonly title = document.createElement('h2');
  private readonly detail = document.createElement('p');
  private readonly progress = document.createElement('div');
  private signature = '';
  private readonly site: string;

  constructor(private readonly container: HTMLElement, site: string) {
    this.site = site.toUpperCase();
    const style = document.createElement('style'); style.textContent = DEPLOYMENT_FIELD_CSS; document.head.append(style);
    this.root.id = 'deployment-banner'; this.root.hidden = true;
    this.root.setAttribute('role', 'status'); this.root.setAttribute('aria-live', 'polite');
    this.root.setAttribute('aria-atomic', 'true');
    this.kicker.className = 'deployment-kicker'; this.count.className = 'deployment-count';
    this.detail.className = 'deployment-detail'; this.progress.className = 'deployment-progress';
    this.progress.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 10; i++) this.progress.append(document.createElement('i'));
    const body = document.createElement('div'), copy = document.createElement('div');
    body.className = 'deployment-body'; copy.append(this.title, this.detail); body.append(this.count, copy);
    this.root.append(this.kicker, body, this.progress); container.append(this.root);
  }

  update(state: ArenaState, serverNow: number, myId: string, active: boolean): DeploymentCue | undefined {
    const frame = this.presentation.update(state, serverNow, active, performance.now());
    this.render(frame, state, serverNow, myId);
    return frame.cue;
  }

  private render(frame: DeploymentFrame, state: ArenaState, now: number, myId: string): void {
    const brief = matchBrief(state, now, myId);
    const signature = `${frame.kind}:${frame.seconds}:${brief.affiliation}:${state.mode}`;
    if (signature === this.signature) return;
    this.signature = signature; this.root.hidden = frame.kind === 'hidden';
    this.container.dataset.deploying = String(!this.root.hidden);
    this.root.dataset.kind = frame.kind;
    if (this.root.hidden) return;
    const mode = modeCopy(state.mode === 2 ? 'dom' : state.mode === 1 ? 'ffa' : state.mode === 3 ? 'practice' : 'tdm').label;
    this.kicker.textContent = `${this.site} · ${mode} · ${brief.affiliation}`;
    this.count.textContent = frame.kind === 'go' ? '출격' : frame.kind === 'countdown' ? String(frame.seconds).padStart(2, '0') : '—';
    this.title.textContent = frame.kind === 'go' ? '전장 진입' : frame.kind === 'waiting' ? '분대 편성 중'
      : frame.kind === 'standby' ? '서버 시작 대기' : '출격 준비';
    this.detail.textContent = frame.kind === 'go' ? brief.objective
      : frame.kind === 'waiting' ? '전투원을 기다리는 동안 전장을 둘러볼 수 있습니다.'
      : frame.kind === 'standby' ? '서버의 전투 시작 확인을 기다립니다.'
      : `${brief.objective}. 시작할 때 위치가 다시 배치됩니다.`;
    [...this.progress.children].forEach((node, index) => {
      (node as HTMLElement).dataset.lit = String(frame.kind === 'go' || (frame.kind === 'countdown' && index < 10 - frame.seconds));
    });
  }
}
