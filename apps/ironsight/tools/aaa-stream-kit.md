# Stream "kit" — soldiers, weapons, first-person arms and animation (late-WW1 front)

You are one of four astra streams working on ironsight at the same time — kit (you),
world (maps, environment art), look (lighting, post, atmosphere, VFX) and ui (menu, HUD
and match presentation skin, worktree `D:/wt-ironsight-ui`, which owns the screen files
the "look" list below attributes to look). Each runs in its own
git worktree on its own branch. Your worktree is `D:/wt-ironsight-kit`, your branch is
`ironsight-ww1-kit`, your dev-server port is **8802**, and you log every session to
`apps/ironsight/AAA-PLAN-KIT.md` (create it; never touch `AAA-PLAN.md`).

Read `tools/aaa-loop-brief.md`, `ART-CONCEPT.md` (WW1 version), `config/ww1-assets.ts`
and `docs/VIEWMODEL-FIT.md` first — they govern rules, look and the asset admission flow.
This file defines your lane.

## Your job

Everything the player looks at that is a person or a gun, in first and third person:

1. **Two original wool-uniform soldiers** — khaki vs field-grey torso value, different
   helmet outlines and webbing placement, canteen/pack/blanket-roll kit variants; enemy
   readability preserved (rim/fresnel highlight and a large torso colour mass, colour
   user-selectable); LODs, materials and triangle budgets exactly as `config/ww1-assets.ts`
   states. Hit reactions and deaths that read at 30 m.
2. **Five wood-and-steel service weapons** with iron sights and visible mechanical motion
   (magazine, bolt, slide, pump, clip, shell) in first and third person; worn wood and
   blued steel finishes; correct grip/muzzle/eject/sight sockets.
3. **First-person arms** — sleeves, hands, gloves — that hold each weapon convincingly:
   real contact, no clipping, sway/ADS/sprint/reload phases with distinct motion.
4. **Remote holds** — every locomotion clip carries the weapon properly on the remote
   soldier; no floating or crossed arms.

Evidence every session: rig inspector stills (`?inspect=rig`, `scripts/inspect-rig.mjs`),
close-up renders of the hands on each weapon, a before/after turntable, and the one
sentence a first-time player would say. Meshy: you are the only stream that spends —
at most 150 credits per session, never below a 300 balance; candidates stay under
`.inspect/` until admitted with a truthful receipt (real hashes, no faking), and a weak
silhouette is rejected and re-prompted, never hidden by materials.

## Files you own (only these)

`client/remote-weapon.ts`, `client/rifle-*.ts`, `client/weapon-*.ts` (not `weapon-flash.ts`
and not `weapon-sound.ts`), `client/reload-presentation.ts`, `client/actor-appearance.ts`,
`client/calibrated-*.ts`, `client/field-equipment.ts`, `client/equipment-finish.ts`,
`client/operator-kit.ts`, `client/hand-geometry.ts`, `client/viewmodel-*.ts`,
`client/procedural-viewmodel-hands.ts`, `client/rig-*.ts`, `client/shared-gltf-cache.ts`,
`client/hit-inspection-pose.ts`, `config/ww1-assets.ts`, `config/ww1-*.json`,
`public/assets/ww1/characters/**`, `public/assets/ww1/weapons/**`, `public/assets/ww1/support/**`,
`public/assets/models/**`, `public/assets/weapons/**`, `tools/*ww1*` (except
`tools/build-ww1-environment.mjs` and `tools/render-ww1-environment.py`), `tools/fit-*.py`,
`tools/meshy-*.mjs`, `tools/shrink-glb.py`, `tools/bake-rifle-hold.mjs`,
`tools/audit-viewmodel.mjs`, `tools/measure-runtime-soldier-contact.py`,
`tools/render-runtime-contact-closeups.py`, `tools/retarget-ww1-holds.py`,
`scripts/*ww1*`, `scripts/inspect-rig.mjs`, `scripts/derive-ww1-contact-frames.mjs`,
`scripts/verify-ww1-animations.mjs`, `docs/VIEWMODEL-FIT.md`, `AAA-PLAN-KIT.md`,
tests that exercise only these files, and new files under `.inspect/`.

Allowlists: you may add lines for admitted character/weapon assets to `.gitignore`,
`scripts/audit-assets.mjs` and `public/assets/README.md` — append only, inside a block
marked `# kit` (create it) so merges stay clean.

## Files other streams own — do not edit

- **world** (maps, environment art, set dressing): `src/map/**`, `client/relay-*.ts`,
  `client/switchyard-*.ts`, `client/undertow-*.ts`, `client/site-architecture.ts`,
  `client/site-ground.ts`, `client/site-wedge.ts`, `client/terrain-geometry.ts`,
  `client/concrete-detail.ts`, `client/dressing-loader.ts`, `client/dressing/**`,
  `client/map-environment-props.ts`, `client/prop-library.ts`, `client/environment-*.ts`,
  `client/cargo-*.ts`, `client/flood-works.ts`, `client/signal-array.ts`, `client/signal-core.ts`,
  `config/ww1-environment.ts`, `public/assets/maps/**`, `public/assets/props/**`,
  `public/assets/ww1/environment/**`, `tools/bake-ground-ao.py`, `tools/bake-architecture.py`,
  `tools/bake-relay-skyline.py`, `tools/dump-*.mjs`, `tools/build-ww1-environment.mjs`,
  `tools/render-ww1-environment.py`, `tools/audit-relay-*.mjs`, `tools/audit-switchyard-*.mjs`,
  `tools/audit-undertow-*.mjs`, `docs/WW1-MAPS.md`, `AAA-PLAN-WORLD.md`.
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
  `public/assets/*.hdr`, `public/assets/*-sky.png`, `scripts/hitch-*.mjs`, `DESIGN.md`,
  `docs/HITCH-GATE.md`, `AAA-PLAN-LOOK.md`.
- **Nobody this phase (visuals only; supervisor-owned)**: `src/**` (weapon numbers, hit
  authority, bots, rooms — a visual change never edits these), `client/net.ts`,
  `client/predict.ts`, `client/input.ts`, `client/fire-input.ts`, `client/audio*.ts`,
  `client/spatial-audio.ts`, `client/weapon-sound.ts`, `client/settings.ts`, `client/config.ts`,
  `client/map-inspect*.ts`, `client/training-*.ts`, `client/ping-*.ts`,
  `client/combat-telemetry*.ts`, `config/ww1-content.ts`, `docs/WW1-CONTRACTS.md`,
  `tools/aaa-*`, `scripts/inspect-map.mjs`, `scripts/inspection-lease.mjs`,
  `ART-CONCEPT.md`, `AAA-PLAN.md`.

If your work truly needs a change in someone else's file (a muzzle-flash socket in
`weapon-flash.ts`, a hook in `scene.ts`, a hit-volume change in `src/`), do not make it:
write the exact request under `## Cross-stream requests` in your plan file and the
supervisor routes it. Other astra sessions are editing this repo in other worktrees right now.
