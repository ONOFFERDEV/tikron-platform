import { describe, expect, it } from "vitest";
import { FIELD_PAPER_CSS } from "../client/ui/field-paper-style.js";
import { UI_TOKENS } from "../client/ui/tokens.js";

describe("1918 field-card skin", () => {
  it("uses only declared tokens and no hard-coded colour", () => {
    const defined = new Set([...Object.keys(UI_TOKENS), "--field-insignia"]);
    const used = [...FIELD_PAPER_CSS.matchAll(/var\((--[\w-]+)/g)].map(match => match[1]);
    expect(used.filter(token => !defined.has(token))).toEqual([]);
    expect(FIELD_PAPER_CSS.replace(/url\("data:[^"]+"\)/g, "")).not.toMatch(/#[a-f\d]{3,8}\b|rgba?\(/i);
  });

  it("stays off the live instruments and adds no motion, filter or text shadow", () => {
    expect(FIELD_PAPER_CSS).not.toMatch(/#(?:feed|combatEventLog|hp|ammo|wbar|xhair|hitmarker|scores|matchBrief|caps)\b/);
    expect(FIELD_PAPER_CSS).not.toMatch(/(?:animation|transition|filter|text-shadow)\s*:/);
    expect(FIELD_PAPER_CSS).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0\b/);
  });

  it("puts each site's vista behind the deployment screen under a shade layer", () => {
    for (const site of ["relay", "undertow", "switchyard"]) {
      const rule = FIELD_PAPER_CSS.match(new RegExp(`:root\\[data-site="${site}"\\] #deployment-flow\\{([^}]+)\\}`))?.[1] ?? "";
      expect(rule).toMatch(new RegExp(`^background:linear-gradient\\(.+url\\("/assets/${site}-vista\\.webp"\\)`));
    }
  });
});
