# Ironsight AAA rebuild — combat stream

Branch `ironsight-aaa-combat`, worktree `D:/wt-ironsight-combat`, local port **8798**.
Scope and ownership: `tools/aaa-stream-combat.md`. No commits, pushes, deployments or Meshy spending.

## AAA gap list

1. **Owner rollback bug, integration hardening:** Session 4 fixes command-heading
   rollback of newer aim and isolates owner-snapshot collision from older room
   echoes, then fixes duplicate idle gravity during server catch-up. Final
   all-map rounds: 14,317 matched samples, 15,380 non-reset replay comparisons,
   zero soft/snap crossings at 100 ms added each way. Finish main activation of
   `Predictor.connect(net.room, () => net.online)` using the exact request below.
   Keep R-L19 partial until that production integration is validated.
2. **Presentation reliability (main owns the next renderer investigation):**
   Session 4 stock FFA fails at 2438.7 ms; a separate covered 1870.8 ms wait
   overlaps compositor/ANGLE work with only 2.7 ms executable CPU. Session 3
   retains 2.05-2.90 s covered waits. Preserve failures and existing limits;
   fresh passes do not close this gap or identify a driver defect.
   Ground navigation's wall-contact bug also blocks two-death probe coverage;
   main's fix request and exact reproduction are below.
3. **Bot squad tactics, arc 2/3:** multi-level routes through map-authored doors,
   stairs and roofs; validate against the map stream's actual new structures.
4. **Bot squad tactics, arc 3/3:** role names and tactical radio barks through the
   existing ping channel, with team cooldowns and human-callout priority.
5. Shared weapon table audit (R-G02–08, R-G19–20).
6. Layered, occluded firefight audio (R-G14–17), then surface impact feedback.

Session 1 delivered arc 1/3: four archetypes, reaction/decision difficulty and
verified-cover reloads. Priorities above are re-ranked for the next session.

## Cross-stream requests

- **Main / supervisor - Session 4 integration addendum:** keep the exact two-line
  activation below. Also take this session's `predict.ts` and `arena-room.ts`
  fixes: movement command yaw now drives only movement/slide/traversal, preserving
  the newer look/fire yaw; connected prediction takes collision from the same
  owner snapshot as kinematics. Also take `rooms/movement-sync.ts`: after applying
  a command the room waits at most one 50 ms timestep for further input before
  adding idle gravity, preventing duplicate gravity in a server catch-up burst.
  The deadline is set by execution, so duplicates cannot sustain a hover.
  Keep main's existing `setCoreOpen` callback for
  legacy prediction and scene/audio presentation. No additional main hook is
  required. All three failures were reproduced by real-room regressions before the
  fixes; the stale-door ordering is a controlled transport scenario, not evidence
  that it caused the owner's original live-play report. Activation still belongs
  to main and remains pending in this checkout.
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
- **Main / supervisor - Session 4 startup presentation stall:** stock FFA
  `combat-s4-production-ffa.json` fails at **2438.7 ms / 5.222% stalled time**;
  the final all-map candidate FFA diagnostic retains **2401.5 ms**. The separate
  `combat-s4-stock-startup-diagnostic{,-trace,-trace-summary}.json` covers a
  **1870.8 ms** interval overlapping `FinishPaintRenderPass` (**1873.272 ms wall /
  2.949 ms CPU**) and `GetVertexExecutableTask::run` (**1872.144 / 2.717 ms**).
  Pre-gap game submissions take **1.3-1.7 ms**, **120-121 calls / 90-91 materials**,
  with no new textures, buffers, programs, shader compilation/link, shadow
  request or target pass. Each recorded frame has eight existing-texture
  `texSubImage2D` calls and one 256-byte existing-buffer update. The after-gap
  game frame takes **1.8 ms**, **20 calls / 16 materials**, no resource creation,
  and one 256-byte existing-buffer update. Investigate the post-preparation
  compositor/ANGLE path in main/scene. This locates this reproduced wait;
  it does not prove a particular driver fault or explain every untraced gap.
  No combat renderer change is justified by these measurements, and all limits
  and browser flags remain unchanged. Session 3 evidence also remains below.
