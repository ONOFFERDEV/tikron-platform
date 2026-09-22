export const DEPLOYMENT_CSS = `
@font-face{font-family:"Stardos Stencil";src:url("/assets/ui/fonts/StardosStencil-Bold.ttf") format("truetype");font-style:normal;font-weight:700;font-display:swap}
#modeMenu{
  --ui-font-wordmark:"Stardos Stencil","Barlow Condensed","Noto Sans KR","Malgun Gothic",sans-serif;
  position:fixed;inset:0;z-index:200;overflow:hidden;pointer-events:auto;
  background:var(--ui-surface-0);color:var(--ui-text-primary);
  font:500 var(--ui-type-body)/1.5 var(--ui-font-body);letter-spacing:0;
}
#modeMenu *{box-sizing:border-box}
#modeMenu .vista{position:absolute;inset:0;background:url('/assets/relay-vista.webp') center/cover no-repeat}
#modeMenu .shade{position:absolute;inset:0;background:linear-gradient(90deg,var(--ui-surface-0),color-mix(in srgb,var(--ui-surface-0) 90%,transparent) 34%,color-mix(in srgb,var(--ui-surface-0) 30%,transparent) 76%),linear-gradient(0deg,var(--ui-surface-0),transparent)}
#modeMenu .shell{position:relative;block-size:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr) auto}
#modeMenu .topline,#modeMenu footer{
  display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-4);
  padding:var(--ui-space-3) var(--ui-safe-edge);background:var(--ui-surface-0);
  color:var(--ui-text-secondary);font-size:var(--ui-type-meta);
}
#modeMenu .topline{border-block-end:var(--ui-border-width) solid var(--ui-border-subtle)}
#modeMenu .brand{display:flex;gap:var(--ui-space-3);align-items:center;color:var(--ui-text-primary);font:700 var(--ui-type-panel)/1 var(--ui-font-display);letter-spacing:.12em}
#modeMenu .mark{display:block;position:relative;inline-size:var(--ui-space-6);block-size:var(--ui-space-6);border:var(--ui-border-width) solid var(--ui-text-secondary)}
#modeMenu .mark:after{content:"";position:absolute;inset:var(--ui-space-1);border-inline:var(--ui-border-emphasis) solid var(--ui-text-secondary)}
#modeMenu .build-tag{font-size:var(--ui-type-meta);word-break:keep-all}
#modeMenu .menuBody{
  position:relative;min-block-size:0;overflow:auto;overscroll-behavior:contain;
  display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,.7fr);align-content:start;
  gap:var(--ui-space-4) var(--ui-space-12);padding:var(--ui-space-8) var(--ui-safe-edge);
  inline-size:100%;max-inline-size:var(--ui-layout-max);margin-inline:auto;
  scrollbar-color:var(--ui-border-strong) var(--ui-surface-0);
}
#modeMenu .hero{min-inline-size:0;padding-block:var(--ui-space-6);align-self:center}
#modeMenu .eyebrow{display:flex;align-items:center;gap:var(--ui-space-3);font-size:var(--ui-type-hud);color:var(--ui-text-secondary)}
#modeMenu .eyebrow:before{content:"";inline-size:var(--ui-space-6);block-size:var(--ui-border-width);background:var(--ui-text-secondary)}
#modeMenu h1{font:700 var(--ui-type-display)/1.1 var(--ui-font-wordmark);letter-spacing:-.025em;margin:var(--ui-space-6) 0 var(--ui-space-2)}
#modeMenu .subtitle{font-size:var(--ui-type-body);color:var(--ui-text-secondary);margin-block-end:var(--ui-space-8);letter-spacing:0}
#modeMenu .brief{font-size:var(--ui-type-body);line-height:1.5;margin:0 0 var(--ui-space-2);font-weight:700;word-break:keep-all;overflow-wrap:anywhere;text-wrap:pretty}
#modeMenu .detail{font-size:var(--ui-type-hud);line-height:1.5;color:var(--ui-text-secondary);margin:0 0 var(--ui-space-6);word-break:keep-all;overflow-wrap:anywhere;text-wrap:pretty}
#modeMenu .field-phrase{display:inline-block;max-inline-size:100%;vertical-align:top}
#modeMenu .deploy{inline-size:min(100%,22rem);display:flex;align-items:center;justify-content:space-between;padding:var(--ui-space-4) var(--ui-space-6);font-size:var(--ui-type-body);letter-spacing:0}
#modeMenu .deploy span:last-child{font-size:var(--ui-type-panel);line-height:1}
#modeMenu .intel{
  position:relative;align-self:center;min-inline-size:0;margin-block:var(--ui-space-6);padding:var(--ui-space-6);
  border:var(--ui-border-width) solid var(--ui-border-subtle);border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent);
  background:var(--ui-hud-backing);text-align:start;
}
#modeMenu .intel small{font-size:var(--ui-type-meta);color:var(--ui-text-secondary)}
#modeMenu .intel strong{display:block;margin-block:var(--ui-space-2);font:700 var(--ui-type-panel)/1.5 var(--ui-font-body);word-break:keep-all;overflow-wrap:anywhere;text-wrap:pretty}
#modeMenu .intel p{font-size:var(--ui-type-hud);line-height:1.5;margin:0;color:var(--ui-text-secondary);word-break:keep-all;overflow-wrap:anywhere;text-wrap:pretty}
#modeMenu .intel .routes{margin-block-start:var(--ui-space-3);color:var(--ui-text-primary)}
#modeMenu .blueprint{margin-block-start:var(--ui-space-6);padding:var(--ui-space-3);background:var(--ui-surface-paper)}
#modeMenu .blueprint svg{display:block;inline-size:100%;max-block-size:12rem}
#modeMenu svg .site-plan-ground{fill:var(--ui-surface-paper);stroke:var(--ui-border-subtle)}
#modeMenu svg .site-plan-high{fill:var(--ui-ink)}
#modeMenu svg .site-plan-low{fill:var(--ui-border-subtle)}
#modeMenu svg .site-plan-ramp{fill:var(--ui-surface-paper);stroke:var(--ui-ink);stroke-width:.6}
#modeMenu .playlistLabel{font-size:var(--ui-type-hud);color:var(--ui-text-secondary);line-height:1.5}
#modeMenu .menuBody>.playlistLabel{grid-column:1/-1;border-block-start:var(--ui-border-width) solid var(--ui-border-subtle);padding-block-start:var(--ui-space-6)}
#modeMenu .playlists{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--ui-space-3)}
#modeMenu .playlist{display:flex;flex-direction:column;align-items:flex-start;gap:var(--ui-space-1);min-inline-size:0;text-align:start;padding:var(--ui-space-4) var(--ui-space-6);word-break:keep-all;overflow-wrap:anywhere;text-wrap:pretty}
#modeMenu .playlist .number{order:0;font:500 var(--ui-type-meta)/1.5 var(--ui-font-body);color:var(--ui-text-secondary);margin-block-end:var(--ui-space-2);font-variant-numeric:tabular-nums}
#modeMenu .playlist .ko{order:1;font:700 var(--ui-type-body)/1.5 var(--ui-font-body);color:var(--ui-text-primary)}
#modeMenu .playlist strong{order:2;font:600 var(--ui-type-hud)/1.4 var(--ui-font-display);letter-spacing:.06em;color:var(--ui-text-secondary)}
#modeMenu .playlist[aria-pressed="true"],#modeMenu .siteCard[aria-pressed="true"]{background:var(--ui-surface-2)}
#modeMenu .playlist:active .number,#modeMenu .playlist:active .ko,#modeMenu .playlist:active strong{color:var(--ui-ink)}
#modeMenu .sites{margin-block-start:var(--ui-space-6)}
#modeMenu .sites[hidden]{display:none}
#modeMenu .siteCards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ui-space-2);margin-block-start:var(--ui-space-2)}
#modeMenu .siteCard{min-inline-size:0;padding:var(--ui-space-3);text-align:start;word-break:keep-all;overflow-wrap:anywhere;text-wrap:pretty}
#modeMenu .siteCard svg{display:block;block-size:var(--ui-space-16);inline-size:100%;margin-block-end:var(--ui-space-2);background:var(--ui-surface-paper)}
#modeMenu .siteCard span{display:block;font-size:var(--ui-type-hud);line-height:1.5;font-weight:700}
#modeMenu .siteCard small{display:block;font-size:var(--ui-type-meta);line-height:1.5;font-weight:500;color:var(--ui-text-secondary);margin-block-start:var(--ui-space-1)}
#modeMenu .siteCard:active small{color:var(--ui-ink)}
#modeMenu footer{border-block-start:var(--ui-border-width) solid var(--ui-border-subtle)}
#modeMenu footer a{display:flex;align-items:center;min-block-size:var(--ui-control-min);color:var(--ui-text-secondary);text-decoration:none;font-family:var(--ui-font-display);letter-spacing:.08em}
#modeMenu footer>span{font-size:var(--ui-type-hud);word-break:keep-all}
#modeMenu footer a:focus-visible{outline:var(--ui-focus-width) solid var(--ui-focus);outline-offset:3px}
#modeMenu .settingsBtn{font-size:var(--ui-type-hud)}
@media(min-width:1600px){#modeMenu .menuBody{padding-block:var(--ui-space-16)}#modeMenu .hero{padding-block:var(--ui-space-8)}}
@media(max-width:1100px){#modeMenu .menuBody{column-gap:var(--ui-space-6)}#modeMenu .playlist{padding:var(--ui-space-4)}}
@media(max-width:1023px){
  #modeMenu .shade{background:var(--ui-scrim)}
  #modeMenu .menuBody{grid-template-columns:minmax(0,1fr);padding-block:var(--ui-space-4)}
  #modeMenu .hero{padding-block:var(--ui-space-3)}
  #modeMenu .intel{margin:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:var(--ui-space-4)}
  #modeMenu .intel small,#modeMenu .intel strong,#modeMenu .intel p{grid-column:1}
  #modeMenu .blueprint{grid-column:2;grid-row:1/5;margin:0;align-self:center}
  #modeMenu .playlists{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:520px){
  #modeMenu .topline{flex-wrap:wrap;gap:var(--ui-space-2)}
  #modeMenu .brand{font-size:var(--ui-type-body)}
  #modeMenu .intel{display:block;padding:var(--ui-space-4)}
  #modeMenu .blueprint{margin-block-start:var(--ui-space-4)}
  #modeMenu .siteCards,#modeMenu .playlists{grid-template-columns:minmax(0,1fr)}
  #modeMenu footer{flex-wrap:wrap;column-gap:var(--ui-space-2)}
  #modeMenu footer>span{flex-basis:100%;order:3}
}
[data-font-fallback="true"] #modeMenu,#modeMenu[data-font-fallback="true"]{--ui-font-wordmark:"Malgun Gothic",system-ui,sans-serif}
`;
