/**
 * Tiny DOM helper shared by every DOM-owning UI module (`ui.ts`, `start-screen.ts`,
 * `inventory-ui.ts`, `minimap.ts`) so each doesn't redeclare the same one-liner.
 */
export function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
