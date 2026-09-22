export type UiTone = "default" | "accent" | "success" | "warning" | "error";
export type UiControlState = "default" | "pressed" | "selected" | "disabled" | "loading";
export type UiKeycapState = "default" | "capturing" | "unbound" | "conflict" | "disabled";
export type UiFieldState = "default" | "valid" | "error" | "saving" | "save-failed" | "disabled";

export interface UiButtonOptions {
  readonly label: string;
  readonly tone?: UiTone;
  readonly state?: UiControlState;
  readonly onClick?: () => void;
}

export interface UiLegendItem {
  readonly label: string;
  readonly tone: "ally" | "enemy" | "neutral";
  readonly marker: string;
}

function setState(node: HTMLElement, state: string): void {
  node.dataset.state = state;
}

export function createUiButton(options: UiButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  const state = options.state ?? "default";
  button.type = "button";
  button.className = "ui-button";
  button.dataset.tone = options.tone ?? "default";
  setState(button, state);
  button.append(document.createTextNode(options.label));

  if (state === "selected" || state === "pressed") {
    button.setAttribute("aria-pressed", "true");
  }
  if (state === "disabled" || state === "loading") button.disabled = true;
  if (state === "loading") {
    button.setAttribute("aria-busy", "true");
    const busy = document.createElement("span");
    busy.className = "ui-button__busy";
    busy.setAttribute("aria-hidden", "true");
    button.append(busy);
  }
  if (options.onClick) button.addEventListener("click", options.onClick);
  return button;
}

export function createUiStatusRow(label: string, value: string, tone: UiTone = "default"): HTMLElement {
  const row = document.createElement("div");
  const labelNode = document.createElement("span");
  const valueNode = document.createElement("strong");
  row.className = "ui-status-row";
  row.dataset.tone = tone;
  labelNode.className = "ui-status-row__label";
  valueNode.className = "ui-status-row__value";
  labelNode.textContent = label;
  valueNode.textContent = value;
  row.append(labelNode, valueNode);
  return row;
}

export function createUiKeycap(binding: string, label: string, state: UiKeycapState = "default"): HTMLElement {
  const keycap = document.createElement("span");
  keycap.className = "ui-keycap";
  keycap.dataset.state = state;
  keycap.textContent = binding || "미지정";
  keycap.setAttribute("aria-label", `${label}: ${binding || "미지정"}`);
  return keycap;
}

export function createUiField(
  label: string,
  control: HTMLElement,
  hint?: string,
  state: UiFieldState = "default",
): HTMLElement {
  const field = document.createElement("label");
  const copy = document.createElement("span");
  const labelNode = document.createElement("span");
  const controlSlot = document.createElement("span");
  field.className = "ui-field";
  field.dataset.state = state;
  copy.className = "ui-field__copy";
  labelNode.className = "ui-field__label";
  labelNode.textContent = label;
  controlSlot.className = "ui-field__control";
  controlSlot.append(control);
  copy.append(labelNode);

  if (hint) {
    const hintNode = document.createElement("span");
    hintNode.className = "ui-field__hint";
    hintNode.textContent = hint;
    copy.append(hintNode);
  }
  if (state === "disabled") {
    control.setAttribute("aria-disabled", "true");
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLButtonElement) {
      control.disabled = true;
    }
  }
  field.append(copy, controlSlot);
  return field;
}

let uiTabsSequence = 0;

