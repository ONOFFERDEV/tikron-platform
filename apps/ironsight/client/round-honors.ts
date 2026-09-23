import { combatantLabel } from './ui/copy.js';
import type { RoundMvp } from "../src/round-honors.js";

export interface PresentedMvp extends RoundMvp { name: string; isMe: boolean }

export function createRoundHonors(mvp: PresentedMvp, dom: boolean, target: Document = document): HTMLElement {
  const section = target.createElement("section");
  section.className = "round-honors";
  section.dataset.mvp = mvp.id;
  section.setAttribute("aria-label", "라운드 최우수 전투원");

  const title = target.createElement("p");
  title.className = "round-honors__title";
  title.textContent = "라운드 최우수 전투원";
  const name = target.createElement("h3");
  name.textContent = mvp.isMe ? `나 · ${combatantLabel(mvp.name)}` : combatantLabel(mvp.name);
  const stats = target.createElement("dl");
  stats.className = "round-honors__stats";
  for (const [label, value] of [
    ["처치", mvp.kills],
    ["지원", mvp.assists],
    ...(dom ? [["점령 기여", `${mvp.captureSeconds}초`]] : []),
    ["기여 점수", mvp.score],
  ] as const) {
    const group = target.createElement("div");
    const term = target.createElement("dt");
    const detail = target.createElement("dd");
    term.textContent = label;
    detail.textContent = String(value);
    group.append(term, detail);
    stats.append(group);
  }
  section.append(title, name, stats);
  return section;
}

export const honorsCss = `
#overlay .result-view .round-honors{margin-block-end:var(--ui-space-6);padding:var(--ui-space-4);border:var(--ui-border-width) solid var(--ui-border-subtle);border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent);background:var(--ui-surface-2);color:var(--ui-text-primary)}
#overlay .result-view .round-honors__title{margin:0;color:var(--ui-accent);font-size:var(--ui-type-hud);font-weight:700;line-height:1.5;letter-spacing:0;opacity:1}#overlay .result-view .round-honors h3{margin:var(--ui-space-1) 0 var(--ui-space-3);font:700 var(--ui-type-panel)/1.5 var(--ui-font-body);overflow-wrap:anywhere;word-break:keep-all}.round-honors__stats{display:flex;flex-wrap:wrap;gap:var(--ui-space-3) var(--ui-space-6);margin:0}.round-honors__stats div{display:flex;gap:var(--ui-space-2);align-items:baseline}.round-honors__stats dt{color:var(--ui-text-secondary);font-size:var(--ui-type-hud)}.round-honors__stats dd{margin:0;font-weight:700;font-variant-numeric:tabular-nums}
`;
