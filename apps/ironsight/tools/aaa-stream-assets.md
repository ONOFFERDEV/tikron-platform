# Stream "assets" — the grounded-warfare asset library

You are one of three astra streams working on ironsight at the same time, each in its own
git worktree on its own branch. Your worktree is `D:/wt-ironsight-assets`, your branch is
`ironsight-aaa-assets`, your dev-server port is **8797**, and you log every session to
`apps/ironsight/AAA-PLAN-ASSETS.md` (create it; never touch `AAA-PLAN.md`).

Read `tools/aaa-loop-brief.md` and `ART-CONCEPT.md` as usual — they still govern rules and
look. This file defines your lane.

## Your job

Build and maintain the **prop library** the other streams place into the world: generate
with Meshy, vet it, shrink it, document it, and expose it through a small registry the map
stream can call. You do not lay out maps and you do not touch gameplay.

1. **Generate in parallel.** `tools/meshy-batch.mjs` runs several Meshy jobs concurrently
   (`node tools/meshy-batch.mjs --concurrency 4`); it carries the ART-CONCEPT palette in its
   style suffix and writes a manifest. Its job list is the concept's programme: combat set
   dressing, war-worn hero props, skyline scale. Extend or re-prompt entries as needed.
   Meshy jobs are API-bound, so start a batch first and do other work while it renders.
2. **Vet every asset.** Look at each thumbnail and each shrunk GLB in the inspector before
   adopting: correct silhouette, sane scale in metres, origin at the base, no floating
   ground plane, polycount in budget. Reject and re-prompt rather than shipping something
   weak — record rejects in the log with the reason.
3. **Shrink and document.** `tools/shrink-glb.py --size 512 --webp` before anything ships.
   Add each adopted asset to `public/assets/README.md` provenance and to the audit
   allowlist, and keep the public set under **60 MiB** with per-file <= 25 MiB.
4. **Publish a registry the map stream can use**: a single module (e.g.
   `client/prop-library.ts`) that maps a stable name to its URL, real-world size, origin
   convention and a lazy loader, plus a short table in your plan file listing what exists.
   The map stream will place these; make placement trivial for it.
5. **Prove them in isolation.** Add a prop-gallery inspector shot (all adopted props in a
   row at known scale with a 2 m reference figure) so regressions are visible.

## Files you own (only these)

`tools/meshy-*.mjs`, `tools/shrink-glb.py`, `client/prop-library.ts` (new),
`public/assets/props/**`, `public/assets/README.md`, `scripts/audit-assets.mjs`,
`AAA-PLAN-ASSETS.md`, and new files under `.inspect/`.

## Files other streams own — do not edit

- Stream **main** (level design): `src/map/**`, `client/*-environment.ts`,
  `client/site-*.ts`, `client/relay-*.ts`, `tools/bake-*.py`, `tools/dump-*.mjs`,
  `AAA-PLAN.md`, `client/scene.ts`.
- Stream **combat**: `src/bots.ts`, `src/rooms/**`, `src/weapons.ts`, `client/audio.ts`,
  `client/spatial-audio.ts`, `client/vfx.ts`, `client/hud.ts`, `test/**`,
  `AAA-PLAN-COMBAT.md`.

If your work truly needs a change in someone else's file, do not make it: write the exact
request in your plan file under `## Cross-stream requests` and the supervisor will route it.

## Budget

Meshy: the owner authorised **1,300 credits total** for the overhaul and ~290 were already
spent. You are the only stream that should spend from here on; keep **at least 200 credits
in reserve** and stop generating below that. Log credits spent, assets adopted, assets
rejected and bytes added every session.
