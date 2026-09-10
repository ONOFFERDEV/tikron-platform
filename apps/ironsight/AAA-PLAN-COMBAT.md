# Ironsight AAA rebuild — combat stream

Branch `ironsight-aaa-combat`, worktree `D:/wt-ironsight-combat`, local port **8798**.
Scope and ownership: `tools/aaa-stream-combat.md`. No commits, pushes, deployments or Meshy spending.

## AAA gap list

1. **Owner rollback bug, repair arc 1/2:** finish live all-map movement telemetry
   and deliver the tested `Predictor.connect(net.room)` hook to main. Matched-command
   replay is implemented; dropped-handshake and full-window retry repairs are tested.
   Production activation is still a main-stream integration requirement.
2. **Bot squad tactics, arc 2/3:** multi-level routes through map-authored doors,
   stairs and roofs; validate against the map stream's actual new structures.
3. **Bot squad tactics, arc 3/3:** role names and tactical radio barks through the
   existing ping channel, with team cooldowns and human-callout priority.
4. Shared weapon table audit (R-G02–08, R-G19–20).
5. Layered, occluded firefight audio (R-G14–17), then surface impact feedback.

Session 1 delivered arc 1/3: four archetypes, reaction/decision difficulty and
verified-cover reloads. Priorities above are re-ranked for the next session.

## Cross-stream requests

- **Main / supervisor — Session 2 owner rollback priority:** `main.ts` constructs
  the predictor without the room, and strips time/ack information before calling
  `reconcile({x,y,z})`. Combat cannot correctly compare corresponding simulation
  steps with that position-only contract. Combat is implementing
  `predictor.connect(net.room)` in its owned `client/predict.ts`, plus the matching
  room handlers. Main integration will be one call immediately after constructing
  the predictor (after initial spawn seeding), and removing the redundant
  `net.setMoveIntent(intent, now)` call: the connected predictor sends bounded
  fixed-step intent commands itself. Keep `net.setLook` and `predictor.frame`.
  Do not apply until the final Session 2 log records the tested API and evidence.
  No edit to main/net/physics/map files in this worktree.
- **Main / supervisor:** `src/bot-roles.ts` is outside combat's explicit allowlist.
  Combat now exposes `combatBotLabel(id)` and `combatBotArchetype(id)` from
  `src/bots.ts`. Route the display-name hookup in `client/main.ts` to that label
  and `client/contact-presentation.ts` (or move the shared identity table into a
  mutually agreed owner file). Preserve
  the existing `botLabel` fallback for training dummies. Seats 9/10 become SUPPORT;
  seats 5/6/11/12 are MARKSMAN. The old UI otherwise calls them ANCHOR/SCOUT.
- **Main / supervisor:** current `GroundNavigator` explicitly excludes ramps and
  routes at y=0. Please provide height-aware `next(from, target)` points and reachable
  authored patrol/flank goals with `{x,y,z}` for doors/stairs/roofs. Combat's route
  contract preserves optional y and refuses arrival on another floor. No combat
  edits to `src/map/**`, collision, `client/main.ts`, or `client/scene.ts`.
- **Main / assets / supervisor:** `client/operator-kit.ts` also uses the old
  three-role lookup. When routing role presentation, assign SUPPORT a radio/pack
  silhouette and retain the existing marksman weapon hold. This file is outside
  the combat allowlist, so its legacy kit behavior was preserved.

## Reference scorecard

| Id | Status | Evidence |
|---|---|---|
| R-M01 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M02 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M03 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M04 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M05 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M06 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M07 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M08 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M09 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M10 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M11 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M12 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M13 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M14 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M15 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M16 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M17 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M18 | partial | Optional feet y retained by bot routes; wrong-floor arrival rejected; local door/ramp/roof sweeps tested. Map-authored multi-level strategic routing pending. |
| R-M19 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M20 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-G01 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-G02 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G03 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G04 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G05 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G06 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G07 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G08 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G09 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-G10 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G11 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G12 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-G13 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-G14 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G15 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G16 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G17 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G18 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-G19 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G20 | partial | Bots use normal handleFire/handleReload/handling; shared weapon-table audit remains next arc. |
| R-L01 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L02 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L03 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-L04 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L05 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L06 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L07 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L08 | partial | Existing BotContacts keeps team cooldown and human priority; tactical barks and updated labels need main hooks. |
| R-L09 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L10 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L11 | partial | Four live profiles; 150-600 ms reactions; identical seeded aim; depth 1/2/3 cover search and easy flank restriction. bot-tactics + bot-cover tests; multi-level strategic routes pending. |
| R-L12 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L13 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L14 | partial | Combat overlay and damage surfaces retain compositor layers; no WebGL resource additions. Map inspector clean; repeated hitch acceptance and remaining presentation stalls recorded below. No iGPU claim. |
| R-L15 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L16 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L17 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L18 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-L19 | partial | Session 2: acknowledged-command replay, bounded retries and unchanged correction thresholds. Live all-map evidence and main-stream activation tracked below. |
| R-L20 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L21 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-L22 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L23 | n.a. | Outside this session/combat lane; other-stream work left untouched. |

