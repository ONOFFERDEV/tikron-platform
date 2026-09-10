/**
 * ESC quit-confirmation modal. Pointer lock is a browser-reserved release
 * gesture — Escape can't be `preventDefault`'d — so there's no way to intercept
 * "the player pressed Escape" directly; the only observable signal is losing
 * pointer lock. `main.ts` wires {@link wireQuitConfirm} as `Input`'s
 * `onLockChange` callback: losing lock mid-game pops this dialog instead of
 * silently dropping to an unlocked cursor. The very first lock loss (there
 * isn't one — the initial "CLICK TO PLAY" screen is simply never locked yet)
 * can't trigger it; the gate is "has ever been locked", set on the first
 * lock-acquired edge.
 *
 * "계속하기" re-requests pointer lock inside its own click handler, so the
 * click itself is the user gesture `requestPointerLock` needs — no separate
 * "click to play" round-trip. "나가기" strips `?mode=` and reloads, which
 * drops back into `mode-select.ts`'s `resolveMode()` menu on the fresh load.
 * An Escape keydown while the modal is already open dismisses it the same way
 * "계속하기" does, MINUS the re-lock: a second Escape can't reliably reclaim
 * pointer lock (browsers guard against instant reclaim-after-release), so it
 * falls back to the ordinary unlocked "CLICK TO PLAY" prompt instead.
 *
 * The "설정" button hides this modal's own DOM (`display: none`, not removal —
 * the panel and its state stay put) and detaches its Escape-dismiss listener
 * before handing off to {@link openSettings}, then restores both once the
 * settings panel's `onClose` fires. This sidesteps an Escape-keydown collision
 * between this modal's dismiss-on-Escape and the settings panel's
 * cancel-capture-on-Escape, without either module needing to know about the
 * other's internals.
 */
import { openSettings, closeSettings } from "./settings-ui.js";
import type { SettingsStore } from "./settings.js";
import type { CompositorFrame } from './compositor-preparation.js';

const css = `
#quitConfirm { position: fixed; inset: 0; z-index: 150; display: flex; align-items: center;
  justify-content: center; background: rgba(6,8,12,0.55); font: 14px/1.4 ui-monospace, "SF Mono", Menlo, monospace;
  color: #eef; pointer-events: auto; }
#quitConfirm .panel { display: flex; flex-direction: column; align-items: center; gap: 18px;
  padding: 32px 40px; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px;
  background: rgba(20,24,32,0.85); }
#quitConfirm h2 { margin: 0; font-size: 20px; letter-spacing: 1px; }
#quitConfirm .row { display: flex; gap: 12px; flex-wrap:wrap; justify-content:center; }
#quitConfirm button:focus-visible{outline:2px solid #edaa52;outline-offset:3px}
#quitConfirm .panel{max-width:calc(100vw - 32px);box-sizing:border-box}
#quitConfirm p{margin:0;text-align:center;color:#becbd0}
#quitConfirm button { padding: 10px 22px; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
  background: rgba(255,255,255,0.06); color: #eef; font: inherit; cursor: pointer;
  transition: background 120ms, border-color 120ms; }
#quitConfirm button:hover { background: rgba(70,130,220,0.25); border-color: rgba(156,196,255,0.6); }
#quitConfirm button.quit:hover { background: rgba(220,70,70,0.25); border-color: rgba(255,140,120,0.6); }
`;

let root: HTMLDivElement | null = null;
let dismissCurrent: (() => void) | null = null;

/** Results and connection recovery take precedence over an open gameplay menu. */
export function closeGameplayMenus(): void {
  if (!root) return;
  closeSettings();
  dismissCurrent?.();
}

function quitToMenu(): void {
  const url = new URL(location.href);
  url.searchParams.delete("mode");
  location.replace(url.toString());
}

export function pauseCompositorFrame(settings: SettingsStore): CompositorFrame {
  const node = document.createElement('div'); node.inert = true;
  showQuitConfirm(settings, () => {}, node);
  return { name: 'pause', node };
}

function showQuitConfirm(settings: SettingsStore, relock: () => void, preparation?: HTMLElement): void {
  if (root) return; // already open

  const style = document.createElement("style");
  style.textContent = css;
  const dlg = document.createElement("div");
  dlg.id = "quitConfirm";
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.setAttribute('aria-labelledby', 'pause-title');
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `<h2 id="pause-title">MATCH MENU / 메뉴</h2><p>The match continues while this menu is open.</p>`;
  const rowEl = document.createElement("div");
  rowEl.className = "row";

  const dismiss = (relockAfter: boolean): void => {
    window.removeEventListener("keydown", onKeydown);
    style.remove();
    dlg.remove();
    root = null;
    dismissCurrent = null;
    if (relockAfter) relock();
  };
  const onKeydown = (e: KeyboardEvent): void => {
    if (e.code === "Escape" && !e.repeat) dismiss(false);
    if (e.code === 'Tab') {
      const controls = Array.from(rowEl.querySelectorAll('button'));
      if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0]?.focus(); }
    }
  };

  const continueBtn = document.createElement("button");
  continueBtn.textContent = 'RESUME / 계속';
  continueBtn.addEventListener("click", () => dismiss(true));
  const settingsBtn = document.createElement("button");
  settingsBtn.textContent = 'SETTINGS / 설정';
  settingsBtn.addEventListener("click", () => {
    window.removeEventListener("keydown", onKeydown);
    dlg.style.display = "none";
    openSettings(settings, () => {
      dlg.style.display = "";
      window.addEventListener("keydown", onKeydown);
    });
  });
  const quitBtn = document.createElement("button");
  quitBtn.className = "quit";
  quitBtn.textContent = 'DEPLOYMENT / 메뉴';
  quitBtn.addEventListener("click", () => quitToMenu());

  rowEl.append(continueBtn, settingsBtn, quitBtn);
  panel.appendChild(rowEl);
  dlg.append(style, panel);
  if (preparation) { preparation.append(dlg); return; }
  document.body.appendChild(dlg);
  window.addEventListener("keydown", onKeydown);
  root = dlg;
  dismissCurrent = () => dismiss(false);
  continueBtn.focus();
}

/**
 * Build an `Input` `onLockChange` callback that pops the quit-confirm dialog on
 * every lock-loss AFTER the first lock has been acquired (so the pre-game
 * "CLICK TO PLAY" screen never triggers it). `relock` is called (from within
 * the "계속하기" button's own click handler) to re-request pointer lock.
 */
export function wireQuitConfirm(
  settings: SettingsStore,
  relock: () => void,
  shouldShow: () => boolean = () => true,
): (locked: boolean) => void {
  let everLocked = false;
  return (locked: boolean): void => {
    if (locked) {
      everLocked = true;
      return;
    }
    if (!everLocked || !shouldShow()) return;
    showQuitConfirm(settings, relock);
  };
}
