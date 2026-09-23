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
import { GAME } from '../src/game-config.js';
import { createUiButton } from './ui/primitives.js';

const T = GAME.text.quit as typeof GAME.text.quit & { readonly title: string };

import { SERVICE_FIELD_CSS } from './ui/service-field-style.js';

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
  style.textContent = SERVICE_FIELD_CSS;
  const dlg = document.createElement("div");
  dlg.id = "quitConfirm";
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.setAttribute('aria-labelledby', 'pause-title');
  const panel = document.createElement("div");
  panel.className = "panel";
  const heading=document.createElement('h2'), prompt=document.createElement('p');
  heading.id='pause-title';heading.textContent=T.title;prompt.textContent=T.prompt;panel.append(heading,prompt);
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

  const continueBtn = createUiButton({label:T.continueLabel,tone:'accent'});
  continueBtn.addEventListener("click", () => dismiss(true));
  const settingsBtn = createUiButton({label:GAME.text.settings.openLabel});
  settingsBtn.addEventListener("click", () => {
    window.removeEventListener("keydown", onKeydown);
    dlg.style.display = "none";
    openSettings(settings, () => {
      dlg.style.display = "";
      window.addEventListener("keydown", onKeydown);
    });
  });
  const quitBtn = createUiButton({label:T.quitLabel,tone:'error'});
  quitBtn.classList.add("quit");
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
