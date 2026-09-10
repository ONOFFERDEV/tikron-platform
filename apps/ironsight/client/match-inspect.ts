import { Hud } from './hud.js';
import { SettingsStore } from './settings.js';
import type { ArenaState } from '../src/schema.js';

/** Offline UI fixtures. Never create a room or modify live authoritative state. */
export function startMatchInspector(): void {
  const settings = new SettingsStore();
  const hud = new Hud(settings);
  const shot = new URLSearchParams(location.search).get('shot') ?? '';
  const state: ArenaState = { players: {}, seed: 1, redScore: 50, blueScore: 42,
    phase: 'ended', matchEndMs: 0, signalAt: 0, coreOpen: false, warmupEndMs: 0, mode: 0, capA: 100, capB: 100, capC: 100 };
  const solo = shot.includes('ffa');
  const dom = shot.includes('dom');
  const mvp = shot.includes('defeat')
    ? { id: 'rook', name: 'Rook', isMe: false, team: 1, kills: 14, assists: 5, captureSeconds: 0, score: 33 }
    : dom
    ? { id: 'sable', name: 'Sable', isMe: false, team: 0, kills: 12, assists: 7, captureSeconds: 16, score: 47 }
    : { id: 'self', name: 'KESTREL', isMe: true, team: 0, kills: 16, assists: 5, captureSeconds: 0, score: 37 };
  const rows = ['KESTREL', 'Sable', 'Morrow', 'Echo', 'Vega', 'Peregrine',
    'Rook', 'Sentinel', 'Warden', 'Lark', 'Copper', 'Northstar'].map((name, i) => ({
    name, k: [16, 12, 9, 6, 5, 2, 14, 10, 7, 5, 4, 2][i]!,
    d: [9, 7, 8, 6, 7, 5, 10, 8, 9, 7, 9, 7][i]!, team: i < 6 ? 0 : 1, isMe: i === 0,
  }));
  hud.setMatchActions(() => { hud.markVoteSent(); hud.setVoteStatus(1, 2); render(); }, () => {});
  function render() {
    hud.setMatchContext(state, 0, 'self');
    if (shot === 'match-reconnect') hud.showConnection(false);
    else hud.showMatchEnd(shot.includes('draw') ? 'draw' : solo ? 'KESTREL' : shot.includes('defeat') ? 'blue' : 'red',
      50, 42, 16, 9, solo, { rows, won: !shot.includes('defeat'), dom,
        intermissionEndMs: shot.includes('legacy') ? undefined : 20000,
        serverNow: shot.includes('standby') ? 20000 : 7000,
        mvp: shot.includes('draw') || shot.includes('legacy') ? undefined : mvp });
  }
  const checks: Record<string, boolean> = {};
  if (shot.startsWith('match-deployment')) {
    document.body.style.background = "#10242b url('/assets/relay-vista.webp') center / cover fixed";
    hud.setDeploymentSite(shot.includes('dom') ? 'Undertow' : shot.includes('ffa') ? 'Switchyard' : 'Relay');
    settings.setReducedMotion(shot.includes('reduced'));
    state.phase = 'warmup'; state.warmupEndMs = 10000;
    state.mode = shot.includes('dom') ? 2 : shot.includes('ffa') ? 1 : 0;
    hud.setMode(state.mode); hud.setScores(0, 0); hud.setWeapon(0);
    hud.updateDeployment(state, 6500, 'self', true);
    let now = 7000;
    if (shot.includes('waiting')) state.warmupEndMs = 0;
    if (shot.includes('standby')) now = 10000;
    if (shot.includes('go')) { state.phase = 'live'; state.warmupEndMs = 0; now = 10050; }
    hud.setMatchContext(state, now, 'self');
    hud.updateDeployment(state, now, 'self', true);
    const banner = document.querySelector<HTMLElement>('#deployment-banner')!;
    const rect = banner.getBoundingClientRect();
    checks.fits = rect.left >= 0 && rect.right <= innerWidth && banner.scrollWidth <= banner.clientWidth;
    checks.outsideAim = rect.bottom < innerHeight * .4;
    checks.liveRegion = banner.getAttribute('role') === 'status' && banner.getAttribute('aria-live') === 'polite';
    checks.noMotion = getComputedStyle(banner).animationName === 'none';
    checks.visible = !banner.hidden;
    checks.noOverlap = ['#ping', '#matchBrief'].every(selector => {
      const other = document.querySelector<HTMLElement>(selector)!;
      if (getComputedStyle(other).visibility === 'hidden') return true;
      const r = other.getBoundingClientRect();
      return rect.right <= r.left || rect.left >= r.right || rect.bottom <= r.top || rect.top >= r.bottom;
    });
    if (Object.values(checks).some(ok => !ok)) throw Error(`Deployment layout failed: ${JSON.stringify(checks)}`);
    if (shot.includes('before')) { banner.hidden = true; document.querySelector<HTMLElement>('#hud')!.dataset.deploying = 'false'; }
  } else if (shot.startsWith('match-network')) {
    document.body.style.background = "#10242b url('/assets/relay-vista.webp') center / cover fixed";
    hud.setMode(0); hud.setScores(24, 19); hud.setWeapon(0); hud.setFps(60);
    const panel = document.querySelector<HTMLElement>('#ping')!;
    hud.setPing(0, true, 1000);
    checks.measuring = panel.dataset.quality === 'measuring';
    hud.setPing(40, true, 2000);
    checks.low = panel.dataset.quality === 'low';
    hud.setPing(180, true, 2500);
    checks.spikeIgnored = panel.dataset.quality === 'low';
    hud.setPing(180, true, 4500);
    checks.high = panel.dataset.quality === 'high';
    hud.setPing(40, false, 4600);
    checks.offline = panel.textContent!.includes('RECONNECTING') && panel.textContent!.includes('— ms');
    hud.setPing(40, false, 4700, true);
    checks.expired = panel.textContent!.includes('CONNECTION LOST');
    hud.setPing(0, true, 4800);
    hud.setPing(shot.includes('high') ? 180 : shot.includes('delayed') ? 100 : 35, !shot.includes('offline'), 5500);
    checks.separateAnnouncement = panel.querySelector('[role="status"]')?.textContent === panel.querySelector('strong')?.textContent
      && !panel.querySelector('[role="status"]')?.textContent?.includes('fps');
    const rect = panel.getBoundingClientRect();
    checks.fits = rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
    checks.outsideAim = rect.right < innerWidth * .4 || rect.bottom < innerHeight * .4;
    if (Object.values(checks).some(ok => !ok)) throw Error(`Network HUD checks failed: ${JSON.stringify(checks)}`);
  } else if (shot.startsWith('match-combat')) {
    const indicator = document.querySelector<HTMLElement>('#damage-direction')!;
    const flash = document.querySelector<HTMLElement>('#damage-flash')!;
    const hitTime = performance.now();
    for (const [bearing, direction] of [[0, 'front'], [Math.PI / 2, 'right'], [Math.PI, 'back'], [-Math.PI / 2, 'left']] as const) {
      hud.showDamageDirection(bearing); hud.update(hitTime);
      checks[`damage-${direction}`] = indicator.dataset.direction === direction && indicator.style.opacity === '1';
    }
    hud.showDamageDirection(0); hud.update(hitTime, Math.PI / 2);
    checks.damageTracksView = indicator.dataset.direction === 'left';
    hud.update(hitTime, Math.PI * 2);
    checks.damageYawWrap = indicator.dataset.direction === 'front';
    hud.update(performance.now() + 1000);
    checks.damageExpired = indicator.style.opacity === '0' && flash.style.opacity === '0';
    hud.showDamageDirection(null); hud.update(performance.now());
    checks.unknownNoDirection = indicator.style.opacity === '0' && flash.style.opacity === '1';
    settings.setReducedMotion(true); hud.showDamageDirection(Math.PI / 2); hud.update(performance.now());
    checks.damageReduced = getComputedStyle(flash).display === 'none' && indicator.style.opacity === '1';
    hud.clearDamage(); hud.update(performance.now());
    checks.damageReset = indicator.style.opacity === '0' && flash.style.opacity === '0';
    // Exercise production HUD lifetime, escaping and capacity before freezing the review sample.
    const feed = document.querySelector('#feed')!;
    const confirm = document.querySelector<HTMLElement>('#elimination')!;
    for (let i = 0; i < 8; i++) hud.addKill('Other', '<img src=x onerror=alert(1)>', 'body', null);
    checks.bounded = feed.children.length === 5;
    checks.escaped = !feed.querySelector('img') && feed.textContent!.includes('<img');
    checks.remoteSilent = confirm.textContent === '';
    hud.addKill('Other','Victim','body',1,undefined,{medal:'ambush'});
    checks.remoteMedalSilent = confirm.textContent === '';
    hud.addKill('Self', 'Self', 'blast', null, undefined, { localKill: true, localVictim: true });
    checks.selfSilent = confirm.textContent === '';
    hud.addKill('Self', 'First', 'head', 0, undefined, { weapon: 4, localKill: true, medal:'ambush' });
    checks.ambush = confirm.querySelector('.ambush')?.textContent === 'AMBUSH';
    hud.addKill('Self', 'Latest', 'body', 0, undefined, { weapon: 1, localKill: true });
    checks.latest = confirm.querySelector('.target')?.textContent === 'Latest';
    checks.medalCleared = !confirm.querySelector('.ambush');
    hud.update(performance.now() + 1900);
    checks.confirmExpired = confirm.textContent === '' && confirm.style.opacity === '0';
    hud.update(performance.now() + 5100);
    checks.feedExpired = feed.children.length === 0;
    settings.setReducedMotion(true);
    hud.addKill('Motion', 'Test', 'body', 0);
    checks.reducedMotion = getComputedStyle(feed.firstElementChild!).animationName === 'none';
    hud.update(performance.now() + 5100);
    settings.setReducedMotion(shot.includes('reduced'));
    if (Object.values(checks).some(ok => !ok)) throw Error(`Combat HUD checks failed: ${JSON.stringify(checks)}`);
    document.body.style.background = "#10242b url('/assets/relay-vista.webp') center / cover fixed";
    hud.setMode(0); hud.setScores(24, 19); hud.setWeapon(0);
    hud.addKill('KESTREL', 'Rook', 'body', 0, undefined, { weapon: 1 });
    hud.addKill('Sable', 'Vega', 'blast', 1, 'Echo', { localVictim: true });
    hud.addKill('KESTREL', 'Sentinel', 'head', 0, undefined, { weapon: 4, localKill: true,
      medal:shot.includes('ambush')?'ambush':undefined });
    const bearing = shot.includes('back') ? Math.PI : shot.includes('left') ? -Math.PI / 2 : shot.includes('front') ? 0 : Math.PI / 2;
    hud.showDamageDirection(bearing); hud.update(performance.now());
    const marker = indicator.firstElementChild!.getBoundingClientRect();
    checks.damageFits = marker.left >= 0 && marker.right <= innerWidth && marker.top >= 0 && marker.bottom <= innerHeight;
    checks.damageOutsideAim = marker.right < innerWidth * .45 || marker.left > innerWidth * .55 || marker.bottom < innerHeight * .4 || marker.top > innerHeight * .6;
    const notice = confirm.getBoundingClientRect();
    checks.confirmFits = notice.left >= 0 && notice.right <= innerWidth && notice.bottom <= innerHeight && confirm.scrollWidth <= confirm.clientWidth;
    checks.damageClearOfNotice = marker.right <= notice.left || marker.left >= notice.right || marker.bottom <= notice.top || marker.top >= notice.bottom;
    if (Object.values(checks).some(ok => !ok)) throw Error(`Damage layout failed: ${JSON.stringify(checks)}`);
  } else {
    if (shot !== 'match-reconnect') {
      const sample = { rows: [{ name: '<img src=x onerror=alert(1)>', k: 1, d: 0, team: 0, isMe: true },
        { name: 'Leader', k: 10, d: 2, team: 0, isMe: false },
        { name: 'Tie fewer deaths', k: 10, d: 1, team: 0, isMe: false }], won: true };
      hud.showMatchEnd('red', 50, 42, 1, 0, false, sample);
      const overlay = document.querySelector<HTMLElement>('#overlay')!;
      checks.escapedRoster = !overlay.querySelector('img') && overlay.textContent!.includes('<img');
      hud.showMatchEnd('red', 50, 42, 1, 0, false, { ...sample, dom: true,
        mvp: { ...mvp, name: '<img src=x onerror=alert(1)>', id: '\"><img src=x>' } });
      checks.escapedMvp = !overlay.querySelector('img') && overlay.querySelector('.honorsBody h2')!.textContent!.includes('<img');
      checks.mvpRule = overlay.querySelector('.honorsRule')!.textContent!.includes('shared capture second');
      const card = overlay.querySelector('.roundHonors');
      hud.showMatchEnd('red', 50, 42, 1, 0, false, { ...sample, dom: true,
        mvp: { ...mvp, name: '<img src=x onerror=alert(1)>', id: '\"><img src=x>' } });
      checks.stableMvp = card === overlay.querySelector('.roundHonors');
      hud.showMatchEnd('red', 50, 42, 1, 0, false, sample);
      checks.oldServer = !overlay.querySelector('.roundHonors');
      checks.legacyCountdown = overlay.querySelector('[data-next-round]')?.textContent === 'AUTOMATIC / STAND BY';
      hud.showMatchEnd('red', 50, 42, 1, 0, false, { ...sample, intermissionEndMs: 20000, serverNow: 7000 });
      const countdownCard = overlay.querySelector('.debrief');
      const focusedButton = document.activeElement;
      checks.deadlineCountdown = overlay.querySelector('[data-next-round]')?.textContent === 'IN 13s';
      hud.showMatchEnd('red', 50, 42, 1, 0, false, { ...sample, intermissionEndMs: 20000, serverNow: 8000 });
      checks.stableCountdown = countdownCard === overlay.querySelector('.debrief') && document.activeElement === focusedButton;
      checks.countdownAdvances = overlay.querySelector('[data-next-round]')?.textContent === 'IN 12s';
      hud.showMatchEnd('red', 50, 42, 1, 0, false, { ...sample, intermissionEndMs: 20000, serverNow: 25000 });
      checks.noLocalStart = overlay.querySelector('[data-next-round]')?.textContent === 'AWAITING SERVER';
      checks.sorted = overlay.querySelector('tbody tr td:nth-child(2)')?.textContent === 'Tie fewer deaths';
      checks.localRow = overlay.querySelectorAll('tr.me').length === 1;
      checks.zeroDeaths = overlay.querySelector('.personalStats div:last-child strong')?.textContent === '—';
      checks.initialFocus = document.activeElement?.getAttribute('data-action') === 'restart';
      hud.showMatchEnd('blue', 42, 50, 1, 0, false, { ...sample, won: false });
      checks.defeat = overlay.querySelector('h1')?.textContent === 'DEFEAT';
      hud.showMatchEnd('draw', 0, 0, 0, 0, true, sample);
      checks.soloDraw = overlay.querySelector('h1')?.textContent === 'DRAW' && !overlay.querySelector('.finalScore');
      hud.showMatchEnd('<img src=x>', 0, 0, 1, 0, true, sample);
      checks.escapedWinner = !overlay.querySelector('img') && overlay.querySelector('.resultWinner')?.textContent?.includes('<img') === true;
      hud.markVoteSent(); hud.setVoteStatus(1, 2);
      hud.showMatchEnd('red', 50, 42, 1, 0, false, sample);
      checks.voteFocus = document.activeElement?.getAttribute('data-action') === 'leave';
      checks.voteDisabled = overlay.querySelector<HTMLButtonElement>('[data-action="restart"]')?.disabled === true;
      hud.resetVoteStatus();
      if (Object.values(checks).some(ok => !ok)) throw Error(`Results checks failed: ${JSON.stringify(checks)}`);
    }
    settings.setReducedMotion(shot.includes('reduced'));
    hud.update(performance.now());
    render();
    if (shot !== 'match-reconnect') {
      const overlay = document.querySelector<HTMLElement>('#overlay')!;
      const panel = overlay.querySelector<HTMLElement>('.debrief')!;
      const rect = panel.getBoundingClientRect();
      checks.horizontalFit = rect.left >= 0 && rect.right <= innerWidth && panel.scrollWidth <= panel.clientWidth;
      checks.rosterComplete = overlay.querySelectorAll('tbody tr').length === rows.length;
      const honors = overlay.querySelector<HTMLElement>('.roundHonors');
      checks.mvpPresent = !!honors === !(shot.includes('draw') || shot.includes('legacy'));
      if (honors) {
        checks.mvpFits = honors.scrollWidth <= honors.clientWidth && honors.getBoundingClientRect().right <= innerWidth;
        checks.mvpScore = honors.querySelector('.honorsScore strong')!.textContent === String(mvp.score);
        checks.mvpMotion = !shot.includes('reduced') || getComputedStyle(honors).animationName === 'none';
      }
      overlay.scrollTop = overlay.scrollHeight;
      const actions = overlay.querySelector('.resultActions')!.getBoundingClientRect();
      checks.actionsReachable = actions.top >= 0 && actions.bottom <= innerHeight;
      overlay.scrollTop = 0;
      checks.headingReachable = overlay.querySelector('h1')!.getBoundingClientRect().top >= 0;
      if (Object.values(checks).some(ok => !ok)) throw Error(`Results layout failed: ${JSON.stringify(checks)}`);
    }
  }
  Object.assign(window, { __inspectReady: true, __mapInspect: { fixture: shot, checks } });
}
