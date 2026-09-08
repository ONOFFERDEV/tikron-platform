import type { PingGesture } from './ping-gesture.js';

export class PingWheel {
  private readonly root = document.createElement('aside');
  private readonly choices: HTMLElement[];
  private lastView = '';
  constructor() {
    const style = document.createElement('style');
    style.textContent = `#pingWheel{position:fixed;z-index:8;left:50%;top:50%;transform:translate(-50%,-50%);width:330px;height:240px;pointer-events:none;color:#d9e9e5;font:11px Arial,sans-serif;letter-spacing:1px}
      #pingWheel[hidden]{display:none}#pingWheel .choice{position:absolute;box-sizing:border-box;width:142px;padding:14px 8px;background:#10242bf5;border:1px solid #668483;text-align:center;line-height:1.6}
      #pingWheel .choice[data-selected=true]{border-color:#ffe0a3;background:#334547;color:#ffe0a3;box-shadow:inset 0 -3px #edaa52}
      #pingWheel .choice:nth-child(1){top:0;left:94px}#pingWheel .choice:nth-child(2){top:86px;left:0}#pingWheel .choice:nth-child(3){top:86px;right:0}
      #pingWheel small{display:block;letter-spacing:0;font-size:10px;color:#b5ccc9}#pingWheel footer{position:absolute;top:184px;width:100%;text-align:center;line-height:1.7;background:#10242bef;padding:8px 0}#pingWheel strong{color:#ffe0a3}`;
    document.head.append(style);
    this.root.id = 'pingWheel'; this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Team ping selection');
    this.root.innerHTML = '<div class="choice" data-intent="context">↑ CONTEXT<small>Enemy seen / go here</small></div><div class="choice" data-intent="go">← GO HERE<small>Aimed location</small></div><div class="choice" data-intent="backup">NEED BACKUP →<small>Your location</small></div><footer><strong>MOVE MOUSE · RELEASE TO SEND</strong><br>Centre / right click to cancel</footer>';
    this.choices = [...this.root.querySelectorAll<HTMLElement>('.choice')];
    document.body.append(this.root);
  }
  update(gesture: PingGesture): void {
    const view = `${gesture.open}/${gesture.selection ?? 'cancel'}`;
    if (view === this.lastView) return;
    this.lastView = view;
    this.root.hidden = !gesture.open;
    this.root.dataset.selection = gesture.selection ?? 'cancel';
    for (const choice of this.choices) choice.dataset.selected = String(choice.dataset.intent === gesture.selection);
  }
}
