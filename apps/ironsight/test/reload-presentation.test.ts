import { describe, expect, it } from 'vitest';
import { ReloadPresentation, inspectionWeaponAction, reloadPose, remoteReloadProgress, weaponActionPose } from '../client/reload-presentation.js';
import type { WeaponActionState } from '../src/weapon-action.js';

describe('server-driven reload presentation', () => {
  it('is idle until acknowledged and finishes at the authoritative deadline', () => {
    const timeline = new ReloadPresentation(); expect(timeline.progress(0)).toBeNull();
    timeline.sync(1800, 1800, 100); expect(timeline.progress(100)).toBe(0);
    expect(timeline.progress(1000)).toBe(0.5); expect(timeline.progress(1900)).toBeNull();
  });
  it('a repeated remaining-time acknowledgement does not restart the motion', () => {
    const timeline = new ReloadPresentation(); timeline.sync(1800, 1800, 0);
    timeline.sync(900, 1800, 900); expect(timeline.progress(900)).toBe(0.5);
    expect(timeline.progress(1800)).toBeNull();
  });
  it('weapon swap, death or cancellation immediately releases the animation', () => {
    const timeline = new ReloadPresentation(); timeline.sync(1800, 1800, 0);
    timeline.sync(0, 1800, 300); expect(timeline.progress(300)).toBeNull();
    expect(reloadPose(timeline.progress(300))).toMatchObject({ tilt: 0, magazine: 0, bolt: 0, reach: 0, phase: 'idle' });
  });
  it('scales phases to each server duration, including slower weapons', () => {
    for (const duration of [1350, 1800, 3100]) {
      const timeline = new ReloadPresentation(); timeline.sync(duration, duration, 0);
      expect(reloadPose(timeline.progress(duration * 0.4)).magazine).toBe(1);
      expect(reloadPose(timeline.progress(duration * 0.78)).bolt).toBe(1);
    }
  });
  it('seats the magazine before operating the bolt and returns continuously', () => {
    expect(reloadPose(0.70).magazine).toBe(0); expect(reloadPose(0.78).bolt).toBe(1);
    expect(reloadPose(0.999).tilt).toBeLessThan(0.001);
    expect(reloadPose(0).tilt).toBe(0);
  });
  it('invalid acknowledgements cannot leave an infinite reload', () => {
    const timeline = new ReloadPresentation(); timeline.sync(Infinity, 1800, 0);
    expect(timeline.progress(1)).toBeNull(); timeline.sync(-10, 1800, 0); expect(timeline.progress(1)).toBeNull();
  });
});

it('AOI entry resumes a remote reload at its server-clock phase', () => {
  expect(remoteReloadProgress(true, 5000, 2000, 4200)).toBeCloseTo(0.6);
  expect(remoteReloadProgress(true, 5000, 2000, 5000)).toBeNull();
  expect(remoteReloadProgress(false, 5000, 2000, 4200)).toBeNull();
  expect(remoteReloadProgress(true, 0, 2000, 4200)).toBeNull();
});

const action = (kind: WeaponActionState['kind'], phase: WeaponActionState['phase'], weaponIndex: number): WeaponActionState => ({
  weaponIndex, kind, phase, startedAt: 100, phaseStartedAt: 100, endsAt: 1100, serial: 7, committed: 0, fireBuffered: false,
});

