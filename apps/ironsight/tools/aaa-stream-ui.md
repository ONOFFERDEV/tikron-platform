# Stream "ui" — menu, HUD and match presentation skin (late-WW1 front)

You are one of four astra streams working on ironsight at the same time, each in its own
git worktree on its own branch. Your worktree is `D:/wt-ironsight-ui`, your branch is
`ironsight-ww1-ui`, your dev-server port is **8804**, and you log every session to
`apps/ironsight/AAA-PLAN-UI.md` (create it; never touch `AAA-PLAN.md`).

Read `tools/aaa-loop-brief.md`, `DESIGN.md` (the UI contract and its recorded WW1 target)
and the WW1 `ART-CONCEPT.md` first. This file defines your lane.

## Your job

Every screen and overlay the player reads, re-skinned from clean stylised sci-fi to a
late-WW1 field aesthetic that still wins on readability: the deployment menu and map/mode
cards, the in-match HUD (health, ammo, weapon, objective bar, capture progress, streak
gauges, compass and threat direction), the kill feed and kill-confirm banner, the
scoreboard and round debrief, the intermission and result screens, the settings and
training coach panels, the connection and reconnect overlays, and the loading screen.

Work the design system first and the screens second: typography (a period-plausible
military stencil or slab for headings, a neutral face for numbers — Korean glyph coverage
is required, so verify any webfont has Hangul or keep a system fallback), colour tokens
(desaturated olive, grey-brown, rust, faded safety amber; colour carries meaning, never
decoration), frames and plates (stamped metal, stencilled labels, field-card paper),
iconography, spacing and motion. Then apply them screen by screen, one coherent pass per
session rather than a scattering of tweaks.

Hard rules in this lane:
- **Skin only.** No flow change, no new state, no rebinding, no gameplay data on screen
  that is not there today. If a screen's structure genuinely blocks the look, request the
  change instead of making it.
- **Readability outranks period feel.** Enemy-related colour stays user-selectable,
  contrast stays legible at 1280x720 and at 200% zoom, and reduced-motion must still work.
- **No graphics or UI setting may reveal or hide gameplay information.**
- Korean copy is already in place on several screens; keep it correct and never let a font
  choice drop Hangul, long names or rebinding labels.
- DOM and CSS effects are compiled by the browser's compositor on first paint, which is the
  known cause of the first-fight stall this project fixed once already: anything new you add
  must be covered by the loading-time pre-render, and the hitch gate must stay green.

Evidence every session: before/after captures of every screen you touched at 1920x1080 and
1280x720, a 200% zoom check on one dense screen, and the one sentence a first-time player
would say.

## Files you own (only these)

`client/hud.ts`, `client/*-hud.ts`, `client/mode-select.ts`, `client/intermission.ts`,
`client/match-presentation.ts`, `client/map-presentation.ts`, `client/deployment-banner.ts`,
`client/deployment-presentation.ts`, `client/deployment-intro.ts`, `client/round-honors.ts`,
`client/settings-ui.ts`, `client/quit-confirm.ts`, `client/connection-quality.ts`,
`client/training-coach.ts`, `client/tactical-map.ts`, `client/ui/**`,
`client/compositor-preparation.ts`, `public/index.html`, `public/assets/ui/**` (except
`damage-vignette.png`, which is the look stream's blast effect),
`scripts/build-ui-showcase.mjs`, `scripts/contrast-probe.mjs`, `DESIGN.md`,
`AAA-PLAN-UI.md`, tests that exercise only these files, and new files under `.inspect/`.

Allowlists: you may add lines for new UI fonts, plates and icons to `.gitignore`,
`scripts/audit-assets.mjs` and `public/assets/README.md` — append only, inside a block
marked `# ui` (create it) so merges stay clean.

## Files other streams own — do not edit

- **world** (maps, environment art, dressing): `src/map/**`, `client/relay-*.ts`,
  `client/switchyard-*.ts`, `client/undertow-*.ts`, `client/site-architecture.ts`,
  `client/site-ground.ts`, `client/site-wedge.ts`, `client/terrain-geometry.ts`,
  `client/concrete-detail.ts`, `client/dressing-loader.ts`, `client/dressing/**`,
  `client/map-environment-props.ts`, `client/prop-library.ts`, `client/environment-*.ts`,
  `client/cargo-*.ts`, `client/flood-works.ts`, `client/signal-array.ts`,
  `client/signal-core.ts`, `config/ww1-environment.ts`, `public/assets/maps/**`,
  `public/assets/props/**`, `public/assets/ww1/environment/**`, `AAA-PLAN-WORLD.md`.
- **kit** (soldiers, weapons, first-person arms, Meshy): `client/remote-weapon.ts`,
  `client/rifle-*.ts`, `client/weapon-*.ts`, `client/reload-presentation.ts`,
  `client/actor-appearance.ts`, `client/calibrated-*.ts`, `client/field-equipment.ts`,
  `client/equipment-finish.ts`, `client/operator-kit.ts`, `client/hand-geometry.ts`,
  `client/viewmodel-*.ts`, `client/procedural-viewmodel-hands.ts`, `client/rig-*.ts`,
  `config/ww1-assets.ts`, `config/ww1-*.json`, `public/assets/ww1/{characters,weapons,support}/**`,
  `public/assets/models/**`, `public/assets/weapons/**`, `tools/*ww1*`, `tools/meshy-*.mjs`,
  `scripts/*ww1*`, `AAA-PLAN-KIT.md`.
- **look** (lighting, post, atmosphere, VFX, decals, 3D hub files): `client/scene.ts`,
  `client/main.ts`, `client/scene-*.ts`, `client/site-lighting.ts`, `client/site-atmosphere.ts`,
  `client/vfx.ts`, `client/combat-fx.ts`, `client/weapon-flash.ts`, `client/mortar-fx.ts`,
  `client/blast-trauma.ts`, `client/shot-feedback.ts`, `client/contact-presentation.ts`,
  `client/damage-direction.ts`, `client/scope-glint.ts`, `client/recon-flyover.ts`,
  `client/*-view.ts`, `client/sentry-drone.ts`, `client/compositor-inspect.ts`,
  `config/visuals.ts`, `public/assets/*.hdr`, `public/assets/*-sky.png`,
  `scripts/hitch-*.mjs`, `docs/HITCH-GATE.md`, `AAA-PLAN-LOOK.md`.
- **Nobody this phase (visuals only; supervisor-owned)**: `src/**`, `client/net.ts`,
  `client/predict.ts`, `client/input.ts`, `client/fire-input.ts`, `client/audio*.ts`,
  `client/spatial-audio.ts`, `client/weapon-sound.ts`, `client/settings.ts`,
  `client/config.ts`, `client/map-inspect*.ts`, `client/ping-*.ts`,
  `client/combat-telemetry*.ts`, `config/ww1-content.ts`, `docs/WW1-CONTRACTS.md`,
  `tools/aaa-*`, `scripts/inspect-map.mjs`, `scripts/inspection-lease.mjs`,
  `ART-CONCEPT.md`, `AAA-PLAN.md`.

`client/settings.ts` holds stored settings and is not yours; `client/settings-ui.ts` is the
screen and is. If your work truly needs a change in someone else's file, do not make it:
write the exact request under `## Cross-stream requests` in your plan file and the
supervisor routes it. Three other astra sessions are editing this repo right now.
