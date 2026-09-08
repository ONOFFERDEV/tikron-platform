# ironsight AAA loop — standing brief for astra (read every session)

You are the lead on the ironsight AAA rebuild (D:\webgame-baas, branch `ironsight-aaa`,
app `apps/ironsight`). This brief is constant; the supervisor's per-session status is in
`apps/ironsight/.inspect/aaa-loop/status.md` — read both, then `apps/ironsight/AAA-PLAN.md`,
before doing anything.

## Owner direction (2026-09-08, verbatim intent)

"It is still far, far from an AAA-grade game. Keep going session after session — around
fifty — until it looks and feels like one. Use Meshy to generate assets whenever they add
visible quality." The owner will play the preview between sessions and report feel; the
supervisor relays that in status.md. Do not wait for owner answers: keep your defaults
active and list open questions with your default answer in the session log.

## Mission, non-negotiables and working agreement (unchanged from session 1)

- Scope: `apps/ironsight/**` only. Never commit; never push; never deploy. The supervisor
  runs the gates, commits, deploys the preview worker and pushes after every session.
- Server-authoritative, server-verified hits; collision map is the sole authority — render
  geometry never creates or removes cover.
- 60 fps at 1080p on a mid laptop iGPU budget: everything baked, no new real-time lights
  (light count must stay constant at all times — a hidden light is a removed light and
  recompiles every lit material), no extra passes, no per-frame CPU bakes.
- Every session ends green: `pnpm typecheck`, `pnpm test`, `pnpm build:client`,
  `pnpm audit:assets`, `node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two`
  with zero console errors, and `node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`
  (plays a bot TDM round until it has died twice, max 150 s; fails on any shader recompile
  after warm-up, any frame > 150 ms, any console error, or if the bots never killed it).
  The supervisor reruns exactly these gates; a red gate means the session is not committed.
- Purchased-source derivatives (Synty, UAL) stay ignored; only original or generated assets
  are versioned, allowlisted explicitly in `.gitignore` and `scripts/audit-assets.mjs`, with
  provenance and a reproducible command in `public/assets/README.md`.
- Asset budget: <= 40 MiB public total, <= 25 MiB per file, lazy per map. No new npm
  dependencies. Stop every server and inspection browser you start.
- Log the session in `AAA-PLAN.md` under `## Session log` as `### Session N - <date>: <title>`
  (N comes from status.md) with: what changed, evidence files, measured deltas
  (bytes, frame time, texture MiB), rejected intermediates, and open owner questions with
  your default. Keep the ranked `## AAA gap list` section at the top of the session log
  current: every session re-rank it and pick the top item you can finish green this session.

## Tools you have

- Blender 4.5 headless: `& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python <script.py> -- <args>`.
  Existing scripts: `tools/bake-ground-ao.py`, `tools/bake-architecture.py`, `tools/bake-environment.py`,
  `tools/bake-relay-skyline.py`, `tools/shrink-glb.py`. Known traps: pin `view_transform = "Standard"`
  for data textures (AgX saves white as 0.8); light Power is physical watts; do not
  recalculate normals on the overlapping kit (it inverts boundary faces).
- Meshy text-to-3D (credits are real money; the account balance is in status.md):
  `node tools/meshy-generate.mjs --name <slug> --prompt "<what>" --texture "<look>" --polycount 3000`
  writes `D:/game-assets/generated/meshy/<slug>/model.glb` (+ thumbnail, meta.json). A
  preview+PBR refine costs **30 credits** and takes ~4-8 minutes (measured 2026-09-08:
  industrial-cable-drum, 30 credits, 4 min, 8.6 MB raw); run it early in the session and
  keep working while it renders. Raw output embeds 2k JPEG PBR textures:
  ALWAYS run `tools/shrink-glb.py --input <model.glb> --output public/assets/props/<slug>.glb --size 512 --webp`
  (~200 KB) before shipping, then allowlist + document. Budget: at most 60 credits per
  session, and stop generating entirely if the balance is below 300. Prefer Meshy for hero
  props, set dressing, weapons/attachments, vehicles, signage, machinery; keep using the
  procedural/Blender kit for architecture that must match colliders exactly. Inspect every
  generated GLB in the map inspector before adopting it (scale, origin at bottom, polycount,
  silhouette); reject and regenerate with a better prompt rather than shipping a weak asset.
- Existing inspectors: `scripts/inspect-map.mjs`, `scripts/inspect-rig.mjs`, `client/map-inspect.ts`,
  `scripts/audit-architecture.py`, `scripts/hitch-probe.mjs`.

## Design reference (owner directive 2026-09-08: learn from the best-selling shooters)

`apps/ironsight/AAA-DESIGN-REFERENCE.md` compiles sourced principles and numbers from
GDC talks, developer blogs and analyses of Call of Duty, Counter-Strike, Valorant, Halo,
Overwatch, Titanfall/Apex, DOOM, Destiny, Battlefield, Team Fortress 2 and others: map
design (lanes, timings, cover classes, sightlines, spawns, readability), gunplay and feel
(TTK, recoil, ADS/reload timing, animation, hit feedback, audio layering), and the fun
loop (match flow, respawn, end-of-round, killcam, medals, HUD, onboarding, art direction,
top player complaints). Read it every session. For each session:
- Pick the gap item, then find the reference principles it touches and state them in the
  session log as `Reference: R-xx, R-yy` with the concrete target you are aiming for
  (a number or a checkable rule), and afterwards whether the build now meets it.
- When the reference and your instinct disagree, follow the reference unless a budget or
  guardrail forbids it; say so in the log.
- Maintain a `## Reference scorecard` section at the top of the session log in AAA-PLAN.md:
  every reference id with status met / partial / not yet / n.a. and the evidence. Re-rank
  the AAA gap list from the `not yet` and `partial` rows.

## What "AAA" means here (judge yourself against this every session)

Environment: layered, readable, lived-in spaces with hero props, set dressing, decals,
signage, wear, lighting depth (AO, sky, contact), atmosphere; three scales (skyline,
room-sized machinery, human-scale detail); Crossyard replaced by a third map of the same
quality. Characters and weapons: convincing first-person hands and weapon animation
(idle sway, sprint, ADS, reload with distinct phases, inspect), remote operator animation
with proper weapon holds, hit reactions, deaths. Feel: responsive movement, camera
feedback (recoil, shake, FOV kick), impact VFX (sparks, decals, tracers, muzzle, blood),
hit sounds, layered audio (weapons with tails, footsteps by surface, ambience, music
stingers). Presentation: deployment menu, HUD, killfeed, scoreboard, end-of-round,
onboarding, settings — coherent art direction (industrial daylight, amber/teal accents).
Performance: the above within the budgets, measured.

Each session: pick the gap that most changes how the game reads at first glance, deliver
it end to end, prove it with before/after captures, and leave the build green.
