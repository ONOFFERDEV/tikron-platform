/**
 * Minimal dark HUD (DOM overlay, `#0b0f15` palette — matches `public/index.html`).
 * Presentation-only: every DOM-owning piece lives in the `Hud` class; the pure pieces
 * (hotbar unlock/cooldown view, hp/mp pct) are plain functions covered by
 * `test/client-net.test.ts` alongside net.ts's pure exports.
 */
import { CLASS_HOTBAR, isSkillUnlocked, type EmberClass, type HotbarSlot } from "../src/content/hotbar.js";
import { SKILL_BY_ID, cooldownRemainingMs, type CooldownState } from "./net.js";
import { el } from "./dom.js";
import { playSfx } from "./audio.js";
import { ZONE_BANNERS, DEATH_TEXT, FIRST_LOGIN_GUIDE_STEPS, RESPAWN_HERE_TEXT, RESPAWN_VILLAGE_TEXT } from "./lore.js";
import type { SavedZone } from "../src/types.js";

// --- pure: presentation view models -------------------------------------------------------

export interface HotbarSlotView {
  slot: number;
  skillId: string;
  name: string;
  unlocked: boolean;
  /** 0 (ready) .. 1 (just used) — drives a bottom-up cooldown sweep overlay. */
  cooldownPct: number;
}

/** Builds the 6-slot hotbar view for `cls` at `level`, given the current cooldown
 *  tracker and clock. Pure — no DOM, no content-pack mutation. */
export function hotbarView(cls: EmberClass, level: number, cooldowns: CooldownState, nowMs: number): HotbarSlotView[] {
  return CLASS_HOTBAR[cls].map((s: HotbarSlot) => {
    const skill = SKILL_BY_ID[s.skillId];
    const cdMs = skill?.cooldownMs ?? 0;
    const remaining = cooldownRemainingMs(cooldowns, s.skillId, nowMs);
    return {
      slot: s.slot,
      skillId: s.skillId,
      name: skill?.name ?? s.skillId,
      unlocked: isSkillUnlocked(cls, level, s.skillId),
      cooldownPct: cdMs > 0 ? Math.min(1, remaining / cdMs) : 0,
    };
  });
}

/** Clamped 0..1 fraction, 0 when `max` isn't positive. */
export function pct(value: number, max: number): number {
  if (!(max > 0)) return 0;
  return Math.max(0, Math.min(1, value / max));
}

// --- DOM-owning HUD ------------------------------------------------------------------------

export interface HudCallbacks {
  onHotbarClick(slot: number): void;
  onRespawn(): void;
  /** Respawn back at the village (emberhold), possibly from another zone. */
  onRespawnVillage(): void;
  /** "New Character" from the continue-code menu — clears the saved token and reloads. */
  onNewCharacter(): void;
}

export interface VitalsView {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  class: EmberClass | "none";
}

