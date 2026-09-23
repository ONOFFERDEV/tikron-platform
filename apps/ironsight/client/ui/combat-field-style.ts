export const SUPPORT_FIELD_CSS = `
#airSupport,#supportBanner{--support-width:288px;--support-bottom:112px;--support-icon:32px;--support-icon-column:56px;box-sizing:border-box;inline-size:var(--support-width);max-inline-size:calc(100vw - var(--ui-safe-edge)*2);color:var(--ui-text-primary);background:var(--ui-hud-backing);border:var(--ui-border-width) solid var(--ui-border-subtle);border-radius:var(--ui-radius-control);font:500 var(--ui-type-hud)/1.5 var(--ui-font-body);font-variant-numeric:tabular-nums;letter-spacing:0;word-break:keep-all;overflow-wrap:anywhere;text-wrap:pretty;pointer-events:none}
#airSupport{inset:auto var(--ui-safe-edge) calc(var(--ui-safe-edge) + var(--support-bottom)) auto;padding:var(--ui-space-3) var(--ui-space-4);border-inline-end:var(--ui-border-emphasis) solid var(--ui-border-strong)}
#airSupport[data-mortar-ready="true"]{border-inline-end-color:var(--ui-accent)}
#airSupport strong{margin:calc(-1 * var(--ui-space-3)) calc(-1 * var(--ui-space-4)) var(--ui-space-2);padding:var(--ui-space-2) var(--ui-space-4);background:var(--ui-surface-paper);color:var(--ui-ink);font:700 var(--ui-type-hud)/1.5 var(--ui-font-body)}
#airSupport span{min-block-size:0;color:var(--ui-text-secondary);font:500 var(--ui-type-hud)/1.5 var(--ui-font-body)}
#airSupport .meter{gap:var(--ui-space-1);margin-block-start:var(--ui-space-3)}
#airSupport i{block-size:var(--ui-space-1);background:var(--ui-border-strong)}
#airSupport i[data-filled="true"]{background:var(--ui-accent)}
#supportBanner{--dispatch-width:560px;inset:auto auto calc(var(--ui-safe-edge) + 44px) 50%;inline-size:var(--dispatch-width);transform:translateX(-50%);padding:var(--ui-space-2) var(--ui-space-4) var(--ui-space-2) var(--support-icon-column);border-block-start:var(--ui-border-emphasis) solid var(--ui-accent)}
#supportBanner::before{left:var(--ui-space-3);top:var(--ui-space-4);width:var(--support-icon);height:var(--support-icon);background:var(--ui-accent)}
#supportBanner strong{font:700 var(--ui-type-reserve)/1.5 var(--ui-font-body);margin:0 0 var(--ui-space-1)}
#supportBanner span{display:block;color:var(--ui-text-secondary);font:500 var(--ui-type-hud)/1.5 var(--ui-font-body)}
#supportBanner[data-kind="drone"]::before{clip-path:polygon(46% 0,54% 0,58% 26%,100% 30%,100% 40%,59% 40%,59% 54%,94% 58%,94% 68%,58% 66%,57% 84%,72% 90%,72% 100%,50% 95%,28% 100%,28% 90%,43% 84%,42% 66%,6% 68%,6% 58%,41% 54%,41% 40%,0 40%,0 30%,42% 26%);transform:none}

@media(max-height:650px){
 #airSupport,#supportBanner{--support-bottom:112px}
 #airSupport{padding:var(--ui-space-2) var(--ui-space-4)}
 #airSupport strong{margin-block-start:calc(-1 * var(--ui-space-2));padding-block:var(--ui-space-1)}
 #supportBanner{padding-block:var(--ui-space-2)}
}
@media(max-width:800px){#airSupport,#supportBanner{--support-bottom:180px;--support-width:272px}#supportBanner{bottom:calc(var(--ui-safe-edge) + 156px)}}
`;

export const COMBAT_FIELD_CSS = `
#hud #streak{box-sizing:border-box;border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent);background:var(--ui-surface-paper);color:var(--ui-ink);padding:var(--ui-space-1) var(--ui-space-3);word-break:keep-all;text-wrap:pretty}
#hud #overlay[data-kind="death"]{--casualty-width:560px;padding-inline:var(--ui-safe-edge);background:none;text-shadow:none;letter-spacing:0}
#hud #overlay[data-kind="death"]>h1,#hud #overlay[data-kind="death"]>p{box-sizing:border-box;flex-shrink:0;inline-size:min(var(--casualty-width),100%);margin:0;text-align:start;letter-spacing:0;word-break:keep-all;overflow-wrap:anywhere;text-wrap:pretty;border-inline-start:var(--ui-border-emphasis) solid var(--ui-error)}
#hud #overlay[data-kind="death"]>h1{padding:var(--ui-space-3) var(--ui-space-6);background:var(--ui-surface-paper);color:var(--ui-ink)!important;font:700 var(--ui-type-panel)/1.25 var(--ui-font-body)}
#hud #overlay[data-kind="death"]>p{padding:var(--ui-space-3) var(--ui-space-6);background:var(--ui-hud-backing);color:var(--ui-text-primary);font:500 var(--ui-type-body)/1.5 var(--ui-font-body);opacity:1}
#hud #overlay[data-kind="death"]>p:last-child{border-block-start:var(--ui-border-width) solid var(--ui-border-subtle);font-variant-numeric:tabular-nums;color:var(--ui-accent)}
@media(max-width:420px){#hud #overlay[data-kind="death"]>h1,#hud #overlay[data-kind="death"]>p{padding-inline:var(--ui-space-4)}}
`;
