export const UI_STYLE_ID = "ironsight-ui-tokens" as const;

export const UI_TOKENS = {
  "--ui-surface-0": "#121714",
  "--ui-surface-1": "#1d2520",
  "--ui-surface-2": "#2b342d",
  "--ui-surface-paper": "#e6dec9",
  "--ui-ink": "#20271f",
  "--ui-text-primary": "#f3f0e4",
  "--ui-text-secondary": "#cfd0bf",
  "--ui-text-muted": "#a8ad9c",
  "--ui-border-subtle": "#465044",
  "--ui-border-strong": "#88917d",
  "--ui-accent": "#d9b66d",
  "--ui-accent-hover": "#e9cb8f",
  "--ui-focus": "#f2d899",
  "--ui-ally": "#89c5e8",
  "--ui-enemy": "#f29b85",
  "--ui-neutral": "#e3decb",
  "--ui-success": "#a8cc91",
  "--ui-warning": "#e9c36e",
  "--ui-error": "#f0a496",
  "--ui-hud-backing": "rgba(18,23,20,.92)",
  "--ui-hud-quiet": "rgba(18,23,20,.7)",
  "--ui-stamp": "#8f3f24",
  "--ui-scrim": "rgba(6,8,7,.78)",
  "--ui-space-1": "4px",
  "--ui-space-2": "8px",
  "--ui-space-3": "12px",
  "--ui-space-4": "16px",
  "--ui-space-6": "24px",
  "--ui-space-8": "32px",
  "--ui-space-12": "48px",
  "--ui-space-16": "64px",
  "--ui-radius-control": "2px",
  "--ui-radius-panel": "4px",
  "--ui-z-world": "0",
  "--ui-z-hud": "10",
  "--ui-z-notice": "20",
  "--ui-z-modal": "30",
  "--ui-z-blocking": "40",
  "--ui-motion-fast": "100ms",
  "--ui-motion-panel": "160ms",
  "--ui-safe-edge": "clamp(16px,2vw,32px)",
  "--ui-control-min": "44px",
  "--ui-control-compact": "32px",
  "--ui-grid-card-min": "19rem",
  "--ui-layout-max": "1440px",
  "--ui-modal-max": "960px",
  "--ui-keycap-min": "40px",
  "--ui-border-width": "1px",
  "--ui-border-emphasis": "3px",
  "--ui-focus-width": "2px",
  "--ui-shadow-modal": "0 18px 70px rgba(3,6,4,.55)",
  "--ui-font-body": '"Noto Sans KR","Malgun Gothic",system-ui,sans-serif',
  "--ui-font-display": '"Barlow Condensed","Noto Sans KR","Malgun Gothic",sans-serif',
  "--ui-font-key": 'ui-monospace,"SFMono-Regular",Consolas,monospace',
  "--ui-type-display": "clamp(48px,7vw,80px)",
  "--ui-type-screen": "clamp(28px,4vw,40px)",
  "--ui-type-panel": "24px",
  "--ui-type-body": "16px",
  "--ui-type-hud": "14px",
  "--ui-type-meta": "12px",
  "--ui-type-micro": "11px",
  "--ui-type-health": "32px",
  "--ui-type-ammo": "40px",
  "--ui-type-reserve": "18px",
  "--ui-type-score": "24px",
} as const satisfies Readonly<Record<string, string>>;

const variableDeclarations = Object.entries(UI_TOKENS)
  .map(([name, value]) => `${name}:${value}`)
  .join(";");