- **Main / supervisor - Session 4 navigation contact / acceptance coverage:**
  fix the capsule-contact case in `src/map/navigation.ts`'s `clear()`; it calls
  hitscan `nearestBox`, whose `rayAabb` deliberately ignores an origin inside
  or on the expanded box. Repro: Relay, from `{x:75,y:0,z:87.6}` toward
  `{x:75,y:0,z:95}`. `next()` returns the goal through cover
  `{min:{x:70,y:0,z:88},max:{x:80,y:3,z:90}}`, but `moveAndSlide` correctly
  stops at **87.6**. At **87.59**, `next()` instead returns **(76.5,87.5)**,
  the valid detour. The observed floating value **87.60000000000001** has the
  same failure. Keep hitscan semantics intact; give navigation a segment test
  that handles capsule contact, including movement away/along a wall. Add a
  regression using these three starts and require progress around the wall.
  Read-only reproducible artifact: `node .inspect/combat-s4-navigation-diagnostic.mjs`
  and `combat-s4-navigation-diagnostic.json`. Ordinary candidate
  `combat-s4-accept-tdm-2.json` stalls there from **83.182 s** through the
  **150.262 s** timeout and fails with only **one death** (at **53.223 s**;
  respawn **56.638 s**), despite a **16 ms** max frame and no errors. The
  standard hitch route also uses `GroundNavigator`, so this affects both
  production and candidate coverage. No navigation/physics/probe source was
  changed in combat; do not weaken the two-natural-deaths assertion.
- **Main / supervisor - Session 3 startup presentation stall:** ordinary candidate FFA
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
- **Main / supervisor:** current `GroundNavigator` excludes positive ramps and
  upper floors; Relay's below-grade terrain now has route continuity. Please
  provide height-aware `next(from, target)` points and reachable
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
| R-G20 | partial | Bots use normal handleFire/handleReload/handling. Session 4 preserves newer look/fire aim while replaying older movement headings (real-room regression). Shared weapon-table audit remains next arc. |
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
| R-L14 | partial | No WebGL resource additions. Session 4 code/asset/inspector checks pass; stock FFA fails at 2438.7 ms. Candidate pair 1 passes, TDM 2 fails death coverage due reproduced map-navigation contact. A short trace covers a separate 1870.8 ms compositor/ANGLE wait. Session 3 failures remain evidence; no iGPU claim. |
| R-L15 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L16 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L17 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L18 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-L19 | partial | Session 4: 14,317 matched samples and 15,380 non-reset replay comparisons across complete Relay/Undertow/Switchyard bot rounds, all errors/crossings zero; 25 prediction tests. Initial Relay replay failure retained; fixed server catch-up. Exact main activation remains pending. |
| R-L20 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L21 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-L22 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L23 | n.a. | Outside this session/combat lane; other-stream work left untouched. |

## Session log

### Session 4 - 2026-09-11: Rollback repair - harden the combat handoff

Reference: **R-L19**, **R-G20**, **R-M18**, **R-L14**. The owner rollback issue
remains the priority. Target: preserve latest aim while executing acknowledged
movement, keep kinematics and collision on the same owner-snapshot timeline,
and revalidate natural all-map bot rounds below the unchanged **0.15 m** soft
and **2.5 m** snap thresholds. No geometry, speed, damage or threshold changes.

Starting state: clean `ironsight-aaa-combat`; `main.ts` still uses the legacy
movement path. The status says Session 3 passed, but the retained Session 3
candidate repeatability results contain failures; those remain open evidence.
The pending main hook is applied only to an inspection bundle. Combat did not
edit any main/map/assets-owned file or spend Meshy credits.

Delivered:

- `src/rooms/arena-room.ts`: command heading is an explicit integration argument
  for walking, sprint sliding and traversal. It cannot overwrite a newer look
  or atomic fire aim. The regression previously moved correctly but changed the
  server yaw from **90 degrees to 0 degrees** after the newer look arrived.
  It now preserves both look and fire yaw while following the older movement
  heading. Bots and legacy inputs use the existing current-yaw default.
