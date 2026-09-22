import { MODES } from '../src/config.js';
import { MODE_ORDER } from '../src/modes.js';
import type { ArenaState } from '../src/schema.js';
import { warmupSeconds } from './deployment-presentation.js';
import { COPY, formatCopy } from './ui/copy.js';

/** Presentation only: time and objectives never decide the round outcome. */
export function matchBrief(state: ArenaState, serverNow: number, myId: string) {
  const mode = MODE_ORDER[state.mode] ?? 'tdm';
  const team = state.players[myId]?.team === 1 ? COPY.match.affiliations.blue : COPY.match.affiliations.red;
  const objective = mode === 'dom' ? formatCopy(COPY.match.objectives.domFmt, { target: MODES.dom.scoreTarget })
    : mode === 'ffa' ? formatCopy(COPY.match.objectives.ffaFmt, { target: MODES.ffa.killTarget })
    : mode === 'practice' ? COPY.match.objectives.practice
    : formatCopy(COPY.match.objectives.tdmFmt, { target: MODES.tdm.killTarget });
  const seconds = Math.max(0, Math.ceil((state.matchEndMs - serverNow) / 1000));
  const warmup = warmupSeconds(state, serverNow);
  const clock = state.phase === 'ended' ? COPY.match.clocks.roundComplete
    : state.phase === 'warmup' ? warmup === null ? COPY.match.clocks.warmupWaiting
      : warmup === 0 ? COPY.match.clocks.warmupStandBy : formatCopy(COPY.match.clocks.deployInFmt, { seconds: warmup })
    : mode === 'practice' || !Number.isFinite(seconds) ? COPY.match.clocks.noTimeLimit
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return { objective, clock, affiliation: mode === 'tdm' || mode === 'dom' ? team : COPY.match.affiliations.solo,
    urgent: state.phase === 'live' && mode !== 'practice' && seconds <= 30 };
}
