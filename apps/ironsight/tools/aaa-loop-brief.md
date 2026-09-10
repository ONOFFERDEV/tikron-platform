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

## Owner directive 2026-09-09 — "It is still boring. Make it insanely good."

The owner played the 150 x 100 m build after 43 sessions and called it 시시해 (dull). The
polish loop is working but the game has no spectacle, no signature moments and little
feel. From now on sessions are judged on **the wow a first-time player gets in their first
five minutes**, not on scorecard rows. Rules for this phase:

- Think in **feature arcs of up to 3 sessions**, not 10-minute patches. An arc may land
  behind a flag in session 1 and 2 as long as every session is green; the arc must be
  playable and on by default by its last session. Name the arc in the session title.
- Every session ends with a **"wow check"** in the log: a 20-second headless bot-round
  capture sequence (or before/after stills) of the new moment, and one sentence a player
  would say about it. If you cannot name the sentence, the session did not deliver.
- Use Meshy freely for hero props and signature set pieces (**up to 120 credits/session**),
  Blender for bakes/animation, and the procedural kit for bulk. Spend on what is seen.
- **Asset budget is 60 MiB (owner decision 2026-09-10; the audit script now enforces 60).**
  Per-file stays <= 25 MiB and per-map lazy loading is mandatory — spend the headroom on
  what is visible in the first five minutes, and log bytes + first-load time per session.

## Owner directive 2026-09-10 — visuals are the standing priority, and fix the GPU stall

1. **Visual fidelity is now the default subject of every session** until told otherwise.
   Work through this list as arcs, re-ranking by what a first-time player sees first:
   textures and materials (tiling detail maps, normal/roughness for concrete, steel, paint;
   the ground atlas is still low-res per metre on the expanded maps), lighting and post
   (bloom, colour-grade LUT, god rays, exposure per map, time-of-day per map: Undertow dusk,
   Switchyard overcast), particles and atmosphere (wind dust, heat shimmer, distant flicker,
   volumetric-ish haze), decals and wear (scorch, bullet holes, grime, painted markings),
   character and weapon fidelity (operator skins with distinct silhouettes, better hands,
   weapon detail passes), skyline and background (animated elements, parallax, distant
   traffic/steam), and per-map hero set pieces via Meshy (up to 120 credits/session).
   Every visual session ships before/after stills at the same camera in the log.
2. **Fix the recurring hitch-gate failure (4 red gates in sessions 52-64).** Session 65's
   cross-process tracing found long GPU/ANGLE tasks while JS stayed responsive, so this is
   a rendering-cost or driver-stall problem, not a JS one. Own it as a dedicated arc before
   or alongside the next visual arc: find what the GPU is doing during those frames
   (draw-call and material count per frame, shadow-map re-bakes, texture uploads and PMREM
   generation timing, per-frame allocations of GPU resources, overdraw from transparent
   VFX, the new map events' geometry churn), fix the cause, and prove it with the hitch
   probe passing five consecutive times (`--assert`, both TDM and FFA). If the true cause
   is outside our control (driver/compositor), say so with the trace evidence and change
   the gate threshold deliberately in one commit rather than leaving it flaky. A red hitch
   gate is not acceptable as the normal state: it hides real regressions.

Backlog of "개쩔게" candidates, ranked by first-five-minutes impact (pick the top one you
can finish as an arc; do not do them all shallowly):
1. **Movement that feels AAA**: sprint-slide, mantle/vault onto waist cover, crouch-slide,
   ledge grab; camera FOV kick and dip on landing; footstep/cloth/gear audio. Titanfall /
   Apex are the bar. Map hooks that use it: ziplines, jump pads, one-way drops.
2. **Signature map events (one per map)**: Relay dish re-alignment that blacks out the HUD
   minimap for 15 s and opens the core; Undertow flood gate that fills/drains the channel
   lane; Switchyard crane dropping a container that creates or removes cover. Server
   authoritative, announced, telegraphed, on a timer or objective trigger.
3. **Streaks and power moments** (R-L01): 3/5/7 streak rewards (UAV sweep, mortar strike
   on a called point, sentry drone) with announcer, HUD progress and a big audiovisual payoff.
4. **Weapon spectacle**: per-weapon muzzle flash shapes, smoke, shell ejection, tracer
   trails, scope glint for the sniper, shotgun pellet spread visual, reload phases with
   distinct foley, weapon inspect. Explosions with shockwave ring, debris, screen trauma,
   persistent decals and scorch marks. Hard-edged smoke and flash grenades.
5. **Atmosphere and post**: bloom + colour grade LUT, god rays through the haze, wind-blown
   dust/particles, distant flickering lights, animated skyline elements, time-of-day
   variant per map (Undertow dusk, Switchyard overcast), rain on one map with wet
   reflections. Keep 60 fps: measure, and add a quality toggle if needed.
6. **Presentation that hypes**: deployment fly-through camera over the map with the
   objective callout, match-start countdown with music sting, last-30-seconds music, lead
   change and capture announcer lines, killcam of your killer, end-of-match Play of the
   Match replay (R-L06), medals popping in the killfeed, victory/defeat screens with the
   MVP posing.
7. **Bots with personality**: rusher / anchor / sniper archetypes, voice barks and
   callouts on the ping channel, visibly different loadouts and skins; hard bots that
   flank. Two operator skins per team with distinct silhouettes.
8. **HUD 2.0**: compact modern HUD, damage numbers toggle, kill-confirm banner with streak
   count, objective status bar with capture progress, threat direction on the compass.

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
