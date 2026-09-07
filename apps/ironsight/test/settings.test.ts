import { describe, it, expect } from "vitest";
import {
  SettingsStore,
  formatKeyLabel,
  formatBinding,
  type SettingsStorage,
} from "../client/settings.js";

/**
 * client/settings.ts is deliberately DOM-free (see its own doc comment), so
 * these tests drive it directly under plain vitest with an in-memory fake
 * standing in for `window.localStorage` — no jsdom required.
 */

class FakeStorage implements SettingsStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const KEY = "ironsight.settings.v1";

describe("SettingsStore persistence", () => {
  it("round-trips sensitivity, invertY, and binds through fake storage", () => {
    const storage = new FakeStorage();
    const store = new SettingsStore(storage);

    store.setSensitivity(2.25);
    store.setInvertY(true);
    store.rebind("jump", "KeyJ");

    // A fresh store reading the SAME backing storage should see the saved state.
    const reloaded = new SettingsStore(storage);
    const s = reloaded.get();
    expect(s.sensitivity).toBe(2.25);
    expect(s.invertY).toBe(true);
    expect(s.binds.jump).toEqual(["KeyJ"]);
  });

  it("falls back to defaults on malformed JSON without throwing", () => {
    const storage = new FakeStorage();
    storage.setItem(KEY, "{not valid json");

    let store!: SettingsStore;
    expect(() => {
      store = new SettingsStore(storage);
    }).not.toThrow();

    const s = store.get();
    expect(s.sensitivity).toBe(1.0);
    expect(s.invertY).toBe(false);
    expect(s.binds.forward).toEqual(["KeyW"]);
  });

  it("falls back to defaults when the saved shape doesn't match (wrong types)", () => {
    const storage = new FakeStorage();
    storage.setItem(KEY, JSON.stringify({ sensitivity: "fast", invertY: "yes", binds: "nope" }));

    const store = new SettingsStore(storage);
    const s = store.get();
    expect(s.sensitivity).toBe(1.0);
    expect(s.invertY).toBe(false);
    expect(s.binds).toEqual({
      forward: ["KeyW"],
      back: ["KeyS"],
      left: ["KeyA"],
      right: ["KeyD"],
      jump: ["Space"],
      crouch: ["ControlLeft", "KeyC"],
      sprint: ["ShiftLeft", "ShiftRight"],
      reload: ["KeyR"],
      grenade: ["KeyG"],
    });
  });

  it("merges a partial saved blob over defaults (missing/unrecognized fields untouched)", () => {
    const storage = new FakeStorage();
    // Only sensitivity and one bind are present; invertY and the rest of binds
    // are absent, as if saved by an older version with fewer fields.
    storage.setItem(KEY, JSON.stringify({ sensitivity: 1.75, binds: { reload: ["KeyF"] } }));

    const store = new SettingsStore(storage);
    const s = store.get();
    expect(s.sensitivity).toBe(1.75);
    expect(s.invertY).toBe(false); // default, since absent from the saved blob
    expect(s.binds.reload).toEqual(["KeyF"]); // merged in
    expect(s.binds.forward).toEqual(["KeyW"]); // default, since absent from the saved blob
  });

  it("loads shipped defaults matching today's hardcoded input.ts behavior when nothing is saved", () => {
    const store = new SettingsStore(new FakeStorage());
    const s = store.get();
    expect(s.sensitivity).toBe(1.0);
    expect(s.invertY).toBe(false);
    expect(s.binds).toEqual({
      forward: ["KeyW"],
      back: ["KeyS"],
      left: ["KeyA"],
      right: ["KeyD"],
      jump: ["Space"],
      crouch: ["ControlLeft", "KeyC"],
      sprint: ["ShiftLeft", "ShiftRight"],
      reload: ["KeyR"],
      grenade: ["KeyG"],
    });
  });
});

describe("SettingsStore.rebind conflict handling", () => {
  it("removes a key from whichever other action held it when reassigned", () => {
    const store = new SettingsStore(new FakeStorage());
    // KeyW is forward's default binding; rebind it onto "back".
    store.rebind("back", "KeyW");

    const s = store.get();
    expect(s.binds.back).toEqual(["KeyW"]);
    expect(s.binds.forward).toEqual([]); // stripped from its previous owner
  });

  it("strips a multi-key action's conflicting entry while leaving its other key intact", () => {
    const store = new SettingsStore(new FakeStorage());
    // ShiftLeft/ShiftRight both map to sprint by default; steal ShiftLeft for grenade.
    store.rebind("grenade", "ShiftLeft");

    const s = store.get();
    expect(s.binds.grenade).toEqual(["ShiftLeft"]);
    expect(s.binds.sprint).toEqual(["ShiftRight"]);
  });
});

