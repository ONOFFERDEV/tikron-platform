# IRONSIGHT interface design system

This document is the visual and interaction contract for the browser game UI. It records the extracted current system and the WW1 competitive target before shared primitives are implemented. Gameplay rendering and Three.js world materials are outside this document unless they carry player-facing UI information.

## 1. Atmosphere and identity

IRONSIGHT feels like a field operations desk assembled from typed orders, map grids, painted metal labels, and restrained brass hardware. The signature is the **field-order edge**: important surfaces use a thin brass rule on one logical edge, with compact identifiers and plain Korean instructions aligned to it. Menus may use real battlefield imagery and a quiet map-grid layer. Live HUD text, targets, sights, and hit feedback remain clean and untextured for competitive readability.

The project is an original fictional WW1 western-front setting. It does not copy Battlefield 1 logos, screens, maps, models, textures, sound, or copy. Battlefield 1 supplies atmosphere direction only.

Primary users:

- First-time Korean player: identifies the mode, training purpose, and deploy action without translating mixed English labels.
- Competitive player: reads health, ammunition, objective, connection, and confirmed combat feedback in peripheral vision.
- Small-screen or zoom user: reaches close, back, and primary actions at 1366x768 and 200% browser zoom.
- Color- or motion-sensitive player: distinguishes states through text and shape and can reduce nonessential motion without losing recoil or aim information.

## 2. Color

### Palette

| Role | Token | Current examples | Target | Usage |
| --- | --- | --- | --- | --- |
| Base surface | `--ui-surface-0` | `#11141b`, `#111d23` | `#121714` | viewport and darkest modal surround |
| Raised surface | `--ui-surface-1` | `#10242b`, `#142b35` | `#1d2520` | panels, cards, HUD backing |
| Selected surface | `--ui-surface-2` | `#294048` | `#2b342d` | selected rows and raised controls |
| Paper surface | `--ui-surface-paper` | none | `#e6dec9` | rare inverse primary action |
| Paper ink | `--ui-ink` | none | `#20271f` | text on paper surface |
| Primary text | `--ui-text-primary` | `#eef`, `#f1f0e8` | `#f3f0e4` | headings, body, critical values |
| Secondary text | `--ui-text-secondary` | `#becbd0` | `#cfd0bf` | hints and supporting values |
| Muted text | `--ui-text-muted` | many 9-11px low-opacity labels | `#a8ad9c` | noncritical metadata only |
| Subtle border | `--ui-border-subtle` | translucent white | `#465044` | dividers and passive frames |
| Strong border | `--ui-border-strong` | mixed cyan/blue | `#88917d` | interactive control boundary |
| Accent | `--ui-accent` | `#edaa52`, `#e9b567` | `#d9b66d` | selection and primary action |
| Accent hover | `--ui-accent-hover` | `#ffcf83` | `#e9cb8f` | pointer hover only |
| Focus | `--ui-focus` | white or amber | `#f2d899` | 2px ring with 3px gap |
| Ally | `--ui-ally` | mixed blues/cyans | `#89c5e8` | ally status plus label/shape |
| Enemy | `--ui-enemy` | mixed reds | `#f29b85` | enemy status plus label/shape |
| Neutral | `--ui-neutral` | gray | `#e3decb` | unowned objective plus label/shape |
| Success | `--ui-success` | mixed green | `#a8cc91` | complete/connected |
| Warning | `--ui-warning` | yellow/amber | `#e9c36e` | waiting and caution |
| Error | `--ui-error` | mixed red | `#f0a496` | failure and destructive action |
| HUD backing | `--ui-hud-backing` | multiple blue-black gradients | `rgba(18,23,20,.92)` | readable text backing in sky/trench extremes |
| Modal scrim | `--ui-scrim` | multiple black alphas | `rgba(6,8,7,.78)` | blocking surfaces |

### Rules

- Body text meets 4.5:1 contrast; large text and meaningful UI boundaries meet 3:1.
- Brass accent identifies selection or action. It is not decorative body text.
- Ally, enemy, and neutral always include a label or distinct marker shape. Color alone never communicates ownership.
- Live HUD readability outranks period texture. No grain, paper fibers, blur, or animated dirt sits over text or the reticle.
- New player-interface colors are added here before code. World/rendering colors remain in their domain modules.