describe('authoritative action presentation', () => {
  it('does not animate before a server action exists or after its deadline', () => {
    expect(weaponActionPose(null, 500)).toMatchObject({ phase: 'idle', pump: 0, shell: 0, clip: 0 });
    expect(weaponActionPose(action('cycle', 'cycle', 2), 1100)).toMatchObject({ phase: 'idle', pump: 0 });
  });

  it('distinguishes pump and bolt cycles from the same authoritative interval', () => {
    expect(weaponActionPose(action('cycle', 'cycle', 2), 600)).toMatchObject({ pump: 1, bolt: 0 });
    expect(weaponActionPose(action('cycle', 'cycle', 3), 600)).toMatchObject({ pump: 0, bolt: 1 });
  });

  it('orders the bolt hand through lift, pull, return, and lock', () => {
    const state = action('cycle', 'cycle', 3);
    const lift = weaponActionPose(state, 200);
    const pull = weaponActionPose(state, 400);
    const returning = weaponActionPose(state, 750);
    const lock = weaponActionPose(state, 1000);
    expect(lift.boltLift).toBeGreaterThan(lift.boltPull);
    expect(pull.boltPull).toBeGreaterThan(pull.boltReturn);
    expect(returning.boltReturn).toBeGreaterThan(returning.boltLock);
    expect(lock.boltLock).toBeGreaterThan(lock.boltPull);
  });

  it('presents shell inserts and stripper clips without granting ammunition', () => {
    expect(weaponActionPose(action('pump_reload', 'reload_insert', 2), 600)).toMatchObject({ shell: 1, reach: 1 });
    expect(weaponActionPose(action('bolt_reload', 'reload', 3), 600)).toMatchObject({ clip: 1, magazine: 0 });
  });

  it('keeps secondary ammunition hidden before reach and seats it before the deadline', () => {
    const shell = action('pump_reload', 'reload_insert', 2);
    expect(weaponActionPose(shell, 100).shell).toBe(0);
    expect(weaponActionPose(shell, 250).shell).toBeGreaterThan(0);
    expect(weaponActionPose(shell, 1000).shell).toBeLessThan(0.2);
    const clip = action('bolt_reload', 'reload', 3);
    expect(weaponActionPose(clip, 100).clip).toBe(0);
    expect(weaponActionPose(clip, 500).clip).toBeGreaterThan(0.5);
    expect(weaponActionPose(clip, 1000).clip).toBeLessThan(0.2);
  });

  it('late sync derives its pose from the server deadline', () => {
    const state = action('cycle', 'cycle', 3);
    expect(weaponActionPose(state, 850)).toEqual(weaponActionPose({ ...state }, 850));
    expect(weaponActionPose(state, 850).bolt).toBeGreaterThan(0);
  });
});

describe('synthetic inspector action adapter', () => {
  it('never leaves a requested authored preview pose silently idle', () => {
    for (let weaponIndex = 0; weaponIndex < 5; weaponIndex += 1) {
      const frame = inspectionWeaponAction(weaponIndex, 0.58);
      expect(frame.provenance).toBe('synthetic-inspector');
      expect(frame.state).not.toBeNull();
      expect(weaponActionPose(frame.state, frame.serverNow).phase).not.toBe('idle');
    }
  });

  it('keeps idle explicit and maps pump insertion plus bolt phases without server authority', () => {
    expect(inspectionWeaponAction(3, null)).toEqual({ state: null, serverNow: 0, provenance: 'synthetic-inspector' });
    const shell = inspectionWeaponAction(2, 0.58);
    expect(shell.state).toMatchObject({ kind: 'pump_reload', phase: 'reload_insert' });
    expect(weaponActionPose(shell.state, shell.serverNow).shell).toBeGreaterThan(0);
    const bolt = [0.4, 0.58, 0.78, 0.94].map(progress => {
      const frame = inspectionWeaponAction(3, progress, 'cycle');
      return weaponActionPose(frame.state, frame.serverNow);
    });
    expect(bolt[0]!.boltPull).toBeGreaterThan(0);
    expect(bolt[1]!.boltReturn).toBeGreaterThan(0);
    expect(bolt[2]!.boltReturn).toBeGreaterThan(0);
    expect(bolt[3]!.boltLock).toBeGreaterThan(0.9);
  });

  it('maps the exact bounded inspector samples to visible authored motion', () => {
    const reloads = [0, 1, 4].map(weaponIndex => {
      const frame = inspectionWeaponAction(weaponIndex, 0.58, 'reload');
      return weaponActionPose(frame.state, frame.serverNow);
    });
    expect(reloads.every(pose => pose.phase === 'mag-in' && pose.reach > 0)).toBe(true);

    const shell = inspectionWeaponAction(2, 0.58, 'reload');
    expect(weaponActionPose(shell.state, shell.serverNow)).toMatchObject({ phase: 'reload_insert' });
    const pump = inspectionWeaponAction(2, 0.5, 'cycle');
    expect(weaponActionPose(pump.state, pump.serverNow).pump).toBe(1);

    const [lift, pull, returning, lock] = [0.1, 0.3, 0.65, 0.9].map(progress => {
      const frame = inspectionWeaponAction(3, progress, 'cycle');
      return weaponActionPose(frame.state, frame.serverNow);
    });
    expect(lift!.boltLift).toBeGreaterThan(lift!.boltPull);
    expect(pull!.boltPull).toBeGreaterThan(pull!.boltReturn);
    expect(returning!.boltReturn).toBeGreaterThan(returning!.boltPull);
    expect(lock!.boltLock).toBeGreaterThan(0.8);
  });

});
