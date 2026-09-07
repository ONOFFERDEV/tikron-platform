import { Hud } from './hud.js';
import { SettingsStore } from './settings.js';
import type { ArenaState } from '../src/schema.js';

/** Offline UI fixtures. Never create a room or modify live authoritative state. */
export function startMatchInspector(): void {
  const hud = new Hud(new SettingsStore());
  const shot = new URLSearchParams(location.search).get('shot') ?? '';
  const state: ArenaState = { players: {}, seed: 1, redScore: 50, blueScore: 42,
    phase: 'ended', matchEndMs: 0, mode: 0, capA: 100, capB: 100, capC: 100 };
  hud.setMatchActions(() => { hud.markVoteSent(); hud.setVoteStatus(1, 2); render(); }, () => {});
  function render() {
    hud.setMatchContext(state, 0, 'self');
    if (shot === 'match-reconnect') hud.showConnection(false);
    else hud.showMatchEnd(shot === 'match-draw' ? 'draw' : 'red', 50, 42, 16, 9, false);
  }
  render();
  Object.assign(window, { __inspectReady: true, __mapInspect: { fixture: shot } });
}