## Session log

### Session 2 - 2026-09-11: Rollback repair, arc 1/2 - match the movement step

Reference: **R-L19**, **R-L14**, **R-M18**. Owner bug takes priority over the
bot/audio arcs. Target: compare each server position with the prediction of its
acknowledged movement command, keep matched error below the unchanged **0.15 m**
soft threshold throughout real bot rounds on Relay, Undertow and Switchyard,
and report terrain-specific p50/p95/max plus soft/snap crossings. The snap
threshold remains **2.5 m**. A delayed echo is a different simulation instant;
it is recorded separately and is not the reconciliation error.

Resumed from clean **3edd350** after the quota interruption. The preceding
Session 2 implementation was already merged, but had no session log: this
entry covers that implementation and this resumed validation/repair work.
`main.ts` still uses the legacy position-only path in this worktree. All candidate
browser runs apply the requested two-line integration **in memory** via an
inspection-only esbuild/CDP response; no main/net/physics/map source is edited.
The production path and the hooked candidate are identified separately below.

Implemented contract (already present on resume): `Predictor.connect(room)`
subscribes to owner-only `movement` snapshots and sends ordered, bounded
`movementSteps` intents at 20 Hz. Commands contain direction, stance, jump and
yaw, **never position, velocity or client dt**. The authoritative room integrates
them with its normal capsule, step-up, ramp, slide and traversal code. An eight
command window bounds replay/storage; at most two commands consume accumulated
server tick credit in one tick. Retransmissions cannot buy repeated movement.
Snapshots carry acknowledged sequence, life epoch, full kinematics and controller
progress/cooldowns. Death/respawn/reconnect reset the epoch; the client restores
the acknowledged state and replays only pending commands. The camera absorbs
small real corrections continuously. Legacy position-only callers retain the
existing fallback until main integrates the hook.

Resumed repairs: a full pending window previously stopped **sending** as well as
prediction, so losing its final upstream batch froze the client permanently.
The regression stuck at ack 16 and failed to resume. The capped predictor now
retransmits at 20 Hz while its camera/position stay bounded; 144 Hz rendering
does not increase retries. A separately dropped `movementStart` also froze
startup; it now retries every 500 ms until the first valid snapshot. Both tests
were observed failing before their fixes. One-tick ordered delivery jitter
during an actual jump is also covered. These are delivery fixes, not changes
to movement speed, collision, damage or reconcile thresholds.

Baseline on resume: asset bytes **30,121,938**, public bytes **37,218,252**,
largest asset **7,183,364**. No Meshy credits, new asset files, textures, lights,
passes or geometry changes. Current full suite: **789 passed / 7 skipped**,
**95 files passed / 5 skipped**; 17 prediction-sync tests and typecheck pass.
Raw evidence is retained under `.inspect/combat-s2-*`; final live/gate results
and the integration handoff are appended when complete.

### Session 1 - 2026-09-11: Bot squad tactics, arc 1/3 — fight, cover, reload

Reference: **R-L11**, **R-G20**, **R-L08**, **R-M18**, **R-L14**. Targets: easy reaction 600 ms;
hard minimum 150 ms; role variation remains inside that envelope. Difficulty changes
reaction and bounded decision depth only, never health, damage, accuracy or wall
knowledge. Reload uses the normal room handler and authoritative magazine/reserve.
Doors/vertical route contracts retain height; actual multi-level routing is arc 2.

Initial state: clean branch; supervisor reports Session 0 was reset. No previous
combat plan existed. Baseline asset audit PASS: 28,822,600 asset bytes,
35,850,349 public bytes, largest asset 7,183,364 bytes. New assets/credits: zero.

