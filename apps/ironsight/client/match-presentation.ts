import { MODES } from '../src/config.js';
import { MODE_ORDER } from '../src/modes.js';
import type { ArenaState } from '../src/schema.js';

/** Presentation only: time and objectives never decide the round outcome. */
export function matchBrief(state: ArenaState, serverNow: number, myId: string) {
  const mode = MODE_ORDER[state.mode] ?? 'tdm';
  const team = state.players[myId]?.team === 1 ? 'BLUE' : 'RED';
  const objective = mode === 'dom' ? `HOLD A / B / C · FIRST TO ${MODES.dom.scoreTarget}`
    : mode === 'ffa' ? `EVERY OPERATOR FOR THEMSELVES · ${MODES.ffa.killTarget} KILLS`
    : mode === 'practice' ? 'TRAINING · MOVE, AIM, FIRE, RELOAD'
    : `ELIMINATE THE OPPOSITION · FIRST TO ${MODES.tdm.killTarget}`;
  const seconds = Math.max(0, Math.ceil((state.matchEndMs - serverNow) / 1000));
  const clock = state.phase === 'ended' ? 'ROUND COMPLETE'
    : state.phase === 'warmup' ? 'WARMUP · STARTS AUTOMATICALLY'
    : mode === 'practice' || !Number.isFinite(seconds) ? 'NO TIME LIMIT'
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return { objective, clock, affiliation: mode === 'tdm' || mode === 'dom' ? `${team} TEAM` : 'SOLO',
    urgent: state.phase === 'live' && mode !== 'practice' && seconds <= 30 };
}
