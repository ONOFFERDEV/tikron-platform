# Ironsight AAA rebuild — combat stream

Branch `ironsight-aaa-combat`, worktree `D:/wt-ironsight-combat`, local port **8798**.
Scope and ownership: `tools/aaa-stream-combat.md`. No commits, pushes, deployments or Meshy spending.

## AAA gap list

1. **Owner rollback bug, repair arc 2/2:** whole-round movement proof now passes
   on all three maps. Finish the main-stream activation of
   `Predictor.connect(net.room, () => net.online)` using the exact request below.
   Keep R-L19 partial until that production integration is validated.
2. **Presentation reliability (main owns the next renderer investigation):**
   short Session 3 traces now cover 2.05-2.90 s raster/compositor executable
   waits after preparation. Preserve the failed runs and existing gate limits;
   fresh passes do not close this gap.
3. **Bot squad tactics, arc 2/3:** multi-level routes through map-authored doors,
   stairs and roofs; validate against the map stream's actual new structures.
4. **Bot squad tactics, arc 3/3:** role names and tactical radio barks through the
   existing ping channel, with team cooldowns and human-callout priority.
5. Shared weapon table audit (R-G02–08, R-G19–20).
6. Layered, occluded firefight audio (R-G14–17), then surface impact feedback.

Session 1 delivered arc 1/3: four archetypes, reaction/decision difficulty and
verified-cover reloads. Priorities above are re-ranked for the next session.

## Cross-stream requests

- **Main / supervisor - Session 3 rollback integration:** the movement repair is
  implemented and now passes the whole-round all-map movement assertion. Apply
  these exact changes to `client/main.ts`, then validate the combined main build
  before release (movement proof passes; repeated FFA presentation acceptance
  remains blocked as recorded below):
  add `predictor.connect(net.room, () => net.online);` immediately after
  `if (me0) predictor.pos = { x: me0.x, y: me0.y, z: me0.z };`, and remove the
  frame-loop `net.setMoveIntent(intent, now);`. Keep `net.setLook(...)`,
  `predictor.frame(...)`, and the existing state callbacks; connected
  `reconcile`/`setAlive` deliberately defer to acknowledged owner snapshots.
  The online callback is REQUIRED to avoid queuing retries while disconnected.
  This replaces the stale Session 2 "do not apply" prerequisite. Session 3's
  in-memory candidate applies exactly these two changes, with no edits to
  main/net/physics/map source. `client/config.ts`'s input-budget comment can be
  updated by main to 20/s movement + <=31/s look + <=16/s fire, below 90/s
  (33 ms look interval; fastest weapon is the 65 ms SMG).
  Production activation is still pending; do not describe the deployed bug as
  fixed until the hook is integrated and validated on main.
- **Main / supervisor - startup presentation stall:** ordinary candidate FFA
  runs 4/6/8 fail with first measured intervals of **1792.5 / 1580.1 / 1880.6 ms**;
  runs 6 and 9 also have later **1318.6 / 2057.6 ms** intervals. Short startup diagnostics now
  capture the native work: `combat-s3-short-startup-1{,-trace,-trace-summary}.json`
  covers a **2901.4 ms** interval overlapping a **2901.113 ms** ANGLE pixel
  executable (**3.615 ms CPU**) in Chromium's browser raster path. Diagnostic 2
  covers **2049.4 ms** overlapping a **2048.148 ms** vertex executable
  (**2.745 ms CPU**) in the compositor paint path. Game submissions around these
  intervals take **0.8-1.5 ms**, with no new textures/buffers, shader links,
  shadow request or target pass. See `combat-s3-stall-diagnosis.json`.
  Investigate the post-preparation raster/compositor handoff in main/scene;
  combat's movement change has no renderer integration beyond the exact hook
  above. These traces locate two waits, not a particular driver defect or the
  cause of every untraced failure. Keep all thresholds unchanged; no speculative
  combat HUD/VFX edit was justified. Failed runs and earlier diagnostics remain
  in the Session 3 log below.
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
| R-L14 | partial | No WebGL resource additions. Session 3 required code/asset/inspector checks and stock TDM/FFA pass; candidate repeatability remains FAIL (FFA 4/6/8/9). Two short traces cover 2.05-2.90 s native raster/compositor waits. No iGPU claim. |
| R-L15 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L16 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L17 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L18 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-L19 | partial | Session 3: 15,595 matched samples across complete Relay/Undertow/Switchyard bot rounds; zero soft/snap crossings; 20 regression tests. Exact main activation request above remains pending. |
| R-L20 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L21 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-L22 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L23 | n.a. | Outside this session/combat lane; other-stream work left untouched. |

