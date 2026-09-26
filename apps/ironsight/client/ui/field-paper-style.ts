/** 1918 field-card skin for the menu, results, casualty slip and deployment screens.
 * CSS only: paper and ruling are token gradients, the insignia is a small inline SVG
 * used as a mask so it takes a token colour. Never used on the live HUD instruments. */

// Fictional regimental badge: roundel, dotted inner ring, crossed rifles under a chevron.
const INSIGNIA_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
  + '<circle cx="32" cy="32" r="29" fill="none" stroke="black" stroke-width="3"/>'
  + '<circle cx="32" cy="32" r="23" fill="none" stroke="black" stroke-width="1.5" stroke-dasharray="2 2.6"/>'
  + '<path d="M20 26 32 18 44 26 44 31 32 23 20 31Z"/>'
  + '<path d="M19 47 43 29 45 31.5 21 49.5Z M45 47 21 29 19 31.5 43 49.5Z"/>'
  + '<rect x="29" y="36" width="6" height="6" transform="rotate(45 32 39)"/></svg>';
export const FIELD_INSIGNIA = `url("data:image/svg+xml,${encodeURIComponent(INSIGNIA_SVG)}")`;

const fibre = 'color-mix(in srgb,var(--ui-ink) 4%,transparent)';
const rule = 'color-mix(in srgb,var(--ui-ink) 9%,transparent)';
const age = 'color-mix(in srgb,var(--ui-ink) 12%,transparent)';
const PAPER = `repeating-linear-gradient(112deg,${fibre} 0 1px,transparent 1px 6px),repeating-linear-gradient(28deg,${fibre} 0 1px,transparent 1px 9px),radial-gradient(ellipse at 50% 40%,transparent 55%,${age}),var(--ui-surface-paper)`;
const RULED = `repeating-linear-gradient(180deg,transparent 0 27px,${rule} 27px 28px),${PAPER}`;
const CANVAS = `repeating-linear-gradient(45deg,color-mix(in srgb,var(--ui-surface-paper) 3%,transparent) 0 1px,transparent 1px 4px),repeating-linear-gradient(-45deg,color-mix(in srgb,var(--ui-surface-paper) 3%,transparent) 0 1px,transparent 1px 4px),var(--ui-surface-1)`;
const INK_SOFT = 'color-mix(in srgb,var(--ui-ink) 80%,var(--ui-surface-paper))';

