import { describe, expect, it } from 'vitest';
import { WEAPON_ACTION_INSPECTIONS, classifyWeapon, classifyWeaponActions, scenarioHandlers } from '../scripts/aside-scenarios/art.mjs';

const definition = cases => ({ cases });

describe('art Aside classification', () => {
  it('enumerates bounded visual action contacts across all five weapon slots', () => {
    expect(new Set(WEAPON_ACTION_INSPECTIONS.map(item => item.weapon))).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(WEAPON_ACTION_INSPECTIONS.map(item => [item.shot, item.action, item.sample])).toEqual([
      ['automatic-reload-in', 'reload', .58], ['trench-reload-in', 'reload', .58],
      ['shotgun-shell-insert', 'reload', .58], ['shotgun-pump-cycle', 'cycle', .5],
      ['rifle-bolt-lift', 'cycle', .1], ['rifle-bolt-pull', 'cycle', .3],
      ['rifle-bolt-return', 'cycle', .65], ['rifle-bolt-lock', 'cycle', .9],
      ['pistol-magazine-insert', 'reload', .58],
    ]);
  });
  it('registers every art scenario declared by the manifest', () => {
    expect(Object.keys(scenarioHandlers).sort()).toEqual([
      'art-character', 'art-character-poses', 'art-scene', 'art-weapon', 'art-weapon-actions',
    ]);
  });
  it('accepts exact five-slot inspector geometry but keeps unsupported input cases unqualified', () => {
    const samples = [0, 1, 2, 3, 4].map(weapon => ({ weapon, ready: true, artifact: { path: `${weapon}.png`, bytes: 10 },
      report: { framing: { sourceMuzzleError: .0001, weaponPixels: 20 } } }));
    const report = classifyWeapon(definition(['five', 'sockets', 'ads', 'fallback']),
      { samples, actualAds: null, missingMesh: null });
    expect(report.cases.map(item => item.verdict)).toEqual(['PASS', 'PASS', 'UNQUALIFIED', 'UNQUALIFIED']);
  });

  it('never upgrades synthetic timelines when native pointer lock was unavailable', () => {
    const report = classifyWeaponActions(definition(['timeline', 'lifecycle', 'deadline']), {
      pointerLock: { acquired: false, error: 'WrongDocumentError' },
      timelines: [0, 1, 2, 3, 4].map(weapon => ({ weapon, trusted: true, phases: ['reload'] })),
      lifecycle: { switchReset: true, deathReset: true, reconnectResumed: true, lateEchoRejected: true },
      deadline: { earlyReadyRejected: true }, artifacts: [],
    });
    expect(report.inputProvenance).toBe('none');
    expect(report.cases.every(item => item.verdict === 'UNQUALIFIED')).toBe(true);
  });

  it('requires every lifecycle edge and early-ready rejection after real input', () => {
    const timelines = [0, 1, 2, 3, 4].map(weapon => ({ weapon, trusted: true, phases: ['idle', 'reload'] }));
    const report = classifyWeaponActions(definition(['timeline', 'lifecycle', 'deadline']), {
      pointerLock: { acquired: true }, timelines,
      lifecycle: { switchReset: true, deathReset: true, reconnectResumed: true, lateEchoRejected: false },
      deadline: { earlyReadyRejected: false }, artifacts: [],
    });
    expect(report.cases.map(item => item.verdict)).toEqual(['PASS', 'FAIL', 'FAIL']);
  });
});
