import { RECON, type SupportView } from '../src/air-support.js';
import type { ArenaState } from '../src/schema.js';
import { emptySupport, readSupport } from './support-view.js';
import { emptyMortar, MORTAR } from '../src/mortar.js';
import { readMortar } from './mortar-view.js';
import { formatBinding, type SettingsStore } from './settings.js';

export class SupportHud {
  private readonly root = document.createElement('aside');
  private readonly banner = document.createElement('aside');
  private readonly title = document.createElement('strong');
  private readonly detail = document.createElement('span');
  private readonly meter = document.createElement('div');
  private readonly pips = Array.from({ length: 5 }, () => document.createElement('i'));
  private mortar = emptyMortar();
  private denialUntil = 0;
  private denial = '';
  private current = emptySupport();
  private bannerUntil = 0;
  private readonly announced = new Set<string>();
  private pulseAt = 0;
  constructor(private readonly cue: (kind: 'earned' | 'friendly' | 'enemy' | 'pulse') => void,
    private readonly width: number, private readonly depth: number, private readonly settings?: SettingsStore) {
    const style = document.createElement('style');
    style.textContent = `#airSupport{position:fixed;right:28px;bottom:151px;width:228px;box-sizing:border-box;padding:12px 14px;background:linear-gradient(110deg,#112b32f2,#10242bdb);border-right:2px solid #80d5dc;color:#e8eee9;pointer-events:none;font:10px Arial;letter-spacing:1.5px}
      #airSupport strong{display:block;font-size:12px;margin-bottom:7px}#airSupport span{display:block;color:#bcd1cc;line-height:1.5;font-size:10px;letter-spacing:.4px;min-height:30px}
      #airSupport .meter{display:flex;gap:4px;margin-top:9px}#airSupport i{height:3px;flex:1;background:#3b545a}#airSupport i[data-filled=true]{background:#edaa52}
      #supportBanner{position:fixed;top:205px;left:50%;transform:translateX(-50%);width:380px;max-width:calc(100vw - 32px);box-sizing:border-box;padding:13px 20px 14px 67px;border-top:2px solid #edaa52;background:linear-gradient(110deg,#17363ff5,#10242bf5);color:#f1f0e8;pointer-events:none;font:10px Arial;letter-spacing:2px;box-shadow:0 8px 30px #0003}
      #supportBanner::before{content:'';position:absolute;left:17px;top:23px;width:34px;height:34px;background:#edaa52;clip-path:polygon(50% 0,58% 38%,100% 78%,100% 89%,58% 69%,58% 89%,73% 100%,27% 100%,42% 89%,42% 69%,0 89%,0 78%,42% 38%)}#supportBanner strong{display:block;font-size:21px;margin:5px 0;letter-spacing:2px}#supportBanner span{color:#bcd1cc;font-size:10px;letter-spacing:.6px}
      #supportBanner[data-kind=mortar]::before{clip-path:polygon(35% 0,65% 0,80% 25%,80% 65%,63% 85%,72% 100%,50% 92%,28% 100%,37% 85%,20% 65%,20% 25%);transform:rotate(30deg)}
      @media(max-width:800px){#airSupport{bottom:200px;right:16px;width:200px}#supportBanner{top:344px}}
      @media(max-width:520px){#airSupport{top:218px;bottom:auto;width:144px;padding:10px}#supportBanner{top:406px;padding-top:9px;padding-bottom:9px}#supportBanner strong{font-size:17px}}
      @media(max-height:650px) and (min-width:801px){#airSupport{bottom:145px}#supportBanner{top:195px}}`;
    document.head.append(style);
    this.root.id = 'airSupport'; this.root.hidden = true;
    this.banner.id = 'supportBanner'; this.banner.hidden = true; this.banner.setAttribute('role', 'status');
    this.meter.className = 'meter'; this.meter.append(...this.pips);
    this.root.append(this.title, this.detail, this.meter); document.body.append(this.root, this.banner);
  }
  receiveMortar(payload: unknown, now: number, state: ArenaState | undefined, id: string): void {
    const next = readMortar(payload, now, this.width, this.depth); if (!next || !state) return;
    const earned = next.available && !this.mortar.available;
    const called = next.strikes.find(s => !this.mortar.strikes.some(old => old.owner === s.owner && old.startedAt === s.startedAt) && now - s.startedAt < 750);
    this.mortar = next;
    if (!state.players[id]?.alive || !document.pointerLockElement) return;
    if (earned) this.announce('5 ELIMINATIONS / SUPPORT EARNED', 'MORTAR READY', 'Aim at open ground. Call a three-round barrage.', now, 'earned');
    else if (called) {
      this.denialUntil = 0;
      const own = called.owner === id, friendly = own || state.mode !== 3 && called.team === state.players[id]!.team;
      this.announce('FIRE MISSION / THREE ROUNDS', own ? 'MARK CONFIRMED' : friendly ? 'FRIENDLY MORTAR' : 'HOSTILE MORTAR',
        'Impact in 3 seconds. Clear the marked ground.', now, friendly ? 'friendly' : 'enemy');
    }
  }
  denyMortar(payload: unknown, now: number): void {
    if (!payload || typeof payload !== 'object' || !('reason' in payload) || typeof payload.reason !== 'string') return;
    this.denial = payload.reason.slice(0, 120); this.denialUntil = now + 2500;
  }
  private announce(kicker: string, title: string, detail: string, now: number, cue: 'earned' | 'friendly' | 'enemy'): void {
    this.banner.dataset.kind = 'mortar';
    this.cue(cue); this.banner.replaceChildren(kicker);
    const heading = document.createElement('strong'), subtitle = document.createElement('span');
    heading.textContent = title; subtitle.textContent = detail; this.banner.append(heading, subtitle); this.bannerUntil = now + 2800;
  }
  mortarInfo() { return this.mortar; }
  receive(payload: unknown, now: number, state: ArenaState | undefined, id: string): void {
    const next = readSupport(payload, now, this.width, this.depth);
    if (!next || !state) return;
    this.current = next;
    const me = state.players[id];
    for (const f of next.flights) {
      const key = `${f.owner}:${f.startedAt}`;
      if (this.announced.has(key)) continue;
      this.announced.add(key);
      if (this.announced.size > 32) this.announced.delete(this.announced.values().next().value!);
      if (!me?.alive || !document.pointerLockElement || state.phase !== 'live' || now - f.startedAt > 750) continue;
      const own = f.owner === id, friendly = own || (state.mode !== 3 && me.team === f.team);
      this.cue(own ? 'earned' : friendly ? 'friendly' : 'enemy');
      this.banner.dataset.kind = 'recon';
      this.banner.replaceChildren();
      this.banner.append(own ? '3 ELIMINATIONS / SUPPORT EARNED' : friendly ? 'TEAM SUPPORT / AIRBORNE' : 'HOSTILE SUPPORT / AIRBORNE');
      const heading = document.createElement('strong'), subtitle = document.createElement('span');
      heading.textContent = own ? 'UAV ONLINE' : friendly ? 'FRIENDLY UAV' : 'ENEMY UAV';
      subtitle.textContent = friendly ? 'Three scans. Last-seen contacts on your map.' : 'Radar sweep incoming. Eliminate its operator to end it.';
      this.banner.append(heading, subtitle); this.bannerUntil = now + 3000;
    }
    if (next.scan && next.scan.sampledAt !== this.pulseAt) {
      this.pulseAt = next.scan.sampledAt;
      if (now - next.scan.sampledAt < 500 && me?.alive && document.pointerLockElement) this.cue('pulse');
    }
  }
  update(state: ArenaState, id: string, now: number, online: boolean, blackout: boolean, playing = true): SupportView {
    const me = state.players[id], eligible = playing && online && !!me?.alive && state.phase === 'live' && state.mode !== 1 &&
      (state.mode !== 3 || Object.keys(state.players).length > 1);
    if (!online || !me?.alive || state.phase !== 'live') { this.current = emptySupport(); this.bannerUntil = 0; }
    if (!online || state.phase !== 'live') this.mortar = emptyMortar();
    this.root.hidden = !eligible; this.banner.hidden = !eligible || now >= this.bannerUntil;
    const friendly = this.current.flights.find(f => f.endsAt > now && (f.owner === id || state.mode !== 3 && f.team === me?.team));
    const queued = this.current.queued;
    let label = friendly ? `UAV ONLINE / ${Math.ceil((friendly.endsAt - now) / 1000)}s` : queued ? 'UAV READY / HOLDING' : this.current.count >= RECON.kills ? 'UAV / DEPLOYED THIS LIFE' : `UAV / ${this.current.count} OF 3`;
    let detail = blackout && (friendly || queued) ? 'Signal lost. Scans blocked until relink.' : friendly ? 'Last-seen contacts. New scan every 4s.' : queued ? `Airspace clears in ${Math.max(0, Math.ceil((this.current.readyAt - now) / 1000))}s. Stay alive.` : this.current.count >= RECON.kills ? 'One UAV per life. Keep the streak going.' : state.mode === 3 ? 'Three eliminations without dying. Private recon rehearsal.' : 'Three eliminations without dying. Automatic team recon.';
    const ownStrike = this.mortar.strikes.find(s => s.owner === id && now < s.endsAt);
    const charge = this.mortar.available, cooldown = Math.max(0, Math.ceil((this.mortar.readyAt - now) / 1000));
    const binding = this.settings ? formatBinding(this.settings.get().binds.support) : 'V';
    if (this.current.count >= 3 || charge || ownStrike) {
      label = ownStrike ? 'MORTAR / BARRAGE ACTIVE' : charge ? cooldown ? `MORTAR / BATTERY ${cooldown}s` : 'MORTAR / READY' : this.current.count >= 5 ? 'MORTAR / SPENT THIS LIFE' : `MORTAR / ${this.current.count} OF 5`;
      detail = ownStrike ? 'Three rounds. Eliminate the operator to cancel.' : charge ? (this.settings?.get().binds.support.length === 0 ? 'Bind Call mortar in Settings.' : `[${binding}] Aim at open ground, 8-60m. Three rounds; keep clear.`) : 'Five eliminations without dying. Call a three-round barrage.';
    }
    const danger = me && this.mortar.strikes.find(s => now < s.startedAt + MORTAR.warningMs + (MORTAR.rounds - 1) * MORTAR.intervalMs &&
      (s.owner === id || s.team !== me.team || state.mode === 3) && Math.hypot(s.x - me.x, s.z - me.z) < MORTAR.radius + 4);
    if (danger) {
      label = 'MORTAR / LEAVE MARKED AREA';
      detail = now < danger.startedAt + MORTAR.warningMs ? `Impact ${((danger.startedAt + MORTAR.warningMs - now) / 1000).toFixed(1)}s. Get behind solid cover.` : 'Rounds landing. Get behind solid cover.';
    }
    if (now < this.denialUntil) detail = this.denial;
    this.root.dataset.mortarReady = String(charge);
    if (this.title.textContent !== label) this.title.textContent = label;
    if (this.detail.textContent !== detail) this.detail.textContent = detail;
    this.root.dataset.count = String(this.current.count);
    this.root.dataset.active = String(!!friendly);
    for (const [index, pip] of this.pips.entries()) { pip.hidden = this.current.count < 3 && index >= 3; pip.dataset.filled = String(this.current.count > index); }
    return this.current;
  }
  inspect(): SupportView { return this.current; }
  announcing(now: number): boolean { return now < this.bannerUntil; }
}
