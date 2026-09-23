import { describe, expect, it } from "vitest";
import { HUD_FIELD_CSS } from "../client/ui/hud-field-style.js";
import { UI_TOKENS } from "../client/ui/tokens.js";

describe("live field instruments", () => {
  it("resolves every visual variable through the declared UI or local layout tokens", () => {
    const defined = new Set([...Object.keys(UI_TOKENS), "--hud-log-width", "--hud-center-width", "--casualty-width"]);
    const used = [...HUD_FIELD_CSS.matchAll(/var\((--[\w-]+)/g)].map(match => match[1]);
    expect(used.filter(token => token === undefined || !defined.has(token))).toEqual([]);
    expect(used).toContain("--ui-type-hud");
    const values = [...HUD_FIELD_CSS.matchAll(/(?:color|background|border[\w-]*)\s*:\s*([^;}]+)/g)];
    for (const value of values) expect(value[1]).not.toMatch(/#[a-f\d]{3,8}\b/i);
  });

  it("cannot suppress authoritative information or introduce an unprepared paint effect", () => {
    expect(HUD_FIELD_CSS).not.toMatch(/(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$))/);
    expect(HUD_FIELD_CSS).not.toMatch(/(?:backdrop-filter|filter|background-image|animation)\s*:/);
    expect(HUD_FIELD_CSS).not.toMatch(/(?:linear|radial|conic)-gradient\(/);
    expect(HUD_FIELD_CSS).not.toMatch(/(?:text-shadow|box-shadow)\s*:\s*(?!none)[^;}]+/);
    expect(HUD_FIELD_CSS).not.toMatch(/#(?:xhair|hitmarker|vignette|damage-[\w-]+)/);
  });
});
