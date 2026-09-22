/** Deployment UI. URL selections remain compatible with the existing matchmaker. */
import { MODE_ORDER, type ModeId } from "../src/modes.js";
import { MODES as MODE_RULES } from "../src/config.js";
import { SITES, siteBlueprint, type SiteId } from "./map-presentation.js";
import { openSettings } from "./settings-ui.js";
import type { SettingsStore } from "./settings.js";
import { FIELD_UI_COPY, formatCopy, modeCopy } from "./ui/copy.js";
import { readDeploymentSelection } from "./ui/flow-state.js";

const MODES: Record<ModeId, { label: string; ko: string; map: string; description: string; detail: string }> = {
  tdm: { label: "TEAM DEATHMATCH", ko: modeCopy("tdm").label, map: "RELAY", description: modeCopy("tdm").description, detail: formatCopy(modeCopy("tdm").detailFmt, { target: MODE_RULES.tdm.killTarget }) },
  dom: { label: "DOMINATION", ko: modeCopy("dom").label, map: "UNDERTOW", description: modeCopy("dom").description, detail: formatCopy(modeCopy("dom").detailFmt, { target: MODE_RULES.dom.scoreTarget }) },
  ffa: { label: "FREE FOR ALL", ko: modeCopy("ffa").label, map: "SWITCHYARD", description: modeCopy("ffa").description, detail: formatCopy(modeCopy("ffa").detailFmt, { target: MODE_RULES.ffa.killTarget }) },
  practice: { label: "FIELD TRAINING", ko: modeCopy("practice").label, map: "ALL SITES", description: modeCopy("practice").description, detail: modeCopy("practice").detailFmt },
};

