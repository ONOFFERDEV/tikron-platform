import {describe,expect,it} from 'vitest';
import {SERVICE_FIELD_CSS} from '../client/ui/service-field-style.js';
import {SETTINGS_STYLE} from '../client/ui/settings-style.js';
import {UI_TOKENS} from '../client/ui/tokens.js';

describe('field service presentation boundaries',()=>{
 it('resolves field materials and geometry through the documented shared or local contract',()=>{
  const css=SERVICE_FIELD_CSS+SETTINGS_STYLE;
  const declared=new Set([...Object.keys(UI_TOKENS),...[...css.matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1])]);
  expect([...css.matchAll(/var\((--[\w-]+)/g)].map(m=>m[1]).filter(key=>!declared.has(key))).toEqual([]);
  expect(css).not.toMatch(/#[a-f\d]{3,8}\b|rgba?\(/i);
 });
 it('adds no costly raster effect or visual suppression beyond native hidden states',()=>{
  const css=SERVICE_FIELD_CSS+SETTINGS_STYLE;
  expect(css).not.toMatch(/(?:backdrop-filter|filter|background-image|animation)\s*:|(?:linear|radial|conic)-gradient\(/);
  expect(css).not.toMatch(/(?:text-shadow|box-shadow)\s*:\s*(?!none)[^;}]+/);
  expect(css).not.toMatch(/visibility\s*:\s*hidden|opacity\s*:\s*0\b|text-overflow\s*:\s*ellipsis/);
  for(const rule of css.matchAll(/([^{}]+)\{[^{}]*display\s*:\s*none[^{}]*\}/g))expect(rule[1]).toContain('[hidden]');
 });
});
