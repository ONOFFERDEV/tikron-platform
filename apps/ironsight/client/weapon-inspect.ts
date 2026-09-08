import { SceneRig } from './scene.js';
import { ARENA1 } from '../src/map/arena1.js';
/** Offline first-person pose proof, including fully repeatable reload phases. */
export function startWeaponInspector(): void {
  const host = document.getElementById('app') ?? document.body;
  for (const child of Array.from(document.body.children))
    if (child !== host && child instanceof HTMLElement) child.hidden = true;
  host.replaceChildren();
  const scene = new SceneRig(ARENA1, host, { loadActors: false });
  scene.setView({ x: 10, y: 1.65, z: 20 }, Math.PI / 2, 0);
  const query = new URLSearchParams(location.search), shot = query.get('shot');
  const weapon = Math.min(4, Math.max(0, Math.floor(Number(query.get('weapon')) || 0)));
  scene.setWeapon(weapon);
  const phases: Record<string, number> = { 'reload-out': 0.40, 'reload-in': 0.58, 'reload-bolt': 0.78, 'reload-return': 0.94 };
  const phase = Object.keys(phases).find(p => shot?.endsWith(p));
  const progress = phases[phase ?? ''] ?? null;
  const flags = window as unknown as { __inspectReady: boolean; __mapInspect: unknown };
  flags.__inspectReady = false;
  let frames = 0;
  const cycle = shot?.endsWith('-cycle') ?? false;
  let cycleFrames = 0;
  const observedPhases = new Set<string>();
  const tick = () => {
    const movingProgress = cycle && cycleFrames < 181 ? cycleFrames / 180 : progress;
    const ready = scene.inspectViewmodel(movingProgress, shot?.endsWith('-ads') ?? false);
    scene.render();
    if (!ready || ++frames < 20 || !scene.readyForInspection(0)) { requestAnimationFrame(tick); return; }
    if (cycle && cycleFrames < 182) {
      observedPhases.add(scene.viewmodelDiagnostics().phase);
      cycleFrames++;
      requestAnimationFrame(tick); return;
    }
    flags.__mapInspect = { ...scene.viewmodelDiagnostics(),
      ...(cycle ? { reloadCycle: { frames: cycleFrames, phases: [...observedPhases] } } : {}) };
    flags.__inspectReady = true;
  };
  requestAnimationFrame(tick);
}