## Session log

### Session 3 - 2026-09-11: Rollback repair, arc 2/2 - prove the movement timeline

Reference: **R-L19**, **R-L14**, **R-M18**. Owner rollback priority remains
above the bot/weapon/audio work. Target: whole natural bot rounds on all three
maps with matched-command error and replay corrections below the unchanged
**0.15 m** soft threshold, plus explicit yard/interior/stair/slab coverage and
**2.5 m** snap-crossing counts. Keep latency error separate from physics error.

Starting state: clean `ironsight-aaa-combat`; the production `main.ts` still has
no `predictor.connect` call. Session 2's 18 prediction tests pass on the current
checkout. This session tests the integration in an inspection-only in-memory
bundle; production activation still belongs to main. No owned geometry,
collision, weapon/bot tuning or correction threshold change is justified by the
evidence so far. Only combat-owned tests, this log and new `.inspect/` files are
being changed. Full results and a concrete integration handoff follow below.

Prior evidence audit: Session 2's full Undertow bot round drove an obsolete
`x=43` route beside the actual `x=44..46` ramp and never reached the deck.
Its later successful vertical route was practice, not a bot round. Switchyard's
full bot round reached its ramp but died before the deck. These are useful
partial observations, **not all-terrain whole-round acceptance**. Session 3
uses corrected routes, chooses the nearer mirrored approach on respawn and
checks waypoint height as well as horizontal arrival. No state/health/bot
injection. Headless runs participate in the shared inspection lease.

Delivered in this session: two regression tests using the real room transport
harness. One reproduces backward corrections from delayed legacy echoes on
identical flat-yard geometry, without input loss or physics disagreement. The
other checks that the rendered camera keeps moving forward with uneven frame
slices (including 144 Hz-like frames) across delayed acknowledgements. All
**20 prediction tests** pass. The Session 2 runtime implementation needed no
additional physics or threshold change on the measured routes.

Baseline reproduction: `combat-s3-before-tdm{,-movement}.json`, **81.974 s**,
2 deaths, injected 100 ms each way. The position-only path reports **666**
comparisons, p50 **0.4967 m**, p95 **1.0212 m**, **603** soft crossings.
Yard p50/p95 **0.4882/1.0258 m**; interior **0.4902/1.0096 m**;
stairs **0.4996/0.9996 m**; roof **0.5714/1.0124 m**.
Its largest **5.6971 m** sample is the initial warmup-to-live reset back to
spawn, not evidence of an ordinary-movement hard snap. The next largest
sample is **2.3076 m**. The baseline collector did not label phase transitions,
so its raw summary retains that reset and reports one snap crossing. Do not
silently present that all-phase count as an ordinary rollback count. The
observer now records phase transitions for future baselines. The deterministic
yard regression isolates backward correction from latency without any reset.

**All-map movement assertion: PASS.** `.inspect/combat-s3-motion-acceptance.json`
and `combat-s3-motion-summary.log` retain the acceptance and full breakdown;
`combat-s3-full-{tdm,dom,ffa}{,-movement}.json` retain raw observations.
These are natural bot rounds with **100 ms added each way**, normal keys, aim
and firing, no forced health/position/bot state. The driver holds movement
through its burst boundaries so it can reach the higher floors under fire.
The initial baseline used the stock driver's pauses; this is not a matched
combat-balance comparison. Room, controller and collision rules are unchanged.

| Map / mode | Round seconds | Natural deaths | Matched samples | p50 / p95 m | Max m | Soft / snap crossings | First ready ms |
|---|---:|---:|---:|---|---:|---|---:|
| Relay / TDM | 263.984 | 6 | 4674 | 0 / 0 | 1.421e-14 | 0 / 0 | 3373.8 |
| Undertow / DOM | 311.193 | 4 | 5571 | 0 / 0 | 1.421e-14 | 0 / 0 | 3747.4 |
| Switchyard / FFA | 311.395 | 7 | 5350 | 0 / 0 | 1.421e-14 | 0 / 0 | 4720.1 |