export const FIELD_PAPER_CSS = `
:root{--field-insignia:${FIELD_INSIGNIA}}
/* Deployment menu: lighter shade so the vista reads, paper field cards, stamped labels. */
:root #modeMenu .shade{background:linear-gradient(90deg,color-mix(in srgb,var(--ui-surface-0) 88%,transparent),color-mix(in srgb,var(--ui-surface-0) 62%,transparent) 36%,color-mix(in srgb,var(--ui-surface-0) 8%,transparent) 74%),linear-gradient(0deg,color-mix(in srgb,var(--ui-surface-0) 70%,transparent),transparent 45%)}
:root #modeMenu .mark{border:0;inline-size:32px;block-size:32px;background:var(--ui-accent);-webkit-mask:var(--field-insignia) center/contain no-repeat;mask:var(--field-insignia) center/contain no-repeat}
:root #modeMenu .mark:after{content:none}
:root #modeMenu .hero:before{content:"";display:block;inline-size:72px;block-size:72px;margin-block-end:var(--ui-space-4);background:var(--ui-surface-paper);-webkit-mask:var(--field-insignia) center/contain no-repeat;mask:var(--field-insignia) center/contain no-repeat}
:root #modeMenu .intel{background:${RULED};color:var(--ui-ink);border:var(--ui-border-width) solid var(--ui-surface-paper);border-inline-start:var(--ui-border-emphasis) solid var(--ui-stamp)}
:root #modeMenu .intel small{display:inline-block;padding:var(--ui-space-1) var(--ui-space-2);border:2px solid var(--ui-stamp);color:var(--ui-stamp);font:700 var(--ui-type-meta)/1.3 var(--ui-font-body);transform:rotate(-2deg)}
:root #modeMenu .intel strong{color:var(--ui-ink)}
:root #modeMenu .intel p{color:${INK_SOFT}}
:root #modeMenu .intel .routes{color:var(--ui-ink)}
:root #modeMenu .blueprint{background:var(--ui-surface-paper);border:var(--ui-border-width) solid ${INK_SOFT}}
:root #modeMenu .menuBody>.playlistLabel{justify-self:start;max-inline-size:100%;margin-block-start:var(--ui-space-4);padding:var(--ui-space-1) var(--ui-space-3);border:2px solid var(--ui-surface-paper);color:var(--ui-surface-paper);font-weight:700;transform:rotate(-1deg)}
:root #modeMenu .playlist{background:${CANVAS};border-color:var(--ui-border-strong)}
:root #modeMenu .playlist[aria-pressed="true"],:root #modeMenu .playlist[aria-pressed="true"]:hover:not(:disabled){background:${PAPER};border-color:var(--ui-surface-paper);box-shadow:inset 4px 0 0 var(--ui-stamp)}
:root #modeMenu .playlist[aria-pressed="true"] :is(.number,.ko,strong){color:var(--ui-ink)}
:root #modeMenu .playlist[aria-pressed="true"] .number{color:var(--ui-stamp);font-weight:700}
:root #modeMenu .deploy{background:${PAPER};border:2px solid var(--ui-ink);outline:var(--ui-border-width) solid var(--ui-surface-paper);outline-offset:-5px}
:root #modeMenu .deploy:focus-visible{outline:var(--ui-focus-width) solid var(--ui-focus);outline-offset:3px}
:root #modeMenu .deploy:hover:not(:disabled){background:var(--ui-accent-hover)}
:root #modeMenu .topline,:root #modeMenu footer{background:${CANVAS}}
/* Results: paper report with the insignia, a stamped outcome and ruled rosters. */
:root #overlay .result-view__header{position:relative;padding-inline-start:calc(var(--ui-space-6) + 64px);background:${PAPER}}
:root #overlay .result-view__header:before{content:"";position:absolute;inset-inline-start:var(--ui-space-6);inset-block-start:50%;inline-size:52px;block-size:52px;transform:translateY(-50%);background:var(--ui-ink);-webkit-mask:var(--field-insignia) center/contain no-repeat;mask:var(--field-insignia) center/contain no-repeat}
:root #overlay .result-view__outcome{justify-self:start;padding:0 var(--ui-space-3);border:4px double currentColor;transform:rotate(-2deg)}
:root #overlay .result-view[data-outcome="defeat"] .result-view__outcome{color:var(--ui-stamp)}
:root #overlay .result-view__body{background:${CANVAS}}
:root #overlay .result-view__rosters h3{background:${PAPER};color:var(--ui-ink);border-block-end:2px solid var(--ui-ink)}
:root #overlay .result-view__footer{background:${CANVAS}}
/* Casualty slip: paper heading with the stamp edge, ruled olive rows. */
:root #hud #overlay[data-kind="death"]>h1{background:${PAPER};border-inline-start-color:var(--ui-stamp)}
:root #hud #overlay[data-kind="death"]>p{background:${CANVAS}}
/* Deployment and redeploy screens show the current site's vista through a light shade. */
:root #deployment-flow .deployment-flow__panel{background:${CANVAS}}
:root #deployment-flow .deployment-flow__eyebrow{background:${PAPER}}
${['relay', 'undertow', 'switchyard'].map(site => `:root[data-site="${site}"] #deployment-flow{background:linear-gradient(0deg,color-mix(in srgb,var(--ui-surface-0) 82%,transparent),color-mix(in srgb,var(--ui-surface-0) 38%,transparent) 60%),url("/assets/${site}-vista.webp") center/cover no-repeat,var(--ui-surface-0)}`).join('\n')}
`;

export function installFieldPaper(target: Document = document): void {
  if (target.getElementById('field-paper-styles')) return;
  const style = target.createElement('style'); style.id = 'field-paper-styles'; style.textContent = FIELD_PAPER_CSS;
  target.head.append(style);
}