describe("SettingsStore reset", () => {
  it("resetBind restores a single action to its shipped default", () => {
    const store = new SettingsStore(new FakeStorage());
    store.rebind("reload", "KeyF");
    expect(store.get().binds.reload).toEqual(["KeyF"]);

    store.resetBind("reload");
    expect(store.get().binds.reload).toEqual(["KeyR"]);
  });

  it("resetAll restores sensitivity, invertY, and every binding to shipped defaults", () => {
    const store = new SettingsStore(new FakeStorage());
    store.setSensitivity(2.9);
    store.setInvertY(true);
    store.rebind("jump", "KeyJ");

    store.resetAll();

    const s = store.get();
    expect(s.sensitivity).toBe(1.0);
    expect(s.invertY).toBe(false);
    expect(s.binds.jump).toEqual(["Space"]);
  });
});

describe("SettingsStore sensitivity clamping", () => {
  it("clamps values above the max down to 3.0", () => {
    const store = new SettingsStore(new FakeStorage());
    store.setSensitivity(50);
    expect(store.get().sensitivity).toBe(3.0);
  });

  it("clamps values below the min up to 0.1", () => {
    const store = new SettingsStore(new FakeStorage());
    store.setSensitivity(-5);
    expect(store.get().sensitivity).toBe(0.1);
  });

  it("falls back to the default for non-finite values", () => {
    const store = new SettingsStore(new FakeStorage());
    store.setSensitivity(Number.NaN);
    expect(store.get().sensitivity).toBe(1.0);
  });

  it("passes through in-range values unchanged", () => {
    const store = new SettingsStore(new FakeStorage());
    store.setSensitivity(1.5);
    expect(store.get().sensitivity).toBe(1.5);
  });
});

describe("formatKeyLabel", () => {
  it("maps the documented special cases exactly", () => {
    expect(formatKeyLabel("KeyW")).toBe("W");
    expect(formatKeyLabel("Space")).toBe("SPACE");
    expect(formatKeyLabel("ControlLeft")).toBe("L-CTRL");
    expect(formatKeyLabel("ShiftRight")).toBe("R-SHIFT");
    expect(formatKeyLabel("ArrowUp")).toBe("↑");
    expect(formatKeyLabel("Digit3")).toBe("3");
  });

  it("passes unrecognized codes through unchanged", () => {
    expect(formatKeyLabel("F1")).toBe("F1");
    expect(formatKeyLabel("Backquote")).toBe("Backquote");
  });
});

describe("formatBinding", () => {
  it("renders an empty binding as an em dash", () => {
    expect(formatBinding([])).toBe("—");
  });

  it("joins multiple codes with a slash", () => {
    expect(formatBinding(["ControlLeft", "KeyC"])).toBe("L-CTRL / C");
  });

  it("formats a single-code binding without a separator", () => {
    expect(formatBinding(["KeyR"])).toBe("R");
  });
});


describe("presentation accessibility settings", () => {
  it("persists reduced motion and volume across sessions", () => {
    const storage = new FakeStorage(), store = new SettingsStore(storage);
    store.setReducedMotion(true); store.setVolume(0.35);
    const restored = new SettingsStore(storage).get();
    expect(restored.reducedMotion).toBe(true); expect(restored.volume).toBe(0.35);
    store.resetAll();
    expect(store.get().reducedMotion).toBe(false); expect(store.get().volume).toBe(1);
  });
  it("clamps corrupt volume and preserves older settings", () => {
    const storage = new FakeStorage();
    storage.setItem("ironsight.settings.v1", JSON.stringify({ sensitivity: 1.5, volume: 100, reducedMotion: "yes" }));
    const store = new SettingsStore(storage);
    expect(store.get().sensitivity).toBe(1.5); expect(store.get().volume).toBe(1);
    expect(store.get().reducedMotion).toBe(false);
    store.setVolume(-2); expect(store.get().volume).toBe(0);
    store.setVolume(NaN); expect(store.get().volume).toBe(1);
  });
});
