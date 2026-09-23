import { DRONE, emptyDrone } from '../src/drone.js';
import { readDrone } from './drone-view.js';
import { RECON, type SupportView } from '../src/air-support.js';
import type { ArenaState } from '../src/schema.js';
import { emptySupport, readSupport } from './support-view.js';
import { emptyMortar, MORTAR } from '../src/mortar.js';
import { readMortar } from './mortar-view.js';
import { formatBinding, type SettingsStore } from './settings.js';
import type { CompositorFrame } from './compositor-preparation.js';
import { FIELD_UI_COPY } from './ui/copy.js';
import { SUPPORT_FIELD_CSS } from './ui/combat-field-style.js';

export class SupportHud {
  private readonly root = document.createElement('aside');
  private readonly banner = document.createElement('aside');
  private readonly title = document.createElement('strong');
  private readonly detail = document.createElement('span');
  private readonly meter = document.createElement('div');
  private readonly pips = Array.from({ length: 7 }, () => document.createElement('i'));
  private mortar = emptyMortar();
  private drone = emptyDrone();
  private denialUntil = 0;
  private denial = '';
  private current = emptySupport();
  private bannerUntil = 0;
  private readonly announced = new Set<string>();
  private pulseAt = 0;
  constructor(private readonly cue: (kind: 'earned' | 'friendly' | 'enemy' | 'pulse') => void,
    private readonly width: number, private readonly depth: number, private readonly settings?: SettingsStore) {
    const style = document.createElement('style');
    style.textContent = `#airSupport{position:fixed;inset-inline-end:var(--ui-safe-edge);inset-block-end:9.5rem;inline-size:228px;box-sizing:border-box;padding:var(--ui-space-3) var(--ui-space-4);background:var(--ui-hud-backing);border-inline-end:var(--ui-border-emphasis) solid var(--ui-ally);color:var(--ui-text-primary);pointer-events:none;font:500 var(--ui-type-hud)/1.4 var(--ui-font-body)}
      #airSupport strong{display:block;font-size:var(--ui-type-hud);margin-block-end:var(--ui-space-2)}#airSupport span{display:block;color:var(--ui-text-secondary);line-height:1.5;font-size:var(--ui-type-hud);min-block-size:2.625rem}
      #airSupport .meter{display:flex;gap:var(--ui-space-1);margin-block-start:var(--ui-space-2)}#airSupport i{block-size:3px;flex:1;background:var(--ui-border-subtle)}#airSupport i[data-filled=true]{background:var(--ui-accent)}
      #supportBanner{position:fixed;inset-block-start:12.75rem;inset-inline-start:50%;transform:translateX(-50%);inline-size:380px;max-inline-size:calc(100vw - 32px);box-sizing:border-box;padding:var(--ui-space-3) var(--ui-space-6) var(--ui-space-4) 67px;border-block-start:var(--ui-border-emphasis) solid var(--ui-accent);background:var(--ui-hud-backing);color:var(--ui-text-primary);pointer-events:none;font:500 var(--ui-type-hud)/1.4 var(--ui-font-body)}
      #supportBanner::before{content:'';position:absolute;left:17px;top:23px;width:34px;height:34px;background:var(--ui-accent);clip-path:polygon(50% 0,58% 38%,100% 78%,100% 89%,58% 69%,58% 89%,73% 100%,27% 100%,42% 89%,42% 69%,0 89%,0 78%,42% 38%)}#supportBanner strong{display:block;font-size:var(--ui-type-panel);margin:var(--ui-space-1) 0}#supportBanner span{color:var(--ui-text-secondary);font-size:var(--ui-type-hud)}
      #supportBanner[data-kind=mortar]::before{clip-path:polygon(35% 0,65% 0,80% 25%,80% 65%,63% 85%,72% 100%,50% 92%,28% 100%,37% 85%,20% 65%,20% 25%);transform:rotate(30deg)}
      #supportBanner[data-kind=drone]::before{clip-path:polygon(0 10%,28% 10%,36% 36%,64% 36%,72% 10%,100% 10%,100% 38%,72% 38%,64% 64%,72% 72%,100% 72%,100% 100%,72% 100%,64% 72%,36% 72%,28% 100%,0 100%,0 72%,28% 72%,36% 64%,28% 38%,0 38%)}
      @media(max-width:800px){#airSupport{bottom:200px;right:16px;width:200px}#supportBanner{top:344px}}
      @media(max-width:520px){#airSupport{top:218px;bottom:auto;width:144px;padding:10px}#supportBanner{top:406px;padding-top:9px;padding-bottom:9px}#supportBanner strong{font-size:17px}}
      @media(max-height:650px) and (min-width:801px){#airSupport{bottom:145px}#supportBanner{top:195px}}`;
    style.textContent += SUPPORT_FIELD_CSS;
    document.head.append(style);
    this.root.id = 'airSupport'; this.root.hidden = true;
    this.banner.id = 'supportBanner'; this.banner.hidden = true; this.banner.setAttribute('role', 'status');
    this.meter.className = 'meter'; this.meter.append(...this.pips);
    this.root.append(this.title, this.detail, this.meter); document.body.append(this.root, this.banner);
  }
  receiveDrone(payload: unknown, now: number, state: ArenaState | undefined, id: string): void {
    const next = readDrone(payload, now, this.width, this.depth); if (!next || !state) return;
    const launched = next.flights.find(f => !this.drone.flights.some(old => old.owner === f.owner && old.startedAt === f.startedAt) && now-f.startedAt<750);
    this.drone = next;
    if (!state.players[id]?.alive || !document.pointerLockElement) return;
    if (launched) {
      const own=launched.owner===id, friendly=own || state.mode!==3 && launched.team===state.players[id]!.team;
      this.announce(own?'7처치 · 지원 획득':'항공 지원 · 복엽기',own?FIELD_UI_COPY.support.inbound:friendly?FIELD_UI_COPY.support.friendlyInbound:FIELD_UI_COPY.support.hostileInbound,
        FIELD_UI_COPY.support.corridorWarning,now,own?'earned':friendly?'friendly':'enemy');
    } else return;
    this.banner.dataset.kind='drone';
  }
  compositorFrames(): CompositorFrame[] {
    return ['recon', 'mortar', 'drone'].map(kind => {
      const node = document.createElement('div');
      const meter = this.root.cloneNode(true) as HTMLElement; meter.hidden = false;
      meter.querySelector('strong')!.textContent = FIELD_UI_COPY.support.ready;
      meter.querySelector('span')!.textContent = FIELD_UI_COPY.support.biplaneAvailable;
      meter.dataset.mortarReady = String(kind === 'mortar');
      for (const [index, pip] of meter.querySelectorAll('i').entries()) {
        pip.hidden = false; pip.dataset.filled = String(index < 3);
      }
      const banner = this.banner.cloneNode(true) as HTMLElement; banner.hidden = false;
      banner.dataset.kind = kind;
      banner.innerHTML = `항공 지원<strong>${FIELD_UI_COPY.support.ready}</strong><span>${FIELD_UI_COPY.support.biplaneAvailable}</span>`;
      node.append(meter, banner);
      return { name: `support-${kind}`, node };
    });
  }
  rally(_payload: unknown, _now: number): void {}
  droneInfo() { return this.drone; }
  receiveMortar(payload: unknown, now: number, state: ArenaState | undefined, id: string): void {
    const next = readMortar(payload, now, this.width, this.depth); if (!next || !state) return;
    const earned = next.available && !this.mortar.available;
    const called = next.strikes.find(s => !this.mortar.strikes.some(old => old.owner === s.owner && old.startedAt === s.startedAt) && now - s.startedAt < 750);
    this.mortar = next;
    if (!state.players[id]?.alive || !document.pointerLockElement) return;
    if (earned) this.announce('5처치 · 지원 획득', FIELD_UI_COPY.support.mortarReady, '8~60m 안의 노출된 지면을 조준해 3발 포격을 요청하세요.', now, 'earned');
    else if (called) {
      this.denialUntil = 0;
      const own = called.owner === id, friendly = own || state.mode !== 3 && called.team === state.players[id]!.team;
      this.announce('포격 임무 · 3발', own ? '표식 확인' : friendly ? '아군 박격포' : '적 박격포',
        '3초 뒤 착탄합니다. 표시된 지면에서 벗어나세요.', now, friendly ? 'friendly' : 'enemy');
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
      this.banner.append(own ? '3처치 · 지원 획득' : friendly ? '아군 지원 · 비행 중' : '적 지원 · 비행 중');
      const heading = document.createElement('strong'), subtitle = document.createElement('span');
      heading.textContent = own ? `${FIELD_UI_COPY.support.recon} 개시` : friendly ? `아군 ${FIELD_UI_COPY.support.recon}` : `적 ${FIELD_UI_COPY.support.recon}`;
      subtitle.textContent = friendly ? '세 차례 관측합니다. 지도에는 마지막 확인 위치만 표시됩니다.' : '적 관측기가 접근합니다. 운용병을 처치하면 종료됩니다.';
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
    if (!online || state.phase !== 'live') { this.mortar = emptyMortar(); this.drone = emptyDrone(); }
    this.root.hidden = !eligible; this.banner.hidden = !eligible || now >= this.bannerUntil;
    const friendly = this.current.flights.find(f => f.endsAt > now && (f.owner === id || state.mode !== 3 && f.team === me?.team));
    const queued = this.current.queued;
    let label = friendly ? `${FIELD_UI_COPY.support.recon} · ${Math.ceil((friendly.endsAt - now) / 1000)}초` : queued ? `${FIELD_UI_COPY.support.recon} · 대기` : this.current.count >= RECON.kills ? `${FIELD_UI_COPY.support.recon} · 이번 생명 사용 완료` : `${FIELD_UI_COPY.support.recon} · ${this.current.count}/3`;
    let detail = blackout && (friendly || queued) ? '연락선 복구까지 관측이 중단됩니다.' : friendly ? '지도에 마지막 확인 위치를 4초마다 갱신합니다.' : queued ? `공역 확보까지 ${Math.max(0, Math.ceil((this.current.readyAt - now) / 1000))}초. 생존하세요.` : this.current.count >= RECON.kills ? '생명당 한 번 사용할 수 있습니다.' : state.mode === 3 ? '죽지 않고 3처치하여 관측 훈련을 시작합니다.' : '죽지 않고 3처치하면 분대 관측이 자동 시작됩니다.';
    const ownStrike = this.mortar.strikes.find(s => s.owner === id && now < s.endsAt);
    const charge = this.mortar.available, cooldown = Math.max(0, Math.ceil((this.mortar.readyAt - now) / 1000));
    const binding = this.settings ? formatBinding(this.settings.get().binds.support) : 'V';
    if (this.current.count >= 3 || charge || ownStrike) {
      label = ownStrike ? '박격포 · 포격 중' : charge ? cooldown ? `박격포 · 포대 대기 ${cooldown}초` : '박격포 · 준비' : this.current.count >= 5 ? '박격포 · 이번 생명 사용 완료' : `박격포 · ${this.current.count}/5`;
      detail = ownStrike ? '3발 포격 중입니다. 운용병이 처치되면 취소됩니다.' : charge ? (this.settings?.get().binds.support.length === 0 ? '설정에서 지원 요청 키를 지정하세요.' : `[${binding}] 8~60m 안의 노출된 지면을 조준하세요. 3발 착탄 구역을 피하십시오.`) : '죽지 않고 5처치하면 3발 포격을 요청할 수 있습니다.';
    }
    const strafe = this.drone.flights.find(f=>now<f.endsAt && (f.owner===id || state.mode!==3 && f.team===me?.team));
    if ((this.current.count>=5 && !charge && !ownStrike) || this.drone.queued || strafe) {
      label=strafe?`복엽기 소사 · ${Math.ceil((strafe.endsAt-now)/1000)}초`:this.drone.queued?'복엽기 소사 · 대기':this.current.count>=DRONE.kills?'복엽기 소사 · 이번 생명 사용 완료':`복엽기 소사 · ${this.current.count}/7`;
      detail=strafe?'표시된 회랑을 따라 한 차례 직선 소사가 지나갑니다.':this.drone.queued?'아군 공역이 확보될 때까지 생존하세요.':'죽지 않고 7처치하면 고정 경로 복엽기 소사를 요청합니다.';
      if (charge) detail+=` Mortar ready [${binding}].`;
    } else if (this.current.count>=5 && charge) detail+=` Air strafe: ${this.current.count}/7.`;
    const inCorridor = me && this.drone.flights.some(f => f.corridor && now < f.endsAt && f.team !== me.team &&
      Math.abs((f.corridor.end.x-f.corridor.start.x)*(me.z-f.corridor.start.z)
        -(f.corridor.end.z-f.corridor.start.z)*(me.x-f.corridor.start.x))
        / DRONE.corridorLength <= f.corridor.width/2);
    if (inCorridor) { label='복엽기 소사 · 회랑 이탈';detail=FIELD_UI_COPY.support.corridorWarning; }
    const danger = me && this.mortar.strikes.find(s => now < s.startedAt + MORTAR.warningMs + (MORTAR.rounds - 1) * MORTAR.intervalMs &&
      (s.owner === id || s.team !== me.team || state.mode === 3) && Math.hypot(s.x - me.x, s.z - me.z) < MORTAR.radius + 4);
    if (danger) {
      label = '박격포 · 표시 구역 이탈';
      detail = now < danger.startedAt + MORTAR.warningMs ? `${((danger.startedAt + MORTAR.warningMs - now) / 1000).toFixed(1)}초 뒤 착탄. 단단한 엄폐물 뒤로 이동하세요.` : '착탄 중입니다. 단단한 엄폐물 뒤로 이동하세요.';
    }
    if (now < this.denialUntil) detail = this.denial;
    this.root.dataset.mortarReady = String(charge);
    if (this.title.textContent !== label) this.title.textContent = label;
    if (this.detail.textContent !== detail) this.detail.textContent = detail;
    this.root.dataset.count = String(this.current.count);
    this.root.dataset.active = String(!!friendly);
    for (const [index, pip] of this.pips.entries()) { pip.hidden = index >= (this.current.count < 3 ? 3 : this.current.count < 5 ? 5 : 7); pip.dataset.filled = String(this.current.count > index); }
    return this.current;
  }
  inspect(): SupportView { return this.current; }
  announcing(now: number): boolean { return now < this.bannerUntil; }
}
