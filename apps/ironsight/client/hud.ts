/**
 * DOM HUD overlay: crosshair (spread-reactive), HP, ammo + reload, killfeed, team
 * scores, damage vignette, hitmarker, pointer-lock prompt, death/respawn overlay,
 * and the match-end scoreboard. Pure presentation driven by `main.ts`; all layout
 * is injected here so `index.html` stays a bare mount point.
 */
import { MODE_ORDER, isTeamless } from "../src/modes.js";
import { combatBotLabel, readSquadPing, SQUAD_BARKS, type SquadBark } from '../src/bots.js';
import { GAME } from "../src/game-config.js";
import { damageDirection } from './damage-direction.js';
import { ConnectionQuality, DELAY_LABELS } from './connection-quality.js';
import { DeploymentBanner } from './deployment-banner.js';
import { honorsCss, honorsMarkup, type PresentedMvp } from './round-honors.js';
import { intermissionLabel } from './intermission.js';
import { formatKeyLabel, formatBinding, type BindAction, type SettingsStore } from "./settings.js";

const TEAM_COLOR = GAME.teams.colors;
const T = GAME.text;
const [UI_RED, UI_BLUE] = GAME.teams.uiText;
const WEAPONS = GAME.weapons;

export interface ResultRoster {
  rows: { name: string; k: number; d: number; team: number; isMe: boolean }[];
  won: boolean;
  mvp?: PresentedMvp;
  dom?: boolean;
  intermissionEndMs?: number;
  serverNow?: number;
}

import { matchBrief } from "./match-presentation.js";
import type { ArenaState } from "../src/schema.js";
import type { CompositorFrame } from './compositor-preparation.js';