- `client/predict.ts`: connected collision comes from the accepted owner
  movement snapshot, along with its position and controller state. A subsequent
  older room echo cannot change prediction's door state. Legacy callers retain
  their existing `setCoreOpen` behavior. Controlled delayed-echo tests at both
  Relay and Undertow doors previously produced **0.6 m** matched errors; both
  now remain below **1e-8 m**. This does not attribute the original live bug to
  that ordering or claim it occurred naturally in a browser round.
- Three new real-room regression cases, **23 prediction tests** total.
  `.inspect/combat-s4-regression-before.log` retains the failures;
  `combat-s4-regression-after.log` retains the pass. The first door fixture
  placed its stale callback before snapshot delivery and passed; corrected
  ordering delivers it between snapshot reception and rendering. Advancing the
  fake wall clock caused backlog warnings, so the final test sets the event
  schedule instead and advances only normal 50 ms ticks.

Initial required checks: typecheck, **795 passed / 7 skipped** tests
(95 files passed / 5 skipped), client build and asset audit PASS. Evidence:
`combat-s4-{typecheck,test,build,assets}.log`. Browser, movement, resource and
wow evidence are recorded below when complete.

Initial browser diagnosis: the first Relay natural bot round ends after
**237.414 s**, with **6 deaths**, **4,010 matched samples at exactly zero error**,
and a **17.9 ms** maximum presentation interval. Its stricter movement acceptance
still fails: ticks **1114-1116** repeat ack **913** while falling from the roof,
with replay corrections **0.45 / 0.5 / 0.25 m**. They arrive together at page
time **59.764 s**, with no nearby >24 ms frame or recorded long task. The last
wow screenshot was at approximately 50.9 s; no direct readback overlap is
claimed. `combat-s4-live-tdm.json` retains the surrounding snapshots. Eight
natural core-state echoes agree with their owner snapshot; the synthetic stale
core regression is NOT presented as an observed natural race.

The SDK's fixed-step timer can drain several catch-up ticks before another
network callback arrives. After draining the available movement commands, the
room was adding idle gravity on the remaining catch-up ticks and then replaying
late commands on that already advanced body. A deterministic server-timer
backdate reproduces this without a client stall or altered geometry:
`combat-s4-catchup-before.log` fails with **0.15000000000000002 m** correction
despite zero matched error. The inspection-only Vitest candidate allows at most
one **50 ms** authoritative timestep after an APPLIED command before idle
gravity takes over. Command duplicates cannot refresh this deadline. It passes
all **25 prediction tests**, including silent-client landing, duplicate-jump
spam, flooded queues and the original rate/latency bounds. See
`combat-s4-catchup.config.ts` and `combat-s4-catchup-candidate.log`.

Those short test runs at **05:10:51-05:10:55 and 05:11:17-05:11:19 KST** ran
during the initial, already diagnostic DOM round; do not use that round as
uncontended hitch acceptance. The live server remains unchanged until the
initial all-map sequence exports, so those observations retain a single runtime.

Initial all-map result (`combat-s4-motion-acceptance.json`): **FAIL**, specifically
Relay's four replay-correction crossings in two timer bursts. Undertow has
**5,356** matched samples and Switchyard **4,413**, with zero matched or replay
corrections. Their complete rounds last **311.457 / 311.881 s**, with **8 / 19**
deaths. Switchyard retains a **1386.6 ms** presentation interval (0.445% stalled
time), inside the existing 1500 ms ceiling; it is not described as smooth.
All three rounds have zero console errors. These initial diagnostic reports
stay at `combat-s4-full-{tdm,dom,ffa}{,-movement}.json`.

Promoted the tested catch-up fix after all initial browsers closed:
`MovementInbox.applied(now)` records only executed commands;
`waitingForInput(now, TICK_MS)` bounds the idle-physics wait by server time.
The inbox's existing epoch lifetime, command cap, two-step credit limit and
payload validation remain authoritative. No wire/state shape or snapshot
version change is needed. A backwards server clock does not extend the wait.
Silent and duplicate-spamming clients still land; server catch-up no longer
adds an extra gravity step immediately after processing movement. Final
uncontended checks and independent `combat-s4-verified-*` rounds follow.

