import { GAME } from "../src/game-config.js";
import { configureAudio, setAudioLevel, setMuted } from "./audio.js";
import type { CompositorFrame } from "./compositor-preparation.js";
import { AUDIO_LEVEL_KEYS, BIND_ACTIONS, formatBinding, type BindAction, type Settings, type SettingsStore } from "./settings.js";
import { createUiButton } from "./ui/primitives.js";
import { SETTINGS_STYLE } from "./ui/settings-style.js";

const T = GAME.text.settings as typeof GAME.text.settings & {
  readonly reducedMotionLabel: string; readonly reducedMotionHint: string;
  readonly enemyColourLabel: string; readonly enemyColourHint: string;
  readonly enemyColours: Readonly<Record<"team" | "yellow" | "violet", string>>;
  readonly audioTitle: string; readonly audioLevels: Readonly<Record<(typeof AUDIO_LEVEL_KEYS)[number], string>>;
  readonly mutedLabel: string; readonly dynamicRangeLabel: string;
  readonly dynamicRanges: Readonly<Record<Settings["audio"]["dynamicRange"], string>>;
  readonly muteWhenHiddenLabel: string; readonly captureCancelHint: string;
  readonly savedLabel: string; readonly saveFailedLabel: string;
};
const STORAGE_KEY = "ironsight.settings.v1";
let root: HTMLDivElement | null = null;
let closeCurrent: (() => void) | null = null;
let settingsInstance = 0;

export function closeSettings(): void { closeCurrent?.(); }

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function settingsPersisted(snapshot: Settings, storage: Pick<Storage, "getItem">): boolean {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return false;
    const { volume: _compatibilityAlias, ...canonical } = snapshot;
    return stableJson(JSON.parse(raw)) === stableJson(canonical);
  } catch { return false; }
}

export function settingsTabAfterKey(index: number, key: string, count: number): number {
  if (count < 1) return index;
  if (key === "ArrowLeft") return (index + count - 1) % count;
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return index;
}

function dynamicRange(value: string): Settings["audio"]["dynamicRange"] | null {
  return value === "headphones" || value === "speakers" || value === "reduced" ? value : null;
}

function labeledControl(label: string, control: HTMLElement, hint?: string): HTMLElement {
  const row = document.createElement("label"), copy = document.createElement("span"), title = document.createElement("span");
  row.className = "settings-field"; copy.className = "settings-copy"; title.textContent = label; copy.append(title);
  if (hint) { const note = document.createElement("small"); note.textContent = hint; copy.append(note); }
  row.append(copy, control); return row;
}

function section(title: string): HTMLElement {
  const node = document.createElement("section"), heading = document.createElement("h3");
  node.className = "settings-section"; heading.textContent = title; node.append(heading); return node;
}

function rangeControl(value: number, format: (value: number) => string): [HTMLElement, HTMLInputElement, HTMLElement] {
  const wrap = document.createElement("span"), input = document.createElement("input"), output = document.createElement("output");
  wrap.className = "range-control"; input.type = "range"; input.value = String(value); output.textContent = format(value);
  wrap.append(input, output); return [wrap, input, output];
}

function checkboxControl(checked: boolean): [HTMLElement, HTMLInputElement] {
  const wrap = document.createElement("span"), input = document.createElement("input");
  wrap.className = "check-control"; input.type = "checkbox"; input.checked = checked; wrap.append(input); return [wrap, input];
}

export function settingsCompositorFrame(settings: SettingsStore): CompositorFrame {
  const node = document.createElement("div"); node.inert = true; openSettings(settings, () => {}, node); return { name: "settings", node };
}

