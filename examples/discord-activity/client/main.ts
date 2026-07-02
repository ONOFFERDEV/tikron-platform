import { GameClient } from "@tikron/client";
import { PALETTE } from "../src/palette.js";
import type { CursorState } from "../src/cursor-room.js";
import { connectDiscord, isDevFallback, proxyTransport } from "./discord.js";

/**
 * The browser side. In Discord it runs the handshake (see discord.ts), joins the
 * room named after the voice channel, and renders every player as a colored,
 * name-labeled dot. With `?dev=1` it skips Discord entirely and behaves like the
 * plain starter so `pnpm --filter tikron-discord-activity dev` is playable in a tab.
 */

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("status")!;

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

async function main(): Promise<void> {
  const dev = isDevFallback();

  let roomId: string;
  let displayName: string;
  if (dev) {
    roomId = new URLSearchParams(location.search).get("room") ?? "lobby";
    displayName = "You";
    statusEl.textContent = `dev fallback · room "${roomId}" · open 2 tabs`;
  } else {
    const session = await connectDiscord();
    roomId = session.roomId;
    displayName = session.name;
    statusEl.textContent = `Discord Activity · ${displayName}`;
  }

  // A per-tab session key so a reload or network blip reclaims the same seat (the
  // room holds it for 30 s via the CasualRealtimeRoom reconnection window).
  let sessionKey = sessionStorage.getItem("discord-activity-session");
  if (!sessionKey) {
    sessionKey = crypto.randomUUID();
    sessionStorage.setItem("discord-activity-session", sessionKey);
  }

  const client = new GameClient(location.host, {
    party: "cursor-room",
    createTransport: proxyTransport(!dev),
  });

  const room = await client.joinOrCreate(roomId, { _session: sessionKey });
  const myId = room.connectionId!;

  // Tell the room our display name once (the server validates + clamps it).
  room.send("setName", { name: displayName });

  let state: CursorState | undefined;
  room.onStateChange((s) => {
    state = s as CursorState;
  });

  // Report the cursor target at a fixed cadence (the server rate-limits inputs).
  const mouse = { x: 0.5, y: 0.5 };
  canvas.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX / canvas.width;
    mouse.y = e.clientY / canvas.height;
  });
  setInterval(() => room.send("move", mouse), 50);

  function render(): void {
    ctx.fillStyle = "#1e1f22"; // Discord dark background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (state) {
      for (const [id, p] of Object.entries(state.players)) {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        const color = PALETTE[p.color % PALETTE.length] ?? "#ffffff";

        ctx.fillStyle = color;
        dot(x, y, 14);
        if (id === myId) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(x, y, 19, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = "#f2f3f5";
        ctx.font = "13px 'gg sans', ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.name, x, y - 22);
      }
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function dot(x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

void main();
