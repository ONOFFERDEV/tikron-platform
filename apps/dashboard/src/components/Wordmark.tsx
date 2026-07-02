/**
 * Tikron wordmark: lowercase "tikron" set in the mono face with a neon
 * "tick" — a pulsing block cursor that reads as a realtime tickrate / terminal
 * caret. Pure CSS so it scales cleanly in the sidebar, login card, and boot
 * screen; the favicon (public/favicon.svg) mirrors the same tick motif.
 */
export function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className={`wordmark wordmark-${size}`} aria-label="tikron">
      <span className="wordmark-text" aria-hidden="true">
        tikron
      </span>
      <span className="wordmark-tick" aria-hidden="true" />
    </span>
  );
}
