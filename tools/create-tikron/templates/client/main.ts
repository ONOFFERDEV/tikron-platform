import { GameClient, EntitySmoother } from "@tikron/client";
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
  statusEl.textContent = `room "${roomName}" · you are the ringed dot · drag to move, tap to splat`;

  let state: ArenaState | undefined;
  room.onStateChange((s) => {
    state = s as ArenaState;
  });

  // Pointer events cover mouse AND touch from one code path — a finger drag and
  // a mouse move both fire `pointermove` (the canvas has `touch-action: none`
  // so the browser scrolls/zooms nothing instead). Send the cursor target at a
  // fixed cadence, not per event: the server rate-limits inputs (30/s default).
  const mouse = { x: 0.5, y: 0.5 };
  const aim = (e: PointerEvent) => {
    mouse.x = e.clientX / canvas.width;
    mouse.y = e.clientY / canvas.height;
  };
  canvas.addEventListener("pointermove", aim);
  canvas.addEventListener("pointerdown", (e) => {
    aim(e); // a tap/click splats at exactly where the pointer went down
    room.send("splat");
  });
  setInterval(() => room.send("move", mouse), 50);

  // Remote players' positions arrive at the ~20 Hz sync rate; EntitySmoother
  // eases each one between updates so they glide instead of stepping. The local
  // player renders straight from `mouse` — you already know where you are, so
  // adding easing there would only add input lag.
  const smoother = new EntitySmoother();
  let lastMs = performance.now();

  function render() {
    const now = performance.now();
    const dtMs = now - lastMs;
    lastMs = now;
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (state) {
      for (const s of state.splats) {
        ctx.fillStyle = `hsl(${s.hue} 70% 45% / 0.55)`;
        dot(s.x * canvas.width, s.y * canvas.height, 18);
      }
      const seen = new Set<string>();
      for (const [id, p] of Object.entries(state.players)) {
        let rx: number;
        let ry: number;
        if (id === myId) {
          rx = mouse.x;
          ry = mouse.y;
        } else {
          const sm = smoother.update(id, { x: p.x, y: p.y }, dtMs);
          rx = sm.x;
          ry = sm.y;
          seen.add(id);
        }
        const x = rx * canvas.width;
        const y = ry * canvas.height;
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
      smoother.prune(seen); // a remote that left snaps in fresh if it returns
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
