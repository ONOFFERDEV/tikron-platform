# Stream "look" — lighting, post, atmosphere, VFX, decals and HUD/menu skin (late-WW1 front)

You are one of four astra streams working on ironsight at the same time, each in its own
git worktree on its own branch. Your worktree is `D:/wt-ironsight-look`, your branch is
`ironsight-ww1-look`, your dev-server port is **8803**, and you log every session to
`apps/ironsight/AAA-PLAN-LOOK.md` (create it; never touch `AAA-PLAN.md`).

Read `tools/aaa-loop-brief.md`, `ART-CONCEPT.md` (WW1 version), `DESIGN.md` and
`docs/HITCH-GATE.md` first — they govern rules, look, the UI contract and the stall gate
you own. This file defines your lane.

## Your job

Everything that is light, air, impact and screen:

1. **Per-map light rig and exposure** — arena1 hard noon sun with long shadows and strong
   contact AO, arena2 low dusk with dark interiors readable against the sky, arena3 flat
   overcast grey with wet-surface response; tonemapping and a colour grade that reads
   desaturated olive / grey-brown / rust with colour coming from light, not paint.
2. **Atmosphere** — haze with depth, dust motes, smoke columns on the skyline, drifting
   ground smoke, heat shimmer — as cheap fakes (billboards, screen-space, baked) that never
   block server-known sight lines; wind and distant motion so the world is not still.
3. **Impact and weapon VFX** — muzzle blast dust, tracers, spent brass, dust puffs, spall,
   ricochet sparks, scorch and bullet-hole decals, explosion shockwave and debris, camera
   weight (sway, landing dip, blast shake, lens dust), the damage vignette.
4. **The 3D presentation cameras** — deployment fly-through, killcam and drone/support
   views — as camera, framing and grade work. The menu and HUD skin belongs to the "ui"
   stream, not to you.

Rules that bite here: the real-time light count stays constant (a hidden light is a removed
light and recompiles every lit material), no extra render passes, no per-frame CPU bakes,
60 fps on a mid laptop iGPU, and the hitch gate stays green — you own `scripts/hitch-*.mjs`
and `docs/HITCH-GATE.md`, so a stall caused by any lane's new textures or effects is yours
to diagnose and prove fixed (five consecutive passes). `client/scene.ts` and
`client/main.ts` are hub files you own: keep your edits to them small, and apply the
cross-stream hook requests the supervisor relays from world and kit promptly. Evidence every
session: before/after stills at the same fixed camera per map, a 20-second bot-round
capture for VFX, frame-time and draw-call deltas, and the one sentence a first-time player
would say.

## Files you own (only these)

`client/scene.ts`, `client/main.ts`, `client/scene-*.ts`, `client/site-lighting.ts`,
`client/site-atmosphere.ts`, `client/vfx.ts`, `client/combat-fx.ts`, `client/weapon-flash.ts`,
`client/mortar-fx.ts`, `client/blast-trauma.ts`, `client/shot-feedback.ts`,
`client/contact-presentation.ts`, `client/damage-direction.ts`, `client/scope-glint.ts`,
`client/recon-flyover.ts`, `client/*-view.ts`, `client/sentry-drone.ts`,
`client/compositor-inspect.ts`, `config/visuals.ts`,
`public/assets/ui/damage-vignette.png`, `public/assets/*.hdr`, `public/assets/*-sky.png`,
`tools/bake-environment.py`, `tools/bake-*-sky.py`, `tools/bake-damage-vignette.mjs`,
`scripts/hitch-*.mjs`, `scripts/compositor-trace-summary.mjs`, `docs/HITCH-GATE.md`,
`AAA-PLAN-LOOK.md`, tests that exercise only these files, and new files under `.inspect/`.

Allowlists: you may add lines for new sky/LUT/VFX assets to `.gitignore`,
`scripts/audit-assets.mjs` and `public/assets/README.md` — append only, inside a block
marked `# look` (create it) so merges stay clean.

## Files other streams own — do not edit