export interface TargetView {
  name: string;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface CastView {
  name: string;
  pct: number; // 0 (just started) .. 1 (about to fire)
}

const FLOAT_COLOR: Record<string, string> = {
  damage: "#f85149",
  heal: "#3fb950",
  xp: "#58a6ff",
  info: "#e6edf3",
};

export class Hud {
  private readonly statusEl: HTMLElement;
  private readonly menuPanelEl: HTMLElement;
  private readonly menuNicknameEl: HTMLElement;
  private readonly menuCodeInputEl: HTMLInputElement;
  private readonly vitalsEl: HTMLElement;
  private readonly hpFillEl: HTMLElement;
  private readonly mpFillEl: HTMLElement;
  private readonly nameLevelEl: HTMLElement;
  private readonly hotbarEl: HTMLElement;
  private readonly castBarEl: HTMLElement;
  private readonly castFillEl: HTMLElement;
  private readonly castLabelEl: HTMLElement;
  private readonly targetEl: HTMLElement;
  private readonly targetNameEl: HTMLElement;
  private readonly targetFillEl: HTMLElement;
  private readonly deathEl: HTMLElement;
  private readonly levelUpEl: HTMLElement;
  private readonly floatLayerEl: HTMLElement;
  private readonly floatNodes = new Map<number, HTMLElement>();
  private levelUpTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: HudCallbacks,
  ) {
    this.statusEl = el("div", "hud-status");
    root.appendChild(this.statusEl);

    const menu = this.buildMenu();
    root.appendChild(menu.wrap);
    this.menuPanelEl = menu.panel;
    this.menuNicknameEl = menu.nickname;
    this.menuCodeInputEl = menu.codeInput;

    this.vitalsEl = el("div", "hud-vitals");
    this.nameLevelEl = el("div", "hud-vitals-label");
    const hpBar = el("div", "hud-bar hud-bar-hp");
    this.hpFillEl = el("div", "hud-bar-fill");
    hpBar.appendChild(this.hpFillEl);
    const mpBar = el("div", "hud-bar hud-bar-mp");
    this.mpFillEl = el("div", "hud-bar-fill");
    mpBar.appendChild(this.mpFillEl);
    this.vitalsEl.append(this.nameLevelEl, hpBar, mpBar);
    root.appendChild(this.vitalsEl);

    this.castBarEl = el("div", "hud-castbar hud-hidden");
    this.castLabelEl = el("div", "hud-castbar-label");
    const castTrack = el("div", "hud-bar hud-bar-cast");
    this.castFillEl = el("div", "hud-bar-fill");
    castTrack.appendChild(this.castFillEl);
    this.castBarEl.append(this.castLabelEl, castTrack);
    root.appendChild(this.castBarEl);

    this.targetEl = el("div", "hud-target hud-hidden");
    this.targetNameEl = el("div", "hud-target-name");
    const targetBar = el("div", "hud-bar hud-bar-hp");
    this.targetFillEl = el("div", "hud-bar-fill");
    targetBar.appendChild(this.targetFillEl);
    this.targetEl.append(this.targetNameEl, targetBar);
    root.appendChild(this.targetEl);

    this.hotbarEl = el("div", "hud-hotbar");
    root.appendChild(this.hotbarEl);

    this.deathEl = this.buildDeathOverlay();
    root.appendChild(this.deathEl);

    this.levelUpEl = el("div", "hud-levelup hud-hidden");
    root.appendChild(this.levelUpEl);

    this.floatLayerEl = el("div", "hud-floats");
    root.appendChild(this.floatLayerEl);
  }

  /** The "☰" menu button + its panel: nickname/class summary, the "이어하기 코드"
   *  (continue code — the character's save token) with copy-to-clipboard, and a "new
   *  character" escape hatch. Populated post-connect via `setCharacterInfo`. */
  private buildMenu(): { wrap: HTMLElement; panel: HTMLElement; nickname: HTMLElement; codeInput: HTMLInputElement } {
    const wrap = el("div", "hud-menu");
    const toggle = document.createElement("button");
    toggle.className = "hud-menu-toggle";
    toggle.title = "메뉴";
    toggle.textContent = "☰";
    toggle.addEventListener("click", () => {
      playSfx("click");
      this.menuPanelEl.classList.toggle("hud-hidden");
    });
    wrap.appendChild(toggle);

    const panel = el("div", "hud-menu-panel hud-hidden");
    const nickname = el("div", "hud-menu-nickname");
    const codeLabel = el("div", "hud-menu-code-label");
    codeLabel.textContent = "이어하기 코드";
    const codeRow = el("div", "hud-menu-code-row");
    const codeInput = document.createElement("input");
    codeInput.className = "hud-menu-code-input";
    codeInput.readOnly = true;
    const copyBtn = document.createElement("button");
    copyBtn.className = "hud-menu-copy-btn";
    copyBtn.textContent = "복사";
    copyBtn.addEventListener("click", () => {
      playSfx("click");
      navigator.clipboard?.writeText(this.menuCodeInputEl.value).catch(() => this.menuCodeInputEl.select());
    });
    codeRow.append(codeInput, copyBtn);
    const newCharBtn = document.createElement("button");
    newCharBtn.className = "hud-menu-newchar-btn";
    newCharBtn.textContent = "새 캐릭터";
    newCharBtn.addEventListener("click", () => {
      playSfx("click");
      this.callbacks.onNewCharacter();
    });
    panel.append(nickname, codeLabel, codeRow, newCharBtn);
    wrap.appendChild(panel);

    return { wrap, panel, nickname, codeInput };
  }