## 3. Typography

### Font stacks

- Korean/body: `"Noto Sans KR", "Malgun Gothic", system-ui, sans-serif` in weights 400, 500, and 700.
- Latin display: `"Barlow Condensed", "Noto Sans KR", "Malgun Gothic", sans-serif` in weights 600 and 700.
- Numeric/keys: inherit body with `font-variant-numeric: tabular-nums`; keycaps may use `ui-monospace, "SFMono-Regular", Consolas, monospace`.
- Self-hosted files and their licenses live at `public/assets/ui/fonts/`. A failed font request must retain readable metrics and layout through the fallback stack.

### Scale

| Level | Token | Size / line height | Weight | Usage |
| --- | --- | --- | --- | --- |
| Display | `--ui-type-display` | `clamp(48px, 7vw, 80px)` / .95 | 700 | menu wordmark only |
| Screen title | `--ui-type-screen` | `clamp(28px, 4vw, 40px)` / 1.1 | 700 | deploy and result title |
| Panel title | `--ui-type-panel` | 24px / 1.25 | 700 | modal title |
| Body/control | `--ui-type-body` | 16px / 1.5 | 400 or 500 | Korean body, buttons, fields |
| Important HUD | `--ui-type-hud` | 14px / 1.4 | 500 or 700 | objective, weapon, keycap, table, status |
| Metadata | `--ui-type-meta` | 12px / 1.4 | 500 | nonessential kicker only |
| Health | `--ui-type-health` | 32px / 1 | 700 | live health number |
| Ammunition | `--ui-type-ammo` | 40px / 1 | 700 | magazine count |
| Reserve | `--ui-type-reserve` | 18px / 1.2 | 500 | reserve ammunition |
| Score/time | `--ui-type-score` | 24px / 1.2 | 700 | round score and time |

Korean uses zero tracking and 1.5 line height. Uppercase Latin overlines may use positive tracking, but that rule never spills into Korean. Long Korean uses `text-wrap: pretty` and `overflow-wrap: anywhere` only for genuinely unbroken content. Critical labels never shrink below 14px.

## 4. Spacing and layout

The base unit is 4px. Tokens are `--ui-space-1:4px`, `--ui-space-2:8px`, `--ui-space-3:12px`, `--ui-space-4:16px`, `--ui-space-6:24px`, `--ui-space-8:32px`, `--ui-space-12:48px`, and `--ui-space-16:64px`. `--ui-safe-edge` is `clamp(16px, 2vw, 32px)`. Controls have `--ui-control-min:44px` minimum block size.

Menu, settings, and results use the `scroll-body-shell` contract:

```css
grid-template-rows: auto minmax(0, 1fr) auto;
max-block-size: 100dvh;
```

Only the body row scrolls and it has `min-block-size:0; overflow:auto`. Header and action footer remain available. No document-level or nested unnamed scrolling region is introduced.

- Wide deploy menu: mode/selection content and battlefield preview share an asymmetric two-column grid.
- Under 1024px: menu becomes one readable column; preview follows selection.
- Under 768px: tabs wrap; settings fields stack labels above controls.
- At 375px and 200% zoom: primary content is one column, no primary horizontal scroll, and fixed actions remain reachable.
- HUD uses `--ui-safe-edge`; the reticle exclusion area is reserved for confirmed combat feedback only.
- Settings maximum inline size is 960px and maximum block size is `calc(100dvh - 32px)`.

## 5. Components

### Button

- Structure: semantic `button.ui-button` with label span and optional busy status.
- Variants: default, accent, success, warning, error.
- States: default, hover, active/pressed, focus-visible, selected, disabled, loading.
- Accessibility: 44px minimum height, native disabled, `aria-pressed` for toggles, `aria-busy` for loading, visible focus ring.
- Motion: 100ms opacity/transform/color feedback; reduced motion removes transform.

### Status row

- Structure: `div.ui-status-row` containing label and value.
- Variants: default, success, warning, error.
- States: neutral, pending, confirmed, failed, empty.
- Accessibility: visible status word and edge marker; live announcements are set by the owning flow, not every row.

### Keycap

- Structure: `span.ui-keycap` with visible binding and accessible action label.
- States: default, capturing, unbound, conflict, disabled.
- Accessibility: 14px minimum type; the full action remains in `aria-label`.

