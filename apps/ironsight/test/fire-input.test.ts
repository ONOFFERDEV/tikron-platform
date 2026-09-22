import { describe, expect, it } from "vitest";
import {
  FIRE_PRESS_WINDOW_MS,
  FireInputBuffer,
  type FireClearReason,
} from "../client/fire-input.js";

const CLEAR_REASONS: readonly FireClearReason[] = [
  "pointer_unlock",
  "blur",
  "death",
  "offline",
  "menu",
  "weapon_switch",
];

describe("first-click fire input", () => {
  it.each([1000 / 60, 1000 / 144])("keeps a short click between %.2f ms frames", frameMs => {
    const fire = new FireInputBuffer();
    fire.press(10);
    expect(fire.active).toBe(true);
    fire.release();
    expect(fire.active).toBe(true);
    expect(fire.take(10 + frameMs, "semi", true)).toEqual({ kind: "press", pressedAt: 10 });
    expect(fire.active).toBe(false);
    expect(fire.take(10 + frameMs, "semi", true)).toBeNull();
  });

  it("holds at most one fresh press for 120 ms", () => {
    const fire = new FireInputBuffer();
    fire.press(0);
    fire.release();
    fire.press(50);
    fire.release();
    expect(fire.take(50 + FIRE_PRESS_WINDOW_MS, "semi", true)).toEqual({ kind: "press", pressedAt: 50 });
    fire.press(500);
    fire.release();
    expect(fire.take(500 + FIRE_PRESS_WINDOW_MS + 1, "semi", true)).toBeNull();
  });

  it("refuses one millisecond before readiness and accepts at the deadline", () => {
    const fire = new FireInputBuffer();
    fire.press(100);
    fire.release();
    expect(fire.take(149, "semi", false)).toBeNull();
    expect(fire.take(150, "semi", true)).toEqual({ kind: "press", pressedAt: 100 });
  });

  it.each(CLEAR_REASONS)("drops the pending press on %s", reason => {
    const fire = new FireInputBuffer();
    fire.press(10);
    fire.release();
    fire.clear(reason);
    expect(fire.held).toBe(false);
    expect(fire.take(11, "semi", true)).toBeNull();
  });

  it("preserves held automatic fire without repeating semi fire", () => {
    const automatic = new FireInputBuffer();
    automatic.press(0);
    expect(automatic.take(200, "automatic", true)).toEqual({ kind: "held", pressedAt: 0 });
    expect(automatic.take(300, "automatic", true)).toEqual({ kind: "held", pressedAt: 0 });

    const semi = new FireInputBuffer();
    semi.press(0);
    expect(semi.take(10, "semi", true)).toEqual({ kind: "press", pressedAt: 0 });
    expect(semi.take(20, "semi", true)).toBeNull();
  });

  it("never turns an expired released press into a delayed shot", () => {
    const fire = new FireInputBuffer();
    fire.press(0);
    fire.release();
    expect(fire.take(121, "automatic", true)).toBeNull();
  });
});