const css = `
#modeMenu{position:fixed;inset:0;z-index:200;background:var(--ui-surface-0);color:var(--ui-text-primary);font:500 var(--ui-type-body)/1.5 var(--ui-font-body);overflow:hidden;pointer-events:auto}
#modeMenu *{box-sizing:border-box}
#modeMenu .vista{position:absolute;inset:0;background:url('/assets/relay-vista.webp') center/cover no-repeat;opacity:.8}
#modeMenu .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,18,24,.98),rgba(8,18,24,.75) 34%,rgba(8,18,24,.05) 76%),linear-gradient(0deg,#0b171eee,transparent 48%)}
#modeMenu .shell{position:relative;block-size:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr) auto}
#modeMenu .topline{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-4);padding:var(--ui-space-6) 4.5vw;font:600 var(--ui-type-meta)/1.4 var(--ui-font-display);letter-spacing:.16em;color:var(--ui-text-secondary);border-block-end:1px solid var(--ui-border-subtle)}
#modeMenu .menuBody{position:relative;min-block-size:0;overflow:auto;padding:0 4.5vw var(--ui-space-6);overscroll-behavior:contain}
#modeMenu .brand{display:flex;gap:12px;align-items:center;color:#fff;font-weight:700;letter-spacing:4px}
#modeMenu .mark{width:21px;height:25px;border:3px solid #e9b567;transform:skew(-15deg);position:relative}
#modeMenu .mark:after{content:"";position:absolute;inset:5px;border-left:2px solid #e9b567}
#modeMenu .build-tag{color:#dcad65}
#modeMenu .hero{padding-block:clamp(34px,7vh,90px) 44px;min-block-size:min(33rem,70vh)}
#modeMenu .eyebrow{font-size:11px;letter-spacing:4px;color:#eab366;display:flex;align-items:center;gap:12px}
#modeMenu .eyebrow:before{content:"";width:28px;height:2px;background:#eab366}
#modeMenu h1{font-size:clamp(44px,6vw,92px);line-height:.96;letter-spacing:-3px;margin:24px 0 18px;font-weight:800}
#modeMenu .subtitle{font-size:12px;letter-spacing:9px;color:#acbbc1;margin-bottom:32px}
#modeMenu .brief{font-size:20px;line-height:1.5;margin:0 0 7px;max-width:440px}
#modeMenu .detail{font-size:12px;color:#acbbc1;margin:0 0 30px}
#modeMenu button,#modeMenu select{font:inherit;cursor:pointer}
#modeMenu button{border:0;border-radius:0;transition:background 130ms,color 130ms}
#modeMenu button:focus-visible,#modeMenu select:focus-visible,#modeMenu a:focus-visible{outline:2px solid #fff;outline-offset:5px}
#modeMenu .deploy{min-block-size:var(--ui-control-min);background:var(--ui-surface-paper);color:var(--ui-ink);padding:var(--ui-space-4) var(--ui-space-6);width:340px;display:flex;justify-content:space-between;align-items:center;font-weight:700;letter-spacing:.12em;font-size:var(--ui-type-hud)}
#modeMenu .deploy:hover{background:var(--ui-accent-hover)}
#modeMenu .deploy span:last-child{font-size:23px;font-weight:400;line-height:1}
#modeMenu .mapSelect{display:flex;gap:15px;align-items:center;margin:18px 0;color:#b9c8cb;font-size:12px;letter-spacing:1px}
#modeMenu select{background:#152730;color:#e8eee9;border:1px solid #789398;padding:7px 12px}
#modeMenu .mapSelect[hidden]{display:none}
#modeMenu .intel{position:absolute;right:4.5vw;top:43%;text-align:right;border-right:2px solid #e9b567;padding-right:18px;text-shadow:0 2px 15px #000}
#modeMenu .intel small{font-size:10px;letter-spacing:3px;color:#dce6df}
#modeMenu .intel strong{display:block;font-size:38px;letter-spacing:4px;line-height:1.3}
#modeMenu .intel p{font-size:11px;letter-spacing:2px;margin:8px 0;color:#d6ddd5}
#modeMenu .playlistLabel{font-size:10px;letter-spacing:3px;color:#9fb1b9;margin-bottom:12px}
#modeMenu .playlists{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
#modeMenu .playlist{position:relative;text-align:left;min-height:108px;padding:19px 20px;background:#11242ddb;border:1px solid #d1dfdb22;color:#dce4df}
#modeMenu .playlist:hover{background:#233b44}
#modeMenu .playlist[aria-pressed="true"]{background:#294048e8;border-color:#e9b567;border-top:3px solid #e9b567;padding-top:17px}
#modeMenu .playlist .number{font-size:10px;letter-spacing:2px;color:#8fa4ac;display:block;margin-bottom:8px}
#modeMenu .playlist strong{font-size:13px;letter-spacing:1.4px;display:block}
#modeMenu .playlist .ko{font-size:16px;color:#d7e2e3;display:block;margin-top:4px}
#modeMenu footer{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-4);padding:var(--ui-space-4) 4.5vw;border-block-start:1px solid var(--ui-border-subtle);background:var(--ui-surface-1);font-size:var(--ui-type-meta);color:var(--ui-text-muted)}
#modeMenu footer a{color:#c6d7d9;text-decoration:none}
#modeMenu .settingsBtn{min-block-size:var(--ui-control-min);padding:var(--ui-space-2) var(--ui-space-4);color:var(--ui-text-primary);background:transparent;letter-spacing:.08em;font-size:var(--ui-type-hud)}
#modeMenu .settingsBtn:hover{color:#e9b567}
#modeMenu .intel .routes{font-size:10px;letter-spacing:1px;color:#afd0d0}
#modeMenu .blueprint{width:200px;margin:20px 0 0 auto;opacity:.9}
#modeMenu .sites{margin:22px 0 0;max-width:560px}
#modeMenu .sites[hidden]{display:none}
#modeMenu .siteCards{display:flex;gap:8px}
#modeMenu .siteCard{padding:9px;flex:1;background:#142b35e8;border:1px solid #708d9255;color:#dce9e6;text-align:left}
#modeMenu .siteCard[aria-pressed="true"]{border-color:#edb467;background:#29464ee8}
#modeMenu .siteCard svg{height:64px;width:100%;display:block;margin-bottom:7px}
#modeMenu .siteCard span{display:block;font-size:10px;letter-spacing:1px;font-weight:700}
#modeMenu .siteCard small{display:block;font-size:8px;color:#a1b9bb;margin-top:3px;letter-spacing:.5px}
@media(max-width:800px){#modeMenu .intel{position:static;display:block;text-align:start;border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent);border-inline-end:0;padding-inline-start:var(--ui-space-4);margin-block-end:var(--ui-space-6)}#modeMenu .intel strong{font-size:var(--ui-type-panel)}#modeMenu .blueprint{margin-inline:0}#modeMenu .topline{letter-spacing:.08em}#modeMenu h1{letter-spacing:-3px}#modeMenu .playlists{grid-template-columns:repeat(2,minmax(0,1fr))}#modeMenu .hero{padding-block:34px 28px;min-block-size:0}#modeMenu .deploy{width:min(340px,100%)}#modeMenu .playlist{min-height:90px;padding:14px}#modeMenu .subtitle{letter-spacing:6px}#modeMenu footer{flex-wrap:wrap}}
@media(max-width:520px){#modeMenu .build-tag{display:none}#modeMenu .playlists,#modeMenu .siteCards{display:grid;grid-template-columns:1fr}#modeMenu .subtitle{letter-spacing:.18em}#modeMenu footer a{display:none}}
@media(prefers-reduced-motion:reduce){#modeMenu button{transition:none}}
`;

