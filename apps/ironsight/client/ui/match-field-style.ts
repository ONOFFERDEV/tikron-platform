export const RESULT_FIELD_CSS = `
#overlay[data-kind="end"]{background:var(--ui-scrim);padding:var(--ui-safe-edge);overflow:hidden}
#overlay .result-view{--report-name-column:64%;inline-size:min(var(--ui-modal-max),100%);max-block-size:calc(100dvh - 2 * var(--ui-safe-edge));text-align:start;border-color:var(--ui-border-strong);border-block-start-color:var(--ui-accent);border-radius:var(--ui-radius-control)}
#overlay .result-view__header{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,auto);align-items:end;gap:var(--ui-space-2) var(--ui-space-6);padding:var(--ui-space-4) var(--ui-space-6);background:var(--ui-surface-paper);color:var(--ui-ink)}
#overlay .result-view__header h2{grid-column:1/-1;margin:0;font:700 var(--ui-type-hud)/1.5 var(--ui-font-body);letter-spacing:0;word-break:keep-all}
#overlay .result-view__outcome{font:700 var(--ui-type-screen)/1.2 var(--ui-font-body);color:var(--ui-ink);letter-spacing:0;word-break:keep-all}
#overlay .result-view__score{min-inline-size:0;max-inline-size:100%;font:700 var(--ui-type-score)/1.5 var(--ui-font-body);font-variant-numeric:tabular-nums;text-align:end;overflow-wrap:anywhere;word-break:keep-all}
#overlay .result-view__body{padding:var(--ui-space-6);scrollbar-color:var(--ui-border-strong) var(--ui-surface-0)}
#overlay .result-view__local{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;margin:0 0 var(--ui-space-6);border-block:var(--ui-border-width) solid var(--ui-border-strong)}
#overlay .result-view__local>div{min-inline-size:0;padding:var(--ui-space-3) var(--ui-space-4)}
#overlay .result-view__local>div+div{border-inline-start:var(--ui-border-width) solid var(--ui-border-subtle)}
#overlay .result-view__local dt{color:var(--ui-text-secondary);font-size:var(--ui-type-hud);line-height:1.5;white-space:nowrap}
#overlay .result-view__local dd{margin:var(--ui-space-1) 0 0;font:700 var(--ui-type-health)/1.2 var(--ui-font-body);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
#overlay .result-view__rosters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ui-space-6)}
#overlay .result-view__rosters:has(>section:only-child){grid-template-columns:minmax(0,1fr)}
#overlay .result-view__rosters h3{margin:0;padding:var(--ui-space-2);border-block-end:var(--ui-border-width) solid var(--ui-border-strong);background:var(--ui-surface-2);font:700 var(--ui-type-hud)/1.5 var(--ui-font-body)}
#overlay .result-view table{inline-size:100%;border-collapse:collapse;table-layout:fixed;font:400 var(--ui-type-hud)/1.5 var(--ui-font-body)}
#overlay .result-view :is(th,td){padding:var(--ui-space-2);border-block-end:var(--ui-border-width) solid var(--ui-border-subtle);text-align:end;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
#overlay .result-view th{color:var(--ui-text-secondary);font-weight:500;white-space:nowrap}
#overlay .result-view :is(th,td):first-child{inline-size:var(--report-name-column);text-align:start;word-break:keep-all}
#overlay .result-view tr[data-self="true"]{background:var(--ui-surface-2)}
#overlay .result-view tr[data-self="true"] td:first-child{border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent)}
#overlay .result-view__footer{align-items:center;gap:var(--ui-space-3);padding:var(--ui-space-4) var(--ui-space-6);background:var(--ui-surface-0)}
#overlay .result-view__status{display:grid;gap:var(--ui-space-1);min-inline-size:0;margin-inline-end:auto;color:var(--ui-text-secondary);font:400 var(--ui-type-hud)/1.5 var(--ui-font-body);word-break:keep-all;overflow-wrap:anywhere}
#overlay .result-view__status strong{color:var(--ui-warning)}
#overlay .result-view .ui-button{margin:0;min-block-size:var(--ui-control-min);padding:var(--ui-space-2) var(--ui-space-4);border:var(--ui-border-width) solid var(--ui-border-strong);border-radius:var(--ui-radius-control);background:var(--ui-surface-1);color:var(--ui-text-primary);font:700 var(--ui-type-body)/1.5 var(--ui-font-body);letter-spacing:0;word-break:keep-all;box-shadow:none}
#overlay .result-view .ui-button[data-tone="accent"]{background:var(--ui-surface-paper);border-color:var(--ui-surface-paper);color:var(--ui-ink)}
#overlay .result-view .ui-button:hover:not(:disabled){background:var(--ui-surface-2);border-color:var(--ui-accent-hover)}
#overlay .result-view .ui-button[data-tone="accent"]:hover:not(:disabled){background:var(--ui-accent-hover);color:var(--ui-ink)}
#overlay .result-view .ui-button:active:not(:disabled){background:var(--ui-accent);color:var(--ui-ink)}
@media(max-width:767px){
 #overlay .result-view__rosters{grid-template-columns:minmax(0,1fr)}
 #overlay .result-view__header,#overlay .result-view__body,#overlay .result-view__footer{padding:var(--ui-space-4)}
 #overlay .result-view__footer{align-items:stretch}
 #overlay .result-view__status{inline-size:100%}
 #overlay .result-view__footer .ui-button{flex:1 1 10rem}
 #overlay .result-view__local>div{padding:var(--ui-space-3) var(--ui-space-2)}
}
`;