Terrain classification uses the actual ramp surface, structure footprint and
supported box top (including x/z overlap). Every row has zero soft/snap crossings:

| Map / terrain | Samples | p50 m | p95 m | Max m |
|---|---:|---:|---:|---:|
| Relay yard | 2339 | 0 | 0 | 1.421e-14 |
| Relay interior | 938 | 0 | 0 | 7.105e-15 |
| Relay stairs/ramps | 361 | 0 | 7.105e-15 | 1.421e-14 |
| Relay roof/slab | 886 | 0 | 0 | 7.105e-15 |
| Relay airborne/drop | 150 | 0 | 0 | 7.105e-15 |
| Undertow yard | 3772 | 0 | 0 | 7.944e-15 |
| Undertow stairs/ramps | 966 | 0 | 0 | 1.421e-14 |
| Undertow roof/slab | 833 | 0 | 0 | 7.105e-15 |
| Switchyard yard | 2768 | 0 | 0 | 1.421e-14 |
| Switchyard stairs/ramps | 1182 | 0 | 0 | 1.421e-14 |
| Switchyard roof/slab | 1400 | 0 | 0 | 1.421e-14 |

Replay correction maxima, including snapshots with no newly matched command,
are also **1.421e-14 m or less** on all three maps. Epoch/liveness resets are
reported separately; normal respawn placement is not a desync. The final
**10-second** `tk:stats` windows report zero drops/errors; they are not a
continuous whole-round rate-limit trace. These are local movement correctness
measurements with artificial latency, not deployed capacity/latency claims.
Only Relay currently has the new structure layer in this checkout. Undertow's
event gallery and Relay's sunken trench were not visited by these full rounds;
no claim of new interiors on Undertow/Switchyard or full-round trench coverage.

Performance failures retained, separate from movement acceptance: the DOM
telemetry round has a **2128.7 ms** first measured interval (2059/2075 CPU
samples idle); FFA has **2232.6 ms** first measured interval (2158/2173 samples
idle) and **1784.6 ms** later. Both fail the current presentation policy.
No shader-count change or console error; max callbacks **11.6 / 9.2 ms**.
Idle JavaScript does not identify the native cause; these runs were not traced.
Relay's telemetry policy result is PASS, max **25.1 ms**, including screenshot
readbacks. Ordinary, uninjected acceptance is recorded separately below.

Wow check: `.inspect/combat-s3-wow.json` and `combat-s3-wow-{0,5,10,15,20}s.png`
capture **20.439 seconds** of that live Relay round. Readback at 15 s shows the
player taking the interior stair at y=2.064 m while wounded (80 HP), with the
normal hostile-mortar and core-opening events. Respawn, yard approach, climb,
roof and drop are retained. Player sentence: **"I can take the stairs under
fire without being pulled backward."** This describes the hooked candidate,
not the unintegrated production entrypoint. Screenshot readbacks are diagnostic
evidence and do not replace the separate hitch acceptance.

Required code/resource checks: `pnpm typecheck`, `pnpm test`,
`pnpm build:client`, `pnpm audit:assets`: **PASS**. Suite: **792 passed /
7 skipped**, **95 files passed / 5 skipped**. Logs are `combat-s3-typecheck.log`,
`combat-s3-test.log`, `combat-s3-build.log`, `combat-s3-assets.log`.
Both stock and in-memory candidate `inspect-map --shots relay,practice-two`
pass with **zero console errors and zero forbidden network requests**:
`combat-s3-{production,candidate}-report.json`. Same-camera stills are
`combat-s3-production-relay.png` and `combat-s3-candidate-relay.png`.
Both fixed Relay views: **27 draws, 200,300 triangles, 16 textures,
25.681 MiB estimated texture memory, median 6.9 ms / p99 7.1 ms**.
Hardware is the existing RTX 5070 host; laptop iGPU validation remains separate.

