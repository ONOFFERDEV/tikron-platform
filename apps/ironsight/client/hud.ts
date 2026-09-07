/**
 * DOM HUD overlay: crosshair (spread-reactive), HP, ammo + reload, killfeed, team
 * scores, damage vignette, hitmarker, pointer-lock prompt, death/respawn overlay,
 * and the match-end scoreboard. Pure presentation driven by `main.ts`; all layout
 * is injected here so `index.html` stays a bare mount point.
 */
import { MODE_ORDER, isTeamless } from "../src/modes.js";
import { GAME } from "../src/game-config.js";
import { formatKeyLabel, formatBinding, type BindAction, type SettingsStore } from "./settings.js";

const TEAM_COLOR = GAME.teams.colors;
const T = GAME.text;
const [UI_RED, UI_BLUE] = GAME.teams.uiText;
const WEAPONS = GAME.weapons;

const css = `
#hud { position: fixed; inset: 0; pointer-events: none; font: 14px/1.4 ui-monospace, "SF Mono", Menlo, monospace; color: #eef; user-select: none; }
#hud .center { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
#xhair i { position: absolute; background: #d8f0ff; box-shadow: 0 0 0 1px #07101b, 0 0 4px #07101b; }
#hud .panel { position: absolute; background: linear-gradient(135deg,rgba(12,22,36,0.90),rgba(8,14,24,0.75)); padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(125,200,255,0.18); box-shadow: 0 4px 16px #0003; }
#hp { left: 24px; bottom: 24px; width: 220px; }
#hpbar { height: 12px; background: #2a2f3a; border-radius: 6px; overflow: hidden; margin-top: 4px; }
#hpfill { height: 100%; width: 100%; background: linear-gradient(90deg,#4caf50,#8bd66f); transition: width 90ms linear; }
#ammo { right: 24px; bottom: 24px; text-align: right; min-width: 130px; }
#ammo .mag { font-size: 30px; font-weight: 700; }
#ammo .res { opacity: 0.65; font-size: 16px; }
#reload { height: 4px; background: #2a2f3a; border-radius: 3px; margin-top: 6px; overflow: hidden; display: none; }
#reloadfill { height: 100%; width: 0%; background: #ffb347; }
#scores { top: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 16px; align-items: center; font-size: 20px; font-weight: 700; }
#scores .r { color: ${UI_RED}; } #scores .b { color: ${UI_BLUE}; }
#mode { position: absolute; top: 56px; left: 50%; transform: translateX(-50%); font-size: 11px; letter-spacing: 2px; opacity: 0.5; }
#streak { position: absolute; top: 120px; left: 50%; transform: translateX(-50%); font-size: 22px; font-weight: 800; letter-spacing: 1px; white-space: nowrap; color: #ffd24a; text-shadow: 0 0 10px rgba(255,170,30,0.65); opacity: 0; transition: opacity 200ms; }
#warmup { position: absolute; top: 120px; left: 50%; transform: translateX(-50%); font-size: 22px; font-weight: 800; letter-spacing: 2px; white-space: nowrap; color: #ffd24a; text-shadow: 0 0 10px rgba(255,170,30,0.65); display: none; }
#lb { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); display: none; font-size: 12px; min-width: 220px; }
#lb table { border-collapse: collapse; width: 100%; }
#lb th, #lb td { padding: 2px 10px; }
#lb th:nth-child(n+3), #lb td:nth-child(n+3) { text-align: right; }
#lb tr.me { color: #ffd24a; font-weight: 700; }
#caps { position: absolute; top: 78px; left: 50%; transform: translateX(-50%); display: none; gap: 10px; padding: 6px 10px; }
#caps .cap { width: 70px; }
#caps .cap .lbl { font-size: 10px; text-align: center; opacity: 0.7; margin-bottom: 2px; }
#caps .cap .bar { position: relative; height: 8px; background: #2a2f3a; border-radius: 4px; overflow: hidden; }
#caps .cap .fill { position: absolute; top: 0; bottom: 0; }
#feed { top: 16px; right: 16px; display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
#feed .k { background: linear-gradient(90deg,#0c1626ed,#0c1626b8); padding: 6px 10px; border-radius: 3px; border-left: 2px solid var(--team); transition: opacity 300ms; animation: feed-in 160ms ease-out; }
@keyframes feed-in { from { transform: translateX(12px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { #feed .k { animation: none; } }
#feed .k .assist { opacity: 0.55; }
#ping { left: 16px; top: 16px; opacity: 0.6; font-size: 12px; }
#hitmarker { opacity: 0; }
#hitmarker.show { opacity: 1; }
#hitmarker i { position: absolute; width: 12px; height: 2px; left: -6px; top: -1px; background: #fff; box-shadow: 0 0 2px #000; }
#hitmarker.head i { background: #ffd24a; box-shadow: 0 0 4px #ffae00; }
#vignette { position: absolute; inset: 0; box-shadow: inset 0 0 90px 20px rgba(235,48,65,0); transition: box-shadow 120ms; }
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
/* Relay HUD pass: readable instrument hierarchy, quiet panels and warm accents. */
#hud{font-family:Arial,"Malgun Gothic",sans-serif;color:#f1f0e8}
#hud .panel{background:linear-gradient(110deg,#10242be8,#10242bba);border:1px solid #c3d3ca25;border-radius:0;box-shadow:none}
#hp{left:28px;bottom:28px;width:190px;padding:12px 15px;border-left:2px solid #e9b567}
#hp .healthValue{font-size:30px;font-weight:700;letter-spacing:-1px;margin-right:9px}
#hp .healthLabel{font-size:10px;letter-spacing:2px;color:#a7c0c4}
#hpbar{height:4px;border-radius:0;margin-top:8px;background:#354b52}
#hpfill{background:#d2ded3}
#ammo{right:28px;bottom:28px;padding:10px 18px;border-right:2px solid #e9b567}
#ammo .mag{font-size:42px;line-height:1;font-variant-numeric:tabular-nums}
#ammo .res{font-size:16px;color:#bdc9c8}
#weaponName{font-size:10px;letter-spacing:3px;color:#edbd74;margin-bottom:9px}
#wbar{bottom:28px;padding:5px 8px!important;border:0!important;background:#10242b80!important}
#wbar .slot{border-radius:0;background:transparent;font-size:10px;letter-spacing:.6px;padding:5px 8px}
#wbar .slot.active{background:#dcae64;color:#132932;box-shadow:none}
#wbar .nades{background:transparent;font-size:10px}
#scores{top:28px;gap:22px;padding:9px 22px;font-variant-numeric:tabular-nums}
#mode{top:79px;opacity:.9;color:#dce6df;text-shadow:0 1px 3px #000;font-size:10px}
#ping{top:194px;left:28px;font-size:10px;letter-spacing:1px;background:#10242bd9}
#lb{background:#10242bdd;border-top:2px solid #edb467;padding:8px;top:28px}
#feed{top:28px;right:28px;font-size:12px}
#overlay{background:linear-gradient(0deg,#06151bc9,transparent 70%);text-shadow:0 2px 12px #000;justify-content:flex-end;padding-bottom:155px;box-sizing:border-box}
#overlay h1{font-size:25px;letter-spacing:5px}
#overlay .hint{font-size:11px;letter-spacing:1px}
@media(max-width:800px){#tacticalMap{transform:scale(.75);transform-origin:top left}#ping{top:155px}#wbar{bottom:115px}#hp{width:150px}#scores{left:auto;right:28px;transform:none}#mode{left:auto;right:28px;transform:none}}
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
  private readonly hpValue: HTMLElement;
  private readonly weaponName: HTMLElement;
  private readonly ammoMag: HTMLElement;
  private readonly ammoRes: HTMLElement;
  private readonly reload: HTMLElement;
  private readonly reloadFill: HTMLElement;
  private readonly scoreR: HTMLElement;
  private readonly scoreB: HTMLElement;
  private readonly scoresPanel: HTMLElement;
  private readonly modeLabel: HTMLElement;
  private readonly streak: HTMLElement;
  private readonly warmup: HTMLElement;
  private readonly lb: HTMLElement;
  private readonly lbBody: HTMLElement;
  private readonly caps: HTMLElement;
  private readonly capFills: HTMLElement[];
  private readonly feed: HTMLElement;
  private readonly ping: HTMLElement;
  private readonly xhair: HTMLElement[];
  private readonly hitmarker: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly wslots: HTMLElement[];
  private readonly nadeCount: HTMLElement;
  private readonly settings: SettingsStore;

  private reloadStart = -1;
  private reloadMs = 0;
  private hitAt = -1e9;
  private vignetteAt = -1e9;
  private streakAt = -1e9;
  private readonly kills: KillRow[] = [];
  /** Live restart-vote tally shown on the match-end overlay; -1 = no vote yet (show the hint instead). */
  private voteCount = -1;
  private voteNeed = 0;

  /** `settings` drives the click-to-play overlay's controls hint, which is
   *  filled in from the player's live keybindings on every `showLockPrompt`
   *  call rather than baked in once. */
  constructor(settings: SettingsStore, container: HTMLElement = document.body) {
    this.settings = settings;
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
    this.hpValue = el("span", undefined, "100"); this.hpValue.className = "healthValue";
    const healthLabel = el("span", undefined, "VITALS"); healthLabel.className = "healthLabel";
    hp.append(this.hpValue, healthLabel);
    const hpbar = el("div", "hpbar");
    this.hpFill = el("div", "hpfill");
    hpbar.appendChild(this.hpFill); hp.appendChild(hpbar);
    this.root.appendChild(hp);

    // Ammo.
    const ammo = el("div", "ammo"); ammo.className = "panel";
    this.weaponName = el("div", "weaponName", "AR / AUTO"); ammo.appendChild(this.weaponName);
    this.ammoMag = el("span", undefined, "30"); this.ammoMag.className = "mag";
    this.ammoRes = el("span", undefined, " / 90"); this.ammoRes.className = "res";
    const ammoLine = el("div"); ammoLine.append(this.ammoMag, this.ammoRes);
    this.reload = el("div", "reload"); this.reloadFill = el("div", "reloadfill");
    this.reload.appendChild(this.reloadFill);
    ammo.append(ammoLine, this.reload);
    this.root.appendChild(ammo);

    // Scores.
    this.scoresPanel = el("div", "scores"); this.scoresPanel.className = "panel";
    this.scoreR = el("span", undefined, "0"); this.scoreR.className = "r";
    this.scoreB = el("span", undefined, "0"); this.scoreB.className = "b";
    this.scoresPanel.append(this.scoreR, el("span", undefined, T.hud.vs), this.scoreB);
    this.root.appendChild(this.scoresPanel);

    // Mode label.
    this.modeLabel = el("div", "mode");
    this.root.appendChild(this.modeLabel);

    // Killstreak banner (transient; decayed in update()).
    this.streak = el("div", "streak");
    this.root.appendChild(this.streak);

    // Warmup banner (static; toggled on/off by setWarmup, no decay).
    this.warmup = el("div", "warmup", T.hud.warmup);
    this.root.appendChild(this.warmup);

    // FFA leaderboard (toggled with #scores by setMode).
    this.lb = el("div", "lb");
    const lbTable = el("table");
    lbTable.appendChild(el("thead", undefined, "<tr><th>#</th><th>name</th><th>K</th><th>D</th></tr>"));
    this.lbBody = el("tbody");
    lbTable.appendChild(this.lbBody);
    this.lb.appendChild(lbTable);
    this.root.appendChild(this.lb);

    // DOM capture-point gauges (mode-gated by main.ts via setCaps/hideCaps).
    this.caps = el("div", "caps");
    this.capFills = ["A", "B", "C"].map((label) => {
      const cap = el("div"); cap.className = "cap";
      const lbl = el("div", undefined, label); lbl.className = "lbl";
      const bar = el("div"); bar.className = "bar";
      const fill = el("div"); fill.className = "fill";
      bar.appendChild(fill);
      cap.append(lbl, bar);
      this.caps.appendChild(cap);
      return fill;
    });
    this.root.appendChild(this.caps);

    // Weapon bar (bottom-center): one slot per WEAPONS entry, plus a grenade badge.
    const wbar = el("div", "wbar"); wbar.className = "panel";
    this.wslots = WEAPONS.map((w, i) => {
      const slot = el("div", undefined, `<span class="num">${i + 1}</span>${esc(w.name)}`);
      slot.className = "slot";
      wbar.appendChild(slot);
      return slot;
    });
    this.nadeCount = el("div", undefined, `${T.nadeIcon} 0`);
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
    this.hpValue.textContent = String(Math.max(0, Math.ceil(hp)));
    const pct = Math.max(0, Math.min(100, hp));
    this.hpFill.style.width = `${pct}%`;
    this.hpFill.style.background = pct > 50 ? "#d2ded3"
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
    this.weaponName.textContent = WEAPONS[index]?.name.toUpperCase() ?? "WEAPON";
    this.wslots.forEach((s, i) => s.classList.toggle("active", i === index));
  }

  /** Update the carried grenade count badge. */
  setNades(n: number): void {
    this.nadeCount.innerHTML = `${T.nadeIcon} ${n}`;
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

  addKill(killer: string, victim: string, part: string, killerTeam: number | null, assistName?: string): void {
    const color = killerTeam === 0 || killerTeam === 1 ? `#${TEAM_COLOR[killerTeam].toString(16)}` : "#eee";
    const icon = part === "head" ? T.killfeedIcons.head : part === "blast" ? T.killfeedIcons.blast : T.killfeedIcons.body;
    const assist = assistName ? ` <span class="assist">(+assist ${esc(assistName)})</span>` : "";
    const node = el("div"); node.className = "k";
    node.style.setProperty("--team", color);
    node.innerHTML = `<b style="color:${color}">${esc(killer)}</b>${icon}${esc(victim)}${assist}`;
    this.feed.appendChild(node);
    this.kills.push({ node, born: performance.now() });
    while (this.kills.length > 5) {
      const old = this.kills.shift()!;
      old.node.remove();
    }
  }

  /** Uppercased active-mode label; also toggles the leaderboard vs team scores
   *  for a teamless mode (FFA, practice — see modes.ts's isTeamless). */
  setMode(modeIndex: number): void {
    const id = MODE_ORDER[modeIndex];
    this.modeLabel.textContent = id?.toUpperCase() ?? "";
    const teamless = id !== undefined && isTeamless(id);
    this.lb.style.display = id === "ffa" ? "block" : "none";
    this.scoresPanel.style.display = teamless ? "none" : "flex";
  }

  /** Transient center-top killstreak banner, decayed in update(). */
  showStreak(who: string, count: number): void {
    this.streak.textContent = fmt(T.hud.streakFmt, { who: who.toUpperCase(), count });
    this.streak.style.opacity = "1";
    this.streakAt = performance.now();
  }

  /** Static top-center "WARMUP" banner; visible only while phase==="warmup" (no decay). */
  setWarmup(active: boolean): void {
    this.warmup.style.display = active ? "block" : "none";
  }

  /** Live restart-vote tally, pushed from the "vote" broadcast. Read by showMatchEnd. */
  setVoteStatus(count: number, need: number): void {
    this.voteCount = count;
    this.voteNeed = need;
  }

  /** Re-arm the vote hint for the next match-end (call once a new match starts). */
  resetVoteStatus(): void {
    this.voteCount = -1;
    this.voteNeed = 0;
  }

  /** DOM capture-gauge bars (mode===2 only); a/b/c are 0..200, 100 = neutral. */
  setCaps(a: number, b: number, c: number): void {
    this.caps.style.display = "flex";
    [a, b, c].forEach((v, i) => this.renderCap(this.capFills[i]!, v));
  }

  hideCaps(): void {
    this.caps.style.display = "none";
  }

  private renderCap(fill: HTMLElement, value: number): void {
    const pct = (value - 100) / 100; // -1 (fully blue) .. 0 (neutral) .. 1 (fully red)
    if (pct >= 0) {
      fill.style.left = "50%";
      fill.style.right = "";
      fill.style.width = `${pct * 50}%`;
      fill.style.background = `#${TEAM_COLOR[0].toString(16)}`;
    } else {
      fill.style.left = "";
      fill.style.right = "50%";
      fill.style.width = `${-pct * 50}%`;
      fill.style.background = `#${TEAM_COLOR[1].toString(16)}`;
    }
  }

  /** Compact top-center k/d table (mode===1 only, toggled by setMode). */
  setLeaderboard(rows: { name: string; k: number; d: number; isMe: boolean }[]): void {
    this.lbBody.innerHTML = rows
      .map((r, i) => `<tr class="${r.isMe ? "me" : ""}"><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.k}</td><td>${r.d}</td></tr>`)
      .join("");
  }

  showHitmarker(head: boolean): void {
    this.hitmarker.className = `center show${head ? " head" : ""}`;
    this.hitAt = performance.now();
  }

  flashDamage(): void {
    this.vignetteAt = performance.now();
    this.vignette.style.boxShadow = "inset 0 0 90px 20px rgba(235,48,65,0.65)";
  }

  setPing(ms: number): void {
    this.ping.textContent = `${this.fps} fps · ${Math.round(ms)} ms`;
  }

  private fps = 0;

  /** Render frame rate, shown in the top-left panel next to the ping. */
  setFps(n: number): void {
    this.fps = Math.round(n);
  }

  /** Fills `T.controlsHintFmt`'s `{move}/{sprint}/{crouch}/{jump}/{reload}`
   *  placeholders from the player's current keybindings (client/settings.ts),
   *  so a rebind in the settings panel shows up here immediately. Digit1-5,
   *  mouse buttons, and the M mute toggle are fixed (never rebindable — see
   *  client/settings.ts's `BindAction` doc comment), so "LMB fire" and
   *  "M mute" stay literal in the template itself. */
  private controlsHintText(): string {
    const { binds } = this.settings.get();
    const keyOf = (a: BindAction): string => (binds[a][0] ? formatKeyLabel(binds[a][0]!) : "—");
    return fmt(T.controlsHintFmt, {
      move: `${keyOf("forward")}${keyOf("left")}${keyOf("back")}${keyOf("right")}`,
      sprint: formatBinding(binds.sprint),
      crouch: formatBinding(binds.crouch),
      jump: formatBinding(binds.jump),
      reload: formatBinding(binds.reload),
    });
  }

  /** The click-to-play / ESC prompt. */
  showLockPrompt(show: boolean, text = T.hud.clickToPlay): void {
    if (show) {
      this.overlay.style.display = "flex";
      this.overlay.innerHTML = `<h1>${T.hud.gameTitle}</h1><p>${text}</p><p class="hint">${this.controlsHintText()}</p>`;
    } else {
      this.overlay.style.display = "none";
    }
  }

  /** Death overlay with a live respawn countdown (seconds). */
  showDeath(secondsLeft: number, killerName?: string): void {
    this.overlay.style.display = "flex";
    const sub = killerName ? `<p>${fmt(T.hud.eliminatedByFmt, { killer: esc(killerName) })}</p>` : "";
    const line = secondsLeft > 0
      ? `<p>${fmt(T.hud.respawnInFmt, { s: secondsLeft.toFixed(1) })}</p>`
      : `<p>${T.hud.respawningNow}</p>`;
    this.overlay.innerHTML = `<h1 style="color:#e05a4a">${T.hud.eliminated}</h1>${sub}${line}`;
  }

  /**
   * `winner` is a display label, already resolved by the caller (main.ts) — the raw
   * "red"/"blue"/"draw" wire value for team modes, or a player name via name(id) for
   * a teamless mode (`teamless` — FFA, practice), which renders in a neutral color
   * instead of the team colors. (Practice never actually reaches "ended" — its
   * match never ends — so this path is unreachable there in practice.)
   */
  showMatchEnd(winner: string, red: number, blue: number, myKills: number, myDeaths: number, teamless: boolean): void {
    this.overlay.style.display = "flex";
    // "draw" is checked before teamless so an FFA no-score timeout renders "DRAW"
    // in neutral color, matching team-mode draw rendering, instead of "draw WINS".
    const title = winner === "draw"
      ? T.hud.draw
      : fmt(T.hud.winsFmt, { winner: teamless ? esc(winner) : winner.toUpperCase() });
    const color = teamless ? "#eee" : winner === "red" ? UI_RED : winner === "blue" ? UI_BLUE : "#eee";
    const scoreLine = teamless ? "" : `<p><span style="color:${UI_RED}">RED ${red}</span> — <span style="color:${UI_BLUE}">BLUE ${blue}</span></p>`;
    const voteLine = this.voteCount >= 0
      ? `<p class="hint">${fmt(T.hud.restartVotesFmt, { count: this.voteCount, need: this.voteNeed })}</p>`
      : `<p class="hint">${T.hud.voteHint}</p>`;
    this.overlay.innerHTML = `<h1 style="color:${color}">${title}</h1>${scoreLine}`
      + `<p>${fmt(T.hud.yourScoreFmt, { k: myKills, d: myDeaths })}</p>${voteLine}`;
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
    if (now - this.vignetteAt > 60) this.vignette.style.boxShadow = "inset 0 0 90px 20px rgba(235,48,65,0)";
    if (now - this.streakAt > 1800) this.streak.style.opacity = "0";
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

/** Fill a `{key}` template (GAME.text.hud's *Fmt strings) from `vars`. */
function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
