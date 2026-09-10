import { Hud } from './hud.js';
import { SettingsStore } from './settings.js';
import { SupportHud } from './support-hud.js';
import { SignalHud } from './signal-hud.js';
import { PingWheel } from './ping-wheel.js';
import { prepareCompositor, peripheralCompositorFrames } from './compositor-preparation.js';
import { settingsCompositorFrame, openSettings, closeSettings } from './settings-ui.js';
import { pauseCompositorFrame } from './quit-confirm.js';

/** Offline browser regression: warmup must paint, clean up, preserve focus/live
 * presentation and settings, then leave the real settings entry point usable. */
export async function startCompositorInspector(): Promise<void> {
  const settings = new SettingsStore();
  const shot = new URLSearchParams(location.search).get('shot') ?? '';
  settings.setReducedMotion(shot.includes('reduced'));
  const hud = new Hud(settings); hud.setDeploymentSite('Relay');
  const support = new SupportHud(() => { throw Error('Preparation played sound'); }, 150, 100, settings);
  new SignalHud(() => { throw Error('Preparation played map cue'); });
  new PingWheel();
  hud.setHp(73); hud.setScores(8, 11); hud.setAmmo(17, 51);
  hud.addKill('REAL ALLY', 'REAL ENEMY', 'body', 0);
  hud.showLockPrompt(true, 'Preparing arena / Loading weapons and effects...');
  const focus = document.createElement('button'); focus.textContent = 'Inspection focus';
  document.body.append(focus); focus.focus();
  const root = document.getElementById('hud')!;
  const before = root.outerHTML, savedSettings = JSON.stringify(settings.get());
  const styleCount = document.querySelectorAll('style').length;
  const frames = [...hud.compositorFrames(), ...support.compositorFrames(),
    ...peripheralCompositorFrames(), pauseCompositorFrame(settings), settingsCompositorFrame(settings)];
  const samples: { effect: string; opacity: string; width: number; height: number; inert: boolean; ariaHidden: boolean; nodes: number }[] = [];
  let sampling = true;
  const sample = () => {
    const surface = document.querySelector<HTMLElement>('[data-compositor-preparation]');
    if (surface?.dataset.effect) {
      const rect = surface.getBoundingClientRect();
      samples.push({ effect: surface.dataset.effect, opacity: getComputedStyle(surface).opacity,
        width: rect.width, height: rect.height, inert: surface.inert,
        ariaHidden: surface.getAttribute('aria-hidden') === 'true', nodes: surface.querySelectorAll('*').length });
    }
    if (sampling) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  await prepareCompositor(frames); sampling = false;
  const checks = {
    unchangedHud: root.outerHTML === before,
    unchangedFocus: document.activeElement === focus,
    unchangedSettings: JSON.stringify(settings.get()) === savedSettings,
    removedSurface: !document.querySelector('[data-compositor-preparation]'),
    singleHud: document.querySelectorAll('#hud').length === 1,
    noStyleLeak: document.querySelectorAll('style').length === styleCount,
    allFramesPresented: frames.every(frame => samples.filter(sample => sample.effect === frame.name).length >= 2),
    visibleRasterSurface: samples.every(sample => Number(sample.opacity) > 0 && Number(sample.opacity) <= .01
      && sample.width === innerWidth && sample.height === innerHeight && sample.nodes > 0),
    inaccessibleCopies: samples.every(sample => sample.inert && sample.ariaHidden),
    noGhostFeed: document.querySelectorAll('#feed .k').length === 1 && !root.textContent?.includes('SCOUT'),
  };
  openSettings(settings, () => {});
  Object.assign(checks, { realSettingsOpen: !!document.querySelector('#settingsPanel') });
  closeSettings();
  Object.assign(checks, { realSettingsClosed: !document.querySelector('#settingsPanel'),
    focusRestored: document.activeElement === focus });
  focus.remove();
  if (Object.values(checks).some(ok => !ok)) throw Error(`Compositor preparation failed: ${JSON.stringify(checks)}`);
  Object.assign(window, { __inspectReady: true, __mapInspect: { fixture: shot, checks, samples,
    preparation: performance.getEntriesByType('measure').map(entry => entry.toJSON()) } });
}
