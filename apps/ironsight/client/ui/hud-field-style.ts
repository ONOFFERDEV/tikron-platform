import { COMBAT_FIELD_CSS } from './combat-field-style.js';

/** Field instruments use the same DOM/state and loading clones as the live HUD. */
export const HUD_FIELD_CSS = `
#hud{
  --hud-log-width:clamp(280px,28vw,400px);--hud-center-width:min(40vw,520px);
  box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) var(--hud-log-width);
  grid-template-rows:max-content max-content minmax(0,1fr);gap:var(--ui-space-2);
  padding:var(--ui-safe-edge);font:500 var(--ui-type-hud)/1.5 var(--ui-font-body);color:var(--ui-text-primary)
}
#hud .panel{box-sizing:border-box;background:var(--ui-hud-backing);border:var(--ui-border-width) solid var(--ui-border-subtle);border-radius:var(--ui-radius-control);box-shadow:none}
#hud #hp{left:var(--ui-safe-edge);bottom:var(--ui-safe-edge);width:208px;padding:var(--ui-space-3) var(--ui-space-4);border-left:var(--ui-border-emphasis) solid var(--ui-border-strong)}
#hud #hp .healthValue{font:700 var(--ui-type-health)/1 var(--ui-font-body);font-variant-numeric:tabular-nums;letter-spacing:0;margin-right:var(--ui-space-2)}
#hud #hp .healthLabel{font-size:var(--ui-type-hud);letter-spacing:0;color:var(--ui-text-secondary)}
#hud #hpbar{height:var(--ui-space-1);margin-top:var(--ui-space-3);border-radius:0;background:var(--ui-border-subtle)}
#hud #hpfill{background:var(--ui-success)}
#hud #ammo{right:var(--ui-safe-edge);bottom:var(--ui-safe-edge);width:176px;padding:var(--ui-space-3) var(--ui-space-4);border-right:var(--ui-border-emphasis) solid var(--ui-border-strong)}
#hud #ammo .mag{font:700 var(--ui-type-ammo)/1 var(--ui-font-body);font-variant-numeric:tabular-nums}
#hud #ammo .res{font-size:var(--ui-type-reserve);color:var(--ui-text-secondary);opacity:1;font-variant-numeric:tabular-nums}
#hud #weaponName{font:700 var(--ui-type-hud)/1.5 var(--ui-font-body);letter-spacing:0;color:var(--ui-text-secondary);margin-bottom:var(--ui-space-2)}
#hud #reload{height:var(--ui-space-1);border-radius:0;margin-top:var(--ui-space-2);background:var(--ui-border-subtle)}
#hud #reloadfill{background:var(--ui-accent)}
#hud #wbar{bottom:var(--ui-safe-edge);max-width:calc(100vw - var(--ui-safe-edge)*2);box-sizing:border-box;gap:var(--ui-space-1);padding:var(--ui-space-1)!important;background:var(--ui-hud-backing)!important;flex-wrap:wrap;justify-content:center}
#hud #wbar .slot,#hud #wbar .nades{font:500 var(--ui-type-hud)/1.5 var(--ui-font-body);letter-spacing:0;padding:var(--ui-space-1) var(--ui-space-2);border-radius:var(--ui-radius-control);color:var(--ui-text-secondary);opacity:1}
#hud #wbar .slot .num{opacity:1;color:var(--ui-text-muted);margin-right:var(--ui-space-1);font-variant-numeric:tabular-nums}
#hud #wbar .slot.active{background:var(--ui-surface-paper);color:var(--ui-ink);box-shadow:none}
#hud #wbar .slot.active .num{color:inherit}
#hud #scores{top:var(--ui-safe-edge);gap:var(--ui-space-6);padding:var(--ui-space-2) var(--ui-space-6);font-size:var(--ui-type-score)}
#hud #mode{top:calc(var(--ui-safe-edge) + 56px);font-size:var(--ui-type-hud);letter-spacing:0;opacity:1;color:var(--ui-text-primary);background:var(--ui-hud-backing);padding:var(--ui-space-1) var(--ui-space-3);text-shadow:none}
#hud #matchBrief{top:calc(var(--ui-safe-edge) + 92px);width:var(--hud-center-width);padding:var(--ui-space-2) var(--ui-space-3);box-sizing:border-box;background:var(--ui-hud-backing);font-size:var(--ui-type-hud);letter-spacing:0;text-shadow:none;word-break:keep-all;overflow-wrap:anywhere}
#hud #matchBrief strong{font:700 var(--ui-type-score)/1.2 var(--ui-font-body);font-variant-numeric:tabular-nums;margin-bottom:var(--ui-space-1)}
#hud #matchBrief .urgent{color:var(--ui-warning)}
#hud #combatObjectives{top:calc(var(--ui-safe-edge) + 172px);gap:var(--ui-space-2)}
#hud #combatObjectives li{min-width:96px;padding:var(--ui-space-1) var(--ui-space-2);font-size:var(--ui-type-hud)}
#hud #caps{top:calc(var(--ui-safe-edge) + 236px);gap:var(--ui-space-2);padding:var(--ui-space-2);background:var(--ui-hud-backing)}
#hud #caps .cap{width:96px}
#hud #caps .cap .lbl{font:500 var(--ui-type-hud)/1.5 var(--ui-font-body);opacity:1;margin-bottom:var(--ui-space-1)}
#hud #caps .cap .bar{height:var(--ui-space-1);background:var(--ui-border-subtle);border-radius:0}
#hud #streak{top:calc(var(--ui-safe-edge) + 292px);max-width:var(--hud-center-width);padding:var(--ui-space-1) var(--ui-space-3);font:700 var(--ui-type-reserve)/1.5 var(--ui-font-body);letter-spacing:0;white-space:normal;overflow-wrap:anywhere;color:var(--ui-accent);background:var(--ui-hud-backing);text-shadow:none}
#hud #authoritativeCombatHud{display:contents}
#hud #feed,#hud #combatEventLog{position:static;grid-column:2;width:100%;max-width:100%;margin:0;min-width:0}
#hud #feed{grid-row:1;gap:var(--ui-space-1);font-size:var(--ui-type-hud);max-height:none;overflow:visible}
#hud #combatEventLog{grid-row:2;align-self:start;gap:var(--ui-space-1)}
#hud #combatEventLog li{padding:var(--ui-space-1) var(--ui-space-2)}
#hud #feed .k{width:100%;max-width:100%;gap:var(--ui-space-2);padding:var(--ui-space-1) var(--ui-space-3);border-left-width:var(--ui-border-emphasis);background:var(--ui-hud-backing)}
#hud #feed .k.local{border-left-color:var(--ui-accent);background:var(--ui-surface-2)}
#hud #feed .k.victim{border-left-color:var(--ui-error)}
#hud #feed .name{font-size:var(--ui-type-hud);font-weight:500}
#hud #feed .cause,#hud #feed .cause strong{font-size:var(--ui-type-hud);letter-spacing:0;color:var(--ui-text-secondary);line-height:1.4}
#hud #feed .cause strong{color:var(--ui-text-primary);font-weight:700}
#hud #feed .assist{font-size:var(--ui-type-hud);color:var(--ui-text-secondary);border-top-color:var(--ui-border-subtle);padding-top:var(--ui-space-1)}
#hud #feed .tag{font-size:var(--ui-type-hud);color:var(--ui-accent);margin-right:var(--ui-space-1)}
#hud #elimination{width:304px;max-width:calc(100vw - var(--ui-safe-edge)*2);box-sizing:border-box;padding:var(--ui-space-2) var(--ui-space-4);border-top:var(--ui-border-emphasis) solid var(--ui-accent);background:var(--ui-hud-backing);text-shadow:none}
#hud #elimination .confirm,#hud #elimination .confirm.ambush{font:700 var(--ui-type-hud)/1.5 var(--ui-font-body);letter-spacing:0;color:var(--ui-accent)}
#hud #elimination .target{font-size:var(--ui-type-reserve);margin:var(--ui-space-1) 0}
#hud #elimination .detail{font-size:var(--ui-type-hud);letter-spacing:0;color:var(--ui-text-secondary)}
#hud #ping{top:calc(var(--ui-safe-edge) + 180px);left:var(--ui-safe-edge);padding:var(--ui-space-2) var(--ui-space-3);font-size:var(--ui-type-hud);line-height:1.5;letter-spacing:0;border-left:var(--ui-border-emphasis) solid var(--ui-success);background:var(--ui-hud-backing)}
#hud #ping strong,#hud #ping span{font-size:var(--ui-type-hud);letter-spacing:0;color:var(--ui-text-secondary)}
#hud #ping strong{color:var(--ui-text-primary)}
#hud #ping[data-quality="delayed"],#hud #ping[data-quality="high"],#hud #ping[data-quality="offline"]{border-left-color:var(--ui-warning)}
#hud #ping[data-quality="delayed"] strong,#hud #ping[data-quality="high"] strong,#hud #ping[data-quality="offline"] strong{color:var(--ui-warning)}
#hud #combatTelemetry{top:calc(var(--ui-safe-edge) + 252px);left:var(--ui-safe-edge);max-width:248px;box-sizing:border-box;overflow-wrap:anywhere}
#hud #audioMuted{inset-block-start:var(--ui-safe-edge)!important;inset-inline-start:calc(var(--ui-safe-edge) + 196px)!important;max-width:152px}
#hud #combatReload{bottom:var(--ui-safe-edge);right:calc(var(--ui-safe-edge) + 184px)}
#hud #lb{top:calc(var(--ui-safe-edge) + 316px);left:var(--ui-safe-edge);width:248px;min-width:0;padding:var(--ui-space-2);box-sizing:border-box;background:var(--ui-hud-backing);border-top:var(--ui-border-emphasis) solid var(--ui-border-strong);font-size:var(--ui-type-hud)}
#hud #lb table{table-layout:fixed}
#hud #lb th,#hud #lb td{padding:var(--ui-space-1);line-height:1.4;font-variant-numeric:tabular-nums}
#hud #lb th:first-child{width:24px}#hud #lb th:nth-child(n+3){width:32px}
#hud #lb td:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#hud #lb tr.me{color:var(--ui-accent)}
/* Full-screen results and connection overlays sit above the body-level map, support and signal panels. */
#hud:has(#overlay[data-kind="end"]),#hud:has(#overlay[data-kind="connection"]){z-index:var(--ui-z-hud)}
#hud #squadRadio{left:var(--ui-safe-edge);bottom:calc(var(--ui-safe-edge) + 252px);max-width:248px;box-sizing:border-box;padding:var(--ui-space-2) var(--ui-space-3);border-left:var(--ui-border-emphasis) solid var(--ui-border-strong);font:500 var(--ui-type-hud)/1.5 var(--ui-font-body);background:var(--ui-hud-backing);color:var(--ui-text-secondary)}
@media(max-width:900px){
 #hud #wbar{bottom:calc(var(--ui-safe-edge) + 112px);width:max-content}
 #hud #hp{width:176px}#hud #ammo{width:160px}
}
@media(max-height:650px) and (min-width:801px){
 #hud #scores{padding:var(--ui-space-1) var(--ui-space-4);line-height:1.2}
 #hud #mode{top:56px}
 #hud #matchBrief{top:88px}
 #hud #combatObjectives{top:164px}
 #hud #caps{top:228px}
 #hud #streak{top:300px}
}
@media(max-width:800px){
 #hud{--hud-log-width:44vw;--hud-center-width:46vw}
 #hud #scores,#hud #mode{left:28%;right:auto;transform:translateX(-50%)}
 #hud #matchBrief{left:28%;top:calc(var(--ui-safe-edge) + 92px)}
 #hud #combatObjectives{left:28%;transform:translateX(-50%);top:calc(var(--ui-safe-edge) + 180px)}
 #hud #combatObjectives li{min-width:0;width:80px;padding:var(--ui-space-1)}
 #hud #caps{left:28%;top:calc(var(--ui-safe-edge) + 252px)}#hud #caps .cap{width:72px}
 #hud #streak{left:28%;top:calc(var(--ui-safe-edge) + 308px)}
 #hud #ping{top:calc(var(--ui-safe-edge) + 356px)}
 #hud #combatTelemetry{top:calc(var(--ui-safe-edge) + 420px);max-width:46vw}
 #hud #lb{top:calc(var(--ui-safe-edge) + 480px);width:46vw}
}
${COMBAT_FIELD_CSS}
/* Short narrow viewports (640x360 CSS = 1280x720 at 200% zoom): three columns plus a full-width weapon row, so no panel stacks on another.
   Every panel stays visible; the practice coach necessarily covers the screen centre at this size. */
@media(max-width:800px) and (max-height:500px){
 #hud #ping{top:143px!important;left:var(--ui-safe-edge)!important;padding:0 var(--ui-space-2)}
 #hud #combatTelemetry{inset-block-start:195px!important;inset-inline-start:var(--ui-safe-edge)!important;max-width:176px;padding:var(--ui-space-1) var(--ui-space-2)}
 #hud #hp{bottom:calc(var(--ui-safe-edge) + 41px);width:176px;padding:var(--ui-space-1) var(--ui-space-3)}
 #hud #hp #hpbar{margin-top:var(--ui-space-1)}
 #hud #ammo{bottom:calc(var(--ui-safe-edge) + 41px);width:196px;padding:var(--ui-space-2) var(--ui-space-3)}
 #hud #weaponName{margin-bottom:var(--ui-space-1)}
 #hud #wbar{bottom:var(--ui-safe-edge);width:max-content;flex-wrap:nowrap}
 #hud #mode{top:var(--ui-safe-edge);left:calc(var(--ui-safe-edge) + 143px);right:auto;transform:none}
 #hud #matchBrief{top:calc(var(--ui-safe-edge) + 33px);left:calc(var(--ui-safe-edge) + 143px);transform:none;width:calc(100vw - var(--ui-safe-edge)*2 - 351px)}
 /* Team modes: scores and mode share the top row so the brief ends above the crosshair. */
 #hud:has(#scores[style*="flex"]) #scores{top:var(--ui-safe-edge);left:calc(var(--ui-safe-edge) + 143px);right:auto;transform:none;gap:var(--ui-space-3);padding:var(--ui-space-1) var(--ui-space-3)}
 #hud:has(#scores[style*="flex"]) #mode{left:auto;right:calc(var(--ui-safe-edge) + 204px)}
 #hud:has(#scores[style*="flex"]) #matchBrief{top:calc(var(--ui-safe-edge) + 48px)}
 #hud #combatReload{bottom:calc(var(--ui-safe-edge) + 41px);right:calc(var(--ui-safe-edge) + 204px)}
 #hud #combatObjectives{top:auto;bottom:calc(var(--ui-safe-edge) + 103px);left:calc(var(--ui-safe-edge) + 184px);transform:none;width:calc(100vw - var(--ui-safe-edge)*2 - 392px)}
 #hud #combatObjectives li{min-width:0;flex:1;padding:0 var(--ui-space-1)}
 #hud #caps{top:auto;bottom:calc(var(--ui-safe-edge) + 41px);left:calc(var(--ui-safe-edge) + 184px);transform:none;padding:var(--ui-space-1)}
 #hud #caps .cap{width:64px}
 body #teamPingNotice{bottom:calc(var(--ui-safe-edge) + 85px)!important;inset-inline-start:calc(var(--ui-safe-edge) + 184px)!important;inline-size:calc(100vw - var(--ui-safe-edge)*2 - 392px)!important;box-sizing:border-box}
 #airSupport{inset:var(--ui-safe-edge) var(--ui-safe-edge) auto auto!important;inline-size:196px!important}
 #teamPingHint{inset-block:auto calc(var(--ui-safe-edge) + 130px)!important;inset-inline:auto var(--ui-safe-edge)!important;max-inline-size:196px!important;inline-size:196px!important}
 .training-coach{inset-block-start:auto!important;inset-block-end:calc(var(--ui-safe-edge) + 41px)!important;inset-inline-start:calc(var(--ui-safe-edge) + 184px)!important;inline-size:calc(100vw - var(--ui-safe-edge)*2 - 392px)!important;padding:var(--ui-space-2) var(--ui-space-3)}
}
`;
