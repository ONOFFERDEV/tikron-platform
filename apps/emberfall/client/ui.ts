/**
 * Minimal dark HUD (DOM overlay, `#0b0f15` palette — matches `public/index.html`).
 * Presentation-only: every DOM-owning piece lives in the `Hud` class; the pure pieces
 * (hotbar unlock/cooldown view, hp/mp pct) are plain functions covered by
 * `test/client-net.test.ts` alongside net.ts's pure exports.
 */
import { CLASS_HOTBAR, isSkillUnlocked, type EmberClass, type HotbarSlot } from "../src/content/hotbar.js";
import { SKILL_BY_ID, cooldownRemainingMs, type CooldownState } from "./net.js";
import { el } from "./dom.js";

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
    toggle.addEventListener("click", () => this.menuPanelEl.classList.toggle("hud-hidden"));
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
      navigator.clipboard?.writeText(this.menuCodeInputEl.value).catch(() => this.menuCodeInputEl.select());
    });
    codeRow.append(codeInput, copyBtn);
    const newCharBtn = document.createElement("button");
    newCharBtn.className = "hud-menu-newchar-btn";
    newCharBtn.textContent = "새 캐릭터";
    newCharBtn.addEventListener("click", () => this.callbacks.onNewCharacter());
    panel.append(nickname, codeLabel, codeRow, newCharBtn);
    wrap.appendChild(panel);

    return { wrap, panel, nickname, codeInput };
  }

  private buildDeathOverlay(): HTMLElement {
    const overlay = el("div", "hud-death hud-hidden");
    const label = el("div", "hud-death-label");
    label.textContent = "You died";
    const btn = document.createElement("button");
    btn.className = "hud-death-btn";
    btn.textContent = "Respawn (R)";
    btn.addEventListener("click", () => this.callbacks.onRespawn());
    overlay.append(label, btn);
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
      btn.addEventListener("click", () => this.callbacks.onHotbarClick(s.slot));

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
