/** Deployment UI. URL selections remain compatible with the existing matchmaker. */
import { MODE_ORDER, type ModeId } from "../src/modes.js";
import { MODES as MODE_RULES } from "../src/config.js";
import { SITES, siteBlueprint, type SiteId } from "./map-presentation.js";
import { openSettings } from "./settings-ui.js";
import type { SettingsStore } from "./settings.js";
import { FIELD_UI_COPY, formatCopy, modeCopy } from "./ui/copy.js";
import { readDeploymentSelection } from "./ui/flow-state.js";
import { setFieldPhrases } from "./ui/field-copy.js";
import { DEPLOYMENT_CSS } from "./ui/deployment-style.js";
import { installFieldPaper } from "./ui/field-paper-style.js";

const MODES: Record<ModeId, { label: string; ko: string; map: string; description: string; detail: string }> = {
  tdm: { label: "TEAM DEATHMATCH", ko: modeCopy("tdm").label, map: SITES.arena1.name, description: modeCopy("tdm").description, detail: formatCopy(modeCopy("tdm").detailFmt, { target: MODE_RULES.tdm.killTarget }) },
  dom: { label: "DOMINATION", ko: modeCopy("dom").label, map: SITES.arena2.name, description: modeCopy("dom").description, detail: formatCopy(modeCopy("dom").detailFmt, { target: MODE_RULES.dom.scoreTarget }) },
  ffa: { label: "FREE FOR ALL", ko: modeCopy("ffa").label, map: SITES.arena3.name, description: modeCopy("ffa").description, detail: formatCopy(modeCopy("ffa").detailFmt, { target: MODE_RULES.ffa.killTarget }) },
  practice: { label: "FIELD TRAINING", ko: modeCopy("practice").label, map: FIELD_UI_COPY.deploy.trainingSite, description: modeCopy("practice").description, detail: modeCopy("practice").detailFmt },
};


export async function resolveMode(settings: SettingsStore): Promise<ModeId> {
  const direct = readDeploymentSelection(location.search);
  if (direct.mode) return direct.mode;
  return new Promise(resolve => {
    let selected: ModeId = "tdm";
    let trainingSite: SiteId = "arena1";
    let deploying = false;
    const style = document.createElement("style"); style.textContent = DEPLOYMENT_CSS; document.head.appendChild(style); installFieldPaper();
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
          <button class="deploy ui-button" data-tone="accent" type="button"><span>${FIELD_UI_COPY.deploy.action}</span><span aria-hidden="true">↗</span></button>
          <div class="sites" hidden><div class="playlistLabel">${FIELD_UI_COPY.deploy.trainingSite}</div><div class="siteCards" role="group" aria-label="훈련 전장"></div></div>
        </section>
        <aside class="intel"><small></small><strong></strong><p class="siteSubtitle"></p><p class="routes"></p><div class="blueprint"></div></aside>
        <div class="playlistLabel">${FIELD_UI_COPY.deploy.selectOperation}</div><nav class="playlists" aria-label="게임 모드"></nav>
        </div>
        <footer><a href="https://tikron.dev" target="_blank" rel="noopener">TIKRON ↗</a><span>${FIELD_UI_COPY.deploy.controls}</span><button type="button" class="settingsBtn ui-button">${FIELD_UI_COPY.deploy.settings}</button></footer>
      </div>`;
    const buttons: HTMLButtonElement[] = [];
    const siteButtons: HTMLButtonElement[] = [];
    const vista = root.querySelector('.vista') as HTMLElement;
    const update = () => {
      const mode = MODES[selected];
      root.querySelector(".brief")!.textContent = mode.description;
      const siteId: SiteId = selected === 'practice' ? trainingSite : selected === 'dom' ? 'arena2' : selected === 'ffa' ? 'arena3' : 'arena1';
      const site = SITES[siteId];
      const detail = `${site.name} / ${selected === 'practice'
        ? trainingSite === 'arena1' ? FIELD_UI_COPY.deploy.privateTargets
          : trainingSite === 'arena2' ? FIELD_UI_COPY.deploy.objectivePractice
          : FIELD_UI_COPY.deploy.mapExploration
        : mode.detail}`;
      const detailNode = root.querySelector(".detail");
      if (detailNode) setFieldPhrases(detailNode, detail);
      (root.querySelector(".sites") as HTMLElement).hidden = selected !== "practice";
      root.querySelector('.intel small')!.textContent = `${FIELD_UI_COPY.deploy.operationSite} · ${site.number}${site.legacy ? ` · ${FIELD_UI_COPY.deploy.legacy}` : ''}`;
      root.querySelector('.intel strong')!.textContent = site.name;
      root.querySelector('.siteSubtitle')!.textContent = site.subtitle;
      const routeNode = root.querySelector('.routes');
      if (routeNode) setFieldPhrases(routeNode, site.routes);
      root.querySelector('.blueprint')!.innerHTML = siteBlueprint(site.map);
      vista.style.backgroundImage = site.image ? `url('${site.image}')` : 'none';
      vista.dataset.site = siteId;
      siteButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.map === trainingSite)));
      buttons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === selected)));
    };
    for (const [id, site] of Object.entries(SITES)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'siteCard ui-button'; button.dataset.map = id;
      button.innerHTML = `${siteBlueprint(site.map)}<span>${site.name}<small>${site.legacy ? FIELD_UI_COPY.deploy.legacy : `${site.number} · ${FIELD_UI_COPY.deploy.fieldOperations}`}</small></span>`;
      button.addEventListener('click', () => { trainingSite = id as SiteId; update(); });
      root.querySelector('.siteCards')!.appendChild(button); siteButtons.push(button);
    }
    MODE_ORDER.forEach((id, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "playlist ui-button"; button.dataset.mode = id;
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
