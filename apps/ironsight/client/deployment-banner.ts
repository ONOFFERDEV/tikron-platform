import { DeploymentPresentation, type DeploymentCue, type DeploymentFrame } from './deployment-presentation.js';
import { matchBrief } from './match-presentation.js';
import type { ArenaState } from '../src/schema.js';

const css = `
#deployment-banner{position:absolute;top:146px;left:50%;transform:translateX(-50%);width:min(600px,calc(100vw - 32px));box-sizing:border-box;padding:17px 22px 15px;border-top:2px solid #edaa52;background:linear-gradient(110deg,#0a151eea,#12232dd9);color:#f4eee3;box-shadow:0 12px 28px #0003;pointer-events:none}
#deployment-banner[hidden]{display:none}
#hud[data-deploying=true] #matchBrief{visibility:hidden}
#deployment-banner .deployment-kicker{font-size:11px;letter-spacing:3px;color:#edaa52}
#deployment-banner .deployment-body{display:flex;align-items:center;gap:22px;margin:4px 0 8px}
#deployment-banner .deployment-count{font:bold 76px/.98 ui-monospace,monospace;min-width:100px;letter-spacing:-6px;color:#fff0d4;border-right:1px solid #edaa5255}
#deployment-banner h2{margin:0;font:bold 23px/1.1 system-ui,sans-serif;letter-spacing:2px}
#deployment-banner .deployment-detail{font:12px/1.5 ui-monospace,monospace;margin:7px 0 0;color:#b9cbd2}
#deployment-banner .deployment-progress{display:flex;gap:5px;height:3px;margin-top:12px}
#deployment-banner .deployment-progress i{flex:1;background:#edaa5230}
#deployment-banner .deployment-progress i[data-lit=true]{background:#edaa52}
#deployment-banner[data-kind=go]{border-color:#64c7cc}
#deployment-banner[data-kind=go] .deployment-count,#deployment-banner[data-kind=go] .deployment-kicker{color:#8ce5df}
#deployment-banner[data-kind=go] .deployment-progress i{background:#64c7cc}
@media(max-height:700px){#deployment-banner{top:96px;padding:10px 18px;width:min(530px,calc(100vw - 32px))}#deployment-banner .deployment-count{font-size:44px;min-width:76px;letter-spacing:-3px}#deployment-banner h2{font-size:18px}#deployment-banner .deployment-body{margin:4px 0}#deployment-banner .deployment-progress{margin-top:7px}}
@media(max-width:800px){#deployment-banner{top:202px;padding:12px}#deployment-banner .deployment-body{gap:12px}#deployment-banner .deployment-count{font-size:48px;min-width:69px;letter-spacing:-3px}#deployment-banner h2{font-size:18px}#deployment-banner .deployment-kicker{font-size:10px;letter-spacing:1px}#deployment-banner .deployment-detail{font-size:10px}#hud[data-deploying=true] #caps{top:330px}#hud[data-deploying=true] #lb{top:350px}}
`;

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
    const mode = state.mode === 2 ? 'DOMINATION' : state.mode === 1 ? 'FREE FOR ALL' : 'TEAM DEATHMATCH';
    this.kicker.textContent = `${this.site} / ${mode} / ${brief.affiliation}`;
    this.count.textContent = frame.kind === 'go' ? 'GO' : frame.kind === 'countdown' ? String(frame.seconds).padStart(2, '0') : '—';
    this.title.textContent = frame.kind === 'go' ? 'TAKE THE FIELD' : frame.kind === 'waiting' ? 'FORMING SQUADS'
      : frame.kind === 'standby' ? 'STAND BY' : 'DEPLOYING';
    this.detail.textContent = frame.kind === 'go' ? brief.objective
      : frame.kind === 'waiting' ? 'Waiting for operators. Explore the yard.'
      : frame.kind === 'standby' ? 'Waiting for the room to confirm the start.'
      : `${brief.objective}. Positions reset at start.`;
    [...this.progress.children].forEach((node, index) => {
      (node as HTMLElement).dataset.lit = String(frame.kind === 'go' || (frame.kind === 'countdown' && index < 10 - frame.seconds));
    });
  }
}
