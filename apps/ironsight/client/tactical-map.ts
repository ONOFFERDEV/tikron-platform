import { setFieldPhrases } from './ui/field-copy.js';
import { PING, type TeamPing } from '../src/ping.js';
import { contactText } from './contact-presentation.js';
import type { SupportView } from '../src/air-support.js';
import { signalFrame } from '../src/signal-event.js';
import { formatBinding, type SettingsStore } from './settings.js';
import { mapCallout } from "./map-presentation.js";
import type { MapDef } from "../src/map/types.js";
import type { ArenaState } from "../src/schema.js";
import { MODES } from '../src/config.js';
import type { TrainingObjective } from './training-progress.js';
import { FIELD_UI_COPY } from './ui/copy.js';
import { UI_TOKENS } from './ui/tokens.js';

/** Static floor plan, allies, pings and explicitly server-granted recon snapshots. */
export class TacticalMap {
  private readonly canvas = document.createElement("canvas");
  private readonly context: CanvasRenderingContext2D;
  private readonly floor = document.createElement("canvas");
  private readonly label = document.createElement("div");
  private readonly notice = document.createElement('div');
  private readonly hint = document.createElement('div');
  private readonly pings = new Map<string, TeamPing>();
  private lastAt = -Infinity;
  private readonly scale: number;

  constructor(private readonly map: MapDef, private readonly trainingObjective?: TrainingObjective, private readonly settings?: SettingsStore) {
    const root = document.createElement("aside"); root.id = "tacticalMap";
    root.setAttribute("aria-label", FIELD_UI_COPY.tactical.label);
    root.style.cssText = "position:fixed;inset-inline-start:var(--ui-safe-edge);inset-block-start:var(--ui-safe-edge);inline-size:180px;color:var(--ui-text-primary);pointer-events:none;font:500 var(--ui-type-hud)/1.4 var(--ui-font-body)";
    this.canvas.width = this.floor.width = 360;
    this.canvas.height = this.floor.height = 252;
    this.canvas.style.cssText = "display:block;inline-size:180px;block-size:126px;border:var(--ui-border-width) solid var(--ui-border-subtle);background:var(--ui-hud-backing)";
    this.canvas.setAttribute("aria-label", FIELD_UI_COPY.tactical.canvas);
    this.label.style.cssText = "padding:var(--ui-space-2) var(--ui-space-3);background:var(--ui-hud-backing);border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent)";
    this.context = this.canvas.getContext("2d")!;
    this.scale = 324 / map.bounds.width;
    const ctx = this.floor.getContext("2d")!;
    ctx.fillStyle = UI_TOKENS["--ui-surface-1"]; ctx.fillRect(18, 18, 324, map.bounds.depth * this.scale);
    ctx.strokeStyle = UI_TOKENS["--ui-border-strong"]; ctx.lineWidth = 1;
    ctx.strokeRect(18, 18, 324, map.bounds.depth * this.scale);
    ctx.fillStyle = UI_TOKENS["--ui-text-secondary"]; ctx.font = '700 14px "Noto Sans KR"'; ctx.textAlign = 'left';
    ctx.fillText('N', 5, 13);
    for (const box of map.boxes) {
      if (map.terrain?.boxes.includes(box)) continue;
      // Ground floor plan: a roof or lintel must not paint over its doorway.
      if (box.min.y >= 1.8) continue;
      ctx.fillStyle = box.max.y > 2 ? UI_TOKENS["--ui-border-strong"] : UI_TOKENS["--ui-border-subtle"];
      ctx.fillRect(18 + box.min.x * this.scale, 18 + box.min.z * this.scale,
        (box.max.x - box.min.x) * this.scale, (box.max.z - box.min.z) * this.scale);
    }
    for (const ramp of map.ramps ?? []) {
      ctx.fillStyle = UI_TOKENS["--ui-accent"];
      ctx.fillRect(18 + ramp.minX * this.scale, 18 + ramp.minZ * this.scale,
        (ramp.maxX - ramp.minX) * this.scale, (ramp.maxZ - ramp.minZ) * this.scale);
    }
    const style = document.createElement('style');
    style.textContent = '#teamPingHint .field-phrase{display:inline-block;white-space:nowrap}@media(max-width:800px){#teamPingNotice{bottom:200px!important}#teamPingHint{bottom:156px!important}}';
    document.head.appendChild(style);
    this.hint.id = 'teamPingHint';
    this.notice.id = 'teamPingNotice'; this.notice.setAttribute('role', 'status');
    this.notice.style.cssText = 'position:fixed;pointer-events:none;color:var(--ui-text-primary);font:500 var(--ui-type-hud)/1.5 var(--ui-font-body);inset-inline-start:var(--ui-safe-edge);inset-block-end:calc(var(--ui-safe-edge) + 160px);inline-size:220px;padding:var(--ui-space-2) var(--ui-space-3);background:var(--ui-hud-backing);border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent);overflow-wrap:anywhere';
    this.notice.hidden = true;
    this.notice.style.whiteSpace = 'pre-line';
    this.hint.style.cssText = 'position:fixed;pointer-events:none;font:500 var(--ui-type-hud)/1.5 var(--ui-font-body);inset-inline-start:var(--ui-safe-edge);inset-block-end:calc(var(--ui-safe-edge) + 88px);inline-size:max-content;max-inline-size:min(360px,calc(100vw - 2 * var(--ui-safe-edge)));box-sizing:border-box;padding:var(--ui-space-2) var(--ui-space-3);background:var(--ui-hud-backing);color:var(--ui-text-secondary);white-space:pre-line';
    root.append(this.canvas, this.label); document.body.append(root, this.hint, this.notice);
  }

