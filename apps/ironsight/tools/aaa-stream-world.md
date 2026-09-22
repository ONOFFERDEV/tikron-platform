# Stream "world" — maps, environment art and set dressing (late-WW1 front)

You are one of three astra streams working on ironsight at the same time, each in its own
git worktree on its own branch. Your worktree is `D:/wt-ironsight-world`, your branch is
`ironsight-ww1-world`, your dev-server port is **8801**, and you log every session to
`apps/ironsight/AAA-PLAN-WORLD.md` (create it; never touch `AAA-PLAN.md`).

Read `tools/aaa-loop-brief.md`, `ART-CONCEPT.md` (WW1 version) and `docs/WW1-MAPS.md`
first — they govern rules and look. This file defines your lane.

## Your job

Make the three maps read as **places on a late-WW1 front at first glance**:
arena1 signal station (hard daylight, timber communications shelter, mast, field-telephone
positions, dust and distant smoke behind a defended yard), arena2 underpass trench (wet
masonry, dugouts, drainage, low dusk light, dark interiors readable against the sky),
arena3 front supply depot (overcast rail unloading, timber platforms, ammunition stacks,
wagons, bomb damage; modern transformer/container language removed).

Work the surfaces and materials (tiling detail: mud, brick, timber, sandbag, rusted steel,
water marks), damage and debris, emplacements, a built boundary instead of a fence, prop
density (cover every 8-12 m, three scales: skyline, room-sized, human-scale), ground and
architecture AO bakes, skyline scale, and the per-map atmosphere hand-off points the
"look" stream lights. Collision stays the sole authority: render geometry never creates or
removes cover; if you change a collider layout, re-bake AO and re-run the map audits.
Every session ships before/after stills at a fixed camera per touched map, an overhead,
bytes/frame-time deltas, and the one sentence a first-time player would say.

## Files you own (only these)

`src/map/**`, `client/relay-*.ts`, `client/switchyard-*.ts`, `client/switchyard-overcast.json`,
`client/undertow-*.ts`, `client/undertow-dusk.json`, `client/site-architecture.ts`,
`client/site-ground.ts`, `client/site-wedge.ts`, `client/terrain-geometry.ts`,
`client/concrete-detail.ts`, `client/dressing-loader.ts`, `client/dressing/**`,
`client/map-environment-props.ts`, `client/prop-library.ts`, `client/environment-*.ts`,
`client/cargo-*.ts`, `client/flood-works.ts`, `client/signal-array.ts`, `client/signal-core.ts`,
`config/ww1-environment.ts`, `public/assets/maps/**`, `public/assets/props/**`,
`public/assets/ww1/environment/**`, `public/assets/*-vista.webp`, `tools/bake-ground-ao.py`,
`tools/bake-architecture.py`, `tools/bake-relay-skyline.py`, `tools/dump-*.mjs`,
`tools/build-ww1-environment.mjs`, `tools/render-ww1-environment.py`, `tools/weather-architecture.py`,
`tools/audit-relay-*.mjs`, `tools/audit-switchyard-*.mjs`, `tools/audit-undertow-*.mjs`,
`scripts/audit-architecture.py`, `docs/RELAY-*.md`, `docs/SWITCHYARD-*.md`,
`docs/UNDERTOW-*.md`, `docs/STRUCTURES.md`, `docs/WW1-MAPS.md`, `AAA-PLAN-WORLD.md`,
tests that exercise only these files, and new files under `.inspect/`.

Allowlists: you may add lines for new environment assets to `.gitignore`,
`scripts/audit-assets.mjs` and `public/assets/README.md` — append only, inside a block
marked `# world` (create it) so merges stay clean.

## Files other streams own — do not edit

- **kit** (soldiers, weapons, first-person arms, animation, Meshy): `client/remote-weapon.ts`,
  `client/rifle-*.ts`, `client/weapon-*.ts`, `client/reload-presentation.ts`,
  `client/actor-appearance.ts`, `client/calibrated-*.ts`, `client/field-equipment.ts`,
  `client/equipment-finish.ts`, `client/operator-kit.ts`, `client/hand-geometry.ts`,
  `client/viewmodel-*.ts`, `client/procedural-viewmodel-hands.ts`, `client/rig-*.ts`,
  `client/shared-gltf-cache.ts`, `client/hit-inspection-pose.ts`, `config/ww1-assets.ts`,
  `config/ww1-*.json`, `public/assets/ww1/{characters,weapons,support}/**`,
  `public/assets/models/**`, `public/assets/weapons/**`, `tools/*ww1*` (except the two
  environment ones above), `tools/fit-*.py`, `tools/meshy-*.mjs`, `tools/shrink-glb.py`,
  `tools/bake-rifle-hold.mjs`, `tools/audit-viewmodel.mjs`, `scripts/*ww1*`,
  `scripts/inspect-rig.mjs`, `docs/VIEWMODEL-FIT.md`, `AAA-PLAN-KIT.md`.
- **look** (lighting, post, atmosphere, VFX, decals, HUD/menu skin, hub files):
  `client/scene.ts`, `client/main.ts`, `client/scene-*.ts`, `client/site-lighting.ts`,
  `client/site-atmosphere.ts`, `client/vfx.ts`, `client/combat-fx.ts`, `client/weapon-flash.ts`,
  `client/mortar-fx.ts`, `client/blast-trauma.ts`, `client/shot-feedback.ts`,
  `client/contact-presentation.ts`, `client/damage-direction.ts`, `client/scope-glint.ts`,
  `client/hud.ts`, `client/*-hud.ts`, `client/tactical-map.ts`, `client/deployment-*.ts`,
  `client/intermission.ts`, `client/match-presentation.ts`, `client/map-presentation.ts`,
  `client/mode-select.ts`, `client/settings-ui.ts`, `client/round-honors.ts`,
  `client/recon-flyover.ts`, `client/*-view.ts`, `client/sentry-drone.ts`, `client/ui/**`,
  `client/compositor-*.ts`, `config/visuals.ts`, `public/index.html`, `public/assets/ui/**`,
  `public/assets/*.hdr`, `public/assets/*-sky.png`, `tools/bake-environment.py`,
  `tools/bake-*-sky.py`, `tools/bake-damage-vignette.mjs`, `scripts/hitch-*.mjs`,
  `DESIGN.md`, `docs/HITCH-GATE.md`, `AAA-PLAN-LOOK.md`.
- **Nobody this phase (visuals only; supervisor-owned)**: `src/**` except `src/map/**`,
  `client/net.ts`, `client/predict.ts`, `client/input.ts`, `client/fire-input.ts`,
  `client/audio*.ts`, `client/spatial-audio.ts`, `client/weapon-sound.ts`, `client/settings.ts`,
  `client/config.ts`, `client/map-inspect*.ts`, `client/training-*.ts`, `client/ping-*.ts`,
  `client/combat-telemetry*.ts`, `config/ww1-content.ts`, `docs/WW1-CONTRACTS.md`,
  `tools/aaa-*`, `scripts/inspect-map.mjs`, `scripts/inspection-lease.mjs`,
  `ART-CONCEPT.md`, `AAA-PLAN.md`.

If your work truly needs a change in someone else's file (a hook in `scene.ts`, a new
soldier prop from kit, a light rig from look), do not make it: write the exact request
under `## Cross-stream requests` in your plan file and the supervisor routes it. Other
astra sessions are editing this repo in other worktrees right now.
