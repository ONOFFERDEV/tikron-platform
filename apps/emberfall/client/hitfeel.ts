/**
 * hitfeel: full-screen red damage vignette overlay (POLISH-EMBERFALL B2). A
 * transient edge pulse on taking a hit (`pulse`) plus a sustained, softly
 * "breathing" vignette while HP is critical (`setLowHp`). The overlay is
 * `pointer-events:none` so it never intercepts canvas/HUD input, and it injects
 * its own scoped `<style>` (own class names) so it never collides with
 * `index.html` or the other UI modules.
 */
import { el } from "./dom.js";

export interface HitFeel {
  /** Brief red edge flash on taking damage (~0.3s fade in/out). Safe to re-fire while playing. */
  pulse(): void;
  /** Sustained faint red vignette with a slow breathing pulse while HP is critical. */
  setLowHp(on: boolean): void;
}

const STYLE_ID = "ef-hitfeel-style";
const PULSE_MS = 300;
const PULSE_PEAK = 0.55;

/** Mounts the vignette overlay on `document.body` and returns its control surface. */
export function createHitFeel(): HitFeel {
  injectStyle();

  const root = el("div", "ef-hitfeel");
  const low = el("div", "ef-hitfeel-layer ef-hitfeel-low");
  const pulseLayer = el("div", "ef-hitfeel-layer ef-hitfeel-pulse");
  root.append(low, pulseLayer);
  document.body.appendChild(root);

  let pulseAnim: Animation | null = null;

  return {
    pulse(): void {
      pulseAnim?.cancel(); // restart cleanly so rapid hits re-fire instead of stacking opacity
      pulseAnim = pulseLayer.animate(
        [{ opacity: 0 }, { opacity: PULSE_PEAK, offset: 0.25 }, { opacity: 0 }],
        { duration: PULSE_MS, easing: "ease-out" },
      );
    },
    setLowHp(on: boolean): void {
      low.classList.toggle("on", on);
    },
  };
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.ef-hitfeel {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 45;
}
.ef-hitfeel-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  background: radial-gradient(ellipse at center, transparent 48%, rgba(190, 18, 18, 0.85) 100%);
}
.ef-hitfeel-low.on {
  animation: ef-hitfeel-breathe 1.2s ease-in-out infinite;
}
@keyframes ef-hitfeel-breathe {
  0%, 100% { opacity: 0.12; }
  50% { opacity: 0.28; }
}
`;
  document.head.appendChild(style);
}