Baseline performance: `.inspect/combat-s1-before.json` ran the ordinary CPU-profiled
TDM gate before the brain/room edits. It FAILed sustained pacing (p99 upper 55 ms,
max frame 176.7 ms, max callback 21.7 ms; 2 deaths, 0 long tasks, 0 shader changes,
0 console errors). The supplied `--capture-fight` argument was unrecognized and
did **not** capture screenshots; keep this as performance baseline only. Correct
capture uses `--capture-first-fight` without `--assert`, or the existing roles probe.
Current repo policy is the documented Session 74 gate in `docs/HITCH-GATE.md`
(1500 ms presentation / 150 ms main-thread / 25 ms p99), not the older 150 ms
presentation sentence in the standing brief. No gate or threshold edits this session.

Delivered (on by default):

- `src/bots.ts`: a stable six-seat squad pattern, mirrored across teams:
  rusher / anchor / marksman / rusher / support / marksman. Existing legacy role
  keys remain compatible with objective/contact consumers. One bot profile table
  supplies engagement distance, reaction offset and reload/cover preferences.
- Easy/regular/hard use base reaction **600/300/150 ms** and decision depth
  **1/2/3**. Archetype delays cap at 600 ms. Hard reactions: rusher 150, anchor
  180, marksman 200, support 175 ms; live actions are quantized by the normal
  50 ms room tick. The seeded aim stream is identical across difficulties.
  Easy bots retain patrols; regular/hard rushers commit to authored flanks.
- Support uses the regular rifle, settles into ADS, fires **900 ms** aimed
  bursts with **350 ms** pauses, and relocates. Anchors also settle/relocate;
  rushers close to 9 m; marksmen retain their 2.5 s settle / 1.5 s relocation.
  Suppression requires current LOS and normal fire validation at every shot.
- `src/rooms/bot-cover.ts`: immutable cover candidate index per actual collision
  variant. Search considers <=4/8/12 swept candidates per decision, within 8 m.
  Each candidate must hide shoulders and head and be reachable using the SAME
  player capsule, step-up, ramps and boxes. Full cover and crouched waist cover
  are distinct. No wall, collider, movement or damage rules were changed.
- Low-ammo bots retreat before topping up; empty magazines reload while moving.
  Failure to find cover falls back to normal reload, not an idle loop. Critical
  injury retreat is capped at 1.8 s with an 8 s cooldown. Completed reloads release
  cover and restore the same objective/patrol. Target memory is a frozen,
  expiring sight/sound position, never a hidden player's live position.
- `src/rooms/arena-room.ts`: injects own authoritative HP/ammo, active collision
  cover query, and profile difficulty. Reload intents call the existing human
  reload handler; ammo capacity, reserve cost, reload duration, HP and damage
  remain normal. No replicated state shape change.
- Height-aware combat route contract (`BotRoutePoint`, `botReached`, optional
  `patrolRoute`) preserves feet height and forbids wrong-floor arrival. Local
  recovery segments can walk doorways and ramps to/from supported roofs. **This
  is not a new multi-level strategic navigator.** GroundNavigator still owns
  patrol/flank routing; integrating long door/stair/roof routes is arc 2.

Verification and measured evidence:

- `pnpm typecheck`, `pnpm test`, `pnpm build:client`, `pnpm audit:assets`: PASS.
  Normal suite: **706 passed / 7 skipped**, **94 files passed / 5 skipped**.
  New `bot-cover.test.ts` and `bot-tactics.test.ts` cover solid/waist/overhead cover,
  narrow doors, true ramp ascent/descent and high-side rejection, reaction bounds,
  seeded aim parity, burst pauses, sight loss, recovery deadlines, roof arrival,
  both-team composition and authoritative reload timing/reserve accounting.
- Opt-in `test/bot-tactics-round.tool.test.ts`: two 120 s natural room simulations,
  no placement or damage injection. `.inspect/combat-s1-natural-tactics.json`:

  | Mode | Kills | Reloads | Cover trips | Cover arrivals |
  |---|---:|---:|---:|---:|
  | TDM | 46 | 43 | 63 | 48 |
  | FFA | 63 | 85 | 107 | 94 |

  Every archetype reloaded, reached cover and earned kills. These are simulation
  counts, not deployed latency/capacity numbers or proof of game balance.
- `inspect-map --url http://localhost:8798 --shots relay,practice-two`: PASS,
  `.inspect/combat-s1-report.json`, zero errors / forbidden network requests.
  Relay fixed camera: 30 draws, 192,058 triangles, 16 textures,
  **25.681 MiB estimated texture memory**, median **7 ms**, p99 **13.9 ms**,
  max **14.4 ms**, preparation **3947.9 ms**. RTX 5070 host, not iGPU validation.
