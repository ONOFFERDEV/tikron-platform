export const SERVICE_FIELD_CSS = `
#deployment-flow,#quitConfirm,#overlay[data-kind="connection"]{--service-width:560px;--service-padding:var(--ui-space-6);background:var(--ui-scrim);color:var(--ui-text-primary);font:400 var(--ui-type-body)/1.5 var(--ui-font-body);letter-spacing:0;text-shadow:none}
#deployment-flow{position:fixed;inset:0;z-index:190;display:grid;place-items:center;padding:var(--ui-safe-edge);box-sizing:border-box;pointer-events:auto}
#deployment-flow[hidden],#deployment-flow [hidden]{display:none}
#deployment-flow .deployment-flow__panel,#quitConfirm .panel,#overlay[data-kind="connection"] .result{box-sizing:border-box;inline-size:min(var(--service-width),100%);max-inline-size:100%;padding:var(--service-padding);border:var(--ui-border-width) solid var(--ui-border-strong);border-block-start:var(--ui-border-emphasis) solid var(--ui-accent);border-radius:var(--ui-radius-control);background:var(--ui-surface-1);box-shadow:none;text-align:start}
#deployment-flow .deployment-flow__eyebrow,#quitConfirm h2,#overlay[data-kind="connection"] .eyebrow{margin:calc(-1 * var(--service-padding)) calc(-1 * var(--service-padding)) var(--ui-space-6);padding:var(--ui-space-3) var(--service-padding);background:var(--ui-surface-paper);color:var(--ui-ink);font:700 var(--ui-type-hud)/1.5 var(--ui-font-body);letter-spacing:0;word-break:keep-all}
#deployment-flow h1,#overlay[data-kind="connection"] h1{margin:0 0 var(--ui-space-3);font:700 var(--ui-type-screen)/1.3 var(--ui-font-body);letter-spacing:0;word-break:keep-all;overflow-wrap:anywhere;text-wrap:balance}
#deployment-flow p,#quitConfirm p,#overlay[data-kind="connection"] p{margin:0;color:var(--ui-text-secondary);font:400 var(--ui-type-body)/1.5 var(--ui-font-body);letter-spacing:0;word-break:keep-all;overflow-wrap:anywhere;text-wrap:pretty;opacity:1;text-align:start}
#deployment-flow .deployment-flow__stage{margin-block-start:var(--ui-space-6);padding:var(--ui-space-3) var(--ui-space-4);border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent);background:var(--ui-surface-0);color:var(--ui-text-primary);font:500 var(--ui-type-hud)/1.5 var(--ui-font-body);word-break:keep-all;overflow-wrap:anywhere}
#deployment-flow .deployment-flow__actions,#quitConfirm .row{display:flex;flex-wrap:wrap;gap:var(--ui-space-2);margin-block-start:var(--ui-space-6);justify-content:flex-start}
#deployment-flow[data-flow="recovery"] .deployment-flow__panel,#deployment-flow[data-flow="expired"] .deployment-flow__panel{border-block-start-color:var(--ui-error)}
#deployment-flow[data-flow="control-required"] .deployment-flow__panel{border-block-start-color:var(--ui-success)}
#deployment-flow .deployment-flow__actions button,#overlay[data-kind="connection"] button{min-block-size:var(--ui-control-min);margin:0;padding:var(--ui-space-2) var(--ui-space-4);border:var(--ui-border-width) solid var(--ui-border-strong);border-radius:var(--ui-radius-control);background:var(--ui-surface-1);color:var(--ui-text-primary);font:700 var(--ui-type-body)/1.5 var(--ui-font-body);letter-spacing:0;word-break:keep-all;cursor:pointer;box-shadow:none}
#deployment-flow .deployment-flow__actions button:first-child,#overlay[data-kind="connection"] button{background:var(--ui-surface-paper);border-color:var(--ui-surface-paper);color:var(--ui-ink)}
#deployment-flow .deployment-flow__actions button:hover,#overlay[data-kind="connection"] button:hover{background:var(--ui-surface-2);border-color:var(--ui-accent-hover)}
#deployment-flow .deployment-flow__actions button:first-child:hover,#overlay[data-kind="connection"] button:hover{background:var(--ui-accent-hover);color:var(--ui-ink)}
#deployment-flow .deployment-flow__actions button:active,#overlay[data-kind="connection"] button:active{background:var(--ui-accent);color:var(--ui-ink)}
#deployment-flow button:focus-visible,#quitConfirm button:focus-visible,#overlay[data-kind="connection"] button:focus-visible{outline:var(--ui-focus-width) solid var(--ui-focus);outline-offset:var(--ui-border-emphasis)}
#overlay[data-kind="connection"]{padding:var(--ui-safe-edge)}
#overlay[data-kind="connection"] button{margin-block-start:var(--ui-space-6)}
#quitConfirm{position:fixed;inset:0;z-index:150;display:grid;place-items:center;padding:var(--ui-safe-edge);box-sizing:border-box;pointer-events:auto}
#quitConfirm h2{font-size:var(--ui-type-panel)}
#quitConfirm .row .ui-button{flex:1 1 auto}
#quitConfirm .row .ui-button[data-tone="error"]{flex-grow:0}
@media(max-width:767px),(max-height:600px){#deployment-flow,#quitConfirm,#overlay[data-kind="connection"]{--service-padding:var(--ui-space-4)}}
@media(max-width:420px){#deployment-flow .deployment-flow__actions,#quitConfirm .row{flex-direction:column}#deployment-flow h1,#overlay[data-kind="connection"] h1{font-size:var(--ui-type-panel);text-wrap:pretty}}
`;
