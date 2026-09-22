import { describe, expect, it } from 'vitest';
import { RESULT_FIELD_CSS, DEPLOYMENT_FIELD_CSS } from '../client/ui/match-field-style.js';
import { honorsCss } from '../client/round-honors.js';
import { UI_TOKENS } from '../client/ui/tokens.js';

describe('match field skin boundaries', () => {
  it('resolves every color and layout variable through the shared or local contract', () => {
    const css = RESULT_FIELD_CSS + DEPLOYMENT_FIELD_CSS + honorsCss;
    const declared = new Set([...Object.keys(UI_TOKENS), ...[...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1])]);
    const references = [...css.matchAll(/var\((--[\w-]+)/g)].map(m => m[1]);
    expect(references.filter(variable => !declared.has(variable))).toEqual([]);
    for (const value of css.matchAll(/(?:color|background|border[\w-]*)\s*:\s*([^;}]+)/g)) {
      expect(value[1]).not.toMatch(/#[a-f\d]{3,8}\b|rgba?\(/i);
    }
  });

  it('adds no raster effects or information-hiding rule to the report', () => {
    const css = RESULT_FIELD_CSS + DEPLOYMENT_FIELD_CSS + honorsCss;
    expect(css).not.toMatch(/(?:backdrop-filter|filter|background-image|animation)\s*:/);
    expect(css).not.toMatch(/(?:linear|radial|conic)-gradient\(/);
    expect(css).not.toMatch(/(?:text-shadow|box-shadow)\s*:\s*(?!none)[^;}]+/);
    expect(RESULT_FIELD_CSS + honorsCss).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0\b|text-overflow\s*:\s*ellipsis/);
  });
});