- Assets remain **28,822,600 bytes**, largest **7,183,364 bytes**. Final public
  directory after bundle/source-map build: **35,876,305 bytes** (**+25,956** vs
  baseline). The earlier bot-only build was 35,874,743 bytes (+24,394).
  **0 asset bytes, WebGL textures, real-time lights, WebGL passes or Meshy credits
  added; 0 generated-asset rejects.** First updated TDM playable at **3483.7 ms**,
  scene preparation **1713 ms**; retain per-run first-load variation in probe JSON.
- Ordinary updated TDM probe `.inspect/combat-s1-tdm-1.json`: PASS, 2 deaths,
  p99 upper **19 ms**, max **66.5 ms**, max callback **19 ms**, 0 frames >150 ms,
  0 shader changes/errors. Repeated final TDM/FFA evidence is recorded below.

First acceptance sequence retained as `combat-s1-final-{tdm,ffa}-{1,2}.json`:
pair 1 TDM/FFA and pair 2 TDM passed. Pair 2 FFA **FAILed repeated presentation
stalls**: 1424.6 ms and 494.1 ms gaps in a 27.423 s round (6.997% stalled), p99
11 ms, max callback 13.1 ms, 0 errors/shader changes. The large gap occurred while
dead, before respawn; **1332/1342 CPU samples were idle**. Both first-hit/death
windows passed. This resembles the documented host/compositor tail but does not
by itself prove the cause. Stopped the sequence immediately; keep the failure and
collect `combat-s1-ffa-diagnostic` with GPU tracing before a fresh sequence.

Diagnostic result: PASS under current policy, 2 deaths, p99 9 ms, max callback
8.4 ms, one **152.2 ms** presentation gap. Around that gap the game submitted
84–87 calls / 53–56 materials in **~1.2–1.3 ms**, with 0 shader creation/links,
0 new textures/buffers/framebuffers, 0 shadow requests and 0 target draws.
The retained GPU trace contains `ANGLEPlatformImpl::RunWorkerTask` spanning
**156.042 ms wall / 2.657 ms thread CPU**, overlapping the gap by 148.338 ms.
**The rolling trace did not retain the complete renderer window**
(`traceCoversWindow:false`), so this is corroborating GPU-wait evidence, not a
complete causal trace of the earlier 1424.6 ms failure. Artifacts:
`combat-s1-ffa-diagnostic.json`, `-trace.json`, `-trace-summary.json`.
No application resource churn was found in the bot-only build. This does not
establish a fix for the existing host stall. Fresh ordinary acceptance pair 3
used the unchanged build and thresholds, without tracing/capture.

Fresh pair 3: TDM PASS (p99 9 ms, max 48.8 ms); FFA FAIL (max **1837.1 ms**,
5.269% stalled, max callback 11.9 ms, 3 deaths, no errors/shader changes).
Stopped again. The immediate-stop diagnostic `combat-s1-ffa-stop-trace` now
**covers its full 628.1 ms spike**: renderer tasks total **9.64 ms**;
`SkiaOutputSurfaceImplOnGpu::FinishPaintRenderPass` runs **633.223 ms wall /
1.211 ms CPU**, and its ANGLE worker **632.044 ms wall / 2.694 ms CPU**.
This locates that reproduced wait in native compositor work. The early-stop
probe intentionally lacks two deaths and is diagnosis, not acceptance.

The combat-owned HUD candidate keeps the existing full-screen
overlay mounted with opacity changes across play/death instead of display-based
removal/insertion. The hidden overlay is inert and aria-hidden; visible content
and input behavior are preserved. Hypothesis: reduce compositor layer churn at
the transition. Candidate acceptance is recorded below; original
file retained at `.inspect/combat-s1-hud-before.ts`.

HUD trial: `.inspect/combat-s1-hud-trial-ffa.json` PASS across **61.141 s / 3
deaths**, p99 **8 ms**, max **15.4 ms**, callback **5.1 ms**, first hit/death
windows **8 ms**, zero >150 ms frames/shader changes/errors. `client/hud.ts`
keeps the same overlay in layout with `will-change: opacity`; visibility updates
are edge-triggered, and hidden buttons are inert and aria-hidden. `present()`
preserves entering-result focus using the explicit visibility state.
This is a compositor-lifetime mitigation, not a new gameplay/render feature.

