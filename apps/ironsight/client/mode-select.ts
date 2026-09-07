/** Deployment UI. URL selections remain compatible with the existing matchmaker. */
import { MODE_ORDER, type ModeId } from "../src/modes.js";
import { openSettings } from "./settings-ui.js";
import type { SettingsStore } from "./settings.js";

const MODES: Record<ModeId, { label: string; ko: string; map: string; description: string; detail: string }> = {
  tdm: { label: "TEAM DEATHMATCH", ko: "팀 데스매치", map: "RELAY", description: "Take the yard. Hold the advantage.", detail: "6v6 · Team combat · Bots fill open seats" },
  dom: { label: "DOMINATION", ko: "거점 점령", map: "FOUNDRY", description: "Three objectives. One coordinated team.", detail: "6v6 · Capture and defend · Legacy arena" },
  ffa: { label: "FREE FOR ALL", ko: "개인전", map: "CROSSYARD", description: "Every angle is a threat. Trust your aim.", detail: "Solo combat · Fast respawns · Legacy arena" },
  practice: { label: "FIELD TRAINING", ko: "사격 훈련", map: "RELAY", description: "Learn the routes. Find your weapon.", detail: "Private session · Passive targets · No time limit" },
};
const css = `
#modeMenu{position:fixed;inset:0;z-index:200;background:#111d23;color:#f0eee5;font:14px/1.5 Arial,"Malgun Gothic",sans-serif;overflow:auto;pointer-events:auto}
#modeMenu *{box-sizing:border-box}
#modeMenu .vista{position:absolute;inset:0;background:url('/assets/relay-vista.webp') center/cover no-repeat;opacity:.8}
#modeMenu .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,18,24,.98),rgba(8,18,24,.75) 34%,rgba(8,18,24,.05) 76%),linear-gradient(0deg,#0b171eee,transparent 48%)}
#modeMenu .shell{position:relative;min-height:100%;padding:36px 4.5vw 26px;display:flex;flex-direction:column}
#modeMenu .topline{display:flex;align-items:center;justify-content:space-between;font-size:11px;letter-spacing:3px;color:#becbd0;border-bottom:1px solid #e0e8de25;padding-bottom:20px}
#modeMenu .brand{display:flex;gap:12px;align-items:center;color:#fff;font-weight:700;letter-spacing:4px}
#modeMenu .mark{width:21px;height:25px;border:3px solid #e9b567;transform:skew(-15deg);position:relative}
#modeMenu .mark:after{content:"";position:absolute;inset:5px;border-left:2px solid #e9b567}
#modeMenu .build-tag{color:#dcad65}
#modeMenu .hero{padding-top:clamp(34px,7vh,90px);padding-bottom:44px;flex:1}
#modeMenu .eyebrow{font-size:11px;letter-spacing:4px;color:#eab366;display:flex;align-items:center;gap:12px}
#modeMenu .eyebrow:before{content:"";width:28px;height:2px;background:#eab366}
#modeMenu h1{font-size:clamp(60px,7.8vw,144px);line-height:.92;letter-spacing:-5px;margin:28px 0 18px;font-weight:800}
#modeMenu .subtitle{font-size:12px;letter-spacing:9px;color:#acbbc1;margin-bottom:32px}
#modeMenu .brief{font-size:20px;line-height:1.5;margin:0 0 7px;max-width:440px}
#modeMenu .detail{font-size:12px;color:#acbbc1;margin:0 0 30px}
#modeMenu button,#modeMenu select{font:inherit;cursor:pointer}
#modeMenu button{border:0;border-radius:0;transition:background 130ms,color 130ms}
#modeMenu button:focus-visible,#modeMenu select:focus-visible,#modeMenu a:focus-visible{outline:2px solid #fff;outline-offset:5px}
#modeMenu .deploy{background:#e9b567;color:#17252a;padding:18px 24px;width:340px;display:flex;justify-content:space-between;align-items:center;font-weight:700;letter-spacing:3px;font-size:14px;box-shadow:0 8px 30px #0004}
#modeMenu .deploy:hover{background:#ffcf83}
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
#modeMenu .playlist .ko{font-size:11px;color:#aabcc3;display:block;margin-top:4px}
#modeMenu footer{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:24px;font-size:10px;letter-spacing:2px;color:#a0b5bd}
#modeMenu footer a{color:#c6d7d9;text-decoration:none}
#modeMenu .settingsBtn{padding:8px 0 8px 20px;color:#d5dedb;background:transparent;letter-spacing:2px;font-size:11px}
#modeMenu .settingsBtn:hover{color:#e9b567}
@media(max-width:800px){#modeMenu .intel{display:none}#modeMenu .topline{font-size:9px;letter-spacing:1px}#modeMenu h1{letter-spacing:-3px}#modeMenu .playlists{grid-template-columns:repeat(2,1fr)}#modeMenu .hero{padding-top:34px;padding-bottom:28px}#modeMenu .deploy{width:min(340px,100%)}#modeMenu .playlist{min-height:90px;padding:14px}#modeMenu .subtitle{letter-spacing:6px}#modeMenu footer{font-size:9px;letter-spacing:1px}}
@media(prefers-reduced-motion:reduce){#modeMenu button{transition:none}}
`;

