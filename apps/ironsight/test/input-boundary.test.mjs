import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Input } from "../client/input.js";
import { SettingsStore } from "../client/settings.js";

class ElementSurface extends EventTarget {
  isContentEditable = false;
  dataset = {};
  setAttribute() {}
  append() {}
  querySelectorAll() { return []; }
  requestPointerLock() {}
}

class InputSurface extends ElementSurface {}
class TextareaSurface extends ElementSurface {}

function event(type, properties = {}) {
  const value = new Event(type, { cancelable: true });
  for (const [key, property] of Object.entries(properties)) {
    Object.defineProperty(value, key, { value: property });
  }
  return value;
}

function setup() {
  const windowSurface = new EventTarget();
  const documentSurface = Object.assign(new EventTarget(), {
    head: new ElementSurface(),
    body: new ElementSurface(),
    createElement: () => new ElementSurface(),
    pointerLockElement: null,
  });
  vi.stubGlobal("window", windowSurface);
  vi.stubGlobal("document", documentSurface);
  vi.stubGlobal("HTMLElement", ElementSurface);
  vi.stubGlobal("HTMLInputElement", InputSurface);
  vi.stubGlobal("HTMLTextAreaElement", TextareaSurface);
  const canvas = new ElementSurface();
  const settings = new SettingsStore({ getItem: () => null, setItem() {} });
  const input = new Input(canvas, 0, settings);
  documentSurface.pointerLockElement = canvas;
  documentSurface.dispatchEvent(event("pointerlockchange"));
  return {
    input, canvas, documentSurface, windowSurface,
    key: (type, code, target = canvas) => windowSurface.dispatchEvent(event(type, { code, target, repeat: false })),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("gameplay input focus boundaries", () => {
  it("clears held controls and queued actions when pointer lock is released", () => {
    // Given held movement, aim, fire, jump and reload during gameplay.
    const { input, canvas, key, documentSurface } = setup();
    for (const code of ["KeyW", "Space", "KeyR"]) key("keydown", code);
    canvas.dispatchEvent(event("mousedown", { button: 0 }));
    canvas.dispatchEvent(event("mousedown", { button: 2 }));

    // When the menu releases pointer lock and play is resumed.
    documentSurface.pointerLockElement = null;
    documentSurface.dispatchEvent(event("pointerlockchange"));
    documentSurface.pointerLockElement = canvas;
    documentSurface.dispatchEvent(event("pointerlockchange"));

    // Then no stale action survives the transition.
    expect(input.intent()).toEqual({ mx: 0, mz: 0, jump: false, crouch: false, sprint: false });
    expect(input.consumeJump()).toBe(false);
    expect(input.consumeReload()).toBe(false);
    expect(input.wantsFire).toBe(false);
    expect(input.adsHeld).toBe(false);
  });

  it("clears queued jump and reload as well as held controls when the window blurs", () => {
    // Given action edges queued between render frames.
    const { input, canvas, key, windowSurface } = setup();
    for (const code of ["KeyW", "Space", "KeyR"]) key("keydown", code);
    canvas.dispatchEvent(event("mousedown", { button: 0 }));
    canvas.dispatchEvent(event("mousedown", { button: 2 }));

    // When window focus leaves before another pointer-lock notification.
    windowSurface.dispatchEvent(event("blur"));

    // Then a later frame cannot execute the old jump or reload.
    expect(input.consumeJump()).toBe(false);
    expect(input.consumeReload()).toBe(false);
    expect(input.intent().mz).toBe(0);
    expect(input.wantsFire).toBe(false);
    expect(input.adsHeld).toBe(false);
  });

  it.each(["input", "textarea", "contenteditable"])("releases existing controls when %s gains typing focus", kind => {
    // Given movement and action edges held before text entry starts.
    const { input, canvas, key, windowSurface } = setup();
    const target = kind === "input" ? new InputSurface() : kind === "textarea" ? new TextareaSurface() : new ElementSurface();
    if (kind === "contenteditable") target.isContentEditable = true;
    for (const code of ["KeyW", "Space", "KeyR"]) key("keydown", code);
    canvas.dispatchEvent(event("mousedown", { button: 0 }));
    canvas.dispatchEvent(event("mousedown", { button: 2 }));

    // When a text control receives focus while the window remains locked.
    windowSurface.dispatchEvent(event("focusin", { target }));
    key("keydown", "KeyW", target);

    // Then gameplay is neutral while the player types.
    expect(input.intent()).toEqual({ mx: 0, mz: 0, jump: false, crouch: false, sprint: false });
    expect(input.consumeReload()).toBe(false);
    expect(input.wantsFire).toBe(false);
    expect(input.adsHeld).toBe(false);
  });

  it("releases an already-held key even when its keyup targets a text field", () => {
    // Given an already-held movement key.
    const { input, key } = setup();
    key("keydown", "KeyW");
    expect(input.intent().mz).toBe(1);

    // When keyup is delivered to an editable control.
    key("keyup", "KeyW", new InputSurface());

    // Then movement stops despite the editable event target.
    expect(input.intent().mz).toBe(0);
  });
});
