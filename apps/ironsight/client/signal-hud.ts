import { signalFrame, type SignalFrame } from '../src/signal-event.js';
import type { ArenaState } from '../src/schema.js';
import { FIELD_UI_COPY } from './ui/copy.js';

/** A quiet peripheral countdown; announcements only change at phase boundaries. */
export class SignalHud {
  private readonly root=document.createElement('aside');
  private readonly title=document.createElement('strong');
  private readonly detail=document.createElement('span');
  private readonly count=document.createElement('b');
  private previousKey='';
  private previousPhase='';
  private lastSecond=-1;
  constructor(private readonly cue:(phase:SignalFrame['phase'])=>void,
    private readonly site:'relay'|'undertow'|'switchyard'='relay') {
    this.root.id='signalEvent'; this.root.hidden=true;
    this.root.style.cssText='position:fixed;inset-block-start:var(--ui-safe-edge);inset-inline-start:14.25rem;inline-size:min(350px,calc(50vw - 14.25rem - 96px));max-inline-size:calc(100vw - 40px);padding:var(--ui-space-3) var(--ui-space-4);border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent);background:var(--ui-hud-backing);color:var(--ui-text-primary);pointer-events:none;font:500 var(--ui-type-hud)/1.4 var(--ui-font-body);box-sizing:border-box';
    this.title.style.cssText='display:block;font-size:var(--ui-type-hud);margin-block-end:var(--ui-space-2)';
    this.title.setAttribute('role','status');
    this.detail.style.cssText='display:block;font-size:var(--ui-type-hud);color:var(--ui-text-secondary);padding-inline-end:3rem';
    this.count.style.cssText='position:absolute;inset-inline-end:var(--ui-space-4);inset-block-start:var(--ui-space-3);font-size:var(--ui-type-hud);color:var(--ui-warning)';
    const style=document.createElement('style');
    style.textContent='@media(max-width:800px){#signalEvent{top:176px!important;left:auto!important;right:16px;width:300px!important;padding:9px 12px!important}#signalEvent strong{font-size:12px!important}}@media(max-width:520px){#signalEvent{top:344px!important;left:16px!important;right:16px;width:auto!important}}';
    document.head.append(style);this.root.append(this.title,this.detail,this.count);document.body.append(this.root);
  }
  update(state:ArenaState,now:number,online:boolean):SignalFrame {
    const frame=signalFrame(state.signalAt,state.phase,now);
    const held=state.coreOpen && frame.phase!=='blackout';
    this.root.hidden=!online || (frame.phase==='idle' && !held);this.root.dataset.phase=frame.phase;
    const key=`${state.signalAt}:${frame.cycle}:${frame.phase}:${state.coreOpen}`;
    const phaseKey=`${state.signalAt}:${frame.cycle}:${frame.phase}`;
    if(key!==this.previousKey) {
      // Seed silently on initial join, reconnect or a skipped interval. Never
      // replay a detonation merely because a hidden/background tab resumed.
      if(this.previousPhase && phaseKey!==this.previousPhase && online && frame.phase!=='idle' && frame.elapsedMs<750) this.cue(frame.phase);
      this.previousPhase=online ? phaseKey : '';
      this.previousKey=online ? key : '';this.lastSecond=-1;
      this.title.textContent=held ? FIELD_UI_COPY.signal.relayOpen : frame.phase==='warning' ? FIELD_UI_COPY.signal.relayWarning : frame.phase==='blackout' ? FIELD_UI_COPY.signal.relayBlackout : FIELD_UI_COPY.signal.restored;
      this.detail.textContent=held ? '양쪽 출구로 빠져나가세요. 통로가 비워질 때까지 차단문이 대기합니다.' : frame.phase==='warning' ? '전술 지도가 끊기며 중앙 통로가 열립니다.' : frame.phase==='blackout' ? '통신 복구 전에 중앙 통로를 통과하세요.' : FIELD_UI_COPY.signal.mapOnline;
      if(this.site==='undertow') {
        this.title.textContent=held ? FIELD_UI_COPY.signal.undertowOpen : frame.phase==='warning' ? FIELD_UI_COPY.signal.undertowWarning : frame.phase==='blackout' ? FIELD_UI_COPY.signal.undertowOpen : '방류 완료';
        this.detail.textContent=held ? '양쪽 출구로 빠져나가세요. 정비 통로가 비워질 때까지 문이 대기합니다.' : frame.phase==='warning' ? '북측 수문이 방류되며 중앙 정비 통로가 열립니다.' : frame.phase==='blackout' ? '압력 설비 아래를 통과하세요. 전술 지도는 유지됩니다.' : '수문이 내려가고 정비 통로가 닫혔습니다.';
      }
      if(this.site==='switchyard') {
        this.title.textContent=held?FIELD_UI_COPY.signal.switchyardOpen:frame.phase==='warning'?FIELD_UI_COPY.signal.switchyardWarning:frame.phase==='blackout'?FIELD_UI_COPY.signal.switchyardOpen:'화물 엄폐 복구';
        this.detail.textContent=held?'표시된 횡단로를 비우세요. 비워질 때까지 균형추가 대기합니다.':frame.phase==='warning'?'동측 엄폐가 내려갑니다. 빠르게 건너거나 측면로를 이용하세요.':frame.phase==='blackout'?'크레인 이동 중입니다. 횡단로가 노출되지만 전술 지도는 유지됩니다.':'균형추가 올라가 다시 완전 엄폐로 사용할 수 있습니다.';
      }
      this.root.style.borderColor=frame.phase==='warning' ? 'var(--ui-warning)' : 'var(--ui-ally)';
    }
    const second=Math.ceil(frame.remainingMs/1000);
    if(second!==this.lastSecond) {this.count.textContent=held ? FIELD_UI_COPY.signal.held : `${second}초`;this.lastSecond=second;}
    return frame;
  }
}
