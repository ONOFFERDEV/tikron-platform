import * as THREE from 'three';
import { SITES } from './map-presentation.js';
import type { MapDef } from '../src/map/types.js';
import type { DeploymentIntro, IntroPose } from './deployment-intro.js';
import { FIELD_UI_COPY } from './ui/copy.js';

/** Saved render pose. No new camera, light, pass or per-frame resource. */
export class IntroCamera {
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  draw(camera: THREE.PerspectiveCamera, viewmodel: THREE.Object3D, pose: IntroPose, draw: () => void): void {
    this.position.copy(camera.position); this.rotation.copy(camera.quaternion);
    const fov = camera.fov, visible = viewmodel.visible;
    try {
      camera.position.copy(pose.eye); camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      camera.fov = pose.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      // The muzzle light is a camera sibling of the weapon, never hidden here.
      viewmodel.visible = false;
      draw();
    } finally {
      camera.position.copy(this.position); camera.quaternion.copy(this.rotation);
      camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      viewmodel.visible = visible;
    }
  }
}

const css = `
#deployment-intro{position:fixed;inset:0;z-index:5;pointer-events:none;color:var(--ui-text-primary);background:linear-gradient(0deg,#06141deb,transparent 37%);font-family:var(--ui-font-body)}
#deployment-intro[hidden]{display:none}
body[data-intro=true] #tacticalMap{visibility:hidden}
#deployment-intro .intro-copy{position:absolute;left:5vw;right:5vw;bottom:5vh;border-left:var(--ui-border-emphasis) solid var(--ui-accent);padding-left:24px}
#deployment-intro .intro-eyebrow{display:inline-block;padding:2px var(--ui-space-2);background:var(--ui-surface-paper);color:var(--ui-ink);letter-spacing:.08em;font:700 var(--ui-type-hud)/1.4 var(--ui-font-display)}
#deployment-intro h1{font:700 clamp(32px,5vw,72px)/1.1 var(--ui-font-body);margin:12px 0 6px;letter-spacing:0;word-break:keep-all}
#deployment-intro .intro-subtitle{font:500 var(--ui-type-body)/1.5 var(--ui-font-body);letter-spacing:0;color:var(--ui-text-secondary)}
#deployment-intro .intro-routes{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0;font:600 var(--ui-type-hud)/1.4 var(--ui-font-body)}
#deployment-intro .intro-routes span{border-top:var(--ui-border-width) solid var(--ui-border-strong);padding:9px 14px 0 0;color:var(--ui-text-primary)}
#deployment-intro .intro-skip{color:var(--ui-text-secondary);font:500 var(--ui-type-body)/1.6 var(--ui-font-body)}
#hud[data-intro=true] > :not(#deployment-banner):not(#ping){visibility:hidden!important}
#hud[data-intro=true] #ping{top:24px;left:32px}
#hud[data-intro=true] #deployment-banner{top:72px;left:auto;right:32px;transform:none;width:530px}
#hud[data-intro=true] #deployment-banner .deployment-count{font-size:48px;min-width:76px;letter-spacing:-3px}
#hud[data-intro=true] #deployment-banner h2{font-size:20px}
@media(max-height:700px){#deployment-intro .intro-copy{bottom:22px}#deployment-intro h1{font-size:40px}#deployment-intro .intro-routes{margin:12px 0}}
@media(max-width:800px){#hud[data-intro=true] #deployment-banner{top:80px;left:16px;right:16px;width:auto}#deployment-intro .intro-copy{left:20px;right:20px;padding-left:14px}#deployment-intro h1{font-size:32px;letter-spacing:0}#deployment-intro .intro-routes{gap:8px}#deployment-intro .intro-eyebrow,#deployment-intro .intro-subtitle{letter-spacing:1px}}
`;

export class DeploymentIntroView {
  private readonly root = document.createElement('section');
  private showing = false;
  constructor(map: MapDef, intro: DeploymentIntro, canvas: HTMLCanvasElement) {
    const site = Object.values(SITES).find(s => s.map.presentation === map.presentation) ?? SITES.arena1;
    const style = document.createElement('style'); style.textContent = css; document.head.append(style);
    this.root.id = 'deployment-intro'; this.root.hidden = true; this.root.dataset.flow = 'warmup';
    this.root.setAttribute('role', 'status'); this.root.setAttribute('aria-live', 'polite');
    const copy = document.createElement('div'); copy.className = 'intro-copy';
    const text = (tag: string, cls: string, value: string) => {
      const el = document.createElement(tag); el.className = cls; el.textContent = value; copy.append(el); return el;
    };
    text('div', 'intro-eyebrow', `${FIELD_UI_COPY.deploy.operationSite} · ${site.number}`);
    text('h1', '', site.name);
    text('div', 'intro-subtitle', site.subtitle);
    const routes = text('div', 'intro-routes', '');
    site.routes.split(' / ').forEach((route, index) => {
      const el = document.createElement('span'); el.textContent = `${index + 1}. ${route}`; routes.append(el);
    });
    text('div', 'intro-skip', FIELD_UI_COPY.deploy.skipIntro);
    this.root.append(copy); document.body.append(this.root);
    // Capture BEFORE Input. A skip gesture cannot also fire, throw, jump, reload
    // or turn the operator. The ordinary pointer-lock/menu flow owns Escape.
    const consume = (e: Event) => {
      if (!intro.active || document.pointerLockElement !== canvas) return;
      intro.skip(); this.update(false);
      if (e instanceof KeyboardEvent && e.code === 'Escape') return;
      e.preventDefault(); e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', consume, true);
    window.addEventListener('mousedown', consume, true);
    window.addEventListener('wheel', consume, { capture: true, passive: false });
    document.addEventListener('mousemove', e => {
      if (intro.active && document.pointerLockElement === canvas) e.stopImmediatePropagation();
    }, true);
  }

  update(active: boolean): void {
    if (active === this.showing) return;
    this.showing = active; this.root.hidden = !active;
    document.body.dataset.intro = String(active);
    const hud = document.getElementById('hud'); if (hud) hud.dataset.intro = String(active);
  }
}
