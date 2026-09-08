import { Hud } from './hud.js';
import { SettingsStore } from './settings.js';
import type { ArenaState } from '../src/schema.js';

/** Offline UI fixtures. Never create a room or modify live authoritative state. */
export function startMatchInspector(): void {
  const settings = new SettingsStore();
  const hud = new Hud(settings);
  const shot = new URLSearchParams(location.search).get('shot') ?? '';
  const state: ArenaState = { players: {}, seed: 1, redScore: 50, blueScore: 42,
    phase: 'ended', matchEndMs: 0, mode: 0, capA: 100, capB: 100, capC: 100 };
  const solo = shot.includes('ffa');
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
      50, 42, 16, 9, solo, { rows, won: !shot.includes('defeat') });
  }
  const checks: Record<string, boolean> = {};
  if (shot.startsWith('match-combat')) {
    // Exercise production HUD lifetime, escaping and capacity before freezing the review sample.
    const feed = document.querySelector('#feed')!;
    const confirm = document.querySelector<HTMLElement>('#elimination')!;
    for (let i = 0; i < 8; i++) hud.addKill('Other', '<img src=x onerror=alert(1)>', 'body', null);
    checks.bounded = feed.children.length === 5;
    checks.escaped = !feed.querySelector('img') && feed.textContent!.includes('<img');
    checks.remoteSilent = confirm.textContent === '';
    hud.addKill('Self', 'Self', 'blast', null, undefined, { localKill: true, localVictim: true });
    checks.selfSilent = confirm.textContent === '';
    hud.addKill('Self', 'First', 'head', 0, undefined, { weapon: 4, localKill: true });
    hud.addKill('Self', 'Latest', 'body', 0, undefined, { weapon: 1, localKill: true });
    checks.latest = confirm.querySelector('.target')?.textContent === 'Latest';
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
    hud.addKill('KESTREL', 'Sentinel', 'head', 0, undefined, { weapon: 4, localKill: true });
  } else {
    if (shot !== 'match-reconnect') {
      const sample = { rows: [{ name: '<img src=x onerror=alert(1)>', k: 1, d: 0, team: 0, isMe: true },
        { name: 'Leader', k: 10, d: 2, team: 0, isMe: false },
        { name: 'Tie fewer deaths', k: 10, d: 1, team: 0, isMe: false }], won: true };
      hud.showMatchEnd('red', 50, 42, 1, 0, false, sample);
      const overlay = document.querySelector<HTMLElement>('#overlay')!;
      checks.escapedRoster = !overlay.querySelector('img') && overlay.textContent!.includes('<img');
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
    render();
    if (shot !== 'match-reconnect') {
      const overlay = document.querySelector<HTMLElement>('#overlay')!;
      const panel = overlay.querySelector<HTMLElement>('.debrief')!;
      const rect = panel.getBoundingClientRect();
      checks.horizontalFit = rect.left >= 0 && rect.right <= innerWidth && panel.scrollWidth <= panel.clientWidth;
      checks.rosterComplete = overlay.querySelectorAll('tbody tr').length === rows.length;
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