  receivePing(payload: unknown, serverNow: number): TeamPing | undefined {
    if (!payload || typeof payload !== 'object') return;
    const p = payload as TeamPing;
    if (typeof p.from !== 'string' || p.from.length > 128 || !['go', 'enemy', 'backup'].includes(p.kind) ||
      !Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(p.expiresAt) ||
      p.x < 0 || p.z < 0 || p.x > this.map.bounds.width || p.z > this.map.bounds.depth ||
      p.expiresAt <= serverNow || p.expiresAt > serverNow + PING.lifetimeMs + 1000 ||
      (p.contact !== undefined && (p.contact !== true || p.kind !== 'enemy' || !/^bot-[1-9]\d*$/.test(p.from)))) return;
    this.pings.delete(p.from);
    if (this.pings.size >= 6) this.pings.delete(this.pings.keys().next().value!);
    this.pings.set(p.from, { ...p });
    return p;
  }

  update(state: ArenaState, myId: string, yaw: number, now: number, serverNow = now, active = true, support?: SupportView): void {
    if (now - this.lastAt < 100) return;
    this.lastAt = now;
    const me = state.players[myId]; if (!me) return;
    if (!active || state.phase !== 'live' || !me.alive) this.pings.clear();
    for (const [id, ping] of this.pings) if (ping.expiresAt <= serverNow) this.pings.delete(id);
    const values = [...this.pings.values()];
    // A player's manual mark owns the card until it expires. Radio reports can
    // still draw their frozen diamond without replacing the player's instruction.
    const latest = values.filter(p => !p.contact).at(-1) ?? values.at(-1);
    this.notice.hidden = !latest;
    this.notice.dataset.contact = latest?.contact ? 'true' : 'false';
    if (latest) {
      const text = latest.contact ? contactText(latest, me, yaw, mapCallout(this.map, latest.x, latest.z), serverNow)
        : `${latest.from === myId ? FIELD_UI_COPY.tactical.me : FIELD_UI_COPY.tactical.ally} · ${latest.kind === 'enemy' ? FIELD_UI_COPY.tactical.enemySeen : latest.kind === 'backup' ? FIELD_UI_COPY.tactical.backup : FIELD_UI_COPY.tactical.go} · ${mapCallout(this.map, latest.x, latest.z)} · ${latest.kind === 'backup' ? FIELD_UI_COPY.tactical.callerPosition : FIELD_UI_COPY.tactical.markedPosition}`;
      if (this.notice.textContent !== text) this.notice.textContent = text;
    }
    this.hint.hidden = !active || state.mode === 1 || state.phase !== 'live' || !me.alive;
    const backup = this.settings ? formatBinding(this.settings.get().binds.backup) : 'B';
    const hint = `${this.settings ? formatBinding(this.settings.get().binds.ping) : 'Q'} · ${state.mode === 3 ? FIELD_UI_COPY.tactical.rehearsePing : FIELD_UI_COPY.tactical.teamPing} · ${FIELD_UI_COPY.tactical.tapHold}\n${backup} · ${FIELD_UI_COPY.tactical.backup} · ${FIELD_UI_COPY.tactical.atLocation}`;
    if (this.hint.textContent !== hint) setFieldPhrases(this.hint, hint);
    const ctx = this.context;
    const signal=signalFrame(state.signalAt,state.phase,serverNow);
    const blackout=this.map.presentation==='relay' && signal.phase==='blackout';
    this.canvas.dataset.signal=blackout ? 'offline' : 'online';
    if(blackout) {
      this.canvas.dataset.reconContacts = '0';
      // Clear the actual canvas; hiding it with an overlay would retain a stale
      // floor/ally frame. Pings keep expiring and text callouts remain available.
      ctx.clearRect(0,0,360,252);ctx.fillStyle='#0d1d24';ctx.fillRect(0,0,360,252);
      ctx.strokeStyle='#35606a';ctx.lineWidth=1;
      for(let y=24;y<252;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(360,y);ctx.stroke();}
      ctx.fillStyle=UI_TOKENS["--ui-warning"];ctx.textAlign='center';ctx.font='700 23px "Noto Sans KR"';ctx.fillText(FIELD_UI_COPY.tactical.signalLost,180,113);
      ctx.fillStyle=UI_TOKENS["--ui-text-secondary"];ctx.font='16px "Noto Sans KR"';ctx.fillText(`${FIELD_UI_COPY.tactical.relinkIn} ${Math.ceil(signal.remainingMs/1000)}초`,180,143);
      this.canvas.setAttribute('aria-label',FIELD_UI_COPY.tactical.mapOffline);
      this.label.textContent=mapCallout(this.map,me.x,me.z);return;
    }
    this.canvas.setAttribute('aria-label',`${FIELD_UI_COPY.tactical.canvas}. 획득한 관측 정보 표시`);
    ctx.clearRect(0, 0, 360, 252); ctx.drawImage(this.floor, 0, 0);
    if (this.map.signalCore) {
      const b=this.map.signalCore.chamber;
      ctx.fillStyle=state.coreOpen ? '#73dace' : '#ce9f5e';
      ctx.fillRect(18+b.min.x*this.scale,18+b.min.z*this.scale,(b.max.x-b.min.x)*this.scale,(b.max.z-b.min.z)*this.scale);
    }
    // The minimap is north-up (+z down); direction matches the server yaw convention.
    const dot = (x: number, z: number, color: string, angle?: number) => {
      ctx.save(); ctx.translate(18 + x * this.scale, 18 + z * this.scale);
      ctx.fillStyle = color;
      if (angle === undefined) { ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill(); }
      else {
        ctx.rotate(-angle); ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-5, -5); ctx.lineTo(5, -5); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    };
    // Mode 0=TDM, 2=DOM. A shared team number means nothing in practice/FFA.
    if (state.mode === 0 || state.mode === 2) {
      for (const [id, player] of Object.entries(state.players)) {
        if (id !== myId && player.alive && player.team === me.team) dot(player.x, player.z, "#80d5dc");
      }
    }
    if (state.mode === 2) {
      ctx.font = "bold 15px Arial"; ctx.textAlign = "center";
      for (const [index, cap] of Object.values(this.map.caps).entries()) {
        ctx.fillStyle = "#efc985"; ctx.fillText(["A", "B", "C"][index]!, 18 + cap.x * this.scale, 23 + cap.z * this.scale);
      }
    }
    if (state.mode === 3 && this.trainingObjective) {
      const goal = this.trainingObjective;
      const x = 18 + goal.x * this.scale, z = 18 + goal.z * this.scale;
      ctx.strokeStyle = '#edaa52'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, z, MODES.dom.captureRadius * this.scale, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#10242b'; ctx.fillRect(x - 11, z - 30, 22, 20);
      ctx.fillStyle = '#ffe0a3'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
      ctx.fillText('A', x, z - 14);
    }
    if (me.alive) dot(me.x, me.z, "#fff3cf", yaw);
    const scan = active && me.alive && state.phase === 'live' && support?.scan && support.scan.expiresAt > serverNow ? support.scan : null;
    this.canvas.dataset.reconContacts = String(scan?.contacts.length ?? 0);
    if (scan) {
      const age = Math.max(0, serverNow - scan.sampledAt);
      ctx.save(); ctx.globalAlpha = Math.max(.3, 1 - age / 2600);
      for (const contact of scan.contacts) {
        const x = 18 + contact.x * this.scale, z = 18 + contact.z * this.scale;
        ctx.strokeStyle = '#ffbd8c'; ctx.fillStyle = '#ff967e'; ctx.lineWidth = 2;
        ctx.strokeRect(x - 6, z - 6, 12, 12); ctx.fillRect(x - 2, z - 2, 4, 4);
      }
      ctx.restore();
      if (!this.settings?.get().reducedMotion) {
        ctx.strokeStyle = '#80d5dc88'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.arc(180, 126, Math.min(205, age * .11), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#ffdab0'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'right';
      ctx.fillText(`${FIELD_UI_COPY.tactical.lastSeen} ${(age / 1000).toFixed(1)}초`, 338, 245);
    }
    for (const ping of this.pings.values()) {
      const x = 18 + ping.x * this.scale, z = 18 + ping.z * this.scale;
      ctx.strokeStyle = ping.kind === 'enemy' ? '#ff967e' : ping.kind === 'backup' ? '#80d5dc' : '#ffe0a3'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, z-7); ctx.lineTo(x+7,z); ctx.lineTo(x,z+7); ctx.lineTo(x-7,z); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
      ctx.fillText(ping.kind === 'enemy' ? '!' : ping.kind === 'backup' ? 'B' : '+', x, z+4);
    }
    const name = mapCallout(this.map, me.x, me.z);
    if (this.label.textContent !== name) this.label.textContent = name;
  }
}
