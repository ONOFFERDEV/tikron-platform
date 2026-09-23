import {describe,expect,it} from 'vitest';
import {COMBAT_FIELD_CSS,SUPPORT_FIELD_CSS} from '../client/ui/combat-field-style.js';
import {UI_TOKENS} from '../client/ui/tokens.js';

describe('combat field presentation boundaries',()=>{
 it('uses defined shared or local tokens for field materials',()=>{
  const css=COMBAT_FIELD_CSS+SUPPORT_FIELD_CSS;
  const declared=new Set([...Object.keys(UI_TOKENS),...[...css.matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1])]);
  expect([...css.matchAll(/var\((--[\w-]+)/g)].map(m=>m[1]).filter(key=>!declared.has(key))).toEqual([]);
  expect(css).not.toMatch(/#[a-f\d]{3,8}\b|rgba?\(/i);
 });
 it('preserves information and introduces no expensive paint effect',()=>{
  const css=COMBAT_FIELD_CSS+SUPPORT_FIELD_CSS;
  expect(css).not.toMatch(/(?:backdrop-filter|filter|background-image|animation)\s*:|(?:linear|radial|conic)-gradient\(/);
  expect(css).not.toMatch(/(?:text-shadow|box-shadow)\s*:\s*(?!none)[^;}]+/);
  expect(css).not.toMatch(/visibility\s*:\s*hidden|opacity\s*:\s*0\b|text-overflow\s*:\s*ellipsis|overflow\s*:\s*hidden/);
  for(const rule of css.matchAll(/([^{}]+)\{[^{}]*display\s*:\s*none[^{}]*\}/g))expect(rule[1]).toContain('[hidden]');
 });
});