export async function resolveMode(settings: SettingsStore): Promise<ModeId> {
  const direct = readDeploymentSelection(location.search);
  if (direct.mode) return direct.mode;
  return new Promise(resolve => {
    let selected: ModeId = "tdm";
    let trainingSite: SiteId = "arena1";
    let deploying = false;
    const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
    const root = document.createElement("main"); root.id = "modeMenu"; root.dataset.flow = "menu";
    root.innerHTML = `
      <div class="vista" aria-hidden="true"></div><div class="shade" aria-hidden="true"></div>
      <div class="shell">
        <header class="topline"><div class="brand"><i class="mark" aria-hidden="true"></i> IRONSIGHT</div><span class="build-tag">${FIELD_UI_COPY.deploy.build}</span></header>
        <div class="menuBody">
        <section class="hero" aria-label="출격할 전장 선택">
          <div class="eyebrow">${FIELD_UI_COPY.deploy.eyebrow}</div>
          <h1>IRONSIGHT</h1><div class="subtitle">${FIELD_UI_COPY.deploy.subtitle}</div>
          <p class="brief"></p><p class="detail"></p>
          <button class="deploy" type="button"><span>${FIELD_UI_COPY.deploy.action}</span><span aria-hidden="true">↗</span></button>
          <div class="sites" hidden><div class="playlistLabel">${FIELD_UI_COPY.deploy.trainingSite}</div><div class="siteCards" role="group" aria-label="훈련 전장"></div></div>
        </section>
        <aside class="intel"><small></small><strong></strong><p class="siteSubtitle"></p><p class="routes"></p><div class="blueprint"></div></aside>
        <div class="playlistLabel">${FIELD_UI_COPY.deploy.selectOperation}</div><nav class="playlists" aria-label="게임 모드"></nav>
        </div>
        <footer><a href="https://tikron.dev" target="_blank" rel="noopener">TIKRON ↗</a><span>${FIELD_UI_COPY.deploy.controls}</span><button type="button" class="settingsBtn">${FIELD_UI_COPY.deploy.settings}</button></footer>
      </div>`;
    const buttons: HTMLButtonElement[] = [];
    const siteButtons: HTMLButtonElement[] = [];
    const vista = root.querySelector('.vista') as HTMLElement;
    const update = () => {
      const mode = MODES[selected];
      root.querySelector(".brief")!.textContent = mode.description;
      const siteId: SiteId = selected === 'practice' ? trainingSite : selected === 'dom' ? 'arena2' : selected === 'ffa' ? 'arena3' : 'arena1';
      const site = SITES[siteId];
      root.querySelector(".detail")!.textContent = `${site.name} / ${selected === 'practice'
        ? trainingSite === 'arena1' ? FIELD_UI_COPY.deploy.privateTargets
          : trainingSite === 'arena2' ? FIELD_UI_COPY.deploy.objectivePractice
          : FIELD_UI_COPY.deploy.mapExploration
        : mode.detail}`;
      (root.querySelector(".sites") as HTMLElement).hidden = selected !== "practice";
      root.querySelector('.intel small')!.textContent = `${FIELD_UI_COPY.deploy.operationSite} · ${site.number}${site.legacy ? ` · ${FIELD_UI_COPY.deploy.legacy}` : ''}`;
      root.querySelector('.intel strong')!.textContent = site.name;
      root.querySelector('.siteSubtitle')!.textContent = site.subtitle;
      root.querySelector('.routes')!.textContent = site.routes;
      root.querySelector('.blueprint')!.innerHTML = siteBlueprint(site.map);
      vista.style.backgroundImage = site.image ? `url('${site.image}')` : 'linear-gradient(135deg,#162c38,#435963)';
      vista.dataset.site = siteId;
      siteButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.map === trainingSite)));
      buttons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === selected)));
    };
    for (const [id, site] of Object.entries(SITES)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'siteCard'; button.dataset.map = id;
      button.innerHTML = `${siteBlueprint(site.map)}<span>${site.name}<small>${site.legacy ? FIELD_UI_COPY.deploy.legacy : `${site.number} · ${FIELD_UI_COPY.deploy.fieldOperations}`}</small></span>`;
      button.addEventListener('click', () => { trainingSite = id as SiteId; update(); });
      root.querySelector('.siteCards')!.appendChild(button); siteButtons.push(button);
    }
    MODE_ORDER.forEach((id, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "playlist"; button.dataset.mode = id;
      button.innerHTML = `<span class="number">0${index + 1} / ${MODES[id].map}</span><strong>${MODES[id].label}</strong><span class="ko">${MODES[id].ko}</span>`;
      button.addEventListener("click", () => { selected = id; update(); });
      buttons.push(button); root.querySelector(".playlists")!.appendChild(button);
    });
    root.querySelector(".deploy")!.addEventListener("click", () => {
      if (deploying) return;
      deploying = true;
      const deploy = root.querySelector<HTMLButtonElement>(".deploy")!;
      deploy.disabled = true; deploy.setAttribute("aria-busy", "true"); root.dataset.flow = "connecting";
      const url = new URL(location.href); url.searchParams.set("mode", selected);
      const map = trainingSite;
      if (selected === "practice" && map !== "arena1") url.searchParams.set("map", map);
      else url.searchParams.delete("map");
      history.replaceState(null, "", url); root.remove(); style.remove(); resolve(selected);
    });
    root.querySelector(".settingsBtn")!.addEventListener("click", () => {
      root.style.display = "none";
      openSettings(settings, () => { root.style.display = ""; (root.querySelector(".settingsBtn") as HTMLButtonElement).focus(); });
    });
    update(); document.body.appendChild(root);
  });
}
