/**
 * Player settings panel: mouse sensitivity, vertical look inversion, and
 * keybindings. Reachable from two places — the quit-confirm modal (ESC
 * mid-match) and the mode-select screen (before ever connecting) — both of
 * which hide their own DOM while this is open and restore it via the
 * `onClose` callback, rather than trying to stack overlays by z-index alone.
 * Visually it follows `quit-confirm.ts`'s pattern exactly: a CSS-string
 * stylesheet, `position: fixed; inset: 0`, the same monospace/dark palette,
 * and the same "build with `createElement`, wire listeners inline" shape.
 *
 * This module owns a SINGLE shared {@link SettingsStore} instance handed in
 * by the caller (the same one `Input` reads from), NOT one it constructs
 * itself — every mutator (`setSensitivity`, `setInvertY`, `rebind`, …)
 * persists immediately, so a change made here is visible to `Input` on the
 * very next input event with no reload and no extra plumbing.
 *
 * Keybinding capture is the one genuinely stateful piece: clicking a row's
 * key button arms a SINGLE module-scoped `capturingAction`, and every other
 * control in the panel (the other 8 rows, the sensitivity slider, the
 * invert-Y checkbox, reset-all, close) is guarded by "if a capture is
 * pending, do nothing" so a stray click mid-capture can't quietly change
 * something else. The next `keydown` completes the rebind (subject to
 * `SettingsStore.rebind`'s conflict-removal rule — a key can only ever
 * belong to one action, so binding it here may silently clear it from
 * whichever row it was on); `Escape` is reserved to CANCEL the capture
 * instead of becoming bindable, since it's the one key every other overlay
 * in this app already treats as a dismiss gesture.
 */
import { GAME } from "../src/game-config.js";
import {
  BIND_ACTIONS,
  formatBinding,
  type BindAction,
  type SettingsStore,
} from "./settings.js";

const T = GAME.text.settings;

const css = `
#settingsPanel { position: fixed; inset: 0; z-index: 160; display: flex; align-items: center;
  justify-content: center; background: rgba(6,8,12,0.7); font: 14px/1.4 ui-monospace, "SF Mono", Menlo, monospace;
  color: #eef; pointer-events: auto; }
#settingsPanel .panel { display: flex; flex-direction: column; gap: 16px; width: 420px;
  max-height: 80vh; overflow-y: auto; padding: 28px 32px; border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px; background: rgba(20,24,32,0.92); }
#settingsPanel h2 { margin: 0; font-size: 20px; letter-spacing: 1px; }
#settingsPanel h3 { margin: 8px 0 0; font-size: 13px; letter-spacing: 1px; opacity: 0.7; }
#settingsPanel .row { display: flex; align-items: center; gap: 10px; }
#settingsPanel .sensRow input[type="range"] { flex: 1; }
#settingsPanel .sensValue { width: 52px; text-align: right; opacity: 0.85; }
#settingsPanel label.checkRow { display: flex; align-items: center; gap: 8px; cursor: pointer; }
#settingsPanel .binds { display: flex; flex-direction: column; gap: 6px; }
#settingsPanel .bindRow { display: flex; align-items: center; gap: 8px; }
#settingsPanel .bindRow .bindLabel { flex: 1; opacity: 0.85; }
#settingsPanel button { padding: 8px 14px; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
  background: rgba(255,255,255,0.06); color: #eef; font: inherit; cursor: pointer;
  transition: background 120ms, border-color 120ms; }
#settingsPanel button:hover { background: rgba(70,130,220,0.25); border-color: rgba(156,196,255,0.6); }
#settingsPanel .keyBtn { min-width: 96px; }
#settingsPanel .keyBtn.capturing { background: rgba(220,180,70,0.25); border-color: rgba(255,220,140,0.7); }
#settingsPanel .resetBtn { min-width: 34px; padding: 8px 0; text-align: center; }
#settingsPanel .bottomRow { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
`;

let root: HTMLDivElement | null = null;

function formatSens(value: number): string {
  return `x${value.toFixed(2)}`;
}

/**
 * Opens the settings panel, mutating `settings` live as the player adjusts
 * things. Calls `onClose` once, after the panel is torn down, so the caller
 * can restore whatever it hid to make room for this (the quit-confirm modal
 * or the mode-select menu). A second call while already open is a no-op.
 */
