import { signalFrame, type SignalFrame } from '../src/signal-event.js';
import type { ArenaState } from '../src/schema.js';

/** A quiet peripheral countdown; announcements only change at phase boundaries. */
export class SignalHud {
  private readonly root=document.createElement('aside');
  private readonly title=document.createElement('strong');
  private readonly detail=document.createElement('span');
  private readonly count=document.createElement('b');
  private previousKey='';
  private previousPhase='';
  private lastSecond=-1;
  constructor(private readonly cue:(phase:SignalFrame['phase'])=>void, private readonly flood=false) {
    this.root.id='signalEvent'; this.root.hidden=true;
    this.root.style.cssText='position:fixed;top:28px;left:228px;width:350px;max-width:calc(100vw - 40px);padding:12px 16px;border-left:3px solid #edaa52;background:#10252def;color:#e9f0e9;pointer-events:none;font:11px Arial,sans-serif;letter-spacing:1.5px;box-sizing:border-box';
    this.title.style.cssText='display:block;font-size:14px;margin-bottom:6px';
    this.title.setAttribute('role','status');
    this.detail.style.cssText='display:block;letter-spacing:.4px;font-size:11px;color:#b9d1d0';
    this.count.style.cssText='position:absolute;right:14px;top:12px;font-size:15px;color:#ffd899';
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
      this.title.textContent=held ? 'CORE / CLEAR TO SEAL' : frame.phase==='warning' ? 'CORE RELEASE INCOMING' : frame.phase==='blackout' ? (state.coreOpen ? 'CORE OPEN / SIGNAL LOST' : 'CORE RELEASING') : 'SIGNAL RESTORED';
      this.detail.textContent=held ? 'Exit either end. Shutters wait until the passage is clear.' : frame.phase==='warning' ? 'Central transit opens as the minimap drops. Take the shortcut.' : frame.phase==='blackout' ? 'Through the core! Shutters seal after the blackout clears.' : 'Tactical map online. Core transit sealed.';
      if(this.flood) {
        this.title.textContent=held ? 'MAINTENANCE / CLEAR TO SEAL' : frame.phase==='warning' ? 'PRESSURE DROP / STAND BY' : frame.phase==='blackout' ? (state.coreOpen ? 'MAINTENANCE / OPEN' : 'MAINTENANCE / RELEASING') : 'DISCHARGE COMPLETE';
        this.detail.textContent=held ? 'Exit either end. Doors wait until the gallery is clear.' : frame.phase==='warning' ? 'North sluices releasing. Central maintenance shortcut opens.' : frame.phase==='blackout' ? 'Cross beneath the pressure stack. Radar stays online.' : 'Sluices lowering. Maintenance gallery sealed.';
      }
      this.root.style.borderColor=frame.phase==='warning' ? '#edaa52' : '#80d5dc';
    }
    const second=Math.ceil(frame.remainingMs/1000);
    if(second!==this.lastSecond) {this.count.textContent=held ? 'HELD' : `${second}s`;this.lastSecond=second;}
    return frame;
  }
}