- **world** (maps, environment art, set dressing): `src/map/**`, `client/relay-*.ts`,
  `client/switchyard-*.ts`, `client/undertow-*.ts`, `client/site-architecture.ts`,
  `client/site-ground.ts`, `client/site-wedge.ts`, `client/terrain-geometry.ts`,
  `client/concrete-detail.ts`, `client/dressing-loader.ts`, `client/dressing/**`,
  `client/map-environment-props.ts`, `client/prop-library.ts`, `client/environment-*.ts`,
  `client/cargo-*.ts`, `client/flood-works.ts`, `client/signal-array.ts`, `client/signal-core.ts`,
  `config/ww1-environment.ts`, `public/assets/maps/**`, `public/assets/props/**`,
  `public/assets/ww1/environment/**`, `public/assets/*-vista.webp`, `tools/bake-ground-ao.py`,
  `tools/bake-architecture.py`, `tools/bake-relay-skyline.py`, `tools/dump-*.mjs`,
  `tools/build-ww1-environment.mjs`, `tools/render-ww1-environment.py`, `tools/audit-relay-*.mjs`,
  `tools/audit-switchyard-*.mjs`, `tools/audit-undertow-*.mjs`, `docs/WW1-MAPS.md`,
  `AAA-PLAN-WORLD.md`.
- **kit** (soldiers, weapons, first-person arms, animation, Meshy): `client/remote-weapon.ts`,
  `client/rifle-*.ts`, `client/weapon-*.ts` (except `weapon-flash.ts`), `client/reload-presentation.ts`,
  `client/actor-appearance.ts`, `client/calibrated-*.ts`, `client/field-equipment.ts`,
  `client/equipment-finish.ts`, `client/operator-kit.ts`, `client/hand-geometry.ts`,
  `client/viewmodel-*.ts`, `client/procedural-viewmodel-hands.ts`, `client/rig-*.ts`,
  `client/shared-gltf-cache.ts`, `client/hit-inspection-pose.ts`, `config/ww1-assets.ts`,
  `config/ww1-*.json`, `public/assets/ww1/{characters,weapons,support}/**`,
  `public/assets/models/**`, `public/assets/weapons/**`, `tools/*ww1*`, `tools/fit-*.py`,
  `tools/meshy-*.mjs`, `tools/shrink-glb.py`, `scripts/*ww1*`, `scripts/inspect-rig.mjs`,
  `docs/VIEWMODEL-FIT.md`, `AAA-PLAN-KIT.md`.
- **ui** (menu, HUD, match presentation skin; worktree `D:/wt-ironsight-ui`, port 8804):
  `client/hud.ts`, `client/*-hud.ts`, `client/mode-select.ts`, `client/intermission.ts`,
  `client/match-presentation.ts`, `client/map-presentation.ts`, `client/deployment-banner.ts`,
  `client/deployment-presentation.ts`, `client/deployment-intro.ts`, `client/round-honors.ts`,
  `client/settings-ui.ts`, `client/quit-confirm.ts`, `client/connection-quality.ts`,
  `client/training-coach.ts`, `client/tactical-map.ts`, `client/ui/**`,
  `client/compositor-preparation.ts`, `public/index.html`, `public/assets/ui/**` (except the
  damage vignette), `scripts/build-ui-showcase.mjs`, `scripts/contrast-probe.mjs`,
  `DESIGN.md`, `AAA-PLAN-UI.md`. The compositor pre-render that keeps the first fight
  stall-free is split: ui owns the preparation module, you own the inspector and the gate,
  so tell ui through a cross-stream request when its new DOM or CSS effects need covering.
- **Nobody this phase (visuals only; supervisor-owned)**: `src/**`, `client/net.ts`,
  `client/predict.ts`, `client/input.ts`, `client/fire-input.ts`, `client/audio*.ts`,
  `client/spatial-audio.ts`, `client/weapon-sound.ts`, `client/settings.ts`, `client/config.ts`,
  `client/map-inspect*.ts`, `client/training-*.ts`, `client/ping-*.ts`,
  `client/combat-telemetry*.ts`, `config/ww1-content.ts`, `docs/WW1-CONTRACTS.md`,
  `tools/aaa-*`, `scripts/inspect-map.mjs`, `scripts/inspection-lease.mjs`,
  `ART-CONCEPT.md`, `AAA-PLAN.md`.

If your work truly needs a change in someone else's file (a decal receiver on a world
material, an emissive on a kit weapon), do not make it: write the exact request under
`## Cross-stream requests` in your plan file and the supervisor routes it. Other astra
sessions are editing this repo in other worktrees right now.
