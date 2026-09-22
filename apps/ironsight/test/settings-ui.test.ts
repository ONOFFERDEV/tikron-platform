import { describe, expect, it } from "vitest";
import { settingsPersisted, settingsTabAfterKey } from "../client/settings-ui.js";
import { SettingsStore, type SettingsStorage } from "../client/settings.js";

class MemoryStorage implements SettingsStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("settings save status", () => {
  it("recognizes a canonical save regardless of JSON object key order", () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    store.setSensitivity(1.35);
    const parsed = JSON.parse(storage.getItem("ironsight.settings.v1") ?? "null") as Record<string, unknown>;
    const reordered = Object.fromEntries(Object.entries(parsed).reverse());

    expect(settingsPersisted(store.get(), { getItem: () => JSON.stringify(reordered) })).toBe(true);
  });

  it("reports a missing, corrupt, or stale save as failed", () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    store.setSensitivity(1.5);

    expect(settingsPersisted(store.get(), { getItem: () => null })).toBe(false);
    expect(settingsPersisted(store.get(), { getItem: () => "{" })).toBe(false);
    expect(settingsPersisted(store.get(), { getItem: () => JSON.stringify({ sensitivity: 1 }) })).toBe(false);
  });
});

describe("settings tabs", () => {
  it("Given a selected tab, When arrow and edge keys are pressed, Then focus wraps without leaving the dialog", () => {
    expect(settingsTabAfterKey(0, "ArrowLeft", 3)).toBe(2);
    expect(settingsTabAfterKey(2, "ArrowRight", 3)).toBe(0);
    expect(settingsTabAfterKey(1, "Home", 3)).toBe(0);
    expect(settingsTabAfterKey(1, "End", 3)).toBe(2);
    expect(settingsTabAfterKey(1, "Escape", 3)).toBe(1);
  });
});