export const DEPLOYMENT_FIELD_CSS = `
#deployment-banner{--deployment-count-width:104px;--deployment-count-size:clamp(40px,4vw,64px);--deployment-top:146px;position:absolute;inset-block-start:var(--deployment-top);inset-inline-start:50%;transform:translateX(-50%);inline-size:min(600px,calc(100vw - 2 * var(--ui-safe-edge)));box-sizing:border-box;padding:var(--ui-space-4) var(--ui-space-6);border:var(--ui-border-width) solid var(--ui-border-strong);border-block-start:var(--ui-border-emphasis) solid var(--ui-accent);background:var(--ui-hud-backing);color:var(--ui-text-primary);pointer-events:none;font-family:var(--ui-font-body);text-align:start}
#deployment-banner[hidden]{display:none}
#hud[data-deploying=true] #matchBrief{visibility:hidden}
#deployment-banner .deployment-kicker{font:700 var(--ui-type-hud)/1.5 var(--ui-font-body);color:var(--ui-text-secondary);word-break:keep-all;overflow-wrap:anywhere}
#deployment-banner .deployment-body{display:grid;grid-template-columns:var(--deployment-count-width) minmax(0,1fr);align-items:center;gap:var(--ui-space-4);margin:var(--ui-space-3) 0}
#deployment-banner .deployment-count{display:grid;place-items:center;align-self:stretch;min-block-size:var(--ui-space-16);padding:var(--ui-space-2) var(--ui-space-1);box-sizing:border-box;background:var(--ui-surface-paper);color:var(--ui-ink);font:700 var(--deployment-count-size)/1.15 var(--ui-font-body);font-variant-numeric:tabular-nums;letter-spacing:0;white-space:nowrap}
#deployment-banner:is([data-kind="go"],[data-kind="waiting"],[data-kind="standby"]) .deployment-count{font-size:var(--ui-type-health)}
#deployment-banner h2{margin:0;font:700 var(--ui-type-panel)/1.5 var(--ui-font-body);word-break:keep-all}
#deployment-banner .deployment-detail{margin:var(--ui-space-1) 0 0;font:400 var(--ui-type-hud)/1.5 var(--ui-font-body);color:var(--ui-text-secondary);word-break:keep-all;text-wrap:pretty;overflow-wrap:anywhere}
#deployment-banner .deployment-progress{display:flex;gap:var(--ui-space-1);block-size:var(--ui-border-emphasis);margin-block-start:var(--ui-space-3)}
#deployment-banner .deployment-progress i{flex:1;background:var(--ui-border-subtle)}
#deployment-banner .deployment-progress i[data-lit=true]{background:var(--ui-accent)}
#deployment-banner[data-kind="go"]{border-block-start-color:var(--ui-success)}
#deployment-banner[data-kind="go"] .deployment-count{background:var(--ui-success)}
#deployment-banner[data-kind="go"] .deployment-progress i{background:var(--ui-success)}
@media(max-width:800px){#deployment-banner{--deployment-top:202px;--deployment-count-width:80px;padding:var(--ui-space-3)}#deployment-banner .deployment-body{gap:var(--ui-space-3)}#hud[data-deploying=true] #caps{top:330px}#hud[data-deploying=true] #lb{top:350px}}
@media(min-width:801px){#hud[data-deploying=true] #combatObjectives{top:328px}#hud[data-deploying=true] #caps{top:386px}}
@media(max-height:700px) and (min-width:801px){#deployment-banner{--deployment-top:120px;padding:var(--ui-space-3) var(--ui-space-4)}#deployment-banner .deployment-body{margin:var(--ui-space-2) 0}}
`;
