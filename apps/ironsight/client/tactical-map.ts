import type { MapDef } from "../src/map/types.js";
import type { ArenaState } from "../src/schema.js";

/** Static floor plan plus self/allies only. Enemy positions are never plotted. */
export class TacticalMap {
  private readonly canvas = document.createElement("canvas");
  private readonly context: CanvasRenderingContext2D;
  private readonly floor = document.createElement("canvas");
  private readonly label = document.createElement("div");
  private lastAt = -Infinity;
  private readonly scale: number;

  constructor(private readonly map: MapDef) {
    const root = document.createElement("aside"); root.id = "tacticalMap";
    root.setAttribute("aria-label", "Tactical map and current location");
    root.style.cssText = "position:fixed;left:28px;top:28px;width:180px;color:#e8eee9;pointer-events:none;font:10px Arial,sans-serif;letter-spacing:2px";
    this.canvas.width = this.floor.width = 360;
    this.canvas.height = this.floor.height = 252;
    this.canvas.style.cssText = "display:block;width:180px;height:126px;border:1px solid #abc2c044;background:#0d1d24dd";
    this.canvas.setAttribute("aria-label", "Your position and teammates; enemies are not shown");
    this.label.style.cssText = "padding:9px 10px;background:#0d1d24dd;border-left:2px solid #edb467";
    this.context = this.canvas.getContext("2d")!;
    this.scale = 324 / map.bounds.width;
    const ctx = this.floor.getContext("2d")!;
    ctx.fillStyle = "#132b33"; ctx.fillRect(18, 18, 324, map.bounds.depth * this.scale);
    ctx.strokeStyle = "#759294"; ctx.lineWidth = 1;
    ctx.strokeRect(18, 18, 324, map.bounds.depth * this.scale);
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
    root.append(this.canvas, this.label); document.body.appendChild(root);
  }

  update(state: ArenaState, myId: string, yaw: number, now: number): void {
    if (now - this.lastAt < 100) return;
    this.lastAt = now;
    const me = state.players[myId]; if (!me) return;
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
    if (me.alive) dot(me.x, me.z, "#fff3cf", yaw);
    const name = this.map.presentation === "relay"
      ? me.x < 14 ? "WEST SERVICE" : me.x > 46 ? "EAST SERVICE" : me.z < 12 ? "01 / COOLING" : me.z > 28 ? "03 / FREIGHT" : "02 / RELAY"
      : "FIELD OPERATIONS";
    if (this.label.textContent !== name) this.label.textContent = name;
  }
}
