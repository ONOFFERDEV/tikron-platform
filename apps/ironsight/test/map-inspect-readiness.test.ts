import { expect, it, vi } from 'vitest';
import { renderStaticInspection, type MapInspectionProgress } from '../client/map-inspect-readiness.js';

const initial = (): MapInspectionProgress => ({
  phase: 'preparing', frameCount: 0, readyForInspection: false,
  environmentLoading: true, performanceComplete: false,
});

it('publishes static readiness after preparation and two real renders without performance warmup', async () => {
  const progress = initial();
  const render = vi.fn();
  const phases: string[] = [];
  const ready = await renderStaticInspection({
    progress,
    prepare: async () => undefined,
    readyForInspection: () => true,
    render,
    nextFrame: async () => 1234,
    publish: state => phases.push(state.phase),
  });
  expect(ready).toBe(true);
  expect(render).toHaveBeenCalledTimes(2);
  expect(progress).toMatchObject({ phase: 'static-rendered', frameCount: 0,
    readyForInspection: true, environmentLoading: false, performanceComplete: false,
    lastRafAt: 1234 });
  expect(phases).toEqual(['preparing', 'assets-ready', 'waiting-render', 'static-rendered']);
});

it('does not publish static readiness while environment assets remain unready', async () => {
  const progress = initial();
  const render = vi.fn();
  const ready = await renderStaticInspection({
    progress,
    prepare: async () => undefined,
    readyForInspection: () => false,
    render,
    nextFrame: async () => 1234,
    publish: () => undefined,
  });
  expect(ready).toBe(false);
  expect(render).not.toHaveBeenCalled();
  expect(progress).toMatchObject({ phase: 'waiting-assets', readyForInspection: false,
    environmentLoading: true, performanceComplete: false });
});
