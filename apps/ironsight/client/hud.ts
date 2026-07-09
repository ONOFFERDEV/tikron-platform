/**
 * DOM HUD overlay: crosshair (spread-reactive), HP, ammo + reload, killfeed, team
 * scores, damage vignette, hitmarker, pointer-lock prompt, death/respawn overlay,
 * and the match-end scoreboard. Pure presentation driven by `main.ts`; all layout
 * is injected here so `index.html` stays a bare mount point.
 */
import { TEAM_COLOR } from "./config.js";
import { WEAPONS } from "../src/config.js";

const css = `
#hud { position: fixed; inset: 0; pointer-events: none; font: 14px/1.4 ui-monospace, "SF Mono", Menlo, monospace; color: #eef; user-select: none; }
#hud .center { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
#xhair i { position: absolute; background: #d8f0ff; box-shadow: 0 0 2px #000; }
#hud .panel { position: absolute; background: rgba(10,13,18,0.55); padding: 8px 12px; border-radius: 8px; backdrop-filter: blur(2px); }
#hp { left: 24px; bottom: 24px; width: 220px; }
#hpbar { height: 12px; background: #2a2f3a; border-radius: 6px; overflow: hidden; margin-top: 4px; }
#hpfill { height: 100%; width: 100%; background: linear-gradient(90deg,#4caf50,#8bd66f); transition: width 90ms linear; }
#ammo { right: 24px; bottom: 24px; text-align: right; min-width: 130px; }
#ammo .mag { font-size: 30px; font-weight: 700; }
#ammo .res { opacity: 0.65; font-size: 16px; }
#reload { height: 4px; background: #2a2f3a; border-radius: 3px; margin-top: 6px; overflow: hidden; display: none; }
#reloadfill { height: 100%; width: 0%; background: #ffb347; }
#scores { top: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 16px; align-items: center; font-size: 20px; font-weight: 700; }
#scores .r { color: #ff8a6e; } #scores .b { color: #7db0ff; }
#feed { top: 16px; right: 16px; display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
#feed .k { background: rgba(10,13,18,0.55); padding: 3px 8px; border-radius: 6px; transition: opacity 300ms; }
#ping { left: 16px; top: 16px; opacity: 0.6; font-size: 12px; }
#hitmarker { opacity: 0; }
#hitmarker.show { opacity: 1; }
#hitmarker i { position: absolute; width: 12px; height: 2px; background: #fff; }
#hitmarker.head i { background: #ffd24a; box-shadow: 0 0 4px #ffae00; }
#vignette { position: absolute; inset: 0; box-shadow: inset 0 0 120px 40px rgba(200,30,30,0); transition: box-shadow 120ms; }
/* pointer-events:none so a click passes through to the canvas (which requests
   pointer lock) — the prompt is informational, not a button. */
#overlay { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; background: rgba(6,8,12,0.5); text-align: center; pointer-events: none; }
#overlay h1 { font-size: 34px; margin: 0 0 8px; letter-spacing: 2px; }
#overlay p { margin: 4px; opacity: 0.85; }
#overlay .hint { margin-top: 18px; font-size: 13px; opacity: 0.6; }
#wbar { left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; gap: 6px; align-items: center; }
#wbar .slot { padding: 4px 10px; border-radius: 6px; background: rgba(10,13,18,0.55); opacity: 0.5; font-size: 12px; white-space: nowrap; }
#wbar .slot .num { opacity: 0.6; margin-right: 4px; }
#wbar .slot.active { opacity: 1; background: rgba(70,130,220,0.65); box-shadow: 0 0 0 1px #9cc4ff; }
#wbar .nades { padding: 4px 10px; border-radius: 6px; background: rgba(10,13,18,0.55); font-size: 12px; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, id?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (id) e.id = id;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

interface KillRow {
  node: HTMLElement;
  born: number;
}

export class Hud {
  private readonly root: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly ammoMag: HTMLElement;
  private readonly ammoRes: HTMLElement;
  private readonly reload: HTMLElement;
  private readonly reloadFill: HTMLElement;
  private readonly scoreR: HTMLElement;
  private readonly scoreB: HTMLElement;
  private readonly feed: HTMLElement;
  private readonly ping: HTMLElement;
  private readonly xhair: HTMLElement[];
  private readonly hitmarker: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly wslots: HTMLElement[];
  private readonly nadeCount: HTMLElement;

  private reloadStart = -1;
  private reloadMs = 0;
  private hitAt = -1e9;
  private vignetteAt = -1e9;
  private readonly kills: KillRow[] = [];

  constructor(container: HTMLElement = document.body) {
    const style = el("style");
    style.textContent = css;
    document.head.appendChild(style);

    this.root = el("div", "hud");

    // Crosshair (4 arms around a centre gap).
    const xh = el("div", "xhair");
    xh.className = "center";
    this.xhair = [el("i"), el("i"), el("i"), el("i")];
    for (const arm of this.xhair) xh.appendChild(arm);
    this.root.appendChild(xh);

    // Hitmarker (X).
    this.hitmarker = el("div", "hitmarker");
    this.hitmarker.className = "center";
    const a = el("i"), b = el("i");
    a.style.transform = "rotate(45deg)";
    b.style.transform = "rotate(-45deg)";
    this.hitmarker.append(a, b);
    this.root.appendChild(this.hitmarker);

    // HP.
    const hp = el("div", "hp"); hp.className = "panel";
    hp.appendChild(el("div", undefined, "HP"));
    const hpbar = el("div", "hpbar");
    this.hpFill = el("div", "hpfill");
    hpbar.appendChild(this.hpFill); hp.appendChild(hpbar);
    this.root.appendChild(hp);

    // Ammo.
    const ammo = el("div", "ammo"); ammo.className = "panel";
    this.ammoMag = el("span", undefined, "30"); this.ammoMag.className = "mag";
    this.ammoRes = el("span", undefined, " / 90"); this.ammoRes.className = "res";
    const ammoLine = el("div"); ammoLine.append(this.ammoMag, this.ammoRes);
    this.reload = el("div", "reload"); this.reloadFill = el("div", "reloadfill");
    this.reload.appendChild(this.reloadFill);
    ammo.append(ammoLine, this.reload);
    this.root.appendChild(ammo);

    // Scores.
    const scores = el("div", "scores"); scores.className = "panel";
    this.scoreR = el("span", undefined, "0"); this.scoreR.className = "r";
    this.scoreB = el("span", undefined, "0"); this.scoreB.className = "b";
    scores.append(this.scoreR, el("span", undefined, "vs"), this.scoreB);
    this.root.appendChild(scores);

    // Weapon bar (bottom-center): one slot per WEAPONS entry, plus a grenade badge.
    const wbar = el("div", "wbar"); wbar.className = "panel";
    this.wslots = WEAPONS.map((w, i) => {
      const slot = el("div", undefined, `<span class="num">${i + 1}</span>${esc(w.name)}`);
      slot.className = "slot";
      wbar.appendChild(slot);
      return slot;
    });
    this.nadeCount = el("div", undefined, "💣 0");
    this.nadeCount.className = "nades";
    wbar.appendChild(this.nadeCount);
    this.root.appendChild(wbar);

    // Killfeed + ping + vignette + overlay.
    this.feed = el("div", "feed"); this.root.appendChild(this.feed);
    this.ping = el("div", "ping"); this.ping.className = "panel"; this.ping.textContent = "-- ms";
    this.root.appendChild(this.ping);
    this.vignette = el("div", "vignette"); this.root.appendChild(this.vignette);
    this.overlay = el("div", "overlay"); this.root.appendChild(this.overlay);

    container.appendChild(this.root);
    this.setSpread(0);
  }

  setHp(hp: number): void {
    const pct = Math.max(0, Math.min(100, hp));
    this.hpFill.style.width = `${pct}%`;
    this.hpFill.style.background = pct > 50 ? "linear-gradient(90deg,#4caf50,#8bd66f)"
      : pct > 25 ? "linear-gradient(90deg,#d8a63a,#f0c040)"
      : "linear-gradient(90deg,#c0392b,#e05a4a)";
  }

  setAmmo(mag: number, reserve: number, reloadMs?: number): void {
    this.ammoMag.textContent = String(mag);
    this.ammoRes.textContent = ` / ${reserve}`;
    if (reloadMs && reloadMs > 0) {
      this.reloadStart = performance.now();
      this.reloadMs = reloadMs;
      this.reload.style.display = "block";
    } else {
      this.reloadStart = -1;
      this.reload.style.display = "none";
    }
  }

  setScores(red: number, blue: number): void {
    this.scoreR.textContent = String(red);
    this.scoreB.textContent = String(blue);
  }

  /** Highlight the held weapon's slot (index into {@link WEAPONS}). */
  setWeapon(index: number): void {
    this.wslots.forEach((s, i) => s.classList.toggle("active", i === index));
  }

  /** Update the carried grenade count badge. */
  setNades(n: number): void {
    this.nadeCount.innerHTML = `💣 ${n}`;
  }

  /** Crosshair gap grows with `spread01` (0 = tight, 1 = wide). Visual only. */
  setSpread(spread01: number): void {
    const gap = 4 + spread01 * 16;
    const len = 7, th = 2;
    const arms: [string, string][] = [
      [`left:-${th / 2}px; top:-${gap + len}px; width:${th}px; height:${len}px`, ""],
      [`left:-${th / 2}px; top:${gap}px; width:${th}px; height:${len}px`, ""],
      [`top:-${th / 2}px; left:-${gap + len}px; height:${th}px; width:${len}px`, ""],
      [`top:-${th / 2}px; left:${gap}px; height:${th}px; width:${len}px`, ""],
    ];
    this.xhair.forEach((arm, i) => (arm.style.cssText = arms[i]![0]));
  }

  addKill(killer: string, victim: string, part: string, killerTeam: number | null): void {
    const color = killerTeam === 0 || killerTeam === 1 ? `#${TEAM_COLOR[killerTeam].toString(16)}` : "#eee";
    const icon = part === "head" ? " ✷ " : part === "blast" ? " 💥 " : " ➜ ";
    const node = el("div"); node.className = "k";
    node.innerHTML = `<b style="color:${color}">${esc(killer)}</b>${icon}${esc(victim)}`;
    this.feed.appendChild(node);
    this.kills.push({ node, born: performance.now() });
    while (this.kills.length > 5) {
      const old = this.kills.shift()!;
      old.node.remove();
    }
  }

  showHitmarker(head: boolean): void {
    this.hitmarker.className = `center show${head ? " head" : ""}`;
    this.hitAt = performance.now();
  }

  flashDamage(): void {
    this.vignetteAt = performance.now();
    this.vignette.style.boxShadow = "inset 0 0 120px 45px rgba(200,30,30,0.55)";
  }

  setPing(ms: number): void {
    this.ping.textContent = `${Math.round(ms)} ms`;
  }

  /** The click-to-play / ESC prompt. */
  showLockPrompt(show: boolean, text = "CLICK TO PLAY"): void {
    if (show) {
      this.overlay.style.display = "flex";
      this.overlay.innerHTML = `<h1>ironsight</h1><p>${text}</p><p class="hint">WASD move · Shift sprint · Ctrl/C crouch · Space jump · R reload · LMB fire · M mute</p>`;
    } else {
      this.overlay.style.display = "none";
    }
  }

  /** Death overlay with a live respawn countdown (seconds). */
  showDeath(secondsLeft: number, killerName?: string): void {
    this.overlay.style.display = "flex";
    const sub = killerName ? `<p>eliminated by ${esc(killerName)}</p>` : "";
    const line = secondsLeft > 0 ? `<p>respawn in ${secondsLeft.toFixed(1)}s</p>` : `<p>respawning…</p>`;
    this.overlay.innerHTML = `<h1 style="color:#e05a4a">ELIMINATED</h1>${sub}${line}`;
  }

  showMatchEnd(winner: string, red: number, blue: number, myKills: number, myDeaths: number): void {
    this.overlay.style.display = "flex";
    const title = winner === "draw" ? "DRAW" : `${winner.toUpperCase()} WINS`;
    const color = winner === "red" ? "#ff8a6e" : winner === "blue" ? "#7db0ff" : "#eee";
    this.overlay.innerHTML = `<h1 style="color:${color}">${title}</h1>`
      + `<p><span style="color:#ff8a6e">RED ${red}</span> — <span style="color:#7db0ff">BLUE ${blue}</span></p>`
      + `<p>your score: ${myKills} K / ${myDeaths} D</p><p class="hint">next round starting…</p>`;
  }

  hideOverlay(): void {
    this.overlay.style.display = "none";
  }

  /** Per-frame animation: reload bar, hitmarker + vignette fade, killfeed decay. */
  update(now: number): void {
    if (this.reloadStart >= 0) {
      const p = Math.min(1, (now - this.reloadStart) / this.reloadMs);
      this.reloadFill.style.width = `${p * 100}%`;
      if (p >= 1) {
        this.reloadStart = -1;
        this.reload.style.display = "none";
      }
    }
    if (now - this.hitAt > 90) this.hitmarker.className = "center";
    if (now - this.vignetteAt > 60) this.vignette.style.boxShadow = "inset 0 0 120px 40px rgba(200,30,30,0)";
    for (let i = this.kills.length - 1; i >= 0; i--) {
      const k = this.kills[i]!;
      const age = now - k.born;
      if (age > 5000) {
        k.node.remove();
        this.kills.splice(i, 1);
      } else if (age > 4000) {
        k.node.style.opacity = String(1 - (age - 4000) / 1000);
      }
    }
  }
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}