export const UI_TOKEN_CSS = `
@font-face{font-family:"Noto Sans KR";src:url("/assets/ui/fonts/NotoSansKR-Variable.ttf") format("truetype");font-style:normal;font-weight:400 700;font-display:swap}
@font-face{font-family:"Barlow Condensed";src:url("/assets/ui/fonts/BarlowCondensed-SemiBold.ttf") format("truetype");font-style:normal;font-weight:600;font-display:swap}
@font-face{font-family:"Barlow Condensed";src:url("/assets/ui/fonts/BarlowCondensed-Bold.ttf") format("truetype");font-style:normal;font-weight:700;font-display:swap}
:root{${variableDeclarations}}
.ui-surface{box-sizing:border-box;color:var(--ui-text-primary);font:400 var(--ui-type-body)/1.5 var(--ui-font-body)}
.ui-surface *{box-sizing:border-box}
.ui-button{min-block-size:var(--ui-control-min);padding:var(--ui-space-2) var(--ui-space-4);border:var(--ui-border-width) solid var(--ui-border-strong);border-radius:var(--ui-radius-control);background:var(--ui-surface-1);color:var(--ui-text-primary);font:600 var(--ui-type-body)/1.25 var(--ui-font-body);cursor:pointer;transition:transform var(--ui-motion-fast) ease-out,background-color var(--ui-motion-fast) ease-out,color var(--ui-motion-fast) ease-out,border-color var(--ui-motion-fast) ease-out}
.ui-button:hover:not(:disabled){background:var(--ui-surface-2);border-color:var(--ui-accent-hover)}
.ui-button:active:not(:disabled),.ui-button[data-state="pressed"]{transform:translateY(1px);background:var(--ui-accent);color:var(--ui-ink)}
.ui-button:focus-visible,.ui-tab:focus-visible,.ui-field:focus-within{outline:var(--ui-focus-width) solid var(--ui-focus);outline-offset:3px}
.ui-button[aria-pressed="true"],.ui-button[data-state="selected"]{border-color:var(--ui-accent);box-shadow:inset 3px 0 0 var(--ui-accent)}
.ui-button[data-tone="accent"]{background:var(--ui-surface-paper);border-color:var(--ui-surface-paper);color:var(--ui-ink)}
.ui-button[data-tone="accent"]:hover:not(:disabled){background:var(--ui-accent-hover)}
.ui-button[data-tone="success"]{border-color:var(--ui-success)}
.ui-button[data-tone="warning"]{border-color:var(--ui-warning)}
.ui-button[data-tone="error"]{border-color:var(--ui-error);color:var(--ui-error)}
.ui-button:disabled{cursor:not-allowed;opacity:.48}
.ui-button[aria-busy="true"]{cursor:progress}
.ui-button__busy{display:inline-block;margin-inline-start:var(--ui-space-2);inline-size:.75em;block-size:.75em;border:var(--ui-focus-width) solid currentColor;border-inline-end-color:transparent;border-radius:50%;animation:ui-busy .7s linear infinite}
.ui-status-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(min-content,auto);gap:var(--ui-space-4);align-items:center;min-block-size:var(--ui-control-min);padding:var(--ui-space-2) var(--ui-space-3);border-inline-start:var(--ui-border-emphasis) solid var(--ui-border-strong);background:var(--ui-surface-1)}
.ui-status-row__label{min-inline-size:0;color:var(--ui-text-secondary)}
.ui-status-row__value{font-size:var(--ui-type-hud);font-weight:700;text-align:end;overflow-wrap:anywhere}
.ui-status-row[data-tone="success"]{border-inline-start-color:var(--ui-success)}
.ui-status-row[data-tone="warning"]{border-inline-start-color:var(--ui-warning)}
.ui-status-row[data-tone="error"]{border-inline-start-color:var(--ui-error)}
.ui-status-row[data-tone="accent"]{border-inline-start-color:var(--ui-accent)}
.ui-keycap{display:inline-flex;align-items:center;justify-content:center;min-block-size:var(--ui-control-compact);min-inline-size:var(--ui-keycap-min);padding:var(--ui-space-1) var(--ui-space-2);border:var(--ui-border-width) solid var(--ui-border-strong);border-block-end-width:var(--ui-border-emphasis);border-radius:var(--ui-radius-control);background:var(--ui-surface-2);font:600 var(--ui-type-hud)/1 var(--ui-font-key);overflow-wrap:anywhere}
.ui-keycap[data-state="capturing"]{border-color:var(--ui-warning);color:var(--ui-warning)}
.ui-keycap[data-state="unbound"]{border-style:dashed;color:var(--ui-text-muted)}
.ui-keycap[data-state="conflict"]{border-color:var(--ui-error);color:var(--ui-error)}
.ui-keycap[data-state="disabled"]{opacity:.48}
.ui-field{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--ui-space-4);align-items:center;padding:var(--ui-space-3);border:var(--ui-border-width) solid var(--ui-border-subtle);border-radius:var(--ui-radius-control);background:var(--ui-surface-1)}
.ui-field__copy{min-inline-size:0}.ui-field__label{display:block;font-weight:600}.ui-field__hint{display:block;margin-block-start:var(--ui-space-1);color:var(--ui-text-muted);font-size:var(--ui-type-hud);overflow-wrap:anywhere}
.ui-field__control{min-inline-size:0}.ui-field__control :is(input,select){inline-size:100%;min-block-size:var(--ui-control-min);padding:var(--ui-space-2);border:var(--ui-border-width) solid var(--ui-border-strong);border-radius:var(--ui-radius-control);background:var(--ui-surface-0);color:var(--ui-text-primary);font:inherit}
.ui-field[data-state="error"],.ui-field[data-state="save-failed"]{border-color:var(--ui-error)}
.ui-field[data-state="saving"]{border-color:var(--ui-warning)}
.ui-field[data-state="valid"]{border-color:var(--ui-success)}
.ui-field[data-state="disabled"]{opacity:.48}
.ui-tabs{display:flex;flex-wrap:wrap;gap:var(--ui-space-1);border-block-end:var(--ui-border-width) solid var(--ui-border-subtle)}
.ui-tab{min-block-size:var(--ui-control-min);padding:var(--ui-space-2) var(--ui-space-4);border:0;border-block-end:3px solid transparent;background:transparent;color:var(--ui-text-secondary);font:600 var(--ui-type-body)/1.25 var(--ui-font-body);cursor:pointer}
.ui-tab:hover:not(:disabled){color:var(--ui-text-primary);background:var(--ui-surface-1)}
.ui-tab[aria-selected="true"]{border-block-end-color:var(--ui-accent);color:var(--ui-text-primary)}
.ui-tab:disabled{opacity:.48;cursor:not-allowed}
.ui-scroll-modal{display:grid;grid-template-rows:auto minmax(0,1fr) auto;inline-size:min(var(--ui-modal-max),100%);max-block-size:calc(100dvh - 32px);border:var(--ui-border-width) solid var(--ui-border-strong);border-block-start:var(--ui-border-emphasis) solid var(--ui-accent);border-radius:var(--ui-radius-panel);background:var(--ui-surface-1);box-shadow:var(--ui-shadow-modal);overflow:hidden}
.ui-scroll-modal[hidden]{display:none}
.ui-scroll-modal__header,.ui-scroll-modal__footer{padding:var(--ui-space-4) var(--ui-space-6);background:var(--ui-surface-2)}
.ui-scroll-modal__header h2{margin:0;font:700 var(--ui-type-panel)/1.25 var(--ui-font-body);text-wrap:balance}
.ui-scroll-modal__body{min-block-size:0;overflow:auto;padding:var(--ui-space-6);overscroll-behavior:contain}
.ui-scroll-modal__footer{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:var(--ui-space-2);border-block-start:var(--ui-border-width) solid var(--ui-border-subtle)}
.ui-map-legend{display:flex;flex-wrap:wrap;gap:var(--ui-space-3);margin:0;padding:0;list-style:none}
.ui-map-legend__item{display:flex;gap:var(--ui-space-2);align-items:center;min-block-size:var(--ui-control-compact);font-size:var(--ui-type-hud)}
.ui-map-legend__marker{display:inline-grid;place-items:center;inline-size:var(--ui-space-6);block-size:var(--ui-space-6);border:2px solid currentColor;font:700 var(--ui-type-micro)/1 var(--ui-font-key)}
.ui-map-legend__item[data-tone="ally"]{color:var(--ui-ally)}.ui-map-legend__item[data-tone="enemy"]{color:var(--ui-enemy)}.ui-map-legend__item[data-tone="neutral"]{color:var(--ui-neutral)}
@keyframes ui-busy{to{transform:rotate(1turn)}}
@media(max-width:767px){.ui-field{grid-template-columns:minmax(0,1fr)}.ui-scroll-modal__header,.ui-scroll-modal__body,.ui-scroll-modal__footer{padding:var(--ui-space-4)}}
@media(prefers-reduced-motion:reduce){.ui-button{transition:none}.ui-button:active:not(:disabled),.ui-button[data-state="pressed"]{transform:none}.ui-button__busy{animation:none}}
[data-reduced-motion="true"] .ui-button{transition:none}[data-reduced-motion="true"] .ui-button:active:not(:disabled),[data-reduced-motion="true"] .ui-button[data-state="pressed"]{transform:none}[data-reduced-motion="true"] .ui-button__busy{animation:none}
[data-font-fallback="true"]{--ui-font-body:"Malgun Gothic",system-ui,sans-serif;--ui-font-display:"Malgun Gothic",sans-serif}
`;

export function installUiTokens(target: Document = document): HTMLStyleElement {
  const existing = target.querySelector<HTMLStyleElement>(`style#${UI_STYLE_ID}`);
  if (existing) return existing;
  const style = target.createElement("style");
  style.id = UI_STYLE_ID;
  style.textContent = UI_TOKEN_CSS;
  target.head.append(style);
  return style;
}