const css = `
#hud { position: fixed; inset: 0; pointer-events: none; font: 14px/1.4 ui-monospace, "SF Mono", Menlo, monospace; color: #eef; user-select: none; }
#squadRadio { position:absolute;left:28px;bottom:244px;max-width:280px;padding:8px 10px;border-left:2px solid #a9b8a0;background:#19201ded;color:#e2e4d6;font:11px/1.5 Arial,sans-serif;white-space:pre-line;opacity:0;pointer-events:none; }
@media(max-width:800px){#squadRadio{left:16px;bottom:294px;max-width:230px}}
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
#feed { position:absolute; top: 16px; right: 16px; display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
#feed .k{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:center;width:340px;max-width:calc(100vw - 80px);box-sizing:border-box;background:linear-gradient(100deg,#10242bf2,#10242bda);padding:9px 12px;border-left:2px solid var(--team);animation:feed-in 160ms ease-out}
#feed .k.local{border-left-color:#edaa52;background:linear-gradient(100deg,#473923f5,#10242bf2)}
#feed .k.victim{border-left-color:#e78879}
#feed .name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
#feed .target{text-align:right}
#feed .cause{text-align:center;color:#bbc9c8;font-size:9px;letter-spacing:1px}
#feed .cause strong{display:block;color:#f1f0e8;font-size:10px;letter-spacing:.5px}
#feed .assist{grid-column:1/-1;font-size:10px;color:#9eb9bd;border-top:1px solid #ffffff12;padding-top:4px}
#feed .tag{font-size:9px;color:#edaa52;margin-right:5px}
#elimination{position:absolute;top:calc(50% + 76px);left:50%;transform:translateX(-50%);width:280px;max-width:80vw;padding:10px 18px;border-top:1px solid #edaa5270;background:linear-gradient(90deg,#10242b00,#10242be8 20%,#10242be8 80%,#10242b00);text-align:center;opacity:0;text-shadow:0 2px 4px #07151b}
#elimination .confirm{font-size:10px;letter-spacing:2px;color:#edaa52}
#elimination .confirm.ambush{font-size:14px;font-weight:700;letter-spacing:4px;color:#91e1d5}
#elimination .target{display:block;font-size:18px;font-weight:600;margin:4px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#elimination .detail{font-size:10px;letter-spacing:1px;color:#cfdfdf}
@keyframes feed-in{from{transform:translateX(10px);opacity:0}to{transform:translateX(0);opacity:1}}
#hud[data-reduced-motion="true"] #feed .k{animation:none}
@media(prefers-reduced-motion:reduce){#feed .k{animation:none}}
#ping { left: 16px; top: 16px; opacity: 0.6; font-size: 12px; }
#hitmarker { opacity: 0; }
#hitmarker.show { opacity: 1; }
#hitmarker i { position: absolute; width: 12px; height: 2px; left: -6px; top: -1px; background: #fff; box-shadow: 0 0 2px #000; }
#hitmarker.head i { background: #ffd24a; box-shadow: 0 0 4px #ffae00; }
#vignette { position:absolute; inset:0; box-sizing:border-box; border:128px solid transparent; border-image:url('/assets/ui/damage-vignette.png') 128 fill stretch; opacity:0; transition:opacity 120ms; }
#damage-flash { position:absolute; inset:0; background:rgba(235,48,65,.055); opacity:0; }
#damage-direction { position:absolute; left:50%; top:50%; width:clamp(180px,30vmin,320px); height:clamp(180px,30vmin,320px); transform:translate(-50%,-50%); opacity:0; }
/* Keep these fixed damage surfaces eligible for compositing between hits.
   Promoting only the death overlay leaves the same layer churn on damage. */
#vignette, #damage-flash, #damage-direction { will-change:opacity; }
#damage-direction .damage-mark { position:absolute; left:50%; top:0; transform:translateX(-50%); color:#ffb69e; text-align:center; font-size:10px; font-weight:800; letter-spacing:2px; text-shadow:0 1px 3px #000,0 0 4px #000; }
#damage-direction .damage-mark::before { content:''; display:block; margin:0 auto 5px; width:44px; height:7px; background:#ffb69e; border:1px solid #57242a; clip-path:polygon(0 0,100% 0,80% 100%,20% 100%); }
#damage-direction[data-direction="back"] { top:max(76%,calc(50% + 184px)); height:0; }
#damage-direction[data-direction="back"] .damage-mark::before { transform:rotate(180deg); }
#damage-direction[data-direction="right"] .damage-mark { left:100%; top:50%; transform:translate(-50%,-50%); }
#damage-direction[data-direction="right"] .damage-mark::before { transform:rotate(90deg); width:28px; margin-bottom:12px; }
#damage-direction[data-direction="left"] .damage-mark { left:0; top:50%; transform:translate(-50%,-50%); }
#damage-direction[data-direction="left"] .damage-mark::before { transform:rotate(-90deg); width:28px; margin-bottom:12px; }
#hud[data-reduced-motion="true"] #damage-flash { display:none; }
#hud[data-reduced-motion="true"] #vignette { transition:none; }
@media(prefers-reduced-motion:reduce){#damage-flash{display:none}#vignette{transition:none}}
/* pointer-events:none so a click passes through to the canvas (which requests
   pointer lock) — the prompt is informational, not a button. */
#overlay { position: absolute; inset: 0; display: flex; opacity: 0; will-change: opacity; align-items: center; justify-content: center; flex-direction: column; background: rgba(6,8,12,0.5); text-align: center; pointer-events: none; }
#overlay h1 { font-size: 34px; margin: 0 0 8px; letter-spacing: 2px; }
#overlay p { margin: 4px; opacity: 0.85; }
#overlay .hint { margin-top: 18px; font-size: 13px; opacity: 0.6; }
#wbar { left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; gap: 6px; align-items: center; }
#wbar .slot { padding: 4px 10px; border-radius: 6px; background: rgba(10,13,18,0.55); opacity: 0.5; font-size: 12px; white-space: nowrap; }
#wbar .slot .num { opacity: 0.6; margin-right: 4px; }
#wbar .slot.active { opacity: 1; background: rgba(70,130,220,0.65); box-shadow: 0 0 0 1px #9cc4ff; }
#wbar .nades { padding: 4px 10px; border-radius: 6px; background: rgba(10,13,18,0.55); font-size: 12px; }
/* Relay HUD pass: readable instrument hierarchy, quiet panels and warm accents. */
#matchBrief{position:absolute;top:96px;left:50%;transform:translateX(-50%);text-align:center;font-size:11px;letter-spacing:1px;text-shadow:0 2px 4px #000;width:min(90vw,620px)}
#matchBrief strong{display:block;font-size:17px;font-variant-numeric:tabular-nums;margin-bottom:5px}
#matchBrief .urgent{color:#edaa52}
#hud #caps{top:155px;background:#10242bd9}
#hud #warmup{display:none!important}
#hud #streak{top:220px}
#overlay[data-kind="end"],#overlay[data-kind="connection"]{pointer-events:auto;justify-content:center;padding:24px;background:#08191ff0;z-index:10}
#overlay .result{width:min(640px,90vw);border-top:3px solid #edaa52;background:#152b32;padding:32px;box-sizing:border-box}
#overlay .eyebrow{color:#edaa52;font-size:11px;letter-spacing:3px;margin-bottom:20px}
#overlay .resultStats{display:flex;justify-content:center;gap:42px;margin:26px 0;font-size:13px}
#overlay .resultStats strong{display:block;font-size:38px}
#overlay button{pointer-events:auto;background:#edaa52;color:#10242b;border:1px solid #edaa52;font:700 13px Arial;padding:14px 22px;margin:8px;cursor:pointer}
#overlay button.secondary{background:transparent;color:#e2e9e6;border-color:#829c9d}
#overlay button:focus-visible{outline:3px solid #fff;outline-offset:3px}
#overlay button:disabled{opacity:.6;cursor:default}
#overlay .briefing{max-width:540px;margin:16px;padding:14px;border-left:2px solid #edaa52;background:#10242bdb;font-size:13px}
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
#hud #ping{top:194px;left:28px;opacity:1;font-size:10px;line-height:12px;letter-spacing:.7px;background:#10242bf2;padding:6px 10px;border-left:2px solid #64c7cc}
#ping strong,#ping span{display:block}#ping strong{font-size:10px;color:#bce6df}#ping span{color:#bdd0ce;font-size:9px;letter-spacing:.4px}
#hud #ping[data-quality="delayed"],#hud #ping[data-quality="high"],#hud #ping[data-quality="offline"]{border-left-color:#edaa52}
#ping[data-quality="delayed"] strong,#ping[data-quality="high"] strong,#ping[data-quality="offline"] strong{color:#ffd097}
@media(max-width:800px),(max-height:650px){#hud #ping{top:155px;left:16px}#tacticalMap{transform:scale(.75);transform-origin:top left}}
#lb{background:#10242bdd;border-top:2px solid #edb467;padding:8px;top:28px}
#hud #lb{top:245px;left:28px;transform:none;min-width:180px}
#feed{top:28px;right:28px;font-size:12px}
#overlay{background:linear-gradient(0deg,#06151bc9,transparent 70%);text-shadow:0 2px 12px #000;justify-content:flex-end;padding-bottom:155px;box-sizing:border-box}
#overlay h1{font-size:25px;letter-spacing:5px}
#overlay .hint{font-size:11px;letter-spacing:1px}
@media(max-width:800px){#tacticalMap{transform:scale(.75);transform-origin:top left}#ping{top:155px}#wbar{bottom:115px}#hp{width:150px}#scores{left:auto;right:28px;transform:none}#mode{left:auto;right:28px;transform:none}}
@media(max-width:800px){#matchBrief{top:202px}#hud #caps{top:270px}#hud #lb{top:290px}#hud #feed{top:96px;width:260px;max-height:96px;overflow:hidden}#hud #feed .k{width:260px;padding:6px 9px;gap:5px}#hud #streak{top:310px}}
/* Round debrief: outcome first, personal contribution, then the seated roster. */
#overlay[data-kind="end"]{padding:24px;overflow:auto;justify-content:flex-start;background:linear-gradient(120deg,#08191f,#142e35);text-shadow:none}
#overlay .debrief{box-sizing:border-box;flex-shrink:0;width:min(960px,100%);margin:auto;border-top:3px solid var(--result-accent);background:linear-gradient(125deg,#1d363e,#10262d);padding:28px 32px;text-align:left;box-shadow:0 18px 70px #0005}
#overlay .debrief .eyebrow{margin:0 0 12px;color:#a9c0c2;letter-spacing:3px}
#overlay .resultHeader{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid #c3d3ca30;padding-bottom:22px}
#overlay .debrief h1{font-size:44px;letter-spacing:4px;color:var(--result-accent);margin:0 0 5px;overflow-wrap:anywhere}
#overlay .resultWinner{color:#d0dddb;font-size:12px;letter-spacing:1px;overflow-wrap:anywhere}
#overlay .finalScore{display:flex;gap:22px;text-align:center;align-items:center;font-variant-numeric:tabular-nums}
#overlay .finalScore strong{display:block;font-size:38px;line-height:1.2}
#overlay .finalScore span{font-size:10px;letter-spacing:2px;white-space:nowrap}
#overlay .finalScore .divider{color:#9eb4b5;font-size:20px}
#overlay .personalStats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;padding:20px 0;border-bottom:1px solid #c3d3ca30}
#overlay .personalStats strong{display:block;font-size:30px;line-height:1.2;font-variant-numeric:tabular-nums}
#overlay .personalStats span{font-size:10px;letter-spacing:1.5px;color:#b8cccc}
#overlay .rosters{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:22px 0}
#overlay .rosters.solo{grid-template-columns:1fr}
#overlay .roster{min-width:0}
#overlay .roster h2{font-size:11px;letter-spacing:2px;margin:0 0 10px;color:var(--team)}
#overlay .roster table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;font-variant-numeric:tabular-nums}
#overlay .roster th{color:#b8cccc;font-size:10px;letter-spacing:1px;font-weight:400}
#overlay .roster th,#overlay .roster td{padding:8px 6px;border-bottom:1px solid #c3d3ca16;text-align:right}
#overlay .roster th:first-child,#overlay .roster td:first-child{width:24px;text-align:left;color:#9db4b7}
#overlay .roster th:nth-child(2),#overlay .roster td:nth-child(2){width:auto;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#overlay .roster th:nth-child(n+3){width:36px}
#overlay .roster tr.me{background:#edaa521b;box-shadow:inset 2px 0 #edaa52;color:#ffe0aa}
#overlay .youTag{font-size:9px;color:#edaa52;margin-right:6px}
#overlay .resultFooter{display:flex;justify-content:space-between;align-items:center;gap:18px;border-top:1px solid #c3d3ca30;padding-top:18px}
#overlay .resultFooter p{font-size:12px;margin:0 0 5px;opacity:1;color:#d2e0dc}
#overlay .resultFooter .hint{font-size:10px;letter-spacing:.3px;color:#a6bfc1;margin:0;max-width:290px}
#overlay .resultActions{display:flex;flex-wrap:wrap;gap:8px;flex-shrink:0}
#overlay .resultActions button{margin:0;padding:13px 16px;font-size:11px}
@media(max-width:800px){#overlay[data-kind="end"]{padding:16px}#overlay .debrief{padding:22px}#overlay .debrief h1{font-size:32px}#overlay .resultFooter{align-items:flex-start;flex-direction:column}#overlay .rosters{gap:16px}}
@media(max-width:540px){#overlay .debrief{padding:18px}#overlay .resultHeader{align-items:flex-start;flex-direction:column;gap:14px}#overlay .rosters{grid-template-columns:1fr}#overlay .personalStats{gap:8px}#overlay .personalStats span{font-size:9px;letter-spacing:.5px}#overlay .resultActions{flex-shrink:1}#overlay .debrief h1{font-size:28px}}
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
  private leaderboardMarkup = '';
  private readonly caps: HTMLElement;
  private readonly capFills: HTMLElement[];
  private readonly feed: HTMLElement;
  private readonly elimination = el('div', 'elimination');
  private eliminationAt = -1e9;
  private readonly ping: HTMLElement;
  private readonly squadRadio = document.createElement('div');
  private radioUntil = 0;
  private radioVisible = false;
  private lastRadioKey = '';
  private readonly xhair: HTMLElement[];
  private readonly hitmarker: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly damageFlash: HTMLElement;
  private readonly damageIndicator: HTMLElement;
  private damageBearing: number | null = null;
  private damageAt = -1e9;
  private readonly overlay: HTMLElement;
  private readonly wslots: HTMLElement[];
  private readonly nadeCount: HTMLElement;
  private lastNades = NaN;
  private lastHp = NaN;
  private lastMode = NaN;
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
  private voteSent = false;
  private overlayMarkup = "";
  private overlayVisible = false;
  private briefText = "";
  private deployment?: DeploymentBanner;
  setDeploymentSite(site: string): void { this.deployment ??= new DeploymentBanner(this.root, site); }
  updateDeployment(state: ArenaState, now: number, myId: string, active: boolean) {
    return this.deployment?.update(state, now, myId, active);
  }
  private trainingHelp = '';
  private readonly muteBadge = el('div', 'audioMuted', 'AUDIO MUTED · M / SETTINGS');
  setMuted(muted: boolean): void { this.muteBadge.hidden = !muted; }
  setTrainingSite(hasTargets: boolean, hasObjective = false): void {
    this.trainingHelp = hasTargets ? 'Passive targets stand in West Service. Try all five weapons (1–5), then reload.'
      : hasObjective ? 'Follow the training card to rehearse holding A for Domination. No targets or scoring here.'
      : 'Map exploration: no targets here. Choose Relay training for target practice.';
  }
  private readonly brief = el("div", "matchBrief");
  private restart: () => void = () => {};
  private leave: () => void = () => {};

  setMatchActions(restart: () => void, leave: () => void): void { this.restart = restart; this.leave = leave; }
  markVoteSent(): void { this.voteSent = true; }
  setMatchContext(state: ArenaState, serverNow: number, myId: string): void {
    const b = matchBrief(state, serverNow, myId);
    this.briefText = b.objective;
    const markup = `<strong class="${b.urgent ? 'urgent' : ''}">${b.clock}</strong>${b.affiliation} · ${b.objective}`;
    if (this.brief.innerHTML !== markup) this.brief.innerHTML = markup;
  }
  private present(kind: string, markup: string): void {
    const enteringEnd = kind === 'end' && (this.overlay.dataset.kind !== 'end' || !this.overlayVisible);
    if (!this.overlayVisible) {
      this.overlayVisible = true;
      this.overlay.style.opacity = '1';
      this.overlay.inert = false;
      this.overlay.removeAttribute('aria-hidden');
    }
    this.overlay.dataset.kind = kind;
    // Keep focused buttons alive between frames and vote broadcasts.
    if (this.overlayMarkup === markup) return;
    const focused = document.activeElement?.getAttribute('data-action');
    const scrollTop = this.overlay.scrollTop;
    this.overlayMarkup = markup;
    this.overlay.dataset.honorsEnter = String(enteringEnd);
    this.overlay.innerHTML = markup;
    const focusTarget = focused ? this.overlay.querySelector<HTMLButtonElement>(`[data-action="${focused}"]:not(:disabled)`)
      ?? this.overlay.querySelector<HTMLButtonElement>('[data-action="leave"]')
      : enteringEnd ? this.overlay.querySelector<HTMLButtonElement>('[data-action="restart"]') : null;
    focusTarget?.focus({ preventScroll: true });
    this.overlay.scrollTop = scrollTop;
  }
  showConnection(expired: boolean): void {
    this.clearDamage();
    this.present('connection', `<div class="result"><div class="eyebrow">CONNECTION / 연결</div><h1>${expired ? 'CONNECTION LOST' : 'RECONNECTING'}</h1><p>${expired ? 'Return to deployment to join a new room.' : 'Waiting for the room. Your operator remains in the match.'}</p><button class="secondary" data-action="leave">DEPLOYMENT / 메뉴</button></div>`);
  }

  /** `settings` drives the click-to-play overlay's controls hint, which is
   *  filled in from the player's live keybindings on every `showLockPrompt`
   *  call rather than baked in once. */
  constructor(settings: SettingsStore, container: HTMLElement = document.body, installStyles = true) {
    this.settings = settings;
    const style = el("style");
    style.textContent = css + honorsCss;
    if (installStyles) document.head.appendChild(style);

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
    this.feed.setAttribute('aria-label', 'Combat feed');
    this.elimination.setAttribute('role', 'status');
    this.elimination.setAttribute('aria-live', 'polite');
    this.elimination.setAttribute('aria-atomic', 'true');
    this.root.appendChild(this.elimination);
    this.ping = el("div", "ping"); this.ping.className = "panel";
    this.delayLabel.setAttribute('role', 'status');
    this.delayLabel.setAttribute('aria-live', 'polite');
    this.ping.append(this.delayLabel, this.delayNumbers);
    this.setPing(0);
    this.root.appendChild(this.ping);
    this.squadRadio.id = 'squadRadio';
    this.squadRadio.setAttribute('role', 'status');
    this.squadRadio.setAttribute('aria-hidden', 'true');
    this.root.appendChild(this.squadRadio);
    this.vignette = el("div", "vignette"); this.root.appendChild(this.vignette);
    this.damageFlash = el('div', 'damage-flash'); this.root.appendChild(this.damageFlash);
    this.damageIndicator = el('div', 'damage-direction');
    this.damageIndicator.setAttribute('aria-hidden', 'true');
    this.damageIndicator.innerHTML = '<span class="damage-mark"></span>';
    this.root.appendChild(this.damageIndicator);
    this.overlay = el("div", "overlay"); this.overlay.inert = true;
    this.overlay.setAttribute('aria-hidden', 'true'); this.root.appendChild(this.overlay);

    this.root.appendChild(this.brief);
    this.muteBadge.style.cssText = 'position:absolute;left:28px;top:230px;color:#edaa52;background:#10242bcc;padding:6px 10px;font:11px Arial';
    this.muteBadge.hidden = true; this.root.appendChild(this.muteBadge);
    this.overlay.addEventListener('click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'restart') this.restart();
      if (action === 'leave') this.leave();
    });
    container.appendChild(this.root);
    this.setSpread(0);
  }

  /** Detached presentation copies use the same methods/markup as real events.
   * Never touches live HP, timers, feed, focus, settings, sounds or room state. */
  compositorFrames(): CompositorFrame[] {
    const container = document.createElement('div'); container.inert = true;
    const sample = new Hud(this.settings, container, false);
    const frames: CompositorFrame[] = [];
    const save = (name: string) => frames.push({ name, node: sample.root.cloneNode(true) as HTMLElement });
    sample.setHp(40); sample.setAmmo(12, 60, 1500); sample.setCaps(150, 50, 100);
    sample.setMode(1);
    sample.setLeaderboard([{ name: 'OPERATOR', k: 2, d: 1, isMe: true }]);
    sample.addKill('OPERATOR', 'SCOUT', 'head', 0, 'ANCHOR', { weapon: 1, localKill: true });
    sample.addKill('SCOUT', 'OPERATOR', 'body', 1, undefined, { weapon: 4, localVictim: true });
    sample.showStreak('OPERATOR', 3);
    sample.presentSquadRadio('bot-9', 'suppress', performance.now() + 3000);
    for (const [index, direction] of ['front', 'right', 'back', 'left'].entries()) {
      sample.showDamageDirection(index * Math.PI / 2);
      sample.update(performance.now());
      sample.showHitmarker(index % 2 === 0);
      save(`combat-${direction}`);
    }
    sample.clearDamage(); sample.hideCaps();
    sample.showDeath(3, 'SCOUT'); save('death');
    const roster: ResultRoster = {
      won: true, dom: true, serverNow: 1000, intermissionEndMs: 21000,
      rows: Array.from({ length: 12 }, (_, i) => ({ name: `OPERATOR ${i + 1}`, k: 12 - i, d: i, team: i % 2, isMe: i === 0 })),
      mvp: { id: 'preparation', name: 'OPERATOR', isMe: true, team: 0, kills: 12, assists: 4, captureSeconds: 20, score: 48 },
    };
    sample.showMatchEnd('red', 50, 42, 12, 4, false, roster); save('results-team');
    sample.hideOverlay();
    sample.showMatchEnd('OPERATOR', 12, 0, 12, 4, true, { ...roster, dom: false }); save('results-solo');
    sample.showConnection(true); save('connection');
    return frames;
  }

  setHp(hp: number): void {
    if (hp <= 0) this.clearSquadRadio();
    if (hp === this.lastHp) return;
    this.lastHp = hp;
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
    if (this.scoreR.textContent !== String(red)) this.scoreR.textContent = String(red);
    if (this.scoreB.textContent !== String(blue)) this.scoreB.textContent = String(blue);
  }

  /** Highlight the held weapon's slot (index into {@link WEAPONS}). */
  setWeapon(index: number): void {
    this.weaponName.textContent = WEAPONS[index]?.name.toUpperCase() ?? "WEAPON";
    this.wslots.forEach((s, i) => s.classList.toggle("active", i === index));
  }

  /** Update the carried grenade count badge. */
  setNades(n: number): void {
    if (n === this.lastNades) return;
    this.lastNades = n;
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

  /** Driven only by confirmed room kills; weapon identifies the killing shot. */
  addKill(killer: string, victim: string, part: string, killerTeam: number | null, assistName?: string,
    details: { weapon?: number | null; localKill?: boolean; localVictim?: boolean; medal?: 'ambush' } = {}): void {
    this.root.dataset.reducedMotion = String(this.settings.get().reducedMotion);
    const color = killerTeam === 0 || killerTeam === 1 ? (killerTeam === 0 ? UI_RED : UI_BLUE) : '#bbc9c8';
    const weapon = part === 'drone' ? 'SENTRY' : part === 'mortar' ? 'MORTAR' : part === 'blast' ? 'GRENADE' : (details.weapon == null ? undefined : WEAPONS.find(w => w.slot === details.weapon)?.name.toUpperCase()) ?? 'WEAPON';
    const cause = part === 'head' ? 'HEADSHOT' : part === 'blast' ? 'BLAST' : 'ELIMINATION';
    const node = el('div'); node.className = `k${details.localKill ? ' local' : ''}${details.localVictim ? ' victim' : ''}`;
    node.style.setProperty('--team', color);
    node.innerHTML = `<span class="name" style="color:${color}">${details.localKill ? '<span class="tag">YOU</span>' : ''}${esc(killer)}</span><span class="cause"><strong>${esc(weapon)}</strong>${cause}</span><span class="name target">${details.localVictim ? '<span class="tag">YOU</span>' : ''}${esc(victim)}</span>${assistName ? `<span class="assist">ASSIST / ${esc(assistName)}</span>` : ''}`;
    this.feed.prepend(node);
    this.kills.push({ node, born: performance.now() });
    while (this.kills.length > 5) this.kills.shift()!.node.remove();
    if (details.localKill && !details.localVictim) {
      const ambush = details.medal === 'ambush';
      this.elimination.innerHTML = `<span class="confirm${ambush ? ' ambush' : ''}">${ambush ? 'AMBUSH' : 'ELIMINATION CONFIRMED'}</span><span class="target">${esc(victim)}</span><span class="detail">${ambush ? 'FROM BEHIND / ' : ''}${esc(weapon)}${part === 'head' ? ' / HEADSHOT' : ''}</span>`;
      this.eliminationAt = performance.now();
      this.elimination.style.opacity = '1';
    }
  }

  /** Uppercased active-mode label; also toggles the leaderboard vs team scores
   *  for a teamless mode (FFA, practice — see modes.ts's isTeamless). */
  setMode(modeIndex: number): void {
    if (modeIndex === this.lastMode) return;
    this.lastMode = modeIndex;
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
    this.voteSent = false;
  }

  /** DOM capture-gauge bars (mode===2 only); a/b/c are 0..200, 100 = neutral. */
  setCaps(a: number, b: number, c: number): void {
    this.caps.style.display = "flex";
    [a, b, c].forEach((v, i) => {
      const fill = this.capFills[i]!;
      const label = fill.parentElement?.parentElement?.querySelector('.lbl');
      const owner = v >= 200 ? 'RED' : v <= 0 ? 'BLUE' : v === 100 ? 'OPEN' : 'TAKING';
      if (label) label.textContent = `${['A', 'B', 'C'][i]} / ${owner}`;
      this.renderCap(fill, v);
    });
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
    const markup = rows
      .map((r, i) => `<tr class="${r.isMe ? "me" : ""}"><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.k}</td><td>${r.d}</td></tr>`)
      .join("");
    if (markup === this.leaderboardMarkup) return;
    this.leaderboardMarkup = markup;
    this.lbBody.innerHTML = markup;
  }

  showHitmarker(head: boolean): void {
    this.hitmarker.className = `center show${head ? " head" : ""}`;
    this.hitAt = performance.now();
  }

  flashDamage(): void {
    this.vignetteAt = performance.now();
    this.vignette.style.opacity = '1';
    this.damageFlash.style.opacity = '1';
  }

  showDamageDirection(bearing: number | null): void {
    this.damageBearing = bearing;
    this.damageAt = performance.now();
    this.flashDamage();
  }

  clearDamage(): void {
    this.clearSquadRadio();
    this.damageBearing = null; this.damageAt = this.vignetteAt = -1e9;
    this.damageIndicator.style.opacity = this.damageFlash.style.opacity = '0';
    this.vignette.style.opacity = '0';
  }

  /** Call only after the normal live/online/living/pointer-lock ping guard.
   * Returns the accepted radio cue; human marks immediately clear bot captions.
   * Duplicate/stale frames cannot replay sound or extend the card lifetime. */
  receiveSquadRadio(payload: unknown, serverNow: number): SquadBark | undefined {
    const ping = readSquadPing(payload, serverNow);
    if (!ping) {
      if (payload && typeof payload === 'object' &&
        typeof (payload as { from?: unknown }).from === 'string' &&
        !combatBotLabel((payload as { from: string }).from)) this.clearSquadRadio();
      return;
    }
    const key = `${ping.from}/${ping.expiresAt}/${ping.radio}`;
    if (key === this.lastRadioKey) return;
    this.lastRadioKey = key;
    this.presentSquadRadio(ping.from, ping.radio, performance.now() + ping.expiresAt - serverNow);
    return ping.radio;
  }

  private presentSquadRadio(from: string, bark: SquadBark, until: number): void {
    this.squadRadio.textContent = `${combatBotLabel(from) ?? 'SQUAD'} / RADIO\n${SQUAD_BARKS[bark]}`;
    this.radioUntil = until; this.radioVisible = true;
    this.squadRadio.style.opacity = '1';
    this.squadRadio.setAttribute('aria-hidden', 'false');
  }

  clearSquadRadio(): void {
    if (!this.radioVisible) return;
    this.radioVisible = false; this.radioUntil = 0;
    this.squadRadio.style.opacity = '0';
    this.squadRadio.setAttribute('aria-hidden', 'true');
  }

  private readonly quality = new ConnectionQuality();
  private readonly delayLabel = document.createElement('strong');
  private readonly delayNumbers = document.createElement('span');
  private nextDelayNumbersAt = 0;
  private wasOnline = true;

  setPing(ms: number, online = true, now = performance.now(), expired = false): void {
    const band = this.quality.update(ms, online, now);
    const label = expired && !online ? 'CONNECTION LOST' : DELAY_LABELS[band];
    if (this.delayLabel.textContent !== label) {
      this.delayLabel.textContent = label;
      this.ping.dataset.quality = band;
      this.ping.title = band === 'high' || band === 'delayed'
        ? 'Round-trip network delay. Hit confirmations may arrive later. This does not measure packet loss.'
        : band === 'offline' ? 'Waiting for your room connection.' : 'Estimated round-trip network delay and rendered frames per second.';
    }
    // Numbers stay out of the live region and update at most twice a second.
    if (now >= this.nextDelayNumbersAt || online !== this.wasOnline) {
      this.nextDelayNumbersAt = now + 500;
      this.wasOnline = online;
      const text = `${online && Number.isFinite(ms) && ms > 0 ? Math.round(ms) : '—'} ms RTT · ${this.fps || '—'} fps`;
      if (this.delayNumbers.textContent !== text) this.delayNumbers.textContent = text;
    }
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
      grenade: formatBinding(binds.grenade),
    });
  }

  /** The click-to-play / ESC prompt. */
  showLockPrompt(show: boolean, text = T.hud.clickToPlay): void {
    if (show) this.clearSquadRadio();
    if (show) {
      this.present('lock', `<h1>${T.hud.gameTitle}</h1><p>${esc(text)}</p><div class="briefing">${this.briefText}<br>${this.trainingHelp ? this.trainingHelp + "<br>" : ""}Move between cover. Right mouse: aim · Left mouse: fire.<br>Respawn is automatic. Esc opens settings and deployment.</div><p class="hint">${this.controlsHintText()}</p>`);
    } else {
      this.hideOverlay();
    }
  }

  /** Death overlay with a live respawn countdown (seconds). */
  showDeath(secondsLeft: number, killerName?: string): void {
    this.overlay.style.display = "flex";
    const sub = killerName ? `<p>${fmt(T.hud.eliminatedByFmt, { killer: esc(killerName) })}</p>` : "";
    const line = secondsLeft > 0
      ? `<p>${fmt(T.hud.respawnInFmt, { s: secondsLeft.toFixed(1) })}</p>`
      : `<p>${T.hud.respawningNow}</p>`;
    this.present("death", `<h1 style="color:#e05a4a">${T.hud.eliminated}</h1>${sub}${line}`);
  }

  /**
   * `winner` is a display label, already resolved by the caller (main.ts) — the raw
   * "red"/"blue"/"draw" wire value for team modes, or a player name via name(id) for
   * a teamless mode (`teamless` — FFA, practice), which renders in a neutral color
   * instead of the team colors. (Practice never actually reaches "ended" — its
   * match never ends — so this path is unreachable there in practice.)
   */
  showMatchEnd(winner: string, red: number, blue: number, myKills: number, myDeaths: number, teamless: boolean, roster?: ResultRoster): void {
    this.clearDamage();
    this.overlay.style.display = "flex";
    // "draw" is checked before teamless so an FFA no-score timeout renders "DRAW"
    // in neutral color, matching team-mode draw rendering, instead of "draw WINS".
    const title = winner === "draw"
      ? T.hud.draw
      : fmt(T.hud.winsFmt, { winner: teamless ? esc(winner) : winner.toUpperCase() });
    const color = teamless ? "#eee" : winner === "red" ? UI_RED : winner === "blue" ? UI_BLUE : "#eee";
    const scoreLine = teamless ? "" : `<div class="finalScore" aria-label="Final team scores"><span style="color:${UI_RED}">RED<strong>${red}</strong></span><span class="divider">/</span><span style="color:${UI_BLUE}">BLUE<strong>${blue}</strong></span></div>`;
    const voteLine = this.voteCount >= 0 ? `${this.voteCount} / ${this.voteNeed} votes to restart` : 'A majority can skip the intermission.';
    const outcome = winner === 'draw' ? 'DRAW' : roster ? roster.won ? 'VICTORY' : 'DEFEAT' : title;
    const accent = winner === 'draw' ? '#d2ded3' : roster ? roster.won ? '#edaa52' : '#e7a49c' : color;
    const groups = teamless ? [null] : [0, 1];
    const tables = roster ? groups.map(team => {
      const rows = roster.rows.filter(r => team === null || r.team === team).slice()
        .sort((a, b) => b.k - a.k || a.d - b.d || a.name.localeCompare(b.name));
      const label = team === null ? 'OPERATORS' : team === 0 ? 'RED TEAM' : 'BLUE TEAM';
      return `<section class="roster" style="--team:${team === null ? '#b8cccc' : team === 0 ? UI_RED : UI_BLUE}"><h2>${label} / ${rows.length}</h2><table aria-label="${label} final standings"><thead><tr><th scope="col">#</th><th scope="col">OPERATOR</th><th scope="col"><abbr title="Eliminations">K</abbr></th><th scope="col"><abbr title="Deaths">D</abbr></th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.isMe ? 'me' : ''}"><td>${i + 1}</td><td>${r.isMe ? '<span class="youTag">YOU</span>' : ''}${esc(r.name)}</td><td>${r.k}</td><td>${r.d}</td></tr>`).join('')}</tbody></table></section>`;
    }).join('') : '';
    this.present('end', `<div class="debrief" style="--result-accent:${accent}" role="region" aria-label="Round results"><div class="eyebrow">RELAY / ROUND DEBRIEF</div><div class="resultHeader"><div><h1>${outcome}</h1><div class="resultWinner">${title}</div></div>${scoreLine}</div>`
      + honorsMarkup(roster?.mvp, roster?.dom === true)
      + '<div class="nextDeployment"><span>NEXT DEPLOYMENT</span><strong data-next-round></strong><span>Vote below to return sooner</span></div>'
      + `<div class="personalStats" aria-label="Your performance"><div><strong>${myKills}</strong><span>ELIMINATIONS</span></div><div><strong>${myDeaths}</strong><span>DEATHS</span></div><div><strong>${myDeaths === 0 ? '—' : (myKills / myDeaths).toFixed(2)}</strong><span>K / D RATIO</span></div></div>`
      + (tables ? `<div class="rosters${teamless ? ' solo' : ''}">${tables}</div>` : '')
      + `<div class="resultFooter"><div><p>${voteLine}</p><p class="hint">The next round starts automatically after intermission. Standings show operators still in the room.</p></div><div class="resultActions">`
      + `<button data-action="restart" ${this.voteSent ? 'disabled' : ''}>${this.voteSent ? 'VOTE SENT / 대기' : 'REMATCH / 다시 플레이 · R'}</button>`
      + `<button class="secondary" data-action="leave">DEPLOYMENT / 메뉴</button></div></div></div>`);
    const timer = this.overlay.querySelector<HTMLElement>('[data-next-round]');
    const label = intermissionLabel(roster?.intermissionEndMs, roster?.serverNow ?? NaN);
    if (timer && timer.textContent !== label) timer.textContent = label;
  }

  hideOverlay(): void {
    if (!this.overlayVisible) return;
    this.overlayVisible = false;
    this.overlay.style.opacity = '0';
    this.overlay.inert = true;
    this.overlay.setAttribute('aria-hidden', 'true');
  }

  /** Per-frame animation: reload bar, hitmarker + vignette fade, killfeed decay. */
  update(now: number, yaw = 0): void {
    if (now >= this.radioUntil) this.clearSquadRadio();
    this.root.dataset.reducedMotion = String(this.settings.get().reducedMotion);
    const damageAge = now - this.damageAt;
    this.damageIndicator.style.opacity = this.damageBearing === null ? '0' : String(Math.max(0, Math.min(1, (900 - damageAge) / 250)));
    if (this.damageBearing !== null && damageAge < 900) {
      const direction = damageDirection(this.damageBearing, yaw);
      if (this.damageIndicator.dataset.direction !== direction) {
        this.damageIndicator.dataset.direction = direction;
        this.damageIndicator.firstElementChild!.textContent = direction.toUpperCase();
      }
    }
    if (now - this.vignetteAt > 60) this.damageFlash.style.opacity = '0';
    const confirmAge = now - this.eliminationAt;
    this.elimination.style.opacity = String(Math.max(0, Math.min(1, (1800 - confirmAge) / 300)));
    if (confirmAge >= 1800 && this.elimination.childNodes.length) this.elimination.replaceChildren();
    if (this.reloadStart >= 0) {
      const p = Math.min(1, (now - this.reloadStart) / this.reloadMs);
      this.reloadFill.style.width = `${p * 100}%`;
      if (p >= 1) {
        this.reloadStart = -1;
        this.reload.style.display = "none";
      }
    }
    if (now - this.hitAt > 90) this.hitmarker.className = "center";
    if (now - this.vignetteAt > 60) this.vignette.style.opacity = '0';
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