export function openSettings(settings: SettingsStore, onClose: () => void): void {
  if (root) return; // already open

  const style = document.createElement("style");
  style.textContent = css;
  const dlg = document.createElement("div");
  dlg.id = "settingsPanel";
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `<h2>${T.title}</h2>`;

  // -- Sensitivity slider -----------------------------------------------
  const sensRow = document.createElement("div");
  sensRow.className = "row sensRow";
  const sensLabel = document.createElement("span");
  sensLabel.textContent = T.sensitivityLabel;
  const sensInput = document.createElement("input");
  sensInput.type = "range";
  sensInput.min = "0.1";
  sensInput.max = "3.0";
  sensInput.step = "0.05";
  sensInput.value = String(settings.get().sensitivity);
  const sensValue = document.createElement("span");
  sensValue.className = "sensValue";
  sensValue.textContent = formatSens(settings.get().sensitivity);
  sensInput.addEventListener("input", () => {
    if (capturingAction !== null) return;
    settings.setSensitivity(Number(sensInput.value));
    sensValue.textContent = formatSens(settings.get().sensitivity);
  });
  sensRow.append(sensLabel, sensInput, sensValue);
  panel.appendChild(sensRow);

  // -- Invert-Y checkbox --------------------------------------------------
  const invertRow = document.createElement("label");
  invertRow.className = "checkRow";
  const invertInput = document.createElement("input");
  invertInput.type = "checkbox";
  invertInput.checked = settings.get().invertY;
  invertInput.addEventListener("change", () => {
    if (capturingAction !== null) {
      invertInput.checked = settings.get().invertY; // revert the stray toggle
      return;
    }
    settings.setInvertY(invertInput.checked);
  });
  const invertText = document.createElement("span");
  invertText.textContent = T.invertYLabel;
  invertRow.append(invertInput, invertText);
  panel.appendChild(invertRow);

  // -- Keybinding table -----------------------------------------------------
  const bindsTitle = document.createElement("h3");
  bindsTitle.textContent = T.keybindingsTitle;
  panel.appendChild(bindsTitle);

  const bindsWrap = document.createElement("div");
  bindsWrap.className = "binds";

  let capturingAction: BindAction | null = null;
  const keyButtons = new Map<BindAction, HTMLButtonElement>();

  const refreshKeyButton = (action: BindAction): void => {
    const btn = keyButtons.get(action)!;
    btn.textContent = formatBinding(settings.get().binds[action]);
    btn.classList.remove("capturing");
  };

  const cancelCapture = (): void => {
    if (capturingAction === null) return;
    const action = capturingAction;
    capturingAction = null;
    refreshKeyButton(action);
  };

  const beginCapture = (action: BindAction): void => {
    if (capturingAction !== null) return;
    capturingAction = action;
    const btn = keyButtons.get(action)!;
    btn.textContent = T.captureHint;
    btn.classList.add("capturing");
  };

  for (const action of BIND_ACTIONS) {
    const row = document.createElement("div");
    row.className = "bindRow";

    const label = document.createElement("span");
    label.className = "bindLabel";
    label.textContent = T.actionLabels[action];

    const keyBtn = document.createElement("button");
    keyBtn.className = "keyBtn";
    keyBtn.textContent = formatBinding(settings.get().binds[action]);
    keyBtn.addEventListener("click", () => {
      if (capturingAction !== null) return;
      beginCapture(action);
    });
    keyButtons.set(action, keyBtn);

    const resetBtn = document.createElement("button");
    resetBtn.className = "resetBtn";
    resetBtn.textContent = "↺";
    resetBtn.addEventListener("click", () => {
      if (capturingAction !== null) return;
      settings.resetBind(action);
      refreshKeyButton(action);
    });

    row.append(label, keyBtn, resetBtn);
    bindsWrap.appendChild(row);
  }
  panel.appendChild(bindsWrap);

  // A capture consumes the very next keydown (Escape cancels instead of
  // binding). `stopPropagation` is defense in depth — the quit-confirm entry
  // point already detaches its own Escape listener before opening this panel
  // so the two never actually race, but this keeps the module safe on its own.
  const onKeydown = (e: KeyboardEvent): void => {
    if (capturingAction === null) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code === "Escape") {
      cancelCapture();
      return;
    }
    const action = capturingAction;
    settings.rebind(action, e.code);
    capturingAction = null;
    // rebind() can silently strip the same code off a DIFFERENT row (the
    // one-owner-per-key invariant), so every row must be refreshed, not just
    // the one just captured.
    for (const a of BIND_ACTIONS) refreshKeyButton(a);
  };
  window.addEventListener("keydown", onKeydown);

  // -- Bottom row: reset-all / close --------------------------------------
  const bottomRow = document.createElement("div");
  bottomRow.className = "bottomRow";

  const resetAllBtn = document.createElement("button");
  resetAllBtn.textContent = T.resetAllLabel;
  resetAllBtn.addEventListener("click", () => {
    if (capturingAction !== null) return;
    settings.resetAll();
    sensInput.value = String(settings.get().sensitivity);
    sensValue.textContent = formatSens(settings.get().sensitivity);
    invertInput.checked = settings.get().invertY;
    for (const a of BIND_ACTIONS) refreshKeyButton(a);
  });

  const closeBtn = document.createElement("button");
  closeBtn.textContent = T.closeLabel;
  closeBtn.addEventListener("click", () => close());

  bottomRow.append(resetAllBtn, closeBtn);
  panel.appendChild(bottomRow);

  function close(): void {
    window.removeEventListener("keydown", onKeydown);
    style.remove();
    dlg.remove();
    root = null;
    onClose();
  }

  dlg.append(style, panel);
  document.body.appendChild(dlg);
  root = dlg;
}
