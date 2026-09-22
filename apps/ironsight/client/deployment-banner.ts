import { DeploymentPresentation, type DeploymentCue, type DeploymentFrame } from './deployment-presentation.js';
import { matchBrief } from './match-presentation.js';
import type { ArenaState } from '../src/schema.js';
import { deploymentFlowContent, type PlayerFlowState } from './ui/flow-state.js';
import { modeCopy } from './ui/copy.js';

const css = `
#deployment-banner{position:absolute;inset-block-start:146px;inset-inline-start:50%;transform:translateX(-50%);inline-size:min(600px,calc(100vw - 32px));box-sizing:border-box;padding:var(--ui-space-4) var(--ui-space-6);border-block-start:var(--ui-border-emphasis) solid var(--ui-accent);background:var(--ui-hud-backing);color:var(--ui-text-primary);pointer-events:none;font-family:var(--ui-font-body)}
#deployment-banner[hidden]{display:none}
#hud[data-deploying=true] #matchBrief{visibility:hidden}
#deployment-banner .deployment-kicker{font-size:var(--ui-type-hud);color:var(--ui-accent)}
#deployment-banner .deployment-body{display:flex;align-items:center;gap:22px;margin:4px 0 8px}
#deployment-banner .deployment-count{font:bold 76px/.98 ui-monospace,monospace;min-width:100px;letter-spacing:-6px;color:#fff0d4;border-right:1px solid #edaa5255}
#deployment-banner h2{margin:0;font:700 var(--ui-type-panel)/1.1 var(--ui-font-body)}
#deployment-banner .deployment-detail{font:var(--ui-type-hud)/1.5 var(--ui-font-key);margin:7px 0 0;color:#b9cbd2}
#deployment-banner .deployment-progress{display:flex;gap:5px;height:3px;margin-top:12px}
#deployment-banner .deployment-progress i{flex:1;background:#edaa5230}
#deployment-banner .deployment-progress i[data-lit=true]{background:#edaa52}
#deployment-banner[data-kind=go]{border-color:#64c7cc}
#deployment-banner[data-kind=go] .deployment-count,#deployment-banner[data-kind=go] .deployment-kicker{color:#8ce5df}
#deployment-banner[data-kind=go] .deployment-progress i{background:#64c7cc}
@media(max-height:700px){#deployment-banner{top:96px;padding:10px 18px;width:min(530px,calc(100vw - 32px))}#deployment-banner .deployment-count{font-size:44px;min-width:76px;letter-spacing:-3px}#deployment-banner h2{font-size:18px}#deployment-banner .deployment-body{margin:4px 0}#deployment-banner .deployment-progress{margin-top:7px}}
@media(max-width:800px){#deployment-banner{top:202px;padding:12px}#deployment-banner .deployment-body{gap:12px}#deployment-banner .deployment-count{font-size:48px;min-width:69px;letter-spacing:-3px}#deployment-banner h2{font-size:18px}#deployment-banner .deployment-kicker{letter-spacing:1px}#hud[data-deploying=true] #caps{top:330px}#hud[data-deploying=true] #lb{top:350px}}
`;

const flowCss = `
#deployment-flow{position:fixed;inset:0;z-index:190;display:grid;place-items:center;padding:var(--ui-safe-edge);box-sizing:border-box;background:linear-gradient(90deg,rgba(7,16,21,.96),rgba(7,16,21,.74));color:var(--ui-text-primary);pointer-events:auto}
#deployment-flow[hidden]{display:none}
#deployment-flow .deployment-flow__panel{width:min(520px,100%);box-sizing:border-box;border-top:2px solid var(--ui-accent);background:var(--ui-surface-1);padding:var(--ui-space-6);box-shadow:0 18px 50px #0008}
#deployment-flow .deployment-flow__eyebrow{color:var(--ui-accent);font:700 var(--ui-type-hud)/1.4 var(--ui-font-key);letter-spacing:.15em}
#deployment-flow h1{margin:12px 0 8px;font:700 clamp(30px,5vw,48px)/1.15 var(--ui-font-display);letter-spacing:.04em;word-break:keep-all;text-wrap:balance}
#deployment-flow p{margin:0;color:var(--ui-text-secondary);font:16px/1.6 var(--ui-font-body);word-break:keep-all;text-wrap:pretty}
#deployment-flow .deployment-flow__stage{margin-top:18px;padding:12px 14px;border-left:2px solid var(--ui-accent);background:var(--ui-surface-2);color:var(--ui-text-primary);font:700 var(--ui-type-hud)/1.5 var(--ui-font-key)}
#deployment-flow .deployment-flow__actions{display:flex;gap:10px;margin-top:24px}
#deployment-flow .deployment-flow__actions button{min-height:44px;padding:0 18px;border:1px solid var(--ui-border-strong);background:var(--ui-surface-0);color:var(--ui-text-primary);font:700 var(--ui-type-body) var(--ui-font-body);cursor:pointer}
#deployment-flow .deployment-flow__actions button:first-child{border-color:var(--ui-accent);background:var(--ui-accent);color:var(--ui-ink)}
#deployment-flow .deployment-flow__actions button:focus-visible{outline:2px solid var(--ui-focus);outline-offset:3px}
@media(max-width:520px){#deployment-flow .deployment-flow__panel{padding:20px}#deployment-flow .deployment-flow__actions{flex-direction:column}#deployment-flow .deployment-flow__actions button{width:100%}}
`;

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
      const style = document.createElement('style'); style.id = 'deployment-flow-styles'; style.textContent = flowCss; document.head.append(style);
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
    const style = document.createElement('style'); style.textContent = css; document.head.append(style);
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
