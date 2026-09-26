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
- Deployment wordmark only: `--ui-font-wordmark: "Stardos Stencil", "Barlow Condensed", "Noto Sans KR", "Malgun Gothic", sans-serif`, weight 700. The self-hosted Latin stencil carries the field-equipment identity; all Korean copy retains the body stack. It uses the existing display scale and never changes live HUD typography.

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

### Deployment field desk

- Reuse the existing header/body/footer DOM and shared button states. The body uses two non-overlapping columns above 1024px: briefing at left, a field-order map plate at right; mode plates span both columns. Below 1024px, the existing content reflows to one column and only the body scrolls.
- Map diagrams use the paper surface, ink high cover, subtle-border low cover and ink-outlined paper ramps inside their plate (minimum mark/boundary contrast 3:1). These are the same collision-derived rectangles and ramps, with no new information. The image behind the menu keeps its existing two directional gradients, now mixed from surface tokens; below 1024px the scrim protects the full text width. No filters, blur or text shadows.
- Mode plates place the Korean label above the English descriptor visually. Labels and objectives are at least 14px; nonessential metadata is 12px. Korean has zero tracking and `word-break: keep-all`, with overflow wrapping for unbroken stress strings. Authored detail and route phrases stay together in inline spans, split only at the existing slash/bullet separators; wording and information stay identical.
- Selection uses the shared button edge and a stable border, without changing control dimensions. Unselected, hovered, focused and selected controls remain distinct under font failure and reduced motion.

### Live field instruments

- Health, ammunition, weapon slots, match instructions, capture labels, kill feed and confirmed elimination use the existing body/numeric scale and stable HUD backing. Critical labels are 14px or larger with zero tracking for Korean; existing English identifiers retain their copy.
- Square field plates use the existing border and edge tokens. No new gradient, filter, blur, shadow, texture or animation is introduced. Existing reticle and damage effects retain their appearance.
- The kill feed and server event log share a right-hand grid column, with intrinsic rows so four feed entries cannot paint over server confirmations. Objective status sits below the match brief and above the existing capture gauges. Content and authoritative gating are unchanged.
- HUD-specific geometry: right column `--hud-log-width:clamp(280px,28vw,400px)`, center width `--hud-center-width:min(40vw,520px)`, vitals width 208px, ammo width 176px, capture columns 96px. Below 900px the loadout moves above the vitals; these dimensions place instruments, never reduce type size. The center aim point remains clear.
- At desktop gameplay sizes, the connection and input-latency plates precede the training coach (safe edge + 316px). Bottom-left hint, ping notice and radio plates use safe edge + 88px, +160px and +252px respectively so backgrounds have a visible gap. The compact FFA table retains 14px text with 1.4 line height.
- Ping hints size to their content up to 360px and the viewport safe edges, so valid long rebinding labels retain two lines alongside the completed coach.
- Ping-hint phrases separated by bullets/slashes/newlines and the three-word training completion suffix stay together; words and separators remain identical. Completed training plates use 12px block padding and an 8px action gap to keep a clear separation from the hint.
- Existing loading-time HUD clones pre-paint these same plates. The preparation fixture also includes authoritative objective, shot-confirmation and reload rows; no live game state or input is used.

### Match field reports (Session 4)

- The existing result header/body/footer shell remains intact. A paper header carries the outcome at screen scale, the existing mode label at HUD scale and the final score at score scale. All align to the same left report margin; the score stays at the opposite edge. Defeat/draw retain their explicit outcome words, with the neutral ink maintaining paper contrast.
- Honors use the raised olive plate and one brass rule. Its title is at least 14px, its name 24px, with natural Korean wrapping. Personal figures form one compact three-column ledger even on narrow screens. Roster names receive 64% of each table, with the two numeric columns sharing the remainder; full existing compact names remain available through wrapping.
- Only the body scrolls. Header and footer retain their existing actions/status. At 767px the roster becomes one column; footer actions wrap using the existing 44px button primitive. Result buttons explicitly use the shared primitive states so legacy overlay selectors cannot override them. There is no new motion.
- The deployment banner retains its current timing, location, labels and progress segments. It uses a paper countdown stamp, body-font Korean instructions, and olive framing. Local layout tokens: `--report-name-column:64%`, `--deployment-count-width:104px`, `--deployment-count-size:clamp(40px,4vw,64px)`, `--deployment-top:146px` (202px below 800px). These are geometry for existing content, not new information. Countdown/go/waiting/standby share the same material; the go state uses the existing success token.
- No new asset, gradient, filter, blur, shadow or animation. Result and banner variants are painted by the existing loading-time preparation; disabled controls, draw/defeat results and the go variant are included in those inert copies. Existing shared hover/focus effects are unchanged.

### Field service panels (Session 5)

