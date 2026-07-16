/**
 * First-load mode-select screen: a fullscreen menu (TDM / FFA / DOMINATION /
 * PRACTICE) shown when the page has no valid `?mode=` query. The deep-link path
 * (`?mode=tdm|ffa|dom|practice`) skips this entirely — connects exactly as
 * before, no menu ever shown. Picking a button reflects the choice into the URL
 * via `history.replaceState` (so a refresh re-enters the same mode) *before*
 * resolving, so `net.ts`'s own `modeFromLocation()` — which reads
 * `location.search` independently — picks it up unchanged. This module never
 * talks to `Net` directly.
 *
 * A small "설정" button in the bottom-right corner opens the same settings
 * panel `quit-confirm.ts` uses. This menu hides its own DOM (rather than
 * relying on z-index — the menu is 200, the settings panel is 160, so a
 * naive stack would put the panel behind it) before opening settings, and
 * restores it in the `onClose` callback.
 */
import { MODE_ORDER, type ModeId } from "../src/modes.js";
import { GAME } from "../src/game-config.js";
import { openSettings } from "./settings-ui.js";
import type { SettingsStore } from "./settings.js";

const css = `
#modeMenu { position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 14px; background: #0b0e14;
  font: 14px/1.4 ui-monospace, "SF Mono", Menlo, monospace; color: #eef; pointer-events: auto; }
#modeMenu h1 { font-size: 42px; letter-spacing: 8px; margin: 0 0 30px; opacity: 0.95; }
#modeMenu button { width: 320px; padding: 16px 20px; border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; background: rgba(20,24,32,0.8); color: #eef; font: inherit; cursor: pointer;
  text-align: left; transition: background 120ms, border-color 120ms; }
#modeMenu button:hover { background: rgba(70,130,220,0.25); border-color: rgba(156,196,255,0.6); }
#modeMenu button .ko { font-size: 18px; font-weight: 700; letter-spacing: 1px; }
#modeMenu button .en { display: block; margin-top: 3px; font-size: 11px; letter-spacing: 2px; opacity: 0.55; }
#modeMenu .settingsBtn { position: absolute; right: 24px; bottom: 24px; width: auto; padding: 10px 18px;
  text-align: center; }
`;

function isModeId(v: string | null): v is ModeId {
  return v !== null && (MODE_ORDER as readonly string[]).includes(v);
}

/**
 * Resolve the mode to play. A valid `?mode=` query wins immediately (deep link —
 * no menu shown). Otherwise shows the fullscreen menu and resolves once a button
 * is picked.
 */
export async function resolveMode(settings: SettingsStore): Promise<ModeId> {
  const fromUrl = new URLSearchParams(location.search).get("mode");
  if (isModeId(fromUrl)) return fromUrl;
  return showMenu(settings);
}

function showMenu(settings: SettingsStore): Promise<ModeId> {
  return new Promise((resolve) => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const root = document.createElement("div");
    root.id = "modeMenu";
    const title = document.createElement("h1");
    title.textContent = GAME.text.title;
    root.appendChild(title);

    for (const id of MODE_ORDER) {
      const { ko, en } = GAME.text.modeLabels[id];
      const btn = document.createElement("button");
      btn.innerHTML = `<span class="ko">${ko}</span><span class="en">${en}</span>`;
      btn.addEventListener("click", () => {
        const url = new URL(location.href);
        url.searchParams.set("mode", id);
        history.replaceState(null, "", url);
        root.remove();
        style.remove();
        resolve(id);
      });
      root.appendChild(btn);
    }

    const settingsBtn = document.createElement("button");
    settingsBtn.className = "settingsBtn";
    settingsBtn.textContent = GAME.text.settings.openLabel;
    settingsBtn.addEventListener("click", () => {
      root.style.display = "none";
      openSettings(settings, () => {
        root.style.display = "";
      });
    });
    root.appendChild(settingsBtn);

    document.body.appendChild(root);
  });
}
