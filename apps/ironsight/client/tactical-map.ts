import { PING, type TeamPing } from '../src/ping.js';
import { formatBinding, type SettingsStore } from './settings.js';
import { mapCallout } from "./map-presentation.js";
import type { MapDef } from "../src/map/types.js";
import type { ArenaState } from "../src/schema.js";
import { MODES } from '../src/config.js';
import type { TrainingObjective } from './training-progress.js';

/** Static floor plan plus self/allies only. Enemy positions are never plotted. */
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
    root.setAttribute("aria-label", "Tactical map and current location");
    root.style.cssText = "position:fixed;left:28px;top:28px;width:180px;color:#e8eee9;pointer-events:none;font:10px Arial,sans-serif;letter-spacing:2px";
    this.canvas.width = this.floor.width = 360;
    this.canvas.height = this.floor.height = 252;
    this.canvas.style.cssText = "display:block;width:180px;height:126px;border:1px solid #abc2c044;background:#0d1d24dd";
    this.canvas.setAttribute("aria-label", "Your position, teammates and temporary team pings; no enemy tracking");
    this.label.style.cssText = "padding:9px 10px;background:#0d1d24dd;border-left:2px solid #edb467";
    this.context = this.canvas.getContext("2d")!;
    this.scale = 324 / map.bounds.width;
    const ctx = this.floor.getContext("2d")!;
    ctx.fillStyle = "#132b33"; ctx.fillRect(18, 18, 324, map.bounds.depth * this.scale);
    ctx.strokeStyle = "#759294"; ctx.lineWidth = 1;
    ctx.strokeRect(18, 18, 324, map.bounds.depth * this.scale);
    ctx.fillStyle = '#b8ccc9'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'left';
    ctx.fillText('N', 5, 13);
    for (const box of map.boxes) {
      ctx.fillStyle = box.max.y > 2 ? "#7d9798" : "#405e66";
      ctx.fillRect(18 + box.min.x * this.scale, 18 + box.min.z * this.scale,
        (box.max.x - box.min.x) * this.scale, (box.max.z - box.min.z) * this.scale);
    }
    for (const ramp of map.ramps ?? []) {
      ctx.fillStyle = "#bc985e";
      ctx.fillRect(18 + ramp.minX * this.scale, 18 + ramp.minZ * this.scale,
        (ramp.maxX - ramp.minX) * this.scale, (ramp.maxZ - ramp.minZ) * this.scale);
    }
    const style = document.createElement('style');
    style.textContent = '@media(max-width:800px){#teamPingNotice{bottom:200px!important}#teamPingHint{bottom:156px!important}}';
    document.head.appendChild(style);
    this.hint.id = 'teamPingHint';
    this.notice.id = 'teamPingNotice'; this.notice.setAttribute('role', 'status');
    this.notice.style.cssText = 'position:fixed;pointer-events:none;color:#e8eee9;font:11px Arial,sans-serif;left:28px;bottom:144px;width:200px;padding:9px;background:#10242bef;border-left:2px solid #edaa52;line-height:1.5;letter-spacing:1px;overflow-wrap:anywhere';
    this.notice.hidden = true;
    this.hint.style.cssText = 'position:fixed;pointer-events:none;font:10px Arial,sans-serif;left:28px;bottom:100px;width:220px;padding:6px 0;font-size:9px;letter-spacing:1px;color:#c0d6d5;white-space:pre-line;line-height:1.5';
    root.append(this.canvas, this.label); document.body.append(root, this.hint, this.notice);
  }

  receivePing(payload: unknown, serverNow: number): TeamPing | undefined {
    if (!payload || typeof payload !== 'object') return;
    const p = payload as TeamPing;
    if (typeof p.from !== 'string' || p.from.length > 128 || !['go', 'enemy', 'backup'].includes(p.kind) ||
      !Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(p.expiresAt) ||
      p.x < 0 || p.z < 0 || p.x > this.map.bounds.width || p.z > this.map.bounds.depth ||
      p.expiresAt <= serverNow || p.expiresAt > serverNow + PING.lifetimeMs + 1000) return;
    this.pings.delete(p.from);
    if (this.pings.size >= 6) this.pings.delete(this.pings.keys().next().value!);
    this.pings.set(p.from, { ...p });
    return p;
  }

  update(state: ArenaState, myId: string, yaw: number, now: number, serverNow = now, active = true): void {
    if (now - this.lastAt < 100) return;
    this.lastAt = now;
    const me = state.players[myId]; if (!me) return;
    if (!active || state.phase !== 'live' || !me.alive) this.pings.clear();
    for (const [id, ping] of this.pings) if (ping.expiresAt <= serverNow) this.pings.delete(id);
    const latest = [...this.pings.values()].at(-1);
    this.notice.hidden = !latest;
    if (latest) {
      const text = `${latest.from === myId ? 'YOU' : 'ALLY'} / ${latest.kind === 'enemy' ? 'ENEMY SEEN' : latest.kind === 'backup' ? 'NEED BACKUP' : 'GO HERE'} / ${mapCallout(this.map, latest.x, latest.z)} / ${latest.kind === 'backup' ? 'caller location when sent' : 'last marked location'}`;
      if (this.notice.textContent !== text) this.notice.textContent = text;
    }
    this.hint.hidden = !active || state.mode === 1 || state.phase !== 'live' || !me.alive;
    const backup = this.settings ? formatBinding(this.settings.get().binds.backup) : 'B';
    const hint = `${this.settings ? formatBinding(this.settings.get().binds.ping) : 'Q'} / ${state.mode === 3 ? 'REHEARSE PING' : 'TEAM PING'} / aim, then mark\n${backup} / NEED BACKUP / at your location`;
    if (this.hint.textContent !== hint) this.hint.textContent = hint;
    const ctx = this.context;
    ctx.clearRect(0, 0, 360, 252); ctx.drawImage(this.floor, 0, 0);
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