export function openSettings(settings: SettingsStore, onClose: () => void, preparation?: HTMLElement): void {
  if (root) return;
  const previousFocus = document.activeElement;
  const dlg = document.createElement("div"), shell = document.createElement("div"), header = document.createElement("header");
  const body = document.createElement("div"), footer = document.createElement("footer"), style = document.createElement("style");
  const heading = document.createElement("h2"), status = document.createElement("p");
  let capturing: BindAction | null = null;
  const keyButtons = new Map<BindAction, HTMLButtonElement>();

  dlg.id = "settingsPanel"; dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-labelledby", "settingsTitle");
  shell.className = "settings-shell"; header.className = "settings-header"; body.className = "settings-body"; footer.className = "settings-footer";
  style.textContent = SETTINGS_STYLE; heading.id = "settingsTitle"; heading.textContent = T.title;
  status.className = "settings-status"; status.setAttribute("role", "status"); status.textContent = T.savedLabel;
  header.append(heading, Object.assign(document.createElement("p"), { textContent: T.captureCancelHint }));

  const setStatus = (): void => {
    const saved = typeof localStorage !== "undefined" && settingsPersisted(settings.get(), localStorage);
    status.dataset.state = saved ? "saved" : "save-failed"; status.textContent = saved ? T.savedLabel : T.saveFailedLabel;
  };
  const mutate = (action: () => void): void => { if (capturing !== null) return; action(); setStatus(); };

  const controls = section("조작과 화면");
  const [sensControl, sensInput, sensOutput] = rangeControl(settings.get().sensitivity, value => `×${value.toFixed(2)}`);
  sensInput.min = "0.1"; sensInput.max = "3"; sensInput.step = "0.05"; sensInput.value = String(settings.get().sensitivity); sensInput.dataset.setting = "sensitivity";
  sensInput.addEventListener("input", () => mutate(() => { settings.setSensitivity(Number(sensInput.value)); sensOutput.textContent = `×${settings.get().sensitivity.toFixed(2)}`; }));
  controls.append(labeledControl(T.sensitivityLabel, sensControl));
  for (const [label, hint, key, checked, update] of [
    [T.invertYLabel, undefined, "invert-y", settings.get().invertY, (value: boolean) => settings.setInvertY(value)],
    [T.reducedMotionLabel, T.reducedMotionHint, "reduced-motion", settings.get().reducedMotion, (value: boolean) => settings.setReducedMotion(value)],
  ] as const) {
    const [control, input] = checkboxControl(checked); input.dataset.setting = key;
    input.addEventListener("change", () => mutate(() => update(input.checked))); controls.append(labeledControl(label, control, hint));
  }
  const enemySelect = document.createElement("select"); enemySelect.dataset.setting = "enemy-highlight";
  for (const key of ["team", "yellow", "violet"] as const) enemySelect.append(new Option(T.enemyColours[key], key));
  enemySelect.value = settings.get().enemyHighlight;
  enemySelect.addEventListener("change", () => mutate(() => settings.setEnemyHighlight(enemySelect.value)));
  controls.append(labeledControl(T.enemyColourLabel, enemySelect, T.enemyColourHint));

  const audio = section(T.audioTitle);
  for (const key of AUDIO_LEVEL_KEYS) {
    const [control, input, output] = rangeControl(settings.get().audio[key], value => `${Math.round(value * 100)}%`);
    input.min = "0"; input.max = "1"; input.step = "0.05"; input.value = String(settings.get().audio[key]); input.dataset.setting = `audio-${key}`;
    input.addEventListener("input", () => mutate(() => { const value = Number(input.value); settings.setAudioLevel(key, value); setAudioLevel(key, value); output.textContent = `${Math.round(value * 100)}%`; }));
    audio.append(labeledControl(T.audioLevels[key], control));
  }
  const [muteControl, muteInput] = checkboxControl(settings.get().muted); muteInput.dataset.setting = "muted";
  muteInput.addEventListener("change", () => mutate(() => { settings.setMuted(muteInput.checked); setMuted(muteInput.checked); }));
  audio.append(labeledControl(T.mutedLabel, muteControl));
  const dynamic = document.createElement("select"); dynamic.dataset.setting = "dynamic-range";
  for (const key of ["headphones", "speakers", "reduced"] as const) dynamic.append(new Option(T.dynamicRanges[key], key));
  dynamic.value = settings.get().audio.dynamicRange;
  dynamic.addEventListener("change", () => mutate(() => { const value = dynamicRange(dynamic.value); if (value === null) return; settings.setDynamicRange(value); configureAudio(settings.get()); }));
  audio.append(labeledControl(T.dynamicRangeLabel, dynamic));
  const [hiddenControl, hiddenInput] = checkboxControl(settings.get().audio.muteWhenHidden); hiddenInput.dataset.setting = "mute-when-hidden";
  hiddenInput.addEventListener("change", () => mutate(() => { settings.setMuteWhenHidden(hiddenInput.checked); configureAudio(settings.get()); }));
  audio.append(labeledControl(T.muteWhenHiddenLabel, hiddenControl));

  const binds = section(T.keybindingsTitle), bindList = document.createElement("div"); bindList.className = "bind-list";
  const refresh = (): void => {
    for (const action of BIND_ACTIONS) { const button = keyButtons.get(action); if (!button) continue;
      button.textContent = action === capturing ? T.captureHint : formatBinding(settings.get().binds[action]); button.dataset.capturing = String(action === capturing); }
  };
  for (const action of BIND_ACTIONS) {
    const row = document.createElement("div"), label = document.createElement("span");
    const keyButton = createUiButton({ label: formatBinding(settings.get().binds[action]) }), reset = createUiButton({ label: "↺" });
    row.className = "bind-row"; label.textContent = T.actionLabels[action];
    keyButton.setAttribute("aria-label", `${T.actionLabels[action]} 키 변경`); reset.setAttribute("aria-label", `${T.actionLabels[action]} 기본값 복원`);
    keyButton.addEventListener("click", () => { if (capturing === null) { capturing = action; refresh(); } });
    reset.addEventListener("click", () => mutate(() => { settings.resetBind(action); refresh(); }));
    keyButtons.set(action, keyButton); row.append(label, keyButton, reset); bindList.append(row);
  }
  binds.append(bindList);
  const instance = ++settingsInstance;
  const tabs = document.createElement("div"); tabs.className = "settings-tabs ui-tabs"; tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "설정 분류");
  const panels = [controls, binds, audio] as const;
  const labels = ["조작과 화면", "키 설정", T.audioTitle] as const;
  const tabButtons = panels.map((panel, index) => {
    const button = document.createElement("button");
    const tabId = `settings-tab-${instance}-${index}`;
    const panelId = `settings-panel-${instance}-${index}`;
    button.type = "button"; button.className = "ui-tab"; button.id = tabId; button.textContent = labels[index] ?? "";
    button.setAttribute("role", "tab"); button.setAttribute("aria-controls", panelId);
    panel.id = panelId; panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", tabId);
    return button;
  });
  const selectTab = (selected: number, focus = false): void => {
    for (const [index, button] of tabButtons.entries()) {
      const active = index === selected;
      button.setAttribute("aria-selected", String(active)); button.tabIndex = active ? 0 : -1;
      panels[index]!.hidden = !active;
    }
    if (focus) tabButtons[selected]?.focus();
  };
  tabButtons.forEach((button, index) => {
    button.addEventListener("click", () => selectTab(index));
    button.addEventListener("keydown", event => {
      const selected = settingsTabAfterKey(index, event.key, tabButtons.length);
      if (selected === index && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault(); selectTab(selected, true);
    });
  });
  tabs.append(...tabButtons); body.append(tabs, ...panels); selectTab(0);

  const close = (): void => { closeCurrent = null; window.removeEventListener("keydown", onKeydown, true); dlg.remove(); root = null; onClose(); if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  const onKeydown = (event: KeyboardEvent): void => {
    if (capturing !== null) { event.preventDefault(); event.stopImmediatePropagation(); if (event.code !== "Escape") { settings.rebind(capturing, event.code); setStatus(); } capturing = null; refresh(); return; }
    if (event.code === "Escape" && !event.repeat) { event.preventDefault(); event.stopImmediatePropagation(); close(); }
  };
  const resetAll = createUiButton({ label: T.resetAllLabel }), closeButton = createUiButton({ label: T.closeLabel, tone: "accent" });
  resetAll.addEventListener("click", () => mutate(() => { settings.resetAll(); configureAudio(settings.get()); close(); })); closeButton.addEventListener("click", close);
  const actions = document.createElement("div"); actions.className = "settings-actions"; actions.append(resetAll, closeButton); footer.append(status, actions);
  shell.append(header, body, footer); dlg.append(style, shell);
  if (preparation) { preparation.append(dlg); return; }
  document.body.append(dlg); window.addEventListener("keydown", onKeydown, true); root = dlg; closeCurrent = close; sensInput.focus();
}