export function createUiTabs(labels: readonly string[], selected: number): HTMLElement {
  const tabs = document.createElement("div");
  const idPrefix = `ui-tabs-${++uiTabsSequence}`;
  const buttons: HTMLButtonElement[] = [];
  const selectedIndex = selected >= 0 && selected < labels.length ? selected : 0;
  tabs.className = "ui-tabs";
  tabs.setAttribute("role", "tablist");
  labels.forEach((label, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "ui-tab";
    tab.id = `${idPrefix}-tab-${index}`;
    tab.dataset.index = String(index);
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `${idPrefix}-panel-${index}`);
    tab.setAttribute("aria-selected", String(index === selectedIndex));
    tab.tabIndex = index === selectedIndex ? 0 : -1;
    tab.textContent = label;
    tab.addEventListener("click", () => {
      for (const candidate of tabs.querySelectorAll<HTMLButtonElement>(".ui-tab")) {
        const active = candidate === tab;
        candidate.setAttribute("aria-selected", String(active));
        candidate.tabIndex = active ? 0 : -1;
      }
    });
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.code)) return;
      event.preventDefault();
      const current = buttons.indexOf(tab);
      const next = event.code === "Home" ? 0
        : event.code === "End" ? buttons.length - 1
          : (current + (event.code === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      const candidate = buttons[next];
      if (!candidate || candidate.disabled) return;
      candidate.click();
      candidate.focus();
    });
    buttons.push(tab);
    tabs.append(tab);
  });
  return tabs;
}

export interface UiScrollModalOptions {
  readonly initiallyOpen?: boolean;
  readonly onClose?: () => void;
}

interface UiScrollModalState {
  readonly onClose?: () => void;
  restoreFocus: HTMLElement | null;
}

const scrollModalState = new WeakMap<HTMLElement, UiScrollModalState>();
const modalFocusable = 'button:not(:disabled),input:not(:disabled),select:not(:disabled),[href],[tabindex]:not([tabindex="-1"])';

export function closeUiScrollModal(modal: HTMLElement): void {
  const state = scrollModalState.get(modal);
  modal.hidden = true;
  modal.dataset.open = "false";
  state?.onClose?.();
  state?.restoreFocus?.focus();
  if (state) state.restoreFocus = null;
}

export function openUiScrollModal(modal: HTMLElement, trigger: HTMLElement | null = null): void {
  const state = scrollModalState.get(modal);
  if (state) state.restoreFocus = trigger;
  modal.hidden = false;
  modal.dataset.open = "true";
  queueMicrotask(() => modal.querySelector<HTMLElement>(modalFocusable)?.focus());
}

export function createUiScrollModal(title: string, body: HTMLElement, footer: HTMLElement, options: UiScrollModalOptions = {}): HTMLElement {
  const modal = document.createElement("section");
  const header = document.createElement("header");
  const heading = document.createElement("h2");
  modal.className = "ui-scroll-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", title);
  modal.hidden = !options.initiallyOpen;
  modal.dataset.open = String(Boolean(options.initiallyOpen));
  scrollModalState.set(modal, { onClose: options.onClose, restoreFocus: null });
  header.className = "ui-scroll-modal__header";
  body.classList.add("ui-scroll-modal__body");
  footer.classList.add("ui-scroll-modal__footer");
  heading.textContent = title;
  header.append(heading);
  modal.append(header, body, footer);
  modal.addEventListener("click", event => {
    if ((event.target as Element).closest("[data-ui-modal-close]")) closeUiScrollModal(modal);
  });
  modal.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeUiScrollModal(modal);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...modal.querySelectorAll<HTMLElement>(modalFocusable)];
    if (focusable.length === 0) return;
    const current = focusable.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey ? (current <= 0 ? focusable.length - 1 : current - 1) : (current + 1) % focusable.length;
    event.preventDefault();
    focusable[next]?.focus();
  });
  if (options.initiallyOpen) queueMicrotask(() => modal.querySelector<HTMLElement>(modalFocusable)?.focus());
  return modal;
}

export function createUiMapLegend(items: readonly UiLegendItem[]): HTMLElement {
  const legend = document.createElement("ul");
  legend.className = "ui-map-legend";
  legend.setAttribute("aria-label", "지도 범례");
  for (const item of items) {
    const row = document.createElement("li");
    const marker = document.createElement("span");
    const label = document.createElement("span");
    row.className = "ui-map-legend__item";
    row.dataset.tone = item.tone;
    marker.className = "ui-map-legend__marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = item.marker;
    label.textContent = item.label;
    row.append(marker, label);
    legend.append(row);
  }
  return legend;
}