### Field

- Structure: `label.ui-field` with label, control slot, optional hint and status.
- States: default, focus-within, disabled, valid, error, saving, save-failed.
- Layout: label/control row on wide surfaces; stack below 768px.

### Tabs

- Structure: `div.ui-tabs[role=tablist]` containing `button.ui-tab[role=tab]`.
- States: default, hover, focus-visible, selected, disabled.
- Accessibility: arrow-key behavior belongs to the panel owner; `aria-selected` and controlled panel IDs are required.

### Scroll modal

- Structure: `.ui-scroll-modal` grid with `__header`, `__body`, and `__footer`.
- Scroll owner: only `__body`; header/close and footer/actions remain fixed.
- States: open, loading, empty, error, blocking/recovery.
- Accessibility: labelled dialog, modal semantics when blocking, initial focus and prior-focus restoration.

### Map legend

- Structure: `.ui-map-legend` list of `.ui-map-legend__item` with marker, label, and state.
- Variants: ally, enemy, neutral.
- Accessibility: marker shape and text supplement color; no enemy information beyond authoritative scope.

### Field-order panel

- Structure: content region with one logical-edge rule, kicker, title, body, and optional actions.
- Usage: deploy briefing, connection status, training step, result header.
- Rule: the edge and brass accent serve hierarchy; no decorative motion or texture overlays.

## 6. Motion and interaction

| Token | Value | Purpose |
| --- | --- | --- |
| `--ui-motion-fast` | 100ms ease-out | press, focus, selected-state feedback |
| `--ui-motion-panel` | 160ms ease-out | panel opacity/transform entry and exit |

Only opacity and transform animate. Motion communicates an input response, state transition, or focus change. No decorative looping animation is allowed. `prefers-reduced-motion: reduce` and `[data-reduced-motion="true"]` remove transforms and nonessential entry motion while retaining aim, recoil, reload, and authoritative state cues.

## 7. Depth and surface

Strategy: **mixed tonal shift with borders**. Surface hierarchy comes from `--ui-surface-0/1/2`; thin borders and the field-order edge clarify interactive and blocking boundaries. Shadows are limited to blocking modal separation and never carry hierarchy alone. Radii are `--ui-radius-control:2px` and `--ui-radius-panel:4px`, preserving the squared field-equipment character.

HUD panels use a stable high-opacity backing and no blur. Menu imagery sits behind an opaque directional shade so text contrast does not depend on the image. The implementation does not use generic glassmorphism.

## 8. Accessibility constraints and accepted debt

### Constraints

- WCAG target: 2.2 AA; body 4.5:1, large text and UI boundaries 3:1.
- Every interactive element is keyboard reachable with visible focus. Dialogs trap focus, Escape cancels key capture before closing, and close restores prior focus when it still exists.
- Player names and long Korean content cannot remove actions, force horizontal scrolling, or create one-character orphan lines in primary instructions.
- Screen reader labels name the action and current state. Training step changes and connection/result changes use deliberate live regions without duplicate announcements.
- Menus and dialogs survive 375px, 1366x768, 1440x900, 1920x1080, ultrawide, and 200% zoom. Mobile testing covers menu/settings/results access, not desktop FPS play.
- Reduced motion, color alternatives, font failure, empty content, and unbroken-string stress are mandatory visual scenarios.

### Accepted debt

| ID | Location | Reason | Owner / exit |
| --- | --- | --- | --- |
| UI-D01 | Existing mode/settings/HUD modules | Current raw colors, 8-12px critical labels, mixed fonts, and multiple injection styles predate task 4. | C removes them task-by-task in UI-02 through UI-07; each migrated module must use these tokens. |
| UI-D02 | Live game integration | I-owned `main.ts` cannot consume the token installer until the integration patch is applied after Task 1 sequencing. | C supplies exact patch; I integrates and validates before task 4 closes. |
| UI-D03 | Browser viewport/pointer-lock evidence | E's Task 6 runner may report unsupported exact viewport or lock control. This cannot be treated as PASS. | E/C retain UNQUALIFIED until actual capability exists; independent source/build work continues. |

No Critical or Major accessibility debt is accepted. Any such finding blocks completion until repaired or explicitly decided by the user.
