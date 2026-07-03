/**
 * Minimap: zone bounds + obstacles + portals (from the shared `zones/*.ts` data — same
 * single source the room clamps movement against and the 3D scene places props from)
 * plus a live dot per synced unit. `projectToMinimap` is pure/tested
 * (test/client-m2.test.ts); `Minimap` is the canvas-owning renderer, exercised
 * visually.
 */
import type { ZoneData } from "../src/zones/types.js";
import { el } from "./dom.js";

const DEFAULT_SIZE = 160;

/** Projects a zone-space point to `[0, pixelSize]` minimap pixel space. A non-positive
 *  `zoneWidth`/`zoneHeight` is treated as 1 (degenerate zone data can't divide by zero),
 *  and the result is clamped so an out-of-bounds unit still renders at the map edge
 *  rather than off-canvas. */
export function projectToMinimap(
  x: number,
  y: number,
  zoneWidth: number,
  zoneHeight: number,
  pixelSize: number,
): { x: number; y: number } {
  const w = zoneWidth > 0 ? zoneWidth : 1;
  const h = zoneHeight > 0 ? zoneHeight : 1;
  return {
    x: Math.max(0, Math.min(pixelSize, (x / w) * pixelSize)),
    y: Math.max(0, Math.min(pixelSize, (y / h) * pixelSize)),
  };
}

export interface MinimapUnit {
  x: number;
  y: number;
  self: boolean;
  /** Anything not a player (monsters/NPCs) renders as a hostile-tinted dot. */
  hostile: boolean;
}

export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly size: number;
  private zone: ZoneData | null = null;

  constructor(root: HTMLElement, size: number = DEFAULT_SIZE) {
    this.size = size;
    const wrap = el("div", "minimap-wrap");
    this.canvas = document.createElement("canvas");
    this.canvas.className = "minimap-canvas";
    this.canvas.width = size;
    this.canvas.height = size;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas context unavailable");
    this.ctx = ctx;
    wrap.appendChild(this.canvas);
    root.appendChild(wrap);
  }

  /** Call on connect and on every zone transfer — the minimap always reflects the zone
   *  the player is CURRENTLY in, not the one they started in. */
  setZone(zone: ZoneData): void {
    this.zone = zone;
  }

  /** `cameraYaw` is the scene rig's orbit yaw (radians) — the map is rotated about its
   *  center by that same angle so the camera's look direction always reads as "up". */
  render(units: readonly MinimapUnit[], cameraYaw: number): void {
    const { ctx, size } = this;
    const cx = size / 2;
    const cy = size / 2;
    ctx.clearRect(0, 0, size, size);

    // Clip everything (background + content) to a centered circle so nothing spills
    // past the round map border.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = "rgba(11,15,21,0.78)";
    ctx.fillRect(0, 0, size, size);

    const zone = this.zone;
    if (zone) {
      // Rotate the world content around the map center by the camera's yaw so the
      // camera's forward direction points straight up on the map.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(cameraYaw);
      ctx.translate(-cx, -cy);

      ctx.fillStyle = "rgba(139,148,158,0.55)";
      for (const o of zone.obstacles) {
        const p = projectToMinimap(o.x, o.y, zone.width, zone.height, size);
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }

      ctx.fillStyle = "#c9a86a";
      for (const portal of zone.portals) {
        const p = projectToMinimap(portal.pos.x, portal.pos.y, zone.width, zone.height, size);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const npc of zone.npcs ?? []) {
        const p = projectToMinimap(npc.pos.x, npc.pos.y, zone.width, zone.height, size);
        ctx.fillStyle = npc.kind === "shop" ? "#f2cc60" : "#8b949e";
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }

      for (const u of units) {
        const p = projectToMinimap(u.x, u.y, zone.width, zone.height, size);
        ctx.fillStyle = u.self ? "#3fb950" : u.hostile ? "#f85149" : "#58a6ff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, u.self ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore(); // drop the circular clip

    ctx.strokeStyle = "#30363d";
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}