- Settings retains its existing three tabs, header/body/footer shell and 760px maximum width. A paper header identifies the sheet; selected tabs use the same paper/ink treatment, while the body stays olive. Ruled setting rows, brass native range/checkbox controls and right-aligned numeric outputs make values readable without replacing native inputs. Local geometry: `--settings-value-width:64px`; existing 820px height cap remains. At 767px labels stack above controls; only the body scrolls and actions remain fixed.
- Binding labels use the Korean body face and key values use tabular figures, with wrapping for unbroken labels. Checkboxes are 24px inside their existing 44px label targets. Critical instructions, save states and bindings are at least 14px. Headers, labels and hints use zero tracking and Korean word preservation.
- Loading, control acquisition, preparation failure, reconnect and expired states retain the existing deployment-flow DOM, copy and action conditions. The shared service card is at most 560px wide with a paper status strip, a readable body-font title, an olive body and a ruled stage row. Error/success edges supplement the existing status words. Pause and legacy HUD connection cards use the same framing. Compact-height/narrow layouts reduce padding; they never scale text or hide information.
- At 420px and below, service titles use the existing 24px panel scale and natural wrapping so complete Korean recovery/expired clauses fit without separating their predicates. Primary recovery/resume actions use paper/ink; secondary and destructive actions keep the shared button states. No added blur, gradient, shadow, animation, font or asset. The existing preparation paints normal/error/ready flow plates, both connection states, pause and every settings tab with checked and capture variants in inert copies.

### Field dispatch and casualty plates (Session 6)

- Support retains the existing 3/5/7 pips, words, eligibility and announcement durations. The meter uses a paper heading over an olive instrument plate; filled pips are brass and unfilled pips have the strong boundary tone. Both the meter and dispatch use 14px body text, tabular figures and natural Korean wrapping. Existing mortar readiness gives the edge its brass emphasis; no new state is inferred.
- Dispatches occupy the lower-center notice strip, below confirmed eliminations and above the loadout at desktop sizes. The persistent support instrument remains above ammunition at right. This keeps the center objective and reticle clear without changing the DOM or event flow. Local geometry: `--support-width:288px`, `--support-bottom:112px`, `--dispatch-width:560px`, notice bottom safe edge + 44px, `--support-icon:32px`, `--support-icon-column:56px`. Width is capped at viewport safe edges. Compact height uses the existing 14px type with 8px padding. Narrow views retain readable plates; full mobile combat remains a separate layout arc.
- The existing recon silhouette stays; the seven-kill dispatch uses a two-wing biplane silhouette in the same CSS icon slot, and mortar keeps its shell. These are identity marks accompanying the existing full text, never new game information. No new asset or effect is required.
- Death retains the exact eliminated/killer/automatic-respawn text and timing. The existing direct children form a 560px maximum casualty slip: paper heading, olive killer row and a ruled tabular countdown row, with an error edge. Long names wrap; unknown killer and respawning-now use the same slip. The overlay keeps its current bottom placement and compositing promotion. No new scrim, animation, gradient, filter or shadow is added.
- Streak text keeps its existing location and fade, with a paper/ink field stamp and brass edge. Loading-time clones paint death/streak and each support icon with both empty and filled pips. All decoration is inert and never changes gameplay visibility.

### Calm HUD and 1918 field cards (Session 14)

- Live HUD weight goes to the reticle, health/ammunition and the objective brief. Secondary groups keep every word but use one quiet backing per group: `--ui-hud-quiet` (`rgba(18,23,20,.7)`). This covers the kill feed, shot-confirmation log, weapon bar, mode label and support card. Rows inside a group have no plate or frame. The local and victim feed rows keep their 3px accent/error edge. Small text on the quiet backing uses secondary text, never muted, so it holds 4.5:1 over bright sky.
- The support card drops its paper header and becomes a quiet instrument with the same words, pips and mortar-ready edge.
- Ping/backup key hints use the quiet backing and fade after the first 60s of each life. The hint is hidden while dead, so the timer restarts on respawn. Under reduced motion the fade is instant. This is the only HUD fade; nothing authoritative fades.
- Menu, results, casualty slip and deployment screens use field-card materials, all CSS: paper (`--ui-surface-paper` with ink fibre gradients and an aged edge), ruled paper (a 28px rule), olive canvas weave, and the rust stamp ink `--ui-stamp` (`#8f3f24`, 5.4:1 on paper). Stamps are bordered labels rotated 1–2°, with Korean zero tracking. The fictional regimental insignia (roundel, dotted ring, chevron, crossed rifles) is an inline SVG mask that takes a token colour. None of this is used on the live instruments.
- The menu shade is lighter so the vista reads: 88% at the text edge, 8% at the far edge. The intel card is ruled paper with ink text; the selected mode card is paper; the header mark is the insignia.
- Deployment and redeploy screens show the current site's vista under a bottom-weighted shade. The site comes from `:root[data-site]`, set when the HUD learns the site. The vista is decoded in the loading-time preparation, so first death adds no decode.

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
