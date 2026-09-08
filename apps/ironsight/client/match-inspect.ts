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
  hud.setMatchActions(() => { hud.markVoteSent(); hud.setVoteStatus(1, 2); render(); }, () => {});
  function render() {
    hud.setMatchContext(state, 0, 'self');
    if (shot === 'match-reconnect') hud.showConnection(false);
    else hud.showMatchEnd(shot === 'match-draw' ? 'draw' : 'red', 50, 42, 16, 9, false);
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
  } else render();
  Object.assign(window, { __inspectReady: true, __mapInspect: { fixture: shot, checks } });
}