export async function resolveMode(settings: SettingsStore): Promise<ModeId> {
  const fromUrl = new URLSearchParams(location.search).get("mode");
  if (fromUrl && (MODE_ORDER as readonly string[]).includes(fromUrl)) return fromUrl as ModeId;
  return new Promise(resolve => {
    let selected: ModeId = "tdm";
    const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
    const root = document.createElement("main"); root.id = "modeMenu";
    root.innerHTML = `
      <div class="vista" aria-hidden="true"></div><div class="shade" aria-hidden="true"></div>
      <div class="shell">
        <header class="topline"><div class="brand"><i class="mark" aria-hidden="true"></i> IRONSIGHT</div><span class="build-tag">RELAY / DEVELOPMENT PREVIEW</span></header>
        <section class="hero" aria-label="Deploy to match">
          <div class="eyebrow">MULTIPLAYER FIELD OPERATIONS</div>
          <h1>IRONSIGHT</h1><div class="subtitle">CONTROL THE SIGNAL</div>
          <p class="brief"></p><p class="detail"></p>
          <button class="deploy" type="button"><span>DEPLOY / 출격</span><span aria-hidden="true">↗</span></button>
          <label class="mapSelect" hidden>TRAINING SITE <select aria-label="Training map"><option value="arena1">Relay</option><option value="arena2">Foundry · Legacy</option><option value="arena3">Crossyard · Legacy</option></select></label>
        </section>
        <aside class="intel"><small>FEATURED LOCATION / 01</small><strong>RELAY</strong><p>COMMUNICATIONS TRANSFER YARD</p></aside>
        <div class="playlistLabel">SELECT OPERATION</div><nav class="playlists" aria-label="Game modes"></nav>
        <footer><a href="https://tikron.dev" target="_blank" rel="noopener">MADE WITH TIKRON ↗</a><span>WASD MOVE · MOUSE AIM</span><button type="button" class="settingsBtn">SETTINGS / 설정</button></footer>
      </div>`;
    const buttons: HTMLButtonElement[] = [];
    const update = () => {
      const mode = MODES[selected];
      root.querySelector(".brief")!.textContent = mode.description;
      root.querySelector(".detail")!.textContent = `${mode.map} / ${mode.detail}`;
      (root.querySelector(".mapSelect") as HTMLElement).hidden = selected !== "practice";
      buttons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === selected)));
    };
    MODE_ORDER.forEach((id, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "playlist"; button.dataset.mode = id;
      button.innerHTML = `<span class="number">0${index + 1} / ${MODES[id].map}</span><strong>${MODES[id].label}</strong><span class="ko">${MODES[id].ko}</span>`;
      button.addEventListener("click", () => { selected = id; update(); });
      buttons.push(button); root.querySelector(".playlists")!.appendChild(button);
    });
    root.querySelector(".deploy")!.addEventListener("click", () => {
      const url = new URL(location.href); url.searchParams.set("mode", selected);
      const map = (root.querySelector("select") as HTMLSelectElement).value;
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
