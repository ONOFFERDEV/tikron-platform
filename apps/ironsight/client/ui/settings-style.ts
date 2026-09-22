export const SETTINGS_STYLE = `
#settingsPanel{position:fixed;inset:0;z-index:160;display:grid;place-items:center;padding:var(--ui-safe-edge);box-sizing:border-box;background:var(--ui-scrim);color:var(--ui-text-primary);font:400 var(--ui-type-body)/1.5 var(--ui-font-body);pointer-events:auto}
#settingsPanel .settings-shell{inline-size:min(760px,100%);max-block-size:min(820px,calc(100dvh - var(--ui-safe-edge)*2));display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:var(--ui-surface-1);border:1px solid var(--ui-border-strong);border-radius:var(--ui-radius-panel);box-shadow:var(--ui-shadow-modal)}
#settingsPanel .settings-header,#settingsPanel .settings-footer{padding:var(--ui-space-4) var(--ui-space-6);background:var(--ui-surface-2)}
#settingsPanel .settings-header{border-block-end:1px solid var(--ui-border-subtle);display:flex;align-items:end;justify-content:space-between;gap:var(--ui-space-4)}
#settingsPanel .settings-header h2{margin:0;font:700 var(--ui-type-panel)/1.25 var(--ui-font-body);color:var(--ui-text-primary)}
#settingsPanel .settings-header p{margin:0;color:var(--ui-text-muted);font:500 var(--ui-type-hud)/1.4 var(--ui-font-body)}
#settingsPanel .settings-body{min-block-size:0;overflow:auto;padding:var(--ui-space-6);display:grid;gap:var(--ui-space-6);overscroll-behavior:contain}
#settingsPanel .settings-tabs{position:sticky;inset-block-start:calc(var(--ui-space-6)*-1);z-index:1;margin:calc(var(--ui-space-6)*-1) calc(var(--ui-space-6)*-1) 0;padding:var(--ui-space-3) var(--ui-space-6) 0;background:var(--ui-surface-1)}
#settingsPanel [role=tabpanel][hidden]{display:none}
#settingsPanel .settings-section{display:grid;gap:var(--ui-space-3)}
#settingsPanel .settings-section h3{margin:0;padding-block-end:var(--ui-space-2);border-block-end:1px solid var(--ui-border-subtle);font:700 16px/1.5 var(--ui-font-body);color:var(--ui-accent)}
#settingsPanel .settings-field{display:grid;grid-template-columns:minmax(160px,1fr) minmax(220px,1.2fr);align-items:center;gap:var(--ui-space-4);min-block-size:44px}
#settingsPanel .settings-copy{display:grid;gap:2px}
#settingsPanel .settings-copy small{color:var(--ui-text-muted);font:500 var(--ui-type-hud)/1.4 var(--ui-font-body)}
#settingsPanel input[type=range],#settingsPanel select{inline-size:100%;min-block-size:44px}
#settingsPanel select{padding-inline:var(--ui-space-3);border:1px solid var(--ui-border-strong);border-radius:var(--ui-radius-control);background:var(--ui-surface-0);color:var(--ui-text-primary);font:400 var(--ui-type-body)/1.5 var(--ui-font-body)}
#settingsPanel .range-control{display:grid;grid-template-columns:minmax(100px,1fr) 52px;align-items:center;gap:var(--ui-space-3);font-variant-numeric:tabular-nums}
#settingsPanel .check-control{justify-self:end;display:flex;align-items:center;gap:var(--ui-space-2);min-block-size:44px}
#settingsPanel .bind-list{display:grid;gap:var(--ui-space-2)}
#settingsPanel .bind-row{display:grid;grid-template-columns:minmax(120px,1fr) minmax(150px,220px) 44px;align-items:center;gap:var(--ui-space-2)}
#settingsPanel .bind-row .ui-button{inline-size:100%}
#settingsPanel .bind-row [data-capturing=true]{border-color:var(--ui-warning);color:var(--ui-warning);background:var(--ui-surface-2)}
#settingsPanel .settings-footer{border-block-start:1px solid var(--ui-border-subtle);display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-3)}
#settingsPanel .settings-status{font:500 var(--ui-type-hud)/1.4 var(--ui-font-body);color:var(--ui-success)}
#settingsPanel .settings-status[data-state=save-failed]{color:var(--ui-error)}
#settingsPanel .settings-actions{display:flex;gap:var(--ui-space-2)}
#settingsPanel :focus-visible{outline:2px solid var(--ui-focus);outline-offset:3px}
@media(max-width:640px){#settingsPanel{padding:0}#settingsPanel .settings-shell{max-block-size:100dvh;block-size:100dvh;border:0}.settings-field{grid-template-columns:1fr!important;gap:var(--ui-space-2)!important}.bind-row{grid-template-columns:minmax(90px,1fr) minmax(120px,1.4fr) 44px!important}.settings-footer{align-items:stretch!important;flex-direction:column}.settings-actions{display:grid!important;grid-template-columns:1fr 1fr}}
`;
