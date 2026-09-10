export interface CompositorFrame { name: string; node: HTMLElement }

/** Clone mounted peripheral layouts without invoking their audio/state machines. */
export function peripheralCompositorFrames(): CompositorFrame[] {
  const frames: CompositorFrame[] = [];
  for (const id of ['deployment-banner', 'deployment-intro', 'signalEvent', 'teamPingNotice', 'pingWheel']) {
    const source = document.getElementById(id);
    if (!source) continue;
    const copy = source.cloneNode(true) as HTMLElement; copy.hidden = false;
    if (id === 'deployment-banner') {
      copy.dataset.kind = 'countdown';
      for (const [selector, text] of [['.deployment-kicker', 'RELAY / TEAM DEATHMATCH'],
        ['.deployment-count', '03'], ['h2', 'DEPLOYING'], ['.deployment-detail', 'Take the field.']]) {
        copy.querySelector(selector!)!.textContent = text!;
      }
    }
    if (id === 'signalEvent') {
      copy.querySelector('strong')!.textContent = 'CORE RELEASE INCOMING';
      copy.querySelector('span')!.textContent = 'Central transit opens.';
      copy.querySelector('b')!.textContent = '8s';
    }
    if (id === 'teamPingNotice') copy.textContent = 'ALLY / ENEMY SEEN / COOLING';
    if (id === 'pingWheel') copy.querySelector<HTMLElement>('.choice')!.dataset.selected = 'true';
    const node = document.createElement('div'); node.id = 'hud'; node.append(copy);
    frames.push({ name: id, node });
  }
  return frames;
}

const paintedFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/** Rasterize actual HUD styles before input is installed. Offscreen, hidden and
 * zero-alpha elements can be culled, as can content behind an opaque loader.
 * These inert copies sit ABOVE the loading screen at 1% opacity: enough to
 * submit their raster/composite work, without showing fake combat to the player.
 * This is preparation only, with no persistent layer or additional WebGL pass. */
export async function prepareCompositor(frames: readonly CompositorFrame[]): Promise<void> {
  performance.mark('ironsight-ui-prepare-start');
  const surface = document.createElement('div');
  surface.dataset.compositorPreparation = 'true';
  surface.inert = true;
  surface.setAttribute('aria-hidden', 'true');
  surface.style.cssText = 'position:fixed;inset:0;z-index:200;pointer-events:none;opacity:.01';
  document.body.append(surface);
  try {
    // Decode the CSS border image explicitly; DOM insertion alone does not wait
    // for it. Failure keeps the same optional-art fallback as the ordinary HUD.
    const border = new Image(); border.src = '/assets/ui/damage-vignette.png';
    await border.decode().catch(() => {});
    await document.fonts.ready;
    for (const frame of frames) {
      const start = performance.now();
      surface.dataset.effect = frame.name;
      surface.replaceChildren(frame.node);
      await paintedFrame();
      // Sample real animations halfway through. An initial opacity:0 keyframe
      // would skip the very program we are here to prepare. Pausing prevents
      // extra loading motion and works with Reduced motion (no animations).
      for (const animation of surface.getAnimations({ subtree: true })) {
        const duration = animation.effect?.getComputedTiming().duration;
        if (typeof duration === 'number' && Number.isFinite(duration)) {
          animation.pause(); animation.currentTime = duration / 2;
        }
      }
      await paintedFrame();
      await paintedFrame();
      performance.measure(`ironsight-ui-${frame.name}`, { start, end: performance.now() });
    }
  } finally {
    surface.remove();
    performance.mark('ironsight-ui-prepare-end');
    performance.measure('ironsight-ui-prepare', 'ironsight-ui-prepare-start', 'ironsight-ui-prepare-end');
  }
  // Present the clean loading HUD before exposing input. No effect DOM survives.
  await paintedFrame();
}