Post-HUD functional checks: typecheck PASS; full suite **706 passed / 7 skipped**;
build and asset audit PASS. `combat-s1-hud-report.json` validates Relay/practice
and the complete `match-vote` focus/voting/layout checks with zero errors.
`combat-s1-hud-respawn-report.json` validates a real grenade death and respawn
(1 death, HP 100, aim reset, reload idle), zero errors. The earlier `respawn` shot
name was only a static inspector fallback; the correctly named `self-respawn`
probe is the actual functional evidence. Public total is now **35,875,843 bytes**
(**+25,494** over baseline; assets still unchanged). WebGL texture estimates stay
25.681 MiB at the fixed Relay camera; native compositor backing memory is not
reported by that estimator.

Mounted-overlay candidate acceptance stopped at pair 4 TDM. Three complete pairs
passed, but `combat-s1-hud-final-tdm-4.json` FAILed a **1687.9 ms** presentation
gap during damage while still alive (p99 8 ms, 2 deaths, 0 errors/recompiles;
**1618/1640 CPU samples idle**). First damage/death windows passed, but this later
damage interval did not. Keep all seven reports; the overlay-only candidate did
not establish the required five-pair result. The fresh traced TDM diagnostic
`combat-s1-hud-tdm-stop.json` completed without reproducing a spike (max 26.1 ms);
it does not explain the untraced 1687.9 ms interval.

Revised HUD candidate also gives the three fixed damage surfaces (`vignette`,
`damage-flash`, `damage-direction`) `will-change: opacity`, keeping their layer
lifetime stable between hits. The effect visuals/timings are unchanged.
`combat-s1-damage-layers.json` confirms Chromium retains all three plus the
overlay with the `WillChangeOpacity` reason while idle. Their recorded extents
are 1896x988 for each full-screen surface and 296x296 for the direction marker.
These are layer extents, **not measured GPU allocations**; WebGL's texture
estimator omits native compositor memory. The layer diagnostic is separate from
acceptance and makes no gameplay/CSS changes. Its first attempts found stale
backend IDs / no layers; refreshing the LayerTree after DOM discovery yielded
the retained report. No failed diagnostic was counted as gate evidence.

Revised-candidate typecheck, build, asset audit and all **706 tests** PASS.
`combat-s1-damage-report.json` validates Relay/practice, match voting/focus and
real grenade death/respawn with zero errors. Fixed Relay camera after the HUD
revision: 30 draws, 192,058 triangles, 16 textures, **25.681 MiB**, median
**6.9 ms**, p99 **7.1 ms**, max **7.2 ms**, scene preparation **1094.3 ms**.
The same camera before the HUD revision is `combat-s1-relay.png`; after is
`combat-s1-damage-relay.png`. These observations have host/run variation and
do not isolate a causal frame-time improvement. Final public bytes are
**35,876,305 (+25,956)**; asset bytes remain unchanged. Its fresh acceptance is
`combat-s1-damage-final-{tdm,ffa}-{1..5}.json`, pending completion. No tracing,
layer observer, capture, concurrent inspector, build or test runs during it.

Wow check: `.inspect/combat-s1-wow-report.json` plus
`combat-s1-wow-roles-live-{0,5,10,15,20}s.png` capture **21.611 seconds** of an
ordinary live Relay TDM with standard movement and no state injection. **160
shot events, 6 kills, 1 team contact ping**, and **88 samples showing bot reloads**
(bots 3/4/6/9, including support). Existing AR/SMG/sniper weapon silhouettes remain
visible; zero console errors. Player sentence: **“They hold the lane, flank me,
and duck away to reload.”** Inspect stills are readback evidence; they do not
replace the separate hitch gate.

Rejected/intermediate work: first telemetry-tool run used an unavailable harness
`dispose()` API; corrected to clear fake timers between rooms, then passed. Its
Node-only import needed the repository's existing explicit type exception in the
Workers-only test tsconfig; no dependency/config edit. The inherited baseline
hitch FAIL is retained above; no thresholds were weakened or failed runs erased.

Open owner questions/defaults: none requiring a pause. Keep hard as the existing
live default, normal weapons/HP, conservative verified cover, and ground strategic
routes until the map integration is tested. Tactical voiced/subtitled barks and
updated SUPPORT/MARKSMAN UI/kit names remain arc 3 / cross-stream integration;
current `BotContacts` and legacy ANCHOR/SCOUT display strings are unchanged.
