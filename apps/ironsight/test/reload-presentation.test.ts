import { describe, expect, it } from 'vitest';
import { ReloadPresentation, reloadPose } from '../client/reload-presentation.js';

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
