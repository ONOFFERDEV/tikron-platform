import type { CompositorFrame } from '../compositor-preparation.js';
import { DeploymentFlowPanel } from '../deployment-banner.js';
import type { PlayerFlowState } from './flow-state.js';

const FLOW_SAMPLES = [
  { kind: 'preparing', stage: 'weapons-and-effects' },
  { kind: 'recovery', stage: 'weapons-and-effects', reason: 'preparation' },
  { kind: 'control-required', retry: false },
  { kind: 'expired' },
] as const satisfies readonly PlayerFlowState[];

/** Only detached, inert presentation copies are varied; settings and live flow stay intact. */
export function serviceCompositorFrames(frames: readonly CompositorFrame[]): CompositorFrame[] {
  const prepared: CompositorFrame[] = [];
  for (const frame of frames) {
    prepared.push(frame);
    if (frame.name !== 'settings') continue;
    for (const index of [1, 2]) {
      const copy = frame.node.cloneNode(true);
      if (!(copy instanceof HTMLElement)) continue;
      copy.inert = true;
      copy.querySelectorAll<HTMLElement>('[role=tabpanel]').forEach((panel, panelIndex) => {
        panel.hidden = panelIndex !== index;
      });
      copy.querySelectorAll('[role=tab]').forEach((tab, tabIndex) => {
        tab.setAttribute('aria-selected', String(tabIndex === index));
      });
      const binding = copy.querySelector<HTMLElement>('.bind-row .ui-button');
      if (binding) binding.dataset.capturing = 'true';
      copy.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(input => { input.checked = true; });
      prepared.push({ name: `settings-tab-${index}`, node: copy });
    }
  }
  const container = document.createElement('div');
  container.inert = true;
  const flow = new DeploymentFlowPanel({ retry() {}, returnToMenu() {} }, container);
  for (const state of FLOW_SAMPLES) {
    flow.render(state);
    const copy = container.cloneNode(true);
    if (copy instanceof HTMLElement) prepared.push({ name: `service-${state.kind}`, node: copy });
  }
  flow.dispose();
  return prepared;
}
