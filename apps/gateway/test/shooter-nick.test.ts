import { describe, it, expect } from "vitest";
import { sanitizeNick, MAX_NICK_LEN } from "../src/rooms/shooter-nick.js";

const ctrl = (code: number): string => String.fromCharCode(code);

describe("sanitizeNick", () => {
  it("accepts a plain name unchanged", () => {
    expect(sanitizeNick("Ana")).toBe("Ana");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeNick("  Bob  ")).toBe("Bob");
  });

  it("strips C0, DEL and C1 control characters", () => {
    const dirty = "a" + ctrl(0x00) + "b" + ctrl(0x07) + "c" + ctrl(0x7f) + "d" + ctrl(0x9f) + "e";
    expect(sanitizeNick(dirty)).toBe("abcde");
  });

  it("clamps to the max length", () => {
    const long = "x".repeat(300);
    const out = sanitizeNick(long);
    expect(out).toBe("x".repeat(MAX_NICK_LEN));
    expect(out!.length).toBe(MAX_NICK_LEN);
  });

  it("rejects non-string payloads", () => {
    expect(sanitizeNick(12345)).toBeNull();
    expect(sanitizeNick(null)).toBeNull();
    expect(sanitizeNick(undefined)).toBeNull();
    expect(sanitizeNick({ nick: "x" })).toBeNull();
    expect(sanitizeNick(["a"])).toBeNull();
  });

  it("rejects strings that sanitize to empty", () => {
    expect(sanitizeNick("")).toBeNull();
    expect(sanitizeNick("   ")).toBeNull();
    expect(sanitizeNick(ctrl(0x00) + ctrl(0x07) + ctrl(0x1f))).toBeNull();
  });
});
