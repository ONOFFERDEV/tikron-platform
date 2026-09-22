import { CombatTelemetry } from './combat-telemetry.js';

declare global {
  interface Window {
    __ironsightQa?: {
      read(): unknown;
      drainTelemetry(): unknown;
      telemetryCsv(): string;
    };
  }
}

export interface CombatTelemetryProbe {
  readonly telemetry: CombatTelemetry;
  dispose(): void;
}

export function installCombatTelemetryProbe(canvas: HTMLCanvasElement, enabled: boolean): CombatTelemetryProbe {
  const telemetry = new CombatTelemetry({ enabled });
  if (!enabled) return { telemetry, dispose: () => {} };
  const provenance = (event: Event) => ({
    source: event.isTrusted ? 'trusted-device' as const : 'synthetic' as const,
    trusted: event.isTrusted,
  });
  const active = () => document.pointerLockElement === canvas;
  const down = (event: MouseEvent) => {
    if (event.button === 0) telemetry.captureInput('fire', 'press', performance.now(), provenance(event), active());
    else if (event.button === 2) telemetry.captureInput('ads', 'press', performance.now(), provenance(event), active());
  };
  const up = (event: MouseEvent) => {
    if (event.button === 2) telemetry.captureInput('ads', 'release', performance.now(), provenance(event), active());
  };
  canvas.addEventListener('mousedown', down);
  window.addEventListener('mouseup', up);
  const previous = window.__ironsightQa;
  const installed = {
    read: () => telemetry.snapshot().hud,
    drainTelemetry: () => telemetry.snapshot(),
    telemetryCsv: () => telemetry.csv(),
  };
  window.__ironsightQa = installed;
  return {
    telemetry,
    dispose: () => {
      canvas.removeEventListener('mousedown', down);
      window.removeEventListener('mouseup', up);
      if (window.__ironsightQa === installed) window.__ironsightQa = previous;
      telemetry.reset('dispose', performance.now());
    },
  };
}