  private buildDeathOverlay(): HTMLElement {
    // No title here: the lore death line (DEATH_TEXT) is already shown by the separate
    // `setDeathOverlay` flavor overlay, so this functional panel is buttons only — a
    // duplicate "You died"/DEATH_TEXT title would double up over the same death screen.
    const overlay = el("div", "hud-death hud-hidden");
    const btn = document.createElement("button");
    btn.className = "hud-death-btn";
    btn.textContent = RESPAWN_HERE_TEXT;
    btn.addEventListener("click", () => {
      playSfx("click");
      this.callbacks.onRespawn();
    });
    const villageBtn = document.createElement("button");
    villageBtn.className = "hud-death-btn";
    villageBtn.textContent = RESPAWN_VILLAGE_TEXT;
    villageBtn.addEventListener("click", () => {
      playSfx("click");
      this.callbacks.onRespawnVillage();
    });
    overlay.append(btn, villageBtn);
    return overlay;
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  /** Populates the menu panel once the character is known (post-connect). */
  setCharacterInfo(info: { nickname: string; cls: EmberClass; level: number; token: string }): void {
    this.menuNicknameEl.textContent = `${info.nickname} · Lv.${info.level} ${info.cls[0]!.toUpperCase()}${info.cls.slice(1)}`;
    this.menuCodeInputEl.value = info.token;
  }

  updateVitals(v: VitalsView | null): void {
    if (!v) {
      this.vitalsEl.classList.add("hud-hidden");
      return;
    }
    this.vitalsEl.classList.remove("hud-hidden");
    const clsLabel = v.class === "none" ? "" : ` ${v.class[0]!.toUpperCase()}${v.class.slice(1)}`;
    this.nameLevelEl.textContent = `Lv.${v.level}${clsLabel}`;
    this.hpFillEl.style.width = `${pct(v.hp, v.maxHp) * 100}%`;
    this.mpFillEl.style.width = `${pct(v.mp, v.maxMp) * 100}%`;
  }

  updateHotbar(slots: HotbarSlotView[] | null): void {
    this.hotbarEl.innerHTML = "";
    if (!slots) return;
    for (const s of slots) {
      const btn = document.createElement("button");
      btn.className = "hud-hotbar-slot" + (s.unlocked ? "" : " hud-hotbar-locked");
      btn.disabled = !s.unlocked;
      btn.title = s.name;
      btn.addEventListener("click", () => {
        playSfx("click");
        this.callbacks.onHotbarClick(s.slot);
      });

      const key = el("span", "hud-hotbar-key");
      key.textContent = String(s.slot);
      const label = el("span", "hud-hotbar-label");
      label.textContent = s.name.slice(0, 2).toUpperCase();
      btn.append(key, label);

      if (s.cooldownPct > 0) {
        const sweep = el("div", "hud-hotbar-sweep");
        sweep.style.height = `${s.cooldownPct * 100}%`;
        btn.appendChild(sweep);
      }
      this.hotbarEl.appendChild(btn);
    }
  }

  updateCastBar(cast: CastView | null): void {
    if (!cast) {
      this.castBarEl.classList.add("hud-hidden");
      return;
    }
    this.castBarEl.classList.remove("hud-hidden");
    this.castLabelEl.textContent = cast.name;
    this.castFillEl.style.width = `${Math.max(0, Math.min(1, cast.pct)) * 100}%`;
  }

  setTarget(target: TargetView | null): void {
    if (!target) {
      this.targetEl.classList.add("hud-hidden");
      return;
    }
    this.targetEl.classList.remove("hud-hidden");
    this.targetNameEl.textContent = target.name;
    this.targetFillEl.style.width = `${pct(target.hp, target.maxHp) * 100}%`;
    this.targetFillEl.style.opacity = target.alive ? "1" : "0.4";
  }

  showDeath(show: boolean): void {
    this.deathEl.classList.toggle("hud-hidden", !show);
  }

  showLevelUp(level: number): void {
    this.levelUpEl.textContent = `Level ${level}!`;
    this.levelUpEl.classList.remove("hud-hidden");
    if (this.levelUpTimer !== null) clearTimeout(this.levelUpTimer);
    this.levelUpTimer = setTimeout(() => this.levelUpEl.classList.add("hud-hidden"), 2200);
  }

  /** Syncs the floating-number DOM layer to `entries` (from `NetSession.floatingNumbers`).
   *  `screenOf(unitId)` projects a unit's current world position to screen space, or
   *  `null` if off-screen/behind the camera (the entry is skipped that frame). */
  renderFloatingNumbers(
    entries: readonly { id: number; unitId: string; text: string; kind: string; bornMs: number }[],
    nowMs: number,
    screenOf: (unitId: string) => { x: number; y: number } | null,
  ): void {
    const seen = new Set<number>();
    for (const f of entries) {
      seen.add(f.id);
      const p = screenOf(f.unitId);
      if (!p) continue;
      const ageS = (nowMs - f.bornMs) / 1000;
      let node = this.floatNodes.get(f.id);
      if (!node) {
        node = el("div", "hud-float");
        node.textContent = f.text;
        node.style.color = FLOAT_COLOR[f.kind] ?? FLOAT_COLOR.info!;
        this.floatLayerEl.appendChild(node);
        this.floatNodes.set(f.id, node);
      }
      node.style.left = `${p.x}px`;
      node.style.top = `${p.y - ageS * 28}px`;
      node.style.opacity = String(Math.max(0, 1 - ageS));
    }
    for (const [id, node] of this.floatNodes) {
      if (!seen.has(id)) {
        node.remove();
        this.floatNodes.delete(id);
      }
    }
  }
}

// --- lore-driven overlays/toasts (standalone module-level DOM, independent of the `Hud`
// instance — callable directly from net.ts's event handlers without threading a `Hud`
// reference through `NetSession`; each lazily creates and reuses its own node) ---------

let zoneBannerEl: HTMLElement | null = null;
let zoneBannerTimer: ReturnType<typeof setTimeout> | null = null;

function ensureZoneBannerEl(): { root: HTMLElement; name: HTMLElement; flavor: HTMLElement } {
  if (!zoneBannerEl) {
    const root = el("div", "hud-zone-banner");
    const name = el("div", "hud-zone-banner-name");
    const flavor = el("div", "hud-zone-banner-flavor");
    root.append(name, flavor);
    document.body.appendChild(root);
    zoneBannerEl = root;
  }
  const root = zoneBannerEl;
  return { root, name: root.children[0] as HTMLElement, flavor: root.children[1] as HTMLElement };
}

/** Zone-entry banner (§2/E1): zone name (large) + one flavor line from `ZONE_BANNERS`,
 *  fade in -> hold 2.5s -> fade out. Re-triggering while already shown restarts the hold. */
export function showZoneBanner(zoneId: SavedZone): void {
  const { root, name, flavor } = ensureZoneBannerEl();
  const info = ZONE_BANNERS[zoneId];
  name.textContent = info.name;
  flavor.textContent = info.flavor;

  if (zoneBannerTimer !== null) clearTimeout(zoneBannerTimer);
  root.classList.add("hud-zone-banner-show");
  zoneBannerTimer = setTimeout(() => {
    root.classList.remove("hud-zone-banner-show");
    zoneBannerTimer = null;
  }, 2500);
}

let deathFlavorEl: HTMLElement | null = null;

function ensureDeathFlavorEl(): HTMLElement {
  if (!deathFlavorEl) {
    const flavor = el("div", "hud-death-flavor hud-hidden");
    flavor.textContent = DEATH_TEXT;
    document.body.appendChild(flavor);
    deathFlavorEl = flavor;
  }
  return deathFlavorEl;
}

/** Grayscales the game canvas and shows the lore death line (`DEATH_TEXT`) while `on`;
 *  both clear together off `off`. Separate from `Hud.showDeath`'s functional
 *  Respawn-button panel, which keeps its own English label and stays untouched. */
export function setDeathOverlay(on: boolean): void {
  document.querySelector("canvas")?.classList.toggle("hud-canvas-death", on);
  ensureDeathFlavorEl().classList.toggle("hud-hidden", !on);
}

let toastLayerEl: HTMLElement | null = null;

function ensureToastLayerEl(): HTMLElement {
  if (!toastLayerEl) {
    toastLayerEl = el("div", "hud-toast-layer");
    document.body.appendChild(toastLayerEl);
  }
  return toastLayerEl;
}

/** Bottom-right toast, auto-dismissed after 3s. Stacks — each call adds its own node. */
export function showToast(text: string): void {
  const layer = ensureToastLayerEl();
  const node = el("div", "hud-toast");
  node.textContent = text;
  layer.appendChild(node);
  setTimeout(() => node.remove(), 3000);
}

const GUIDE_DONE_KEY = "ef_guide_done";
const GUIDE_STEP_MS = 4000;

/** Shows one `FIRST_LOGIN_GUIDE_STEPS` line as a toast. Exposed separately from
 *  `runFirstLoginGuide` so a caller could drive the sequence on its own timing if needed. */
export function showGuideStep(index: number): void {
  const step = FIRST_LOGIN_GUIDE_STEPS[index];
  if (step) showToast(step);
}

/** Runs the 3-step first-login guide (§10) as sequential toasts, 4s apart, once ever per
 *  browser (gated on `localStorage['ef_guide_done']`). No-op on every call after the first. */
export function runFirstLoginGuide(): void {
  if (localStorage.getItem(GUIDE_DONE_KEY)) return;
  localStorage.setItem(GUIDE_DONE_KEY, "1");
  FIRST_LOGIN_GUIDE_STEPS.forEach((_, i) => setTimeout(() => showGuideStep(i), i * GUIDE_STEP_MS));
}

// --- boss drama overlays (E2 boss HP bar + dialogue line, E3 phase flash, E8 ending) — §7.
// index.html is out of this agent's file boundary, so these inject their own scoped <style>
// (mirrors hitfeel.ts's precedent) using the HUD palette; the narrative banner reuses the
// existing `.hud-zone-banner` classes. Module-level singletons like the lore overlays above,
// driven directly from net.ts's `"bossEvent"` handler. ---------------------------------------

const BOSS_STYLE_ID = "ef-boss-style";

function injectBossStyle(): void {
  if (document.getElementById(BOSS_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = BOSS_STYLE_ID;
  style.textContent = `
.ef-boss-bar {
  position: fixed;
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
  width: min(460px, 80vw);
  z-index: 3;
  text-align: center;
  pointer-events: none;
}
.ef-boss-bar-name {
  margin-bottom: 4px;
  font: 600 17px ui-monospace, monospace;
  color: #e0563b;
  letter-spacing: 0.06em;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
}
.ef-boss-bar-track {
  position: relative;
  height: 16px;
  background: #161b22;
  border: 1px solid #5a2020;
  border-radius: 3px;
  overflow: hidden;
}
.ef-boss-bar-fill {
  height: 100%;
  width: 100%;
  background: linear-gradient(#ff7a33, #e0563b);
  transition: width 0.18s ease-out;
}
.ef-boss-line {
  position: fixed;
  left: 50%;
  bottom: 168px;
  transform: translateX(-50%);
  max-width: min(640px, 88vw);
  z-index: 3;
  padding: 8px 18px;
  background: rgba(11, 15, 21, 0.72);
  border: 1px solid #5a2020;
  border-radius: 4px;
  color: #f0e6d8;
  font-size: 17px;
  line-height: 1.4;
  text-align: center;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.ef-boss-line-show {
  opacity: 1;
}
.ef-phase-flash {
  position: fixed;
  inset: 0;
  z-index: 46;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(ellipse at center, transparent 45%, rgba(255, 90, 20, 0.9) 100%);
}
`;
  document.head.appendChild(style);
}

let bossBarEl: HTMLElement | null = null;
let bossBarNameEl: HTMLElement | null = null;
let bossBarFillEl: HTMLElement | null = null;
let bossBarUnitId: string | null = null;

function ensureBossBarEl(): void {
  if (bossBarEl) return;
  injectBossStyle();
  const root = el("div", "ef-boss-bar hud-hidden");
  const name = el("div", "ef-boss-bar-name");
  const track = el("div", "ef-boss-bar-track");
  const fill = el("div", "ef-boss-bar-fill");
  track.appendChild(fill);
  root.append(name, track);
  document.body.appendChild(root);
  bossBarEl = root;
  bossBarNameEl = name;
  bossBarFillEl = fill;
}

/** Shows the top-center boss HP frame for `unitId` with display `name` (E2). The fill is
 *  refreshed every render frame by `updateBossBar` from net.ts's tick loop; `unitId` is
 *  retained so a stale boss's late `updateBossBar`/`hideBossBar` is ignored. */
export function showBossBar(unitId: string, name: string): void {
  ensureBossBarEl();
  bossBarUnitId = unitId;
  bossBarNameEl!.textContent = name;
  bossBarFillEl!.style.width = "100%";
  bossBarEl!.classList.remove("hud-hidden");
}

/** Per-frame HP fill update; no-op unless `unitId` is the bar's current boss (guards against
 *  a lingering AOI unit or a prior boss driving the wrong frame). */
export function updateBossBar(unitId: string, hpFraction: number): void {
  if (bossBarUnitId !== unitId || !bossBarFillEl) return;
  bossBarFillEl.style.width = `${Math.max(0, Math.min(1, hpFraction)) * 100}%`;
}

export function hideBossBar(): void {
  bossBarUnitId = null;
  bossBarEl?.classList.add("hud-hidden");
}

let bossLineEl: HTMLElement | null = null;
let bossLineTimer: ReturnType<typeof setTimeout> | null = null;

function ensureBossLineEl(): HTMLElement {
  if (!bossLineEl) {
    injectBossStyle();
    bossLineEl = el("div", "ef-boss-line");
    document.body.appendChild(bossLineEl);
  }
  return bossLineEl;
}

/** Boss dialogue / phase call-out line (§7), shown mid-lower center for 3.5s — distinct from
 *  the zone-entry banner. Re-firing before it fades swaps the text and restarts the hold. */
export function showBossLine(text: string): void {
  const node = ensureBossLineEl();
  node.textContent = text;
  node.classList.add("ef-boss-line-show");
  if (bossLineTimer !== null) clearTimeout(bossLineTimer);
  bossLineTimer = setTimeout(() => {
    node.classList.remove("ef-boss-line-show");
    bossLineTimer = null;
  }, 3500);
}

let bossBannerEl: HTMLElement | null = null;
let bossBannerTimer: ReturnType<typeof setTimeout> | null = null;

function ensureBossBannerEl(): HTMLElement {
  if (!bossBannerEl) {
    // Reuses the zone-banner visual (index.html `.hud-zone-banner`) but as its own node, so a
    // boss/ending banner and a zone-entry banner never clobber each other's text/timer.
    const root = el("div", "hud-zone-banner");
    root.appendChild(el("div", "hud-zone-banner-name"));
    document.body.appendChild(root);
    bossBannerEl = root;
  }
  return bossBannerEl;
}

/** Single narrative banner (boss entrance/defeat framing, §7) in the zone-banner style, held
 *  `holdMs` then faded. Separate element from `showZoneBanner` so the two never collide. */
export function showBossBanner(text: string, holdMs = 3500): void {
  const root = ensureBossBannerEl();
  (root.firstChild as HTMLElement).textContent = text;
  if (bossBannerTimer !== null) clearTimeout(bossBannerTimer);
  root.classList.add("hud-zone-banner-show");
  bossBannerTimer = setTimeout(() => {
    root.classList.remove("hud-zone-banner-show");
    bossBannerTimer = null;
  }, holdMs);
}

/** Ending sequence (§7.3, E8): the closing banners shown one after another, `stepMs` apart,
 *  reusing the narrative-banner component. */
export function runEndingBanners(lines: readonly string[], stepMs = 4000): void {
  lines.forEach((line, i) => setTimeout(() => showBossBanner(line, stepMs), i * stepMs));
}

let phaseFlashEl: HTMLElement | null = null;
let phaseFlashAnim: Animation | null = null;

/** Ember-orange screen-edge vignette flash (E3, ~0.5s) on a boss phase transition — a
 *  distinct hue/z-index from hitfeel's red damage vignette so the two never read as one cue. */
export function showPhaseFlash(): void {
  if (!phaseFlashEl) {
    injectBossStyle();
    phaseFlashEl = el("div", "ef-phase-flash");
    document.body.appendChild(phaseFlashEl);
  }
  phaseFlashAnim?.cancel();
  phaseFlashAnim = phaseFlashEl.animate(
    [{ opacity: 0 }, { opacity: 0.7, offset: 0.35 }, { opacity: 0 }],
    { duration: 500, easing: "ease-out" },
  );
}