Assets **30,121,938 bytes**, public directory **37,221,255 bytes**, largest
asset **7,183,364 bytes**: all unchanged from this session's baseline.
**0 asset bytes, textures, lights, rendering passes or Meshy credits added**;
0 asset-generation rejects. Candidate bundle (without source-map output):
**2,224,305 bytes**, SHA-256
`8416cebe8d498a325d07128bc7a15b4925f544d0deca9b0b160e714b5164b2d0`.
`combat-s3-build-gate.mjs` reproduces that candidate with only the exact main
hook changes; `combat-s3-probe-build.mjs` adds inspection telemetry and optional
latency separately. The main entrypoint has not been edited by combat.

The stock production TDM/FFA `--assert` gates pass with **2 deaths each**,
p99 **8 / 9 ms**, max frames **19.8 / 1089.5 ms**, max callbacks
**14.8 / 8.9 ms** (`combat-s3-production-{tdm,ffa}.json`). The FFA gap is
retained even though it falls inside the existing 1500 ms presentation ceiling.
Current `docs/HITCH-GATE.md` policy is unchanged: 1500 ms presentation, 150 ms
main-thread work, 25 ms p99, <=5% stalled time, no shader changes/errors and
at least two natural deaths. No acceptance threshold or browser flags changed.
Repeated candidate acceptance follows below; no latency injection, telemetry
patch, screenshot capture, trace, concurrent inspection browser or local build/
test is used during that sequence. Each run releases the shared GPU lease and
allows other streams to acquire it before the next run.

First candidate acceptance sequence stopped at **pair 4 FFA**: pairs 1-3 and
pair 4 TDM pass (all max frames below 20 ms), but
`combat-s3-accept-ffa-4.json` FAILs a **1792.5 ms** first measured warmup frame.
No console errors/shader changes, p99 **9 ms**, max callback **8.4 ms**, 2 deaths;
1708/1734 CPU samples around that gap are idle. The subsequent traced,
GPU-instrumented `combat-s3-ffa-diagnostic.json` runs **150.602 s**, max
**14.6 ms**, no >150 ms frames, only 1 death. Its trace summarizer has no spike
window: it does **not** explain the failed run or qualify as acceptance.
The first sequence and trace are preserved. A fresh ordinary sequence starts
at pair 5 on the **same candidate and same thresholds**; fresh passes qualify
those observations, not a fix for the earlier untraced presentation stall.

The second sequence stops at **pair 6 FFA**: pair 5 and pair 6 TDM pass,
but FFA has **1580.1 ms** at its first measured interval and **1318.6 ms**
later, failing both presentation maximum and repeated-stall share. Its
44.058 s run has 2 deaths, p99 **9 ms**, max callback **5.4 ms**; the two
windows contain **1496/1520** and **1260/1273** idle CPU samples respectively.
`combat-s3-startup-diagnostic{,-trace,-trace-summary}.json` then traces from
before navigation with GPU/timing instrumentation. It completes **68.146 s /
2 deaths**, max measured frame **14.4 ms**, without reproducing a gameplay
spike. Two startup intervals (268.8 / 240.9 ms) remain in the report, but
their renderer windows were evicted from the rolling trace
(`traceCoversWindow:false`), so they have no valid causal attribution.
No browser flag, timing limit or combat runtime was changed. The next fresh
ordinary acceptance sequence starts at **pair 7**. Both failed sequences
remain evidence of unresolved startup presentation reliability.

The third sequence stops at **pair 8 FFA**: pair 7 and pair 8 TDM pass
(TDM 8 retains a **646.6 ms** interval), but FFA 8 has **1880.6 ms** on its
first measured warmup frame. Its **23.313 s** run has 2 deaths, p99 **9 ms**,
max callback **9.1 ms**, zero shader changes/errors and **1797/1818** idle
CPU samples around the gap. It fails both presentation maximum and stall share
(**8.067%**). Passing and failing starts both occur in warmup, with and without
damage; no consistent combat-state transition explains the difference.

Three short startup traces then preserve the early renderer window before the
rolling buffer can evict it. `combat-s3-short-startup-{1,2,3}.json`, corresponding
`-trace.json`/`-trace-summary.json`, and `combat-s3-stall-diagnosis.json` retain
all results. These are **diagnostics, not acceptance** (0/0/1 deaths).

