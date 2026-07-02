import { GameClient } from "@tikron/client";
import type { ArenaState } from "../src/arena-room.js";

/**
 * The browser side of the starter. The SDK gives you a `Room` handle:
 *  - `room.onStateChange(cb)` — the server's authoritative state, every sync.
 *  - `room.send(type, payload)` — send an intent to the room's handler.
 *  - `room.connectionId` — your stable id (keyed by the session below).
 */

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("status")!;

// ?room=my-room lets any number of isolated rooms share one deployment.
const roomName = new URLSearchParams(location.search).get("room") ?? "lobby";

// A per-tab session key: reconnects (tab switch, network blip, reload) with
// the same key reclaim the same seat — the server holds it for 30 seconds.
let session = sessionStorage.getItem("tikron-session");
if (!session) {
  session = crypto.randomUUID();
  sessionStorage.setItem("tikron-session", session);
}

const client = new GameClient(location.host, { party: "arena-room" });

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

async function main() {
  const room = await client.joinOrCreate(roomName, { _session: session! });
  const myId = room.connectionId!;
  statusEl.textContent = `room "${roomName}" · you are the ringed dot · click to splat`;

  let state: ArenaState | undefined;
  room.onStateChange((s) => {
    state = s as ArenaState;
  });

  // Send the cursor's target at a fixed cadence, not per mousemove event —
  // the server rate-limits inputs (30/s by default).
  const mouse = { x: 0.5, y: 0.5 };
  canvas.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX / canvas.width;
    mouse.y = e.clientY / canvas.height;
  });
  setInterval(() => room.send("move", mouse), 50);

  canvas.addEventListener("click", () => room.send("splat"));

  function render() {
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (state) {
      for (const s of state.splats) {
        ctx.fillStyle = `hsl(${s.hue} 70% 45% / 0.55)`;
        dot(s.x * canvas.width, s.y * canvas.height, 18);
      }
      for (const [id, p] of Object.entries(state.players)) {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        ctx.fillStyle = `hsl(${p.hue} 80% 60%)`;
        dot(x, y, 8);
        if (id === myId) {
          ctx.strokeStyle = "#e6edf3";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 12, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function dot(x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

void main();
