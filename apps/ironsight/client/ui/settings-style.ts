export const SETTINGS_STYLE = `
#settingsPanel{position:fixed;inset:0;z-index:160;display:grid;place-items:center;padding:var(--ui-safe-edge);box-sizing:border-box;background:var(--ui-scrim);color:var(--ui-text-primary);font:400 var(--ui-type-body)/1.5 var(--ui-font-body);pointer-events:auto}
#settingsPanel .settings-shell{--settings-value-width:64px;inline-size:min(760px,100%);max-block-size:min(820px,calc(100dvh - var(--ui-safe-edge)*2));display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:var(--ui-surface-1);border:var(--ui-border-width) solid var(--ui-border-strong);border-block-start:var(--ui-border-emphasis) solid var(--ui-accent);border-radius:var(--ui-radius-control)}
#settingsPanel .settings-header,#settingsPanel .settings-footer{padding:var(--ui-space-4) var(--ui-space-6);background:var(--ui-surface-2)}
#settingsPanel .settings-header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--ui-space-2) var(--ui-space-4);background:var(--ui-surface-paper);color:var(--ui-ink)}
#settingsPanel .settings-header h2{margin:0;font:700 var(--ui-type-panel)/1.5 var(--ui-font-body);color:inherit}
#settingsPanel .settings-header p{margin:0;color:inherit;font:500 var(--ui-type-hud)/1.5 var(--ui-font-body);word-break:keep-all}
#settingsPanel .settings-body{min-block-size:0;overflow:auto;padding:var(--ui-space-6);display:grid;gap:var(--ui-space-6);overscroll-behavior:contain}
#settingsPanel .settings-tabs{position:sticky;inset-block-start:calc(var(--ui-space-6)*-1);z-index:1;margin:calc(var(--ui-space-6)*-1) calc(var(--ui-space-6)*-1) 0;padding:var(--ui-space-3) var(--ui-space-6) 0;background:var(--ui-surface-1)}
#settingsPanel [role=tabpanel][hidden]{display:none}
#settingsPanel .ui-tab[aria-selected=true]{background:var(--ui-surface-paper);color:var(--ui-ink)}
#settingsPanel .settings-section{display:grid;gap:0;min-inline-size:0}
#settingsPanel .settings-section h3{margin:0 0 var(--ui-space-2);padding:var(--ui-space-2) var(--ui-space-3);border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent);background:var(--ui-surface-0);font:700 var(--ui-type-body)/1.5 var(--ui-font-body);color:var(--ui-text-primary)}
#settingsPanel .settings-field{display:grid;grid-template-columns:minmax(160px,1fr) minmax(220px,1.2fr);align-items:center;gap:var(--ui-space-4);min-block-size:var(--ui-control-min);padding-block:var(--ui-space-3);border-block-end:var(--ui-border-width) solid var(--ui-border-subtle)}
#settingsPanel .settings-copy{display:grid;gap:var(--ui-space-1);min-inline-size:0;word-break:keep-all;text-wrap:pretty;overflow-wrap:anywhere}
#settingsPanel .settings-copy small{color:var(--ui-text-secondary);font:400 var(--ui-type-hud)/1.5 var(--ui-font-body)}
#settingsPanel input[type=range],#settingsPanel select{inline-size:100%;min-block-size:44px}
#settingsPanel select{padding-inline:var(--ui-space-3);border:1px solid var(--ui-border-strong);border-radius:var(--ui-radius-control);background:var(--ui-surface-0);color:var(--ui-text-primary);font:400 var(--ui-type-body)/1.5 var(--ui-font-body)}
#settingsPanel .range-control{display:grid;grid-template-columns:minmax(0,1fr) var(--settings-value-width);align-items:center;gap:var(--ui-space-3);min-inline-size:0;font-variant-numeric:tabular-nums}
#settingsPanel .range-control output{padding:var(--ui-space-1);border:var(--ui-border-width) solid var(--ui-border-subtle);background:var(--ui-surface-0);text-align:center}
#settingsPanel input{accent-color:var(--ui-accent)}
#settingsPanel input[type=range]{min-inline-size:0;margin:0;cursor:pointer}
#settingsPanel input[type=checkbox]{inline-size:var(--ui-space-6);block-size:var(--ui-space-6);margin:0;cursor:pointer}
#settingsPanel .check-control{justify-self:end;display:flex;align-items:center;gap:var(--ui-space-2);min-block-size:44px}
#settingsPanel .bind-list{display:grid;gap:var(--ui-space-2)}
#settingsPanel .bind-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,220px) var(--ui-control-min);align-items:center;gap:var(--ui-space-2);padding-block:var(--ui-space-2);border-block-end:var(--ui-border-width) solid var(--ui-border-subtle);word-break:keep-all;overflow-wrap:anywhere}
#settingsPanel .bind-row .ui-button{inline-size:100%;min-inline-size:0;padding-inline:var(--ui-space-2);font-size:var(--ui-type-hud);line-height:1.5;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
#settingsPanel .bind-row [data-capturing=true]{border-color:var(--ui-warning);color:var(--ui-warning);background:var(--ui-surface-2)}
#settingsPanel .settings-footer{border-block-start:var(--ui-border-width) solid var(--ui-border-subtle);display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-3);background:var(--ui-surface-0)}
#settingsPanel .settings-status{font:500 var(--ui-type-hud)/1.4 var(--ui-font-body);color:var(--ui-success)}
#settingsPanel .settings-status[data-state=save-failed]{color:var(--ui-error)}
#settingsPanel .settings-actions{display:flex;gap:var(--ui-space-2);flex-shrink:0}
#settingsPanel .settings-status{word-break:keep-all;text-wrap:pretty}
#settingsPanel :focus-visible{outline:2px solid var(--ui-focus);outline-offset:3px}
@media(max-width:767px){#settingsPanel .settings-field{grid-template-columns:minmax(0,1fr);gap:var(--ui-space-2)}#settingsPanel .check-control{justify-self:start}#settingsPanel .settings-footer{align-items:stretch;flex-direction:column}#settingsPanel .settings-actions{display:grid;grid-template-columns:1fr 1fr}#settingsPanel .bind-row{grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) var(--ui-control-min)}}
@media(max-width:640px){#settingsPanel{padding:0}#settingsPanel .settings-shell{max-block-size:100dvh;block-size:100dvh;border:0}#settingsPanel .settings-header,#settingsPanel .settings-footer,#settingsPanel .settings-body{padding:var(--ui-space-4)}#settingsPanel .settings-tabs{inset-block-start:calc(-1 * var(--ui-space-4));margin:calc(-1 * var(--ui-space-4)) calc(-1 * var(--ui-space-4)) 0;padding:var(--ui-space-2) var(--ui-space-4) 0}#settingsPanel .ui-tab{padding-inline:var(--ui-space-3)}}
`;