- Trace 1: **2901.4 ms** full startup interval, overlapping the **2319.4 ms**
  first ordinary measurement. `traceCoversWindow:true`. Chromium's
  `BrowserRasterWorker` spans **2904.896 ms wall / 7.392 ms CPU**, waiting on
  `GetPixelExecutableTask::run` (**2901.113 ms wall / 3.615 ms CPU**).
  Adjacent game renders take **0.9-1.5 ms**, **142-144 draws / 114-116 materials**.
- Trace 2: **2049.4 ms** full startup interval and **1385.2 ms** first measured
  interval, both covered. `SkiaOutputSurfaceImplOnGpu::FinishPaintRenderPass`
  spans **2049.206 ms wall / 3.078 ms CPU**; the overlapping vertex executable
  spans **2048.148 ms wall / 2.745 ms CPU**. Adjacent renders take **0.8-1.1 ms**,
  **96 draws / 58 materials**. A subsequent **174.8 ms** raster interval is retained.
- Trace 3: no gameplay repro, max **13.7 ms** over **11.202 s**. No causal claim
  comes from this smooth diagnostic.

The two covered long intervals have **no texture/buffer creation, shader links,
shadow requests or target passes**; existing skin/instance updates continue.
They locate waits in Chromium/ANGLE raster/compositor work, not a particular
driver defect, and cannot assign that cause to every untraced failed interval.
No runtime edit, browser flag or gate-policy change follows from this evidence.
The next fresh ordinary candidate sequence begins at **pair 9**. Its result
qualifies those runs only; presentation reliability remains an open main request.

The fourth sequence stops at **pair 9 FFA**. TDM 9 passes (2 deaths,
**115.178 s**, p99 **8 ms**, max **25.4 ms**, callback **21.2 ms**). FFA 9
retains a **1175.4 ms** first interval and a **2057.6 ms** later interval at
19.953 s. Its **42.986 s** run has 2 deaths, p99 **9 ms**, callback **8.2 ms**,
no shader changes/errors, but **7.521%** stalled time. CPU windows contain
**1116/1137** and **1930/1942** idle samples. This later untraced gap is not
assigned the startup traces' cause.

Final ordinary candidate history (`combat-s3-accept-{tdm,ffa}-{1..9}.json`):

| Pair | TDM status / max ms | FFA status / max ms |
| --- | --- | --- |
| 1 | PASS / 19.3 | PASS / 16.2 |
| 2 | PASS / 14.4 | PASS / 14.0 |
| 3 | PASS / 18.1 | PASS / 14.4 |
| 4 | PASS / 15.6 | FAIL / 1792.5 |
| 5 | PASS / 15.8 | PASS / 14.3 |
| 6 | PASS / 15.2 | FAIL / 1580.1 |
| 7 | PASS / 14.4 | PASS / 13.9 |
| 8 | PASS / 646.6 | FAIL / 1880.6 |
| 9 | PASS / 25.4 | FAIL / 2057.6 |

All 18 runs have at least two natural deaths and zero shader changes/console
errors. **Five consecutive passing TDM/FFA pairs were not achieved.** The final
report, `combat-s3-final-gates.json` (`node .inspect/combat-s3-gates-report.mjs
--from=5`), intentionally reports **FAIL** for the last five attempted pairs and
retains the entire history. The session is **not fully green**: typecheck, all
792 tests, build, assets, both inspectors, stock TDM/FFA and the all-map movement
assertion pass, but candidate presentation repeatability remains red.

No further unchanged retries are used to manufacture a passing streak. The
combat deliverable is the measured movement proof plus two regression tests;
the exact production hookup and native presentation investigation are assigned
to main through the requests above. Default remains the existing 0.15/2.5 m
movement thresholds and unchanged hitch policy. No new owner decision is needed
to route those requests. No runtime source/asset change was justified by this
session's measurements; no commit, push or deploy was performed.

Cleanup: stopped the owned Wrangler process and verified **no listener on 8798**
and no remaining Session 3 inspector/server Node process. Each completed probe
closed its inspection browser before releasing the shared lease. Final
`git diff --check` is clean; the only tracked changes are this plan and
`test/prediction-sync.test.ts` on `ironsight-aaa-combat`.

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
