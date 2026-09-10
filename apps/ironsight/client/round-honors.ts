import type { RoundMvp } from '../src/round-honors.js';

export interface PresentedMvp extends RoundMvp { name: string; isMe: boolean }
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export function honorsMarkup(mvp: PresentedMvp | undefined, dom: boolean): string {
  if (!mvp) return '';
  return `<section class="roundHonors" aria-label="Round MVP" data-mvp="${escape(mvp.id)}">
    <div class="honorsSeal" aria-hidden="true"><svg viewBox="0 0 120 120" fill="none">
      <path d="M60 6 105 32v51L60 110 15 83V32Z" stroke="currentColor" stroke-width="2"/>
      <path d="M60 14 98 36v43L60 102 22 79V36Z" stroke="currentColor" opacity=".35"/>
      <path d="m60 27 8 18 20 2-15 14 4 20-17-10-17 10 4-20-15-14 20-2Z" fill="currentColor"/>
      <path d="m4 48 7 6v22l-7-6m112-22-7 6v22l7-6M42 111l18 9 18-9" stroke="currentColor" stroke-width="3"/>
    </svg></div>
    <div class="honorsBody"><div class="honorsKicker">FIELD HONORS <span>/ ROUND MVP</span></div>
      <h2>${mvp.isMe ? '<span class="honorsYou">YOU</span>' : ''}${escape(mvp.name)}</h2>
      <div class="honorsStats"><span><strong>${mvp.kills}</strong> ELIMINATIONS</span><span><strong>${mvp.assists}</strong> ASSISTS</span>${dom ? `<span><strong>${mvp.captureSeconds}s</strong> CAPTURE CREDIT</span>` : ''}</div>
      <p class="honorsRule">2 per elimination · 1 per assist${dom ? ' · 1 per shared capture second' : ''}. ${dom ? 'Only advancing a flag counts.' : 'Winning side only.'}</p>
    </div><div class="honorsScore"><strong>${mvp.score}</strong><span>IMPACT</span></div>
  </section>`;
}

export const honorsCss = `
#overlay .roundHonors{display:grid;grid-template-columns:92px minmax(0,1fr) auto;gap:22px;align-items:center;position:relative;margin:20px 0 0;padding:20px 24px;border:1px solid #edaa5259;border-left:3px solid #edaa52;background:linear-gradient(115deg,#5a4226 0%,#283b38 38%,#162e35 85%);overflow:hidden}
#overlay .honorsSeal{color:#f4c47e;width:92px;height:92px}
#overlay .honorsSeal svg{width:100%;height:100%}
#overlay .honorsKicker{color:#f4c47e;font-size:10px;letter-spacing:2.5px;font-weight:700}
#overlay .honorsKicker span{color:#b6cbc8;font-weight:400;white-space:nowrap}
#overlay .honorsBody h2{display:flex;gap:10px;align-items:center;margin:5px 0 10px;font-size:27px;letter-spacing:1px;line-height:1.2;overflow-wrap:anywhere;color:#fff0d8}
#overlay .honorsYou{font-size:9px;letter-spacing:1px;padding:4px 6px;border:1px solid #edaa5280;color:#ffcf88;flex-shrink:0}
#overlay .honorsStats{display:flex;flex-wrap:wrap;gap:6px 20px;font-size:9px;color:#c5d6d2;letter-spacing:1px}
#overlay .honorsStats strong{font-size:16px;color:#fff0d8;letter-spacing:0;margin-right:4px}
#overlay .honorsRule{font-size:10px;color:#bac9c4;line-height:1.5;margin:10px 0 0;opacity:1;max-width:490px}
#overlay .honorsScore{text-align:center;padding-left:20px;border-left:1px solid #edaa524d;color:#f4c47e}
#overlay .honorsScore strong{display:block;font-size:42px;line-height:1.1;font-variant-numeric:tabular-nums}
#overlay .honorsScore span{font-size:9px;letter-spacing:2px}
#overlay[data-honors-enter="true"] .roundHonors{animation:honors-arrive 480ms ease-out both}
@keyframes honors-arrive{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
#hud[data-reduced-motion="true"] #overlay .roundHonors{animation:none}
@media(prefers-reduced-motion:reduce){#overlay .roundHonors{animation:none!important}}
@media(max-width:800px){#overlay .roundHonors{grid-template-columns:64px minmax(0,1fr) auto;gap:14px;padding:16px}#overlay .honorsSeal{width:64px;height:64px}#overlay .honorsBody h2{font-size:23px}}
@media(max-width:540px){#overlay .roundHonors{grid-template-columns:46px minmax(0,1fr);gap:12px;padding:14px}#overlay .honorsSeal{width:46px;height:56px;align-self:start}#overlay .honorsBody h2{font-size:20px}#overlay .honorsScore{grid-column:2;text-align:left;padding:0;border:0;display:flex;align-items:baseline;gap:9px}#overlay .honorsScore strong{font-size:28px}#overlay .honorsKicker{font-size:9px;letter-spacing:1.2px}}
`;