Final code/resource checks: `pnpm typecheck`, `pnpm test`, `pnpm build:client`,
`pnpm audit:assets` **PASS**. **797 passed / 7 skipped**, 95 test files passed /
5 skipped; **25 prediction tests**. `combat-s4-final-checks.json` records the
exit codes and shared inspection lease used to keep checks/bundling out of
the other stream's GPU window. Logs: `combat-s4-final-{typecheck,test,build-client,
audit-assets}.log`. Final production public bytes **37,222,385**, asset bytes
**30,121,938**, largest asset **7,183,364**. Public total is **+1,130 bytes** vs
Session 3's recorded total, including generated bundle/source-map changes.
**Zero asset bytes, textures, lights, passes or Meshy credits added**; zero
asset-generation rejects. The exact main-hook candidate bundle is **2,224,344
bytes**, SHA-256 `de23660a117fee6f166fc47fb93d35aeee4352ebf20a2c91d3b8305f69f7181c`.

Wow check on the final runtime: `combat-s4-final-wow.json` and
`combat-s4-final-wow-{0,5,10,15,20}s.png`, **20.478 seconds**, triggered by natural
nonfatal damage in Relay. The player runs through the interior, climbs and
drops from the roof at **35 HP**, dies and respawns; every captured correction
is zero. Player sentence: **"I can climb and drop under fire without being
pulled backward."** This describes the hooked candidate, not deployed main.
The earlier `combat-s4-wow-*` sequence is retained as initial-run evidence.
Screenshot readbacks are diagnostic visual evidence, separate from acceptance.

Fresh Relay round (`combat-s4-verified-tdm{,-movement}.json`): **256.371 s**,
**4 deaths**, **4,487 matched samples**, p50/p95/max **0/0/0 m**, zero replay
correction or soft/snap crossings. First-ready **4329.9 ms**. It retains a
**1207.9 ms** presentation interval (0.471% stalled time), no shader changes or
console errors; this satisfies the existing policy but is not a smoothness
claim. All-map terrain acceptance and ordinary hitch acceptance follow.

**Final all-map movement assertion: PASS.** `combat-s4-verified-motion-acceptance.json`
and `combat-s4-verified-summary.json` retain the assertion and full breakdown;
raw data is `combat-s4-verified-{tdm,dom,ffa}{,-movement}.json`. With **100 ms
added each way**, the three complete natural rounds contain **14,317 matched
samples** and **15,380 non-reset replay comparisons**. Every terrain row has
p50/p95/max **0/0/0 m** and **zero soft/snap crossings**:

| Map / terrain | Matched samples | p50 / p95 / max m | Soft / snap |
|---|---:|---:|---:|
| Relay yard | 2078 | 0 / 0 / 0 | 0 / 0 |
| Relay interior | 930 | 0 / 0 / 0 | 0 / 0 |
| Relay stairs/ramps | 362 | 0 / 0 / 0 | 0 / 0 |
| Relay roof/slab | 945 | 0 / 0 / 0 | 0 / 0 |
| Relay airborne/drop | 172 | 0 / 0 / 0 | 0 / 0 |
| Undertow yard | 3762 | 0 / 0 / 0 | 0 / 0 |
| Undertow stairs/ramps | 809 | 0 / 0 / 0 | 0 / 0 |
| Undertow roof/slab | 699 | 0 / 0 / 0 | 0 / 0 |
| Switchyard yard | 3558 | 0 / 0 / 0 | 0 / 0 |
| Switchyard stairs/ramps | 431 | 0 / 0 / 0 | 0 / 0 |
| Switchyard roof/slab | 571 | 0 / 0 / 0 | 0 / 0 |

The zeroes compare the **same acknowledged command** and the resulting replay
correction, not the current rendered player against an older room echo. Raw
room-echo distance still includes the deliberately added transport delay:

| Map | Raw echo samples | p50 / p95 / max m | Above soft / snap |
|---|---:|---:|---:|
| Relay | 2117 | 1.497 / 2.094 / 2.862 | 2018 / 3 |
| Undertow | 2459 | 1.505 / 2.025 / 2.409 | 2370 / 0 |
| Switchyard | 2252 | 1.493 / 2.096 / 2.682 | 2144 / 2 |

Connected prediction does not correct against these unacknowledged echoes.
This is why raw latency distance must not be reported as physics divergence,
or the exact-command zeroes presented as zero network delay.

Undertow's final round lasts **311.363 s / 6 deaths**, first-ready **4281.6 ms**;
Switchyard **311.460 s / 17 deaths**, first-ready **4079.1 ms**. Every final
10-second `tk:stats` window has zero input drops and room errors; this is not a
continuous whole-round drop trace. Respawn/epoch placement is counted separately.
This checkout has the new Relay structure layer and existing ramps/decks on
Undertow/Switchyard. These rounds do not claim new main-worktree interiors or
full-round trench/gallery coverage. The dedicated current-geometry tests retain
door, stair, slab and trench coverage. These are local correctness observations,
not deployed RTT/capacity figures or laptop-iGPU validation.

Performance residue, separate from movement: final Switchyard's diagnostic
round **fails presentation** with **2401.5 ms** at the first measured interval
and **766.3 ms** later. Main-thread callback max **13.2 ms**, p99 **8 ms**,
zero shaders added/console errors; **2293/2317** and **731/744** profile samples
are idle around the respective gaps. No cause is assigned from CPU idleness.
`combat-s4-startup-diagnostic{,-trace,-trace-summary}.json` is the short follow-up
with startup trace and GPU instrumentation. It does **not** reproduce a gameplay
stall (max **8 ms**, first-ready window **97.4 ms**). Its covered **275.2 ms**
loading interval contains a **250.947 ms wall / 246.137 ms CPU** pixel executable
and **250.522 / 245.713 ms** D3D compilation. A second **175.5 ms** loading
interval is retained. This is observed loading compilation, not an explanation
for the untraced 2.402-second gameplay gap. The short diagnosis has fewer than
two deaths and is not acceptance. No browser flag or gate limit was changed.

Final fixed-camera production/candidate inspection: both **PASS**, with zero
console errors or forbidden requests. Reports are
`combat-s4-final-{production,candidate}-report.json`; before/after stills are
`combat-s4-final-{production,candidate}-{relay,practice-two}.png`. Relay's
camera matches and looks unchanged, as expected for a movement repair:
**27 draws / 200,300 triangles / 16 textures / 25.681 MiB**, identical on both
paths. Median **6.9 / 6.9 ms**, p99 **7.2 / 7.1 ms**, scene preparation
**995.9 / 982.6 ms** (production/candidate). Practice-two retains **49 draws /
101,470 triangles / 17 textures** on both. No geometry, lighting or visual
quality claim is made from the timing variation. Initial
`combat-s4-{production,candidate}-*` reports/stills remain retained too.

Ordinary stock gates retain mixed results: TDM **PASS**, **66.219 s / 2 deaths**,
max **14.5 ms**, p99 upper **8 ms**, callback **9.6 ms**, first-ready **3319.9 ms**.
FFA **FAIL**, **46.702 s / 2 deaths**, max **2438.7 ms**, p99 upper **8 ms**,
callback **8.4 ms**, **5.222%** stalled time. Both have zero shader additions
and console errors. Evidence: `combat-s4-production-{tdm,ffa}.json` and logs.
The failed FFA interval has **2330/2341 idle CPU samples**; that alone does not
locate its cause. The failure is retained under its original filename.

The follow-up stock startup trace **does reproduce a covered native wait**:
`combat-s4-stock-startup-diagnostic{,-trace,-trace-summary}.json`, **1870.8 ms**
startup interval overlapping a **1242.7 ms** first ordinary measurement interval.
`traceCoversWindow:true`; Chromium's compositor paint takes **1873.272 ms wall /
2.949 ms CPU**, overlapping an ANGLE vertex executable **1872.144 / 2.717 ms**.
The pre-gap game submissions take **1.3-1.7 ms**, **120-121 calls / 90-91
materials**, with eight existing-texture updates and a 256-byte existing-buffer
update per recorded frame. After the gap: **1.8 ms / 20 calls / 16 materials**,
one 256-byte buffer update. No new GPU resources, shader compilation/link,
shadow request or render-target pass is recorded around it. Loading compilation
intervals of **282.3 / 167.9 ms** are retained separately. This locates the
reproduced wait in the compositor/ANGLE path, not a named driver defect or all
untraced stalls. Its short duration/death coverage cannot satisfy acceptance;
do not count this diagnostic as a passing round. Exact main follow-up is above.

Ordinary candidate acceptance stopped at the first failure. The exact main-hook
bundle uses the unchanged original probe, normal input driver, **150000 ms** and
`--assert`; there are no movement observers, artificial latency, captures or
tracing in these runs. All browsers hold the shared inspection lease through
cleanup; main's inspections can run between these sequential probes, never
alongside them. `combat-s4-acceptance.json` is **FAIL**, not five passing pairs:

| Candidate run | Gate | Measured seconds / deaths | Max frame / callback ms | p99 upper ms | Stalled time |
|---|---|---:|---:|---:|---:|
| TDM 1 | PASS | 132.734 / 2 | 554.2 / 13.1 | 9 | 0.679% |
| FFA 1 | PASS | 60.909 / 2 | 14.1 / 7.1 | 8 | 0% |
| TDM 2 | FAIL: fewer than two deaths | 150.262 / 1 | 16.0 / 7.2 | 8 | 0% |

First-ready **3363.8 / 3293.8 / 3111.8 ms** respectively. All have zero shader
additions and errors. Raw evidence: `combat-s4-accept-{tdm-1,ffa-1,tdm-2}.json`
and matching logs. FFA 2 and pairs 3-5 were not run after that failure.

The second TDM's navigation trace stays against Relay's south wall at
**z=87.6** from **83.182 s** through timeout. The direct read-only reproduction
in `combat-s4-navigation-diagnostic{.mjs,.json}` shows the map navigator choosing
the goal through a radius-expanded wall at contact, while movement collision
correctly stops. One centimetre before contact it chooses a valid detour.
The root is the navigator reusing a hitscan intersection that skips origins on
or inside the expanded box; this is not prediction drift. Main owns
`src/map/navigation.ts` and the standard probe. Exact coordinates and requested
regression are in Cross-stream requests. No combat-only bot aggression/damage
change, altered probe route or weaker death requirement is justified to hide
that failure. No unchanged retries were used to manufacture five passes.

Final session disposition: **NOT FULLY GREEN**. Typecheck, **797 tests**, build,
asset audit, both production/candidate fixed-camera inspectors and full-round
all-map movement assertions pass. Stock FFA presentation and candidate
five-pair repeatability remain red for the two documented reasons. Movement
activation, navigation contact handling and renderer investigation belong to
main; this stream supplies the combat fix and concrete requests without
editing those files. Do not mark R-L19 met or the deployed rollback bug fixed
until main integrates the two-line hook and validates the combined build.

Open owner questions: none require a pause. Defaults remain unchanged
thresholds, natural deaths, current authored collision, original browser flags,
and no Meshy spending. Prioritize main integration and the two measured
acceptance blockers before the deferred weapon/audio arc. No commit, push or
deployment was made.

Cleanup/scope: all Session 4 probes completed and closed their browsers before
releasing the shared lease. Stopped only this session's verified Wrangler tree
(root PID **82472**, including its workerd children); confirmed **zero Session 4
processes** and **zero listeners on 8798**. Other streams and the supervisor
remain running. Final `git diff --check` passes; branch is
`ironsight-aaa-combat`. Tracked changes are exactly this plan, `client/predict.ts`,
`src/rooms/arena-room.ts`, `src/rooms/movement-sync.ts` and
`test/prediction-sync.test.ts`; ignored evidence stays under `.inspect/`.

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
