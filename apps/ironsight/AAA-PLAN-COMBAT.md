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
   Session 5 retains another stock FFA failure (2155.7 ms and one death);
   Switchyard's north-wall driver contact is reproduced separately. The combat
   navigator avoids it, but the main-owned probe still uses GroundNavigator.
   Session 6 stock passes five final pairs, but the exact radio-hook candidate
   FFA still fails at **2507.7 ms / 8.830% stalled time**. Keep the presentation
   investigation open; radio is inactive in FFA, which alone proves no cause.
   Session 7 also retains a stock pair-4 FFA failure at **1870.7 ms** with
   two deaths and zero errors/recompiles. Final requalification fails again
   at **1973.4 ms** in pair 2 FFA. Separate traces do not reproduce these
   completed intervals; causes remain unassigned. Five pairs were not achieved.
   Session 8 retains stock FFA **1995.2 / 2051.4 ms** intervals. A separate
   complete trace covers a **3369.233 ms** native raster wait on a pixel
   executable task; no combat resource/shader work is created. The exact main
   request below distinguishes that reproduction from the untraced gate gaps.
   Final Session 8 qualification fails pair 2 FFA at **2302.2 ms**, plus a
   **325.3 ms** first-death interval. Five pairs are not achieved. A focused
   death trace does not reproduce either failure; keep both causes open.
   Session 9's initial pair 2 FFA also fails at **1618.9 ms** and first damage
   **1146 ms**. Its traced follow-up does not reproduce either gameplay gap;
   no new cause is assigned. Final qualification is recorded in Session 9.
   Final Session 9 FFA fails at **1845.1 ms** during the first death window.
   The longer death trace does not reproduce that failure; no third retry.
3. **Bot squad radio integration:** Session 6 implements six authoritative
   callouts and a role caption readable with audio muted. The legacy client receives
   compatible markers by default; main must activate the exact caption/audio
   hook below before the full three-session bot arc is called complete.
4. **Weapon authority, arc 2/2:** Session 8 also uses server receipt time for
   ADS/sprint eligibility, swap and reload. Ten queued boundary regressions fail
   before the fix; all 31 cadence tests and 855 full-suite tests now pass.
   Damage, recoil and timer values remain unchanged. Session 7 repairs cadence and recoil using
   server-recorded input receipt time, preserving the exact weapon table.
   The baseline live SMG accepts only 10/18 inputs; the queue regression also
   reproduces rejection of legal pistol shots and acceptance of early AR shots.
   Existing denial feedback now corrects ammo/recoil. Final SMG capture still
   accepts only **5/18** after thirteen inputs arrive 1 ms behind a delayed
   accepted shot. Trace delivery compression next; do not widen the rate cap.
   Reduced view kick remains a main-owned request. Session 8 reproduces delayed
   ADS delivery downstream of a local relay that preserves input spacing.
   A separate Worker observer finds a **347 ms** tick/input pause immediately
   after a periodic snapshot. The storage promise resolves immediately; this
   correlation is not a root cause. Keep receipt-based validation and investigate
   local Worker scheduling/storage without changing persistence guarantees.
5. **Surface impact feedback is the next actionable combat arc:** Session 10
   completes the prepared distance/confirmation mix implementation following
   Session 9's support/occlusion repair. Native audio fixtures preserve weapon
   identity at three distances, reserve threat foley, and put hit/kill cues
   above a dense gunfire stem. Human headphone acceptance remains open.
   Next audit muzzle/impact dust, spall and suppression against R-G10/R-G11,
   using existing bounded VFX pools. This does not close the higher-priority
   main movement/presentation or local-delivery requests.
6. Retest bot routes as main lands new buildings; DOM keeps ground-objective
   priority and has no forced high-ground diversion in this session.

Session 1 delivered arc 1/3: four archetypes, reaction/decision difficulty and
verified-cover reloads. Session 5 delivers arc 2/3: collision-derived multi-level
walking and bounded marksman high-ground orders. Priorities above are re-ranked.

## Cross-stream requests

- **Main / supervisor - Session 10 audio:** no new main hook is needed.
  Existing confirmed `playHit` / `playKill` calls briefly lower the dedicated
  gunfire gain; foley, victim cues, warnings and the master mute/volume retain
  their existing paths. Prepared close/field/far perspectives select at
  **12 / 28 m**, within the existing **55 m** audible range and geometry filter.
  There is one additional persistent audio gain and **2,131,200 extra cached
  PCM bytes at 48 kHz**, no per-shot PCM generation or extra shot source.
  Keep the pending movement/radio hooks and presentation investigation above
  these audio changes in release priority. No movement activation, renderer
  repair, local-delivery fix or human headphone acceptance is claimed here.

- **Main / supervisor - Session 9 presentation recurrence:** initial pair 2
  FFA fails at **1618.9 ms**, plus **512.3 ms**, **4.950%** stalled time,
  **5.8 ms** callback max, p99 **8 ms**, two natural deaths, zero errors or
  shader changes. The first-damage observer separately fails at **1146 ms**
  across the measurement boundary; it overlaps the 512.3 ms interval and must
  not be added as a third independent stall. Evidence:
  `combat-s9-accept-ffa-2.json` / `combat-s9-acceptance.json`.
  The traced follow-up runs **35.763 s / two deaths**, max **18.9 ms**,
  callback **14.1 ms**, and does not reproduce either gameplay failure.
  Its older **269.7 / 164.4 ms** loading intervals have no retained renderer
  coverage. `combat-s9-ffa-diagnostic{,-trace,-trace-summary}.json` and
  `combat-s9-diagnostic-summary.json` therefore assign no new cause. Continue
  main's presentation investigation; no speculative HUD edit or gate/driver
  change follows. A bounded final qualification is recorded separately below.
  **Final qualification also fails:** pair 1 FFA has a **1845.1 ms** interval
  ending at **24.912 s**, while dead, after first death at **22.854 s**.
  It fails both presentation and first-death bounds. Callback max **4.6 ms**,
  p99 **8 ms**, **2.491%** stalled time, two natural deaths, no errors or
  shader changes. `combat-s9-final-accept-ffa-1.json` retains the interval;
  the separate longer death diagnostic below is not acceptance or a retry.
  `combat-s9-death-window{,-trace,-trace-summary}.json` records **22.039 s**,
  one death, and a complete first-damage/death window at **8.4 ms**. It does
  not reproduce the failed death interval. Its **1354.3 ms** startup gap and
  overlapping **1920.2 ms** post-ready observation lack retained renderer
  coverage; no cause is assigned. `combat-s9-death-summary.json` records these
  limits. The same ownership boundaries and existing presentation request apply.

- **Main / supervisor - Session 9 acoustic integration:** no new main hook is
  needed. Existing `setAudioMap(map)` / open-door map updates now prepare the
  same ramp occluders used by authoritative shots. Terrain boxes and structural
  walls/slabs use concrete foley; structure stairs use concrete, while legacy
  deck/cover fallbacks retain metal. This matches the current authored kit,
  not a universal material inference for future wood or grating. Preserve
  identity references from `terrain.boxes` and `structures.parts[].box` when
  composing maps, as the existing map contract requires. Combined newer main
  geometry still needs validation. Owner rollback activation and Session 8's
  presentation/runtime-scheduling requests remain open; this audio
  work does not resolve them or alter prediction/weapon timing.

- **Main / SDK owner - Session 8 delayed local input:** the standard handling
  check first fails AR at **461.8 ms** (bound **450 ms**). A read-only send/reply
  observer then reproduces **799 ms**. The transparent-relay run preserves
  **262.5 ms** browser / **262.215 ms** relay spacing from ADS to fire, yet the
  first denial arrives at **902.2 ms** with **250 ms** ADS remaining; first
  confirmed shot is **1139.7 ms**. That compression is downstream of the relay.
  A separate Worker observer captures a **347 ms** tick gap immediately after
  periodic snapshot `put` at **1789084795563**. ADS reaches the relay at
  **1789084795764.274**, Worker `_message` at **1789084795891**; fire reaches
  them at **1789084796021.467 / 1789084796022**. The authority correctly sees
  only **131 ms** of ADS and reports **119 ms** remaining. First shot **463.1
  ms**. SDK `receivedAt` therefore cannot recover the earlier missing interval.
  Evidence: `combat-s8-readiness-delivery-summary.json`,
  `combat-s8-handling-{wire,worker-context}-trace-1.json`, corresponding wire
  logs and `combat-s8-handling-worker-context-worker.json`.
  Inspect local workerd scheduling and storage flush/gating around these
  boundaries; `put`'s promise resolves in the same millisecond, which does not
  time its flush. This is correlation, not proof of a storage defect. Do not
  add client-clock fire credit, relax cadence or change storage options from
  this evidence. SDK/runtime files are outside combat ownership. Observers
  preserved arguments/results but can affect timing; the added TCP hop can
  also affect timing. The owned preview was restarted before final checks.

- **Main / supervisor - Session 8 covered presentation recurrence:** ordinary
  pair 1 FFA fails at **1995.2 / 2051.4 ms**, **5.309%** stalled time, **8.4
  ms** callback max, p99 **9 ms**, two deaths, zero shaders/errors. The separate
  immediate-stop startup trace reproduces **2796.5 ms** measured, overlapping
  a **3366.4 ms** post-ready interval; these overlap and are not two stalls.
  The complete trace covers it: `BrowserRasterWorker` takes **3369.233 ms wall /
  3.301 ms CPU**, waiting on `GetPixelExecutableTask::run` (**3365.458 /
  3.431 ms**). Game submissions immediately before cost **1.0-1.4 ms**, **96
  calls / 50 materials**; the returning frame costs **2.4 ms**, **125 calls /
  81 materials**. Zero resource creation, shader links, shadow requests or
  target passes; existing bone textures and the 256-byte buffer update remain.
  Files: `combat-s8-accept-ffa-1.json` and
  `combat-s8-ffa-diagnostic{,-trace,-trace-summary}.json`. Timers keep firing
  through the gap. This locates this reproduced native wait, not a specific
  driver defect or the causes of both untraced acceptance intervals. Combat
  client bytes are unchanged. Continue main's compositor/presentation work;
  no gate change or speculative combat HUD/VFX edit follows from this trace.
  **Final qualification fails again:** pair 2 FFA has **2302.2 / 325.3 ms**
  gaps, **3.116%** stalled time, **7.9 ms** callback max, p99 **8 ms**, three
  deaths and zero errors/recompiles. The **325.3 ms** gap also fails the
  separate first-death **150 ms** bound. A **2940.2 ms** post-ready startup
  interval overlaps the initial measured gap; do not add them. Evidence:
  `combat-s8-final-accept-ffa-2.json` / `combat-s8-final-acceptance.json`.
  A focused first-death trace completes its window at **8.7 ms** and does not
  reproduce the failure. Its older loading intervals are outside renderer
  coverage. `combat-s8-death-diagnostic{,-trace,-trace-summary}.json` cannot
  assign a cause to either failed acceptance interval. No further unchanged
  acceptance retries, source speculation, threshold or browser-flag change.

- **Supervisor - Session 8 inspection scheduling:** Session 7's supervisor
  timeout occurred while waiting for main's GPU lease, before the combat probe
  launched a browser. The shared helper allows a **600 s acquisition wait**;
  the supervisor kills the whole command after **360 s**. Start the measurement
  watchdog after lease acquisition, or allow the existing acquisition budget
  plus probe/cleanup time. Retain the same lease, browser cleanup and every
  performance limit; never terminate another stream's inspector or bypass the
  lease. Session 8's baseline acquired immediately and passed; the decoded
  transport diagnostic waited **79.279 s** behind main's normal hitch probe.
  This request fixes scheduling, not the separately retained FFA stalls. The
  combat lane cannot edit the supervisor or `scripts/inspection-lease.mjs`.

- **Main / supervisor - Session 8 weapon integration:** take the inherited
  Session 7 cadence repair together with this session's readiness fix in
  `arena-room.ts` and `test/weapon-cadence.test.ts`. Fire readiness and cadence,
  plus swap/reload starts, now use the same SDK-recorded receipt instant.
  Early ADS/sprint/swap/reload shots cannot borrow the queue wait and steal the
  following legal shot. No new client hook or protocol change is required.
  Keep the existing weapon table and receipt-based rate cap. The separate
  local delivery investigation above does not justify a client-clock workaround.

- **Main / supervisor - Session 7 presentation recurrence:** stock pair-4 FFA
  fails the unchanged 1500 ms presentation ceiling at **1870.7 ms**, the first
  measured interval. Callback max **7.7 ms**, p99 **8 ms**, stalled share
  **2.651%**, two natural deaths, zero errors/recompiles, first-damage/death
  windows pass. `combat-s7-accept-ffa-4.json` and `combat-s7-acceptance.json`
  retain the failure; CPU **1768/1787** idle samples do not identify its cause.
  The full traced diagnostic has no gameplay spike; its startup intervals
  have rolled out of trace coverage. The short trace covers only **344 /
  161.3 ms** loading intervals before UI preparation, not this 1.87 s gap.
  Evidence: `combat-s7-ffa-{diagnostic,startup-diagnostic}{,-trace-summary}.json`.
  No client bundle, renderer, assets, browser flags or limits changed here.
  Continue the existing presentation investigation; a fresh passing sequence
  cannot close this request or turn the untraced failure into a driver diagnosis.
  **Final qualification also fails** in pair 2 FFA: **1973.4 / 195.8 ms**
  gaps, **5.9 ms** callback max, p99 **8 ms**, **2.990%** stalled time, two
  deaths, zero errors/recompiles, first-damage/death checks pass. Its startup
  observer also retains a **2604.2 ms** post-ready interval overlapping the
  first measured gap. Files: `combat-s7-final-accept-ffa-2.json` and
  `combat-s7-final-acceptance.json`. The bounded sequence stopped; no further
  acceptance retry. Session 7 is **not green**. Three diagnostic captures,
  including a longer startup/recovery trace, do not identify the failure's
  cause. See `combat-s7-summary.json` for the complete failed disposition.

- **Main / supervisor - Session 7 reduced view kick:** the weapon audit finds
  `client/scene.ts` still computes `const kick = this.recoil;` after its
  exponential decay, regardless of `reducedMotion`. In that viewmodel-only
  block, use `const kick = this.recoil * (this.reducedMotion ? 0.25 : 1);`.
  Keep `src/recoil.ts`, `main.ts` aim offsets and authoritative rays unchanged.
  This extends the existing reduced-motion setting to the cosmetic weapon
  translation/rotation (R-G08); it must not reduce gameplay recoil. Validate
  both modes at the same shot index and confirm identical hit rays. This is
  a reviewable request, not an edit or a shipped claim in the combat stream.

- **Main / supervisor - Session 6 presentation blocker:** final stock passes
  five consecutive TDM/FFA pairs, but the exact radio-hook candidate stops at
  pair 1 FFA with **1533.1 / 2507.7 ms** gaps and **8.830% stalled time**.
  Callback max **8 ms**, p99 **8 ms**, two deaths, zero errors/recompiles;
  first-damage/death windows pass. Evidence:
  `combat-s6-candidate-accept-ffa-1.json` / `combat-s6-candidate-acceptance.json`.
  Both gaps are untraced; CPU idleness is not a cause. FFA has no radio traffic.
  No unchanged acceptance retry or threshold/browser/driver change was used
  to hide the failure. Continue the main-owned presentation investigation;
  subsequent diagnostic evidence and scope limits are in the session log.
  The corrected traced diagnostic does not reproduce a gameplay gap and its
  retained startup windows are uncovered. No new native-work cause is claimed.

- **Main / supervisor - Session 6 squad radio hookup:** in `client/main.ts`'s
  existing guarded `teamPing` listener, replace
  `if (ping?.contact) playContactCue();` with:

  ```ts
  const bark = ping && hud.receiveSquadRadio(ping, net.serverNow());
  if (bark) playContactCue(bark);
  else if (ping?.contact && !('radio' in ping)) playContactCue();
  ```

  Keep the existing online/live/alive/pointer-lock guard and tactical-map
  validation. The second condition preserves old-server contact sounds without
  replaying a duplicate/stale new-server radio cue. No other hook is needed:
  `Hud.update`, death/result damage clearing, and pause already clear captions.
  This session's inspection bundle applies exactly this hook in memory, with
  no main/source/driver edits. The production server sends compatible
  `teamPing` markers by default; rich captions and tactical cue variants stay
  pending until main activates this hook. Existing SUPPORT/MARKSMAN legacy
  killfeed/operator-kit naming requests below still apply; the new radio
  caption itself uses `combatBotLabel` correctly. These are subtitled barks
  with procedural radio idents, not recorded or synthesized spoken dialogue.

- **Main / supervisor - Session 5 release blockers:** stock
  `combat-s5-final-accept-ffa-1.json` fails at **2155.7 ms** and with **one death**
  in **151.418 s**. The first gap has **2045/2059** idle CPU samples; a later
  **1127.6 ms** gap has **1069/1077**. Callback max **9.5 ms**, p99 **8 ms**,
  zero new shaders/errors. These two intervals are untraced; do not assign
  their cause from CPU idleness. The separate short trace only covers loading
  intervals (**273.7 / 165.5 ms**), not a reproduction of either gameplay gap.
  Client bundle and asset byte counts are unchanged this session.
  Continue the previously requested main/scene presentation investigation.
  The second blocker is a new location of the existing driver navigation bug:
  Switchyard `{x:25,y:0,z:5.6000000000000005}` toward `{x:25,y:0,z:13}`, blocked by
  `{min:{x:20,y:0,z:6},max:{x:36,y:3,z:8}}`. `GroundNavigator.next` returns the
  goal through cover; normal movement stays at **z=5.6**. At **5.59** it detours.
  The failing browser stays there from **42.865 to 148.838 s** (42 samples),
  after death **26.261 s** / respawn **29.759 s**. New combat navigation returns
  **(19.5,0,5.5)** and its full-physics regression reaches the goal. Repro:
  `combat-s5-navigation-diagnostic.mjs` / `.json`; fix main's `navigation.ts`
  contact segment semantics as requested in Session 4, preserving hitscan and
  the two-death gate. No map/driver/gate change or unchanged acceptance retry
  was used to conceal this failure. Five passing pairs were **not achieved**.
- **Main / supervisor - Session 5 bot navigation:** no new client hook is needed.
  `src/rooms/bot-navigation.ts` replaces the room's ground-only navigator; it
  derives supported floors and swept walking edges from existing boxes/ramps.
  Both core-door variants are built at room creation and cached per immutable
  map. Marksmen take reachable high ground at regular/hard difficulty, while
  DOM orders keep priority. Take the combat-owned room/brain/test changes as
  usual and rerun route tests against main's newer map geometry. No map layout,
  collision, `navigation.ts`, physics or client source changed. The old request
  for a main-provided vertical bot navigator is superseded for this checkout.
  **The Session 4 `GroundNavigator` contact request still applies to main's
  headless player driver**, which deliberately retains its original code.
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
| R-M18 | met | Current combat geometry: Session 5 walks both Relay interiors/stairs/roofs, Undertow/Switchyard decks and Relay trench with the normal capsule. Natural Relay bots use ground, +3 m and -3 m. New main-worktree geometry still needs combined validation. |
| R-M19 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-M20 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-G01 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-G02 | partial | Session 7 audits ideal TTK at 5/15/30/60 m, verifies real queued AR/SMG/pistol body-shot kills, and fixes tick-dependent cadence rejection. Live delivery compression remains; ideal TTK is not measured network TTK or a balance claim. |
| R-G03 | partial | Existing sniper glint/tracer, 400 ms ADS, 150 ms sprint recovery; handling browser proof passes. Opponent-side telegraph readability remains a separate visual audit. |
| R-G04 | met | Shared-table audit and recoil tests: first-shot accuracy <=0.0002 rad, large movement penalty, 25% crouch reduction; AR 300 ms and SMG 260 ms ideal close body TTK. |
| R-G05 | met | First four automatic pattern entries are vertical, then fixed lateral drift; real-room rays follow the shared pattern. Session 7 removes drain-clock distortion from recoil recovery. |
| R-G06 | met | Shared center-biased bounded jitter, ADS/crouch multiplication, hybrid spread after AR 8 / SMG 7 / pistol 5; existing distribution/stance tests and new queued recoil parity pass. |
| R-G07 | partial | Existing blast trauma uses squared strength, rotational-only 2-degree cap and 2 s decay; full tests pass. Weapon cosmetic kick remains a separate main-owned presentation path. |
| R-G08 | partial | Aim recoil and cosmetic viewmodel kick are separate. Reduced-motion currently leaves weapon kick unchanged; exact main request above, no combat edit to scene/settings. |
| R-G09 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-G10 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G11 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-G12 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-G13 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-G14 | met | Session 9 actual Web Audio graph preserves 1.4x enemy footstep/reload gain, 16/20 voice priority and complete drainage. Terrain/slab/stair material and capsule support regressions pass; live concrete stair/roof capture retained. |
| R-G15 | partial | Session 10 native audio A/B: confirmed hit/kill cues retain their original level while gunfire dips 11.06/13.98 dB; cue-to-fire RMS is +1.88/+7.55 dB in the specified dense windows. Overlap, recovery, voice saturation and mute pass. WAV comparisons retained; subjective headphone acceptance remains open. |
| R-G16 | met | Session 9 uses authoritative box/ramp occluders, retains open doors and above-ramp paths, fixes endpoint/thin-wall leaks, and verifies actual 0.32 gain/1100 Hz occluded nodes. No diffraction/HRTF claim. |
| R-G17 | met | Session 10: cached close/field/far perspectives keep all five original weapon shapes/three variations, with damped mechanism and more diffuse distant tails. Native graph A/B at 0/8/20/40 m, 44.1/48/96 kHz synthesis regressions, unchanged one-source shot lifetime/caps, and confirmation priority. No HRTF, physical diffraction or headphone-quality claim. |
| R-G18 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-G19 | partial | Table ADS 250/200/225/400/165 ms and sprint 120/100/130/150/90 ms match targets. Session 8 fixes early queue-drained shots stealing the legal shot behind them: all five weapons pass exact receipt-time ADS/sprint boundaries, plus swap/reload boundaries. Full suite 855 passed. Live AR first-shot bound fails; relay/Worker observations locate delayed ADS input before SDK receipt. Keep end-to-end timing partial until that cause is resolved. |
| R-G20 | partial | Client and room read GAME.weapons and the same recoil/spread/handling helpers. Session 7 uses trusted receipt time for cadence/recoil, rejects forged subtick credit and corrects denied prediction. Compressed delivery and existing predicted muzzle/audio policy remain; no claim of fully server-confirmed local juice. |
| R-L01 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L02 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L03 | met | AR is four close body hits / 300 ms ideal TTK; the queued room duel confirms the four-hit kill. This is a weapon contract, not a claim of completed PvP balance tuning. |
| R-L04 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L05 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L06 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L07 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L08 | partial | Session 6: six action/sight-validated barks share 8 s/team and 16 s/caller airtime; human pings retain 5 s priority. Real-room routing/forgery tests pass. Exact role-caption/audio hook passes live browser inspection but remains main-owned integration work. |
| R-L09 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L10 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L11 | partial | Four profiles, 150-600 ms reactions, identical seeded aim, depth 1/2/3 cover search and verified multi-level routing. Session 6 natural rounds show six radio kinds across team modes; no FFA radio. Rich caption/audio activation and legacy role/kit names still require main. |
| R-L12 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L13 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L14 | partial | Session 9 code/build/assets, fixed cameras and real audio graph pass (863 application cases plus 31 archived cadence cases), with no new WebGL resources. Initial FFA fails at 1618.9 ms / first damage 1146 ms; final FFA fails at 1845.1 ms in the first death window. Five pairs not achieved. Both diagnostic death windows pass without reproducing these failures; older spikes lack coverage. All evidence retained; no iGPU or presentation-fix claim. |
| R-L15 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L16 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L17 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L18 | partial | Session 9 confirms 1.4x enemy foley and four reserved clear-threat voices. Occlusion follows solid geometry; no additional path-distance/reachability weighting is claimed. |
| R-L19 | partial | Session 4: 14,317 matched samples and 15,380 non-reset replay comparisons across complete Relay/Undertow/Switchyard bot rounds, all errors/crossings zero; 25 prediction tests. Initial Relay replay failure retained; fixed server catch-up. Exact main activation remains pending. |
| R-L20 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L21 | not yet | Queued combat-stream audit; no Session 1 compliance claim. |
| R-L22 | n.a. | Outside this session/combat lane; other-stream work left untouched. |
| R-L23 | n.a. | Outside this session/combat lane; other-stream work left untouched. |

## Session log

### Session 10 - 2026-09-11: Grounded firefight audio, arc 2/2 - confirmations cut through

Reference: **R-G15**, **R-G17**, **R-G14**, **R-G16**, **R-L14**, **R-L19**.
Targets: retain the five close weapon identities; prepare separate field/far
perspectives without event-time synthesis or more sources per shot; make a
confirmed hit/kill exceed the dense gunfire stem by **at least 1 dB RMS** in
the stated cue windows; retain the **16/20** remote-voice caps, enemy foley
gain, muted/zero-volume silence, finite unclipped output and complete drainage.
Those digital targets pass; headphone preference is not inferred from RMS.

Started clean at **2f79869**, branch `ironsight-aaa-combat`, port **8798**.
Read the lane first, then the standing brief, Session 10 status, combat plan,
art concept and design reference. Main still uses legacy `net.setMoveIntent`;
the owner movement repair activation remains outside this lane. The preceding
session's retained FFA failures remain valid despite the supervisor's green
summary. No physics/map/scene/main/config/asset or other-stream source edit,
new dependency, Meshy expenditure, commit, push or deployment.

Delivered through existing production hooks:

- `client/audio.ts` prepares three perspectives for each of the five weapons'
  three existing variations. Local and <12 m recordings are unchanged;
  12-28 m field and >=28 m distant shots soften the mechanism and increase
  relative reflection energy. The existing 55 m spatial range, pan and
  authoritative-geometry occlusion still apply. One source/remote voice per
  shot, same <0.6 s maximum tail, no new per-frame work or audio timer.
- `client/spatial-audio.ts` owns the pure deterministic preparation helper.
  All PCM is generated during initial audio preparation; a shot only selects
  its cached buffer. No gameplay or collision data changes.
- A dedicated persistent gunfire gain yields to existing server-confirmed
  hit/kill calls. A **4 ms** ramp reaches **0.28 / 0.20**, holds for **25 /
  100 ms**, then recovers over **100 ms**. Native cancel-and-hold automation
  preserves continuity on repeated cues; a later hit cannot shorten an active
  kill hold. Threat footsteps/reloads, victim feedback and warnings bypass
  this duck; every path still passes through master volume/mute and limiter.
  Completed hit/kill oscillators and gains now explicitly disconnect.

Native **48 kHz OfflineAudioContext** A/B renders the original module snapshot
and final production module in fresh pages under the shared inspection lease.
Deterministic ambience and identical scheduled volleys allow comparison;
read-only stems are tapped before master, and output WAVs retain the actual
compressor/limiter. **28 fixtures per build** cover all weapons at **0, 8, 20,
40 m**, dense fire, hit, kill, overlapping confirmations, cap/reserve, recovery,
mute and zero volume. No fixture is substituted for gameplay/hitch acceptance.
Evidence: `.inspect/combat-s10-{before,final}-audio-report.json`, matching WAVs,
`combat-s10-audio-summary.json`; regenerate via `combat-s10-offline.mjs` and
`combat-s10-audio-summary.mjs` (baseline uses `--baseline`).

| Confirm / window | Gunfire change | Cue above gunfire RMS | Recovery |
|---|---:|---:|---|
| Hit / 154-175 ms | -11.057 dB | +1.875 dB | full gain |
| Kill / 175-245 ms | -13.979 dB | +7.553 dB | full gain |
| Kill then two hits / 175-245 ms | -13.979 dB | +10.811 dB | full gain |

Cue stems retain exactly the same RMS as baseline. At 0/8 m all five output
peaks match baseline; distance synthesis tests measure progressively lower
high-frequency difference energy and greater relative tail energy on every
weapon at **44.1/48/96 kHz**. All fixtures allocate **zero event-time PCM
buffers**, retain voice caps/recovery, and drain every transient. Final maximum
digital output peak **0.872491**, with exact mute/zero-volume silence.
Three new synthesis tests pass. **897 tests passed / 9 skipped**, **101 files
passed / 7 skipped**: **866 application cases** plus the inherited 31-case
archived cadence suite. `pnpm typecheck`, `pnpm test`, `pnpm build:client`, and
`pnpm audit:assets` pass in `combat-s10-final-checks.json` and command logs.

Audio buffer allocation: **1,929,600 -> 4,060,800 bytes** at 48 kHz, including
existing noise/ambient buffers; delta **2,131,200 bytes / 2.032 MiB**.
Median preparation **20.5 -> 28.8 ms** in fresh offline fixtures; this is
preparation on this host, not event cost or deployed first-load latency.
Assets remain **30,121,938 bytes**, largest **7,183,364 bytes**. Public total
**37,287,000 bytes**, **+6,107** versus Session 9, including JS/source map.
**0 new shipped asset bytes, WebGL textures/lights/passes, Meshy credits or
generated-asset rejects.** One persistent audio gain added. Client SHA-256:
`65d977f1605fb725d496cd32c8d119e7914b900e3e6c5cf8b7500471f1058443`.

Intermediate corrections retained: the endpoint assertion originally treated
IEEE negative zero as nonzero; it now checks absolute zero. Importing the pure
helper from `audio.ts` pulled DOM types into the Workers test project; moving
it into the owned pure spatial module fixes that without changing tsconfig.
The first duck candidate measured **-0.063 dB** hit-to-fire in the dense
window, below the +1 dB target; final gains above meet it. Retained evidence:
`combat-s10-focused.log`, `combat-s10-typecheck-before-helper-move.log`,
`combat-s10-initial-duck-report.json`. No gate threshold or browser flag changed.

Fixed-camera, live wow capture, repeated hitch acceptance and cleanup follow.
No owner answer is needed; default remains these bounded procedural sounds.
Human listening feedback can adjust timbre later without changing authority.

### Session 9 - 2026-09-11: Grounded firefight audio, arc 1/2 - hear every floor

Reference: **R-G14**, **R-G16**, **R-G17**, **R-L18**, **R-L14**, **R-L19**.
Targets: concrete yard/interior/stairs/roof foley follows actual support;
airborne players over the trench do not emit grounded steps; solid stairs,
slabs and thin walls muffle sound by the existing **0.32 gain / 1100 Hz** cut.
Keep **1.4x enemy foley**, **16 ordinary / 20 prioritized remote voices**,
open-door audibility and all gameplay/authority thresholds unchanged.

Started clean at **67cf53e**, branch `ironsight-aaa-combat`, port **8798**.
The top movement fix still awaits main's two-line activation in this checkout;
Session 4's measured all-map result remains the relevant movement evidence.
No new all-map movement round is claimed here. All **25 prediction-sync
regressions** pass. The Session 8 presentation and local input-delivery failures
remain open despite the supervisor's green summary. With the remaining fixes
outside combat ownership, this takes the next actionable combat audio gap.

Delivered, active through existing hooks:

- `spatial-audio.ts` separates support from material. Ground uses the actual
  map floor; supported box edges use the same **0.4 m** capsule footprint as
  movement. Terrain and authored structural surfaces select the concrete
  sample; existing equipment/deck fallbacks retain metal. No collider, physics,
  movement threshold or map layout changes.
- Each immutable map variant caches its ramp occluders once, using the same
  `rampOccluderBoxes` as server hits. `setAudioMap` prepares this outside the
  first audible event. No event-time mesh or geometry construction, new audio
  source/voice, WebGL resource or per-frame bake.
- Sound segments now test passage through solid volume, including either
  endpoint touching or slightly inside a wall. Surface grazing/outward paths
  remain clear. A **0.00001 m** geometric tolerance replaces the old normalized
  endpoint exclusion that skipped nearby thin walls on long rays. This is
  audio-only; hitscan keeps its existing intersection semantics.
- Eight new regression cases cover current Relay terrain/structures, capsule
  edges, actual trench void versus bridge, both ramp axes/directions and
  negative bases, shutter variants, open doorways, floor slabs, wall contact
  and thin cover. The existing browser audio fixture now exercises the actual
  ramp/contact node graph as well as gain priority and voice drainage.

Regression evidence: `combat-s9-corrected-baseline.log` runs the preserved
original spatial module through an inspection-only loader and fails **5 / 12**
tests. The patched suite passes. Earlier failed logs are retained: the first
trench fixture chose the real bridge at **x=75**; the corrected void is
**(63,0,76)**, with the bridge checked separately. The old simplified fixture
removed terrain boxes but inherited **floor=-3**; it now explicitly restores
its intended legacy **floor=0**. These fixture corrections do not change maps.

Required code/resource checks **PASS**: `pnpm typecheck`, `pnpm test`,
`pnpm build:client`, `pnpm audit:assets`, recorded in
`combat-s9-final-checks.json` and its four command logs. The normal command
reports **894 passed / 9 skipped**, **100 files passed / 7 skipped**; that
includes the inherited `.inspect/combat-s8-weapon-cadence.test.ts` archive's
31 repeated cases. The application test directory has **863 distinct passing
cases**, eight more than Session 8. The archive is left intact. No dependency,
server, source-map authority or test-gate configuration change.

Fixed-camera before/after and live audio inspection **PASS**, with zero
console errors or forbidden network requests: `combat-s9-{before,after}-report.json`
and corresponding Relay/practice-two/audio PNGs. Relay remains **27 draws /
200,300 triangles / 16 textures / 25.681 MiB**, median **6.9 / 6.9 ms**,
p99 **7.1 / 7.1 ms**. Scene preparation **1007.7 / 1014.4 ms**; construction
**229.9 / 195.0 ms**. These are host/run observations, not a causal speedup
or laptop iGPU proof. Fixed cameras have no intended visual change.

At **48 kHz**, the actual browser graph records clear ally/enemy gains
**0.28636 / 0.40091** (ratio **1.4**). The ramp blocks at **0.12829 gain /
1100 Hz**; above it remains **0.40091 / 6218.18 Hz** at equal distance.
Contact and thin-wall cases also record **1100 Hz**. Voice counts peak at
**16 / 20**, then drain to **0**. This measures node parameters before the
master compressor, not headphone loudness or HRTF/diffraction quality.

**Wow check:** `combat-s9-wow-report.json`, five
`combat-s9-wow-sound-live-{0,5,10,15,20}s.png` stills and the **330,668-byte**
`combat-s9-wow-firefight.webm` preserve **20.588 s** of an ordinary live bot
TDM after **8.661 s** of keyboard approach. The player enters Comms, climbs
to **3 m**, and returns through the stairwell; **175 shot / 7 kill events**
occur in the room. **161 audio sources**, including **34 concrete footsteps /
0 metal footsteps**, are observed during the recording. All 325 player
samples are alive and classified concrete; no claim of taking damage or a
local kill. The post-limiter audio tap and screenshot readbacks are separate
from performance acceptance. Player sentence: **"I can hear boots on concrete
and the firefight muffling behind the stairs."** No state, HP, pose, clock or
collision injection. Zero browser errors; stills visually inspected.
`combat-s9-audio-review.json` / `combat-s9-recording-levels.log` measure the
recording at **-46.9 dB mean / -17.7 dB peak** after the limiter: non-silent,
unclipped digital output. Subjective headphone acceptance is not claimed.
Decoding held the shared lease between probes; it did not run during a gate.

Assets remain **30,121,938 bytes**, largest **7,183,364 bytes**. Public total
is **37,280,893 bytes**, **+9,421** including generated JS/source-map text.
**0 new asset bytes, textures, lights, passes, Meshy credits or asset rejects.**
The ignored audio recording is evidence, not a shipped asset. Client SHA-256:
`a124ba593f2e0a236440593b03077a6a94dcd5be0f516407a92085c650fa7467`.

The unchanged ordinary `--assert --assert-first-use` five-pair sequence is
recorded under `combat-s9-accept-*`, with the shared lease and fresh profiles.
Final acceptance disposition, first-load timing and cleanup follow below.
No new owner decision is needed. Default next audio work: distance identity
and measured hit/kill audibility in a dense mix, preserving existing caps.
Main's movement, radio and presentation requests remain higher release
priorities; this arc does not mark them resolved.

Initial acceptance stopped at **pair 2 FFA**, with all earlier runs passing:
TDM 1 **15.7 ms**, FFA 1 **14.2 ms**, TDM 2 **20.5 ms**. The failed run has
**1618.9 / 512.3 ms** measured intervals, **2131.2 ms / 4.950%** stalled time,
**5.8 ms** callback max, p99 **8 ms**, two natural deaths and no errors/shader
changes. The first-damage check also fails at **1146 ms**, including the
pre-profiler interval; that observation overlaps the 512.3 ms gap. First death
passes at **9.2 ms**. Evidence and limits are preserved in
`combat-s9-accept-table.json`; no failed run is reclassified.

The separate traced follow-up does not reproduce a gameplay stall: **35.763 s**,
two deaths, max **18.9 ms**, callback **14.1 ms**, p99 **8 ms**, first damage
and death **8 ms**, zero errors/recompiles. Its **269.7 / 164.4 ms** loading
intervals have `traceCoversWindow:false`. This does not explain the acceptance
failure or justify an audio/HUD/renderer change. Trace analysis held the shared
lease; the inspector closed before the final ordinary sequence began.

One final, bounded five-pair qualification starts under
`combat-s9-final-accept-*`, stopping on its first failure. No capture, audio tap,
trace, test/build, altered browser flags or relaxed limits are present in those
measurement windows. This measures the current build, not a claimed fix of
the retained intermittent presentation problem. There will be no further
unchanged acceptance retries after this sequence.

**Final qualification: FAIL; Session 9 is NOT FULLY GREEN.**
`combat-s9-final-acceptance.json` and `combat-s9-final-accept-table.json`:

| Pair / mode | Result | Seconds / deaths | Max frame / callback ms | p99 ms | First damage / death ms | First ready ms |
|---|---|---:|---:|---:|---:|---:|
| 1 / TDM | PASS | 110.204 / 2 | 14.0 / 8.7 | 8 | 7.8 / 8.1 | 3501.1 |
| 1 / FFA | FAIL | 74.081 / 2 | 1845.1 / 4.6 | 8 | 14.8 / 1845.1 | 3478.7 |

FFA's interval ends at **24.912 s**, while dead; first death was **22.854 s**.
The interval starts about **213 ms after death** and crosses the end of the
first-use window, so both independent bounds correctly fail. Stalled time is
**1845.1 ms / 2.491%**. Both runs have zero errors/recompiles. Final FFA waits
**12.921 s** for the shared lease; TDM acquires immediately. Five passing pairs
were not achieved, and no third acceptance sequence is attempted. The code,
asset and fixed-camera passes are not substituted for this failed requirement.

A focused death diagnostic retains a **completed frame at least 3.5 s after
the first natural death**. The inherited 1.3 s timer could export before a
1.845 s interval completed; its waiting-only Node PID **49784** was verified
to have no browser child, then stopped before measurement. Its log remains
`combat-s9-death-initial-wait.log`. The revised copy stays under `.inspect/`,
rejects acceptance flags, and preserves ordinary controls and the GPU lease.
It changes observation duration only, not the game or any gate bound.

The revised death diagnostic (`combat-s9-death-window{,-trace,-trace-summary}.json`)
finishes **22.039 s** into measurement, **3.516 s** after its one natural death.
Both first-use windows pass at **8.4 ms**. It does **not** reproduce the final
acceptance death stall. It retains a separate **1354.3 ms** initial measured
interval (**6.145%** of its short run) and an overlapping **1920.2 ms**
post-ready interval; do not add them as independent gaps. Older loading
intervals are **284 / 163.5 ms**. All those intervals lack retained renderer
coverage, so none receives a causal label. Callback max **4.8 ms**, p99 **8 ms**,
zero errors/recompiles. Its policy summary intentionally fails on stall share
and one death; it is diagnosis, never acceptance. No runtime change is justified
by these traces, and the failed final qualification remains the disposition.

Cleanup completed: only the verified Session 9 server tree rooted at PID
**39160** was stopped; **zero remaining tree processes / zero listeners on
8798** (`combat-s9-server-cleanup.json`). All launched inspection browsers
closed through their normal cleanup before their leases were released.
`combat-s9-scope.json` confirms exactly five changed files, all combat-owned,
clean `git diff --check`, branch `ironsight-aaa-combat`, HEAD **67cf53e**.
`combat-s9-summary.json` retains both failed acceptance sequences, code/resource
passes, the natural audio capture and diagnostic limits. No commit, push,
deployment, other-stream edit or Meshy spending. No owner answer is required;
main must continue the presentation investigation and activate the already
documented movement repair before those higher-priority gaps can close.

### Session 8 - 2026-09-11: Weapon authority, arc 2/2 - ready means ready

Reference: **R-G19**, **R-G20**, **R-G02**, **R-G05**, **R-L19**, **R-L14**.
Target: one server-recorded clock for weapon readiness and cadence; an input
received **1 ms before** ADS/sprint/swap/reload completion must be denied,
while the input received **at** completion fires, even when both drain in one
50 ms tick. Keep every shared-table value, damage, rate budget and movement
reconciliation threshold unchanged. No authority is granted to payload clocks
or the optional client subtick timestamp.

Resumed **88a5bc5** with Session 7's uncommitted `arena-room.ts`, cadence test
and plan changes intact. No other stream's source, asset, inspector or gate is
edited. Port **8798**, no Meshy/dependencies/commit/push/deploy. The supervisor
failure was a **360 s watchdog timeout while waiting for main's GPU lease**,
not a measured combat frame failure. The distinct Session 7 FFA failures
remain valid. The precise scheduling request is above; our inspections and
checks keep the shared lease and never stop another stream's process.

The first fresh ordinary stock FFA gate passes with **3 natural deaths**,
**36.110 s** measured, **14.2 ms** max presentation, **4.0 ms** max callback,
p99 **9 ms**, zero >150 ms intervals, shaders or console errors. First
damage/death windows both max **8.2 ms**. Lease wait **0 ms**.
Evidence: `combat-s8-baseline-ffa.json`. This is a baseline result, not a
repair claim for the intermittent presentation stall.

Delivered on by default, no main hookup required:

- Session 7 fixed cadence/recoil but readiness still used `Date.now()` at
  drain. The real queued-room test demonstrates the early shot passing and
  the correctly timed shot behind it losing the cadence contest on **all five
  weapons**, for both ADS and sprint recovery. Baseline result **10 failed /
  12 passed**, retained in `combat-s8-before-handling.log`.
- `resolveFire` now evaluates readiness, swap/reload eligibility, automatic
  empty-mag reload, cadence and recoil at `InputMeta.receivedAt`. Wall time
  still drives current-world event/lag-history work. Swap and manual reload
  handlers receive the same trusted metadata and start their timers at receipt.
  Direct bot calls retain their actual invocation time. No deferred shot or
  release-time retry is scheduled on the server.
- **19 new regression cases** cover early/ready ADS and sprint on all five
  weapons, all four actual swaps away from AR, and reload completion/ammo/
  reserve on every weapon. Forged switch/reload payload clocks are ignored.
  All **31 cadence tests** and the **79-test** cadence/handling/prediction
  subset pass (`combat-s8-final-focused.log`). Prior forged-subtick,
  queue-phase, recoil-ray, close-duel and release-after-denial cases remain.

`pnpm typecheck`, `pnpm test`, `pnpm build:client`, `pnpm audit:assets`:
**PASS**, **855 tests passed / 9 skipped**, **98 files passed / 7 skipped**.
Evidence: `combat-s8-final-checks.json` and matching command logs. Both
checks and inspections acquire the GPU lease, keeping builds/tests out of
another stream's acceptance interval. The first focused command's outer
PowerShell redirection reported a native stderr warning as an error even
though its recorded child exit was **0**; the direct final focused invocation
and JSON result both verify success. No failed test was reclassified.

Client SHA-256 remains
`5c1d9c597ff8da9bfcb58fc81cd0ef4e873c24eada2dae22a1782718af98c67a`.
Assets **30,121,938 bytes**, public **37,271,472 bytes**, largest asset
**7,183,364 bytes**, all unchanged. **0 new asset bytes, textures, WebGL
lights/passes, Meshy credits or generated-asset rejects.** Weapon-table audit
is retained as `combat-s8-weapon-table.json`; ideal TTK/ADS/sprint numbers
remain those tabulated in Session 7.

Transport diagnosis: `.inspect/combat-s8-wire-proxy.mjs` forwards WebSocket
bytes unchanged through an ephemeral loopback TCP relay and observes frame
arrival on both sides. The inspection browser also records native CDP frame
events and raw send/reply performance times. This is an inspection-only
connection path, never an acceptance substitute or shipped networking change.
The first capture found negotiated compression and could not label raw wire
messages; it retains **11/12 AR**, **17/18 SMG**, **2/2 shotgun**, **1/1 sniper**,
**8/8 pistol** confirmations in `combat-s8-delivery-*`. Its decoder limitation
is not treated as evidence about where those two denials occurred.

The second observer decodes negotiated deflate off the forwarding path and
retains **425 compressed frames / 418 decoded text frames**. It confirms
**12/12 AR, 18/18 SMG, 2/2 shotgun, 1/1 sniper, 8/8 pistol**, no denials.
SMG browser intervals **67.4 / 69.5 / 71.5 ms** min/median/max; relay arrival
intervals **67.54 / 69.47 / 71.45 ms**. This burst preserves spacing through
the relay and reaches the server legally. Separate epoch clocks have a
roughly **3.6 ms offset** in this capture; their raw differences are retained,
not called one-way latency. Node's two >40 ms heartbeat gaps (**75.2 / 61.7
ms**) are also retained. These observations **do not reproduce or explain**
Session 7's 1.2 s compressed delivery, and do not justify widening the cap.
Evidence: `combat-s8-delivery-decoded-{wire,summary}.json`, per-weapon JSON,
report and stills; `.inspect/combat-s8-delivery-summary.mjs` reproduces the
summary without altering the game. No renderer/driver cause is inferred.

The required fixed-camera inspector passes with zero errors/network violations:
`combat-s8-final-{report.json,relay.png,practice-two.png}`. Relay remains
**27 calls / 200,300 triangles / 16 textures / 25.681 MiB**, median **7.0 ms**,
p99/max **7.1 ms**; construction **196.2 ms**, scene preparation **1039.9 ms**.
This machine reports **RTX 5070 / ANGLE D3D11**; these are not iGPU claims.
No visual source changed, so the before/after fixed camera has no intended
visual delta. Captures are inspected, including the readable kill banner.

Readiness delivery remains a separate open problem. The stock handling
assertion fails AR (**257 ms** sight settle, **461.8 ms** first confirmed shot
against **450 ms** bound), with zero console errors. Its failure is retained
in `combat-s8-handling-report.json`. Inspection-only send/reply observers
preserve the existing input path and assertions and save raw traces before
assertions; an unasserted diagnostic reproduces **799 ms**. A separate relay
run gives **1139.7 ms**, preserving **262.5 / 262.215 ms** browser/relay ADS-to-
fire spacing. Denial at **902.2 ms** reports all **250 ms** of ADS remaining.
The Worker observer then captures a **347 ms** tick gap immediately after a
periodic snapshot, delays ADS by roughly **127 ms** while the later fire
arrives promptly, and correctly rejects that compressed readiness interval.
The exact timestamps, traces and bounded request are above. Buffered storage
write promises do not establish flush completion; see the official
[Durable Object storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).
No storage option, persistence period, transport, client-clock credit or
weapon threshold changed. The observed coincidence warrants investigation,
not a storage/driver diagnosis or a claim that Session 7's exact stall is solved.

Rejected diagnostic intermediates are retained: native Node WebSocket could
not complete the local inspector handshake; the first raw CDP helper omitted
the Worker's execution context; neither launched a gameplay browser. The
successful observer uses the bundle's reported execution context and a
non-pausing conditional breakpoint, then bounded wrappers around storage,
raw arrival, handlers and ticks. Its report completed but the CDP socket
stayed open. Only its verified own PID was stopped, documented in
`combat-s8-handling-worker-context-manual-cleanup.json`; the helper now closes
its socket. `combat-s8-diagnostic-server-cleanup.json` proves the entire
owned preview tree/8798 listener stopped. A clean preview was restarted to
remove all ephemeral Worker observers before the final ordinary captures.

**Wow check:** `combat-s8-final-play-report.json` and five
`combat-s8-final-play-fight-{0,5,10,15,20}s.png` stills cover **20.524 s** of
live TDM. Sprint release and ADS at **8.015 s**, **11 confirmed SMG shots /
12 intents**, **9 hit events**, **1 elimination**, ending at **50 HP**.
The 10-second still shows the confirmed Anchor 3 elimination. Normal movement,
sprint, ADS and trigger keys/buttons drive the capture; inspection aim only
targets clear replicated enemies. No state/HP/pose/clock injection. Player
sentence: **"I can sprint into a lane, shoulder the SMG, and land the burst."**
The five normal practice bursts retain **12/12 AR, 16/17 SMG, 2/2 shotgun,
1/1 sniper, 7/8 pistol** confirmations and two denials; do not call delivery
loss solved. Zero browser errors. This capture is separate from acceptance.

**Final qualification: FAIL; Session 8 is not green.** The original stock
probe runs with `--assert --assert-first-use`, the existing 1500 ms
presentation / 150 ms main-thread and first-use ceilings, p99 25 ms and 5%
stalled-time bounds, fresh browser profiles, unchanged flags and shared lease.
The initial sequence already failed pair 1 FFA (**1995.2 / 2051.4 ms**,
**5.309%** stalled time); it remains in `combat-s8-acceptance.json`.
The separate complete startup trace located the **3369.233 ms** native raster
wait described above. After removing diagnostic observers and restarting the
preview, one final ordinary sequence stopped at pair 2 FFA:

| Pair / mode | Gate | Deaths | Max frame / callback ms | p99 ms | First damage / death ms | First-ready ms | Lease wait s |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 / TDM | PASS | 2 | 20.2 / 12.3 | 8 | 7.9 / 8.1 | 3480.7 | 97.5 |
| 1 / FFA | PASS | 2 | 14.4 / 8.3 | 8 | 7.8 / 8.7 | 3448.4 | 87.5 |
| 2 / TDM | PASS | 2 | 16.6 / 11.9 | 8 | 7.7 / 8.1 | 3245.9 | 0.0 |
| 2 / FFA | FAIL | 3 | 2302.2 / 7.9 | 8 | 10.6 / 325.3 | 3068.2 | 120.7 |

The failed FFA retains **2627.5 ms / 3.116%** stalled time and zero
errors/recompiles. Its separate **325.3 ms** first-death interval fails the
150 ms first-use bound too. First-ready time is **3068.2-3480.7 ms**, not a
deployed or cold-driver result. Every loading/startup interval remains in
the raw reports, including the **2940.2 ms** post-ready interval overlapping
the failed run's initial measured gap. Five consecutive pairs were **not**
achieved. `combat-s8-final-gate-table.mjs` reproduces the table from
`combat-s8-final-acceptance.json` and the four individual reports.

One focused diagnostic copies the original hitch driver only under `.inspect/`
and exports **1.3 s after the first natural death**, with an explicit refusal
of acceptance flags. Normal controls, CPU/GPU observers and shared lease remain.
It retains one death, first damage **7.9 ms**, first death **8.7 ms**, gameplay
max **13 ms**, callback **4 ms**, no errors/recompiles. The first-use window is
complete; it **does not reproduce** the 325.3 ms failure. Older startup gaps
**271.7 / 151.6 / 487.9 ms** have fallen outside renderer trace coverage and
are not attributed. This one-death diagnostic deliberately cannot qualify as
acceptance. An initial inspection-copy import rewrite mistakenly changed the
in-memory map imports; that setup error happened before browser launch and
is retained as `combat-s8-death-diagnostic-setup-failure.log`. The corrected
copy preserves those paths. There is no actionable HUD/VFX cause from this
trace, so no speculative production change or further acceptance retry.

Cleanup and final scope verification are recorded in
`combat-s8-server-cleanup.json` and `combat-s8-scope.json`. The final disposition
is `combat-s8-summary.json`. `combat-s8-review.patch` plus the separate
`combat-s8-weapon-cadence.test.ts` preserve the uncommitted Session 7 + 8
work for review/recovery; `combat-s8-review.json` records their hashes. No
commit, push, deploy, new dependency or another stream's source edit.

Open owner questions: none required for this repair. Defaults remain the
shared weapon table, trusted server receipt times, unchanged persistence and
unchanged hitch thresholds. Next priority stays the owner's movement fix
activation and the main-owned presentation investigation; do not start the
next audio/impact arc by treating these partial rows as closed.

### Session 7 - 2026-09-11: Weapon authority, arc 1/2 - every legal round counts

Reference: **R-G02**, **R-G04**, **R-G05**, **R-G06**, **R-G19**, **R-G20**,
**R-L03**, **R-L14**. Main's rollback/radio activations and presentation
investigation remain the first integration prerequisites. This session takes
the next actionable combat gap, auditing the shared weapon table through the
actual queued room instead of treating theoretical TTK as delivered cadence.

Target: every legally spaced arrival survives the 50 ms queue boundary,
genuinely early arrivals are rejected, and recoil uses the same authoritative
shot clock as cadence. All three now pass the queued-room regression. The
exact weapon intervals, damage, movement, ADS/sprint timers, input budget and
reconciliation thresholds are unchanged. Client-claimed clocks grant no
firing credit. This fixes tick quantization; it does not make compressed
network delivery disappear (retained browser evidence below).

Started clean at **88a5bc5**, branch `ironsight-aaa-combat`. Only the combat
allowlist and new `.inspect/combat-s7-*` artifacts are touched. Port **8798**;
tests/builds/browsers share the inspection lease. No Meshy, assets, dependencies,
commits, pushes or deployments. Session 6's retained candidate FFA failure
remains valid despite the supervisor's green summary.

Delivered, on by default without a new main hook:

- `arena-room.ts` previously compared `Date.now()` at queue drain for the fire
  cap. It now compares the SDK's server-recorded `InputMeta.receivedAt` and
  uses that same instant for recoil sampling/recovery. Direct bot calls use
  their actual tick invocation time. Payload `receivedAt`, payload deadlines
  and the optional client subtick `ts` cannot buy a faster shot.
- Real arrival compression still gets a strict rejection. The rate branch
  now returns the existing `fireBlocked` ammo/retry reply as well as the
  existing recoil acknowledgement. Net's already-wired handling recovery
  restores prediction and retries only while the trigger is held. Advice is
  at least one tick, never skips the next cap check, and schedules no server
  shot after release. No new input type, retry queue, timer or client bundle.
- Twelve new tests retain the real 20 Hz queue and normal hit validation.
  They cover three tick phases for all five weapons (141 legal arrivals),
  recoil parity, actual close AR/SMG/pistol body kills, early-arrival rejection,
  forged payload and wire-envelope clocks, and release after denial.

The regression was observed failing before repair:
`combat-s7-before-cadence.log` has **6 failed / 4 passed**. At phase 1, the
SMG and pistol each accept only **7/12** legal intents. Recoil stamps the
first SMG shot **33 ms** late; the expected five/three-shot body kills fail.
The inverse exploit also reproduces: AR arrivals only **52 ms** apart are
accepted because their drains are 100 ms apart. After repair the focused
75-test run passes. The final suite includes the two later security/release
checks: **836 passed / 9 skipped**, **98 files passed / 7 skipped**.

Final `pnpm typecheck`, `pnpm test`, `pnpm build:client`, `pnpm audit:assets`:
**PASS**, `combat-s7-final-checks.json` and `combat-s7-final-*.log`. The
prior verified run has **835** tests; it predates the final denial-recovery
test and is retained separately. Client SHA-256 stays
`5c1d9c597ff8da9bfcb58fc81cd0ef4e873c24eada2dae22a1782718af98c67a`.

Shared-table audit: `combat-s7-weapon-table.json` reads the actual shared
roster and pellet/falloff helpers. Values are **ideal first-shot-to-kill-shot
body TTK**, excluding acquisition, reload, aim error, tick and network delay:

| Weapon | Interval ms | ADS / sprint ms | Body TTK 5 / 15 / 30 / 60 m, ms |
|---|---:|---:|---|
| AR | 100 | 250 / 120 | 300 / 300 / 300 / 500 |
| SMG | 65 | 200 / 100 | 260 / 260 / 455 / 585 |
| Shotgun | 850 | 225 / 130 | 0 / 2550 / 11900 / out of range |
| Sniper | 1300 | 400 / 150 | 1300 / 1300 / 1300 / 1300 |
| Pistol | 160 | 165 / 90 | 320 / 320 / 480 / 640 |

The shotgun's 30 m ideal sequence exceeds its magazine; that value is not a
practical reload-inclusive TTK. First-shot spread is <=**0.0002 rad**,
crouch reduces grounded spread **25%**, and movement dominates that benefit.
AR/SMG open with four vertical pattern entries, then lateral drift; hybrid
spread begins at indices **8/7**, and pistol at **5**. ADS/crouch multiply,
and airborne crouch grants no accuracy benefit. Existing focused tests prove
the shared math. No damage or speed retuning was justified by this audit.
Bots still decide at 20 Hz: this repair does not invent subtick bot intents.

The real pointer/key handling inspection passes all five weapons:
`combat-s7-after-report.json`, `--assert-handling`. Measured ADS completion
is **255.6 / 207.5 / 235.3 / 408.9 / 171.4 ms** (AR through pistol);
first server-confirmed shots arrive at **325.1 / 228.6 / 290.8 / 465.3 /
211.2 ms**. Pistol sprint release confirms its first shot at **145.3 ms**
against the 90 ms timer. These include render/tick/transport scheduling,
not measured RTT or human comfort. Reduced view kick remains the precise
main-owned request above; its current omission was not hidden by a scorecard.

Stock-client held-pointer evidence, each burst lasting **1.2 s**, no pose,
health, clock or weapon-stat injection (confirmed / sent):

| Weapon | Before | Receipt-clock repair | Final denial-recovery build |
|---|---:|---:|---:|
| AR | 8 / 12 | 12 / 12 | 12 / 12 |
| SMG | 10 / 18 | 17 / 18 | 5 / 18 |
| Shotgun | 1 / 2 | 2 / 2 | 2 / 2 |
| Sniper | 1 / 1 | 1 / 1 | 1 / 1 |
| Pistol | 7 / 8 | 8 / 8 | 7 / 8 |

All runs are retained at `combat-s7-{before,after,final-play}-recoil-*.json`
and their reports. **The final SMG outlier is not erased or called fixed.**
Client sends stay **69.3-69.6 ms** apart, but the fifth accepted input has a
**1247 ms estimated clock delay** (server receipt minus the SDK's estimated
server timestamp; not a measured one-way network latency). The next thirteen
denials each report **64 ms** remaining on the **65 ms** cap, directly showing
that those inputs were received only **1 ms** after the accepted one. The
new reply corrects them; it cannot restore intent spacing lost upstream.
The earlier 17/18 run retains an **11 ms** estimated receipt-delay outlier
before its one rejection. The source of these delays is untraced; no browser,
Wrangler, server-CPU or driver cause is assigned. This is the next bounded
weapon-authority task, not grounds to trust client clocks or widen the cap.
`combat-s7-delivery-summary.json` indexes the exact request/reply evidence.

Wow check: `combat-s7-final-play-report.json` and
`combat-s7-final-play-fight-{0,5,10,15,20}s.png` capture **20.530 s** of
ordinary live Relay TDM. **21 confirmed local shots, 16 hit events, two
local SMG body eliminations**, magazine **25 -> 4**, **zero reload replies**,
HP **100 -> 85**. The human uses normal W, aim, slot and trigger inputs;
bots, damage and game time are unmodified. Player sentence:
**"I dropped two attackers with one SMG magazine."** The same capture also
retains 44 fire attempts and an approximately 1.5 s receipt/reply bunch early
in the fight; its two kills are not proof that delivery is consistently smooth.
Readback captures remain separate from hitch acceptance.

Required fixed-camera inspection: **PASS**, zero errors/forbidden requests,
`combat-s7-{before,final}-report.json` and matching Relay/practice-two PNGs.
Relay stays **27 draws / 200,300 triangles / 16 textures / 25.681 MiB**;
practice stays **49 draws / 101,470 triangles / 17 textures**. Median Relay
frame **6.9 -> 7.0 ms**, p99 **7.1 -> 7.2 ms**. These are host/run variation,
not a claimed rendering improvement or laptop-iGPU proof. Fixed Relay scene
preparation **1017 -> 1023 ms**, construction **199.7 -> 198.0 ms**; final
qualification first-ready spans **3119.9-4984.1 ms** across four fresh profiles.
Assets **30,121,938 bytes**, public **37,271,472 bytes**, largest asset
**7,183,364 bytes**, all unchanged. **0 bytes, textures, WebGL lights, passes,
Meshy credits or generated-asset rejects added.**

Rejected/intermediate tooling: the first raw-envelope security fixture used
`c:m`, so the real wire parser correctly dropped it. It now imports the SDK's
`ClientMessageType.Message` (`c:msg`). Keep the initial **834 pass / 1 fail**
release log. The initial delivery-summary helper mistakenly treated recoil
state `at` as a local frame timestamp; that invalid summary is retained as
`combat-s7-delivery-summary-first.json`. The corrected summary derives no
frame intervals from those samples, and future probes use `sampleAtMs`.
Neither fixture correction changes runtime code or a gate threshold.
The first post-run process audit accidentally included large raw trace JSON;
that owned audit process was stopped and replaced with explicit report/manifest
inputs. The corrected process audit passes. Acceptance had already ended and
the dev server was already stopped; this did not produce an acceptance sample.

Initial ordinary acceptance stops on **pair 4 FFA**:
`combat-s7-acceptance.json`, `combat-s7-accept-stats.json` and eight original
reports/logs. Earlier TDM maxima **13.8 / 17.5 / 14.5 / 17.8 ms** and FFA
**14.4 / 14.6 / 14.3 ms** pass. The failing FFA has a **1870.7 ms** first
measured interval, **7.7 ms** callback max, p99 **8 ms**, **2.651%** stalled
time, two natural deaths, zero errors/recompiles. First damage/death windows
pass at **7.8 / 8.4 ms**. Its **1768/1787** idle CPU samples are not a cause.

Two separate diagnostic runs retain the original flags plus cross-process
tracing, GPU submissions and callback timing. The full FFA diagnostic has
**43.378 s**, two deaths and **16.2 ms** max; it does not reproduce the gap.
Its **281.3 / 158.9 ms** loading intervals are outside retained trace coverage.
The short startup diagnostic covers **344 / 161.3 ms** intervals before UI
preparation. In the first, an image-load task takes **279.749 ms wall /
15.070 ms CPU**, overlapping a **259.304 / 2.577 ms** WebGL program-status
wait. The second overlaps a **156.892 / 63.769 ms** DOM timer task. Neither
is the failed post-ready presentation interval. The short diagnostic has no
measured gameplay frames or deaths and is explicitly **not acceptance**.
Original reports and `-trace-summary.json` companions are retained under
`combat-s7-ffa-{diagnostic,startup-diagnostic}`; no new runtime fix is claimed.

After those diagnostics, one fresh, explicitly bounded five-pair qualification
sequence is run as `combat-s7-final-accept-*`, stopping at its first failure.
The initial failure stays in the final summary and the main request. Runtime,
CPU sampling, ordinary probe, browser flags and every gate limit are unchanged;
this remeasurement qualifies its own runs only and cannot establish reliability
or erase the earlier failure. It **fails again**, so no further acceptance
retry is performed:

| Final pair | Mode | Max presentation / callback ms | Result |
|---|---|---:|---|
| 1 | TDM | 343.9 / 7.3 | PASS under the existing presentation allowance |
| 1 | FFA | 14.4 / 6.6 | PASS |
| 2 | TDM | 14.3 / 7.3 | PASS |
| 2 | FFA | 1973.4 / 5.9 | FAIL: presentation gap |

All four have two natural deaths, p99 **8 ms**, zero errors/recompiles, and
passing first-damage/death checks. Final FFA also retains **195.8 ms**, for
**2169.2 ms / 2.990%** stalled time. Its first-use windows are **7.6 / 8.5 ms**.
The startup observer records **2604.2 ms** after ready, overlapping the first
measured gap; do not add those two observations as independent stalls.
CPU samples are **1856/1877** idle in the large gap and **180/185** in the
second, without causal attribution. `combat-s7-final-acceptance.json` and
`combat-s7-final-accept-stats.json` index all four original reports/logs.

The follow-up recovery diagnostic extends the short observation to **6.147 s**
and records **886** gameplay frames, max **10.1 ms**, with no reproduced spike.
Its earlier loading intervals are outside retained renderer trace coverage;
it lacks two deaths and is not acceptance. The earlier zero-frame diagnostic
is also inspected over its actual **1820.9 ms** measurement window in
`combat-s7-zero-frame-trace.json`, explicitly labeled an **uncompleted window,
not a completed frame**. It has a clock anchor and retained renderer task
coverage, but no long completed task explaining the missing callback. An
unfinished native task need not have a completed trace event. Neither this
absence nor the recovery run proves a cause or a repair. No combat-owned
runtime change is justified by these traces; main's investigation remains open.

Open owner choices/defaults: keep the exact shared weapon damage, recoil and
handling table while tracing the compressed-delivery path; do not compensate
for missing shots with extra damage or client-clock credit. Default reduced
cosmetic kick is **25%** when main activates the existing accessibility setting.
The next combat arc should timestamp real sends, server receipt and delivery
with distinct clock domains, then test any demonstrated fix without changing
authoritative rate caps. Main still owns presentation and the pending movement/
radio hooks; no owner answer is needed to retain these conservative defaults.

Final disposition: **NOT GREEN - FFA hitch acceptance failed; five consecutive
TDM/FFA pairs were not achieved.** The combat change remains reviewable with
all 836 tests and required typecheck/build/assets/fixed-camera checks passing.
No threshold, observer, browser, map, driver or other-stream file was changed
to turn the failed run green. `combat-s7-summary.json` reports **FAIL**, includes
both acceptance sequences and all diagnostic limits, and does not substitute
diagnostic passes for acceptance. `combat-s7-scope.json` verifies only
`src/rooms/arena-room.ts`, `test/weapon-cadence.test.ts`, and this plan changed.
The owned server tree rooted at PID **61008** was stopped, with **0** remaining
tree processes and **0** listeners on 8798 (`combat-s7-server-cleanup.json`).
All inspection processes finished through their browser-close/lease cleanup.
`combat-s7-process-audit.json` independently finds no remaining owned Node or
browser roots and no port 8798 listener.
No commit, push or deployment was performed; HEAD remains **88a5bc5**.

### Session 6 - 2026-09-11: Bot squad tactics, arc 3/3 - squad radio handoff

Reference: **R-L08**, **R-L11**, **R-L14**, **R-G20**. Targets: six short,
action-specific callouts, one shared **8 s/team** channel and **16 s/caller**
limit, **3 s** frozen markers/captions, and human pings owning the channel for
their full **5 s** lifetime. Contact requires **600 ms** sustained sight plus
a current geometry/facing/range recheck. No remembered or heard enemy is
turned into visual intelligence. Ordinary difficulty, damage, aim, movement,
collision and the **0.15/2.5 m** reconciliation thresholds remain unchanged.

Clean starting branch: `ironsight-aaa-combat`. Main's rollback activation and
the prior renderer/navigation requests remain open. This checkout still uses
legacy `net.setMoveIntent`; no main/map/physics file was changed. The Session 5
retained red FFA evidence remains valid despite the supervisor's green summary.
No Meshy credits, asset files, dependencies, commit, push or deployment.

Delivered in the combat lane:

- `rooms/bot-radio.ts` combines contact reports and tactical barks under one
  cooldown. Reloads require the room's accepted reload deadline; suppression
  requires an accepted shot and current sight. Retreat, moving flank and
  high-ground hold report the bot's own rounded location. Enemy reports freeze
  the observed rounded location; no target id or tracking information is sent.
  Busy action transitions are discarded, so nothing announces an old reload
  after it ends. The radio consumes no aim RNG and does not issue bot orders.
- `arena-room.ts` samples radio after normal weapon validation, delivers only
  to living same-team clients within **50 m** of the marker, excludes FFA and
  practice, and reuses human-ping priority and round/bot cleanup. Client ping
  payloads cannot forge `from`, `contact`, or `radio` fields.
- `bots.ts` owns the six fixed lines and presentation validator. `hud.ts`
  presents a compact role caption with duplicate/expiry rejection, clears for
  human marks, death, results and pause, and prepares the same markup during
  existing compositor warmup. `audio.ts` adds descending reload/retreat and
  rising movement idents to the existing two-note cue, through the existing
  mute/volume bus; each graph drains within **240 ms**. No speech service,
  audio file, timer loop, new WebGL light, texture or pass.
- Legacy clients display normal enemy/backup/go markers immediately. The
  exact richer caption/audio hook is ready for main above. **The full arc is
  integration-pending**, not claimed shipped until that hook is taken.

Initial implementation checks: **PASS** `pnpm typecheck`, `pnpm test`
(**823 passed / 9 skipped**, **97 files passed / 7 skipped**),
`pnpm build:client`, `pnpm audit:assets`. Evidence:
`combat-s6-verified-checks.json` / `combat-s6-verified-*.log`.
Sixteen new focused radio tests plus the twelve existing contact tests pass;
all existing prediction tests remain green. Tests cover actual-room accepted
reload routing and forged metadata, current sight, reaction, bounded airtime,
human priority, discarded busy transitions, wrong-floor holds and all inactive
modes. Visual/audio/gate evidence and final measurements follow below.

Natural telemetry is three ordinary **180 s** bot rounds, no player/bot pose,
loadout, action, clock progression or damage injection. The Node harness uses
its normal fixed tick; timing below is real wall time around bot decisions,
not deployed latency/capacity. Initial pre-refinement report, preserved as
`combat-s6-natural-radio-before-flank-refinement.json`:

| Mode | Contact | Suppress | Reload | Retreat | Flank | High ground | Kills |
|---|---:|---:|---:|---:|---:|---:|---:|
| TDM | 23 | 0 | 2 | 5 | 3 | 4 | 65 |
| DOM | 26 | 2 | 2 | 3 | 0 | 0 | 52 |
| FFA | 0 | 0 | 0 | 0 | 0 | 0 | 110 |

Decision p50/p95/max: TDM **0.355/1.387/5.967 ms**, DOM
**0.335/0.551/3.064 ms**, FFA **0.297/1.148/3.426 ms**. These timings include
the normal bot decisions, navigation and radio observer; they do not isolate
the radio cost. All emitted same-team intervals meet **>=8000 ms**. FFA's
zero is intentional. Different normal room seeds produce different fights:
the first retained run had all six types in TDM, and no DOM reload bark.

Rejected/intermediate evidence: the first room fixture ran before the normal
filler spawn tick and selected an absent bot; waiting **100 ms** before its
fixed-pose routing assertions corrected the fixture. Both failed logs remain.
The first natural telemetry assertion incorrectly demanded a reload callout
in every team mode despite shared airtime; it now requires variety over the
observed rounds and verifies every team's budget. No production behavior was
changed to satisfy that expectation. Retained original:
`combat-s6-natural-radio.json` / `combat-s6-final-natural.log`.

The first baseline inspector invocation used unsupported `--out`; it wrote
the default prefix. Its report and both stills were preserved as
`combat-s6-before-*`; all later invocations use the correct `--prefix`.
The first server launcher referenced its wrapper before creation and exited;
the later owned wrapper on **8798** is the active one for this session.

Review found and repaired a radio-only timing edge: wall time can advance
during accepted shot validation, so checking the shot timestamp against a
later `Date.now()` could lose the suppression bark. The room now compares
the before/after accepted-shot marker. The real-room regression advances wall
time **1 ms** inside the fire wrapper, verifies one round consumed and
`accepted.fired === true`. Post-fix typecheck and all **823 tests** pass:
`combat-s6-post-{typecheck,test}.log` / result JSON. The client bundle is
unchanged by this server-only repair; prior client build/audit remain current.

Fixed-camera before/after: **PASS**, no console errors or forbidden requests,
`combat-s6-{before,after}-report.json` and corresponding Relay/practice-two
PNGs. Relay stays **27 draws / 200,300 triangles / 16 textures / 25.681 MiB**;
practice stays **49 draws / 101,470 triangles / 17 textures**. Relay median
**6.9 / 6.9 ms**, p99 **7.2 / 7.1 ms**, scene preparation
**1050.4 / 958.4 ms** (before/after). These are host/run observations, not a
causal rendering improvement or laptop iGPU validation. Asset bytes remain
**30,121,938**, largest **7,183,364**; public total with client/map files is
**37,271,383 (+48,998)**. Zero added asset bytes, textures, lights, passes,
Meshy credits or generated-asset rejects.

Wow check: `combat-s6-wow-verified-report.json`, its `-natural.json`,
`-radio-live-{0,5,10,15,20}s.png` and three `-radio-{0,1,2}.png` stills record
**20.547 s** of natural TDM after an **11.701 s** ordinary-input approach.
**276 shot/kill/ping events**, no console errors or forbidden requests.
Visible calls: ANCHOR 4 contact, RUSH 8 contact, then **SUPPORT 10 / Covering
fire. Move up.** Player sentence: **"My squad tells me when it's covering
the lane."** Only normal W/aim input; no gameplay state, health, pose, loadout
or clock injection. The exact pending main radio hook is in the inspection
bundle, clearly separate from stock acceptance.

The three radio events each create a 620/830 Hz pair whose observed end
events are within **240 ms** of scheduling. The audio observer also catches
one unrelated **660 Hz** support-sting note (about **651 ms**); it is retained
and is not assigned to the radio graph. Separate presentation-only fixtures
pass caption deduplication, human clearing, expiry and pause clearing. Layout
stills at **1920x1080 / 1366x768 / 800x600** keep the card inside the viewport
and above vitals; the natural full-size still also shows the contact card
below it without overlap. These screenshots are not performance samples.

The first wow run completed its 20-second live capture but failed the fixture
assertion because a hidden ping card has a zero rectangle. Its failed report
and stills remain `combat-s6-wow-*`. The corrected inspection assertion checks
overlap only for a visible ping; no runtime layout change was needed. Future
fixture failures also retain their natural telemetry before failing.

Muted live proof also **PASS**: `combat-s6-muted-report.json`, `-natural.json`
and its stills. **20.515 s** after **11.402 s** of ordinary approach, two
visible natural contact captions, **212 events**, **zero observed cue nodes**
and no errors. The separate lifecycle/layout fixtures pass at all three sizes.

A final radio-truthfulness review separates an active flank path from a flank
plan temporarily interrupted by a close duel. `BotDecision.tactic` now marks
actual flank movement, and radio requires that mark; retaining `brain.flank`
alone is insufficient. A focused regression verifies the close-duel case.
This changes radio metadata, not movement, aiming, damage, collision or
navigation. Release typecheck, **824 tests**, build and asset audit pass:
`combat-s6-release-checks.json` / `combat-s6-release-*.log`. The client JS hash
is identical before/after this server-metadata refinement; only embedded
source-map text adds **89 bytes**, taking public total to **37,271,472
(+49,087 vs session start)**. The earlier client visual proofs remain current.

Initial stock acceptance (`combat-s6-stock-accept-tdm-1.json`) **FAILS**:
**1807.9 ms** first presentation interval, callback max **8.6 ms**, p99
**8 ms**, one death in **151.831 s**, zero shader changes/errors. That interval
has **1727/1740** idle CPU samples; it is untraced and has no assigned cause.
Death is at **134.434 s**, respawn **137.412 s**. Navigation samples continue
moving around the map; this run does **not** reproduce a persistent fixed
wall contact. Do not assign its one-death result to the old driver bug.
The sequence stopped at this failure. This predates the final flank metadata
refinement; neither that refinement nor the radio UI is claimed to repair the
existing presentation stall. Diagnostic and final acceptance results follow.

The separate **10-second** startup diagnostic does not reproduce the gameplay
gap: max measured interval **24.3 ms**, max callback **20 ms**, no measured
>150 ms intervals, no errors/recompiles, no deaths (diagnosis, not acceptance).
It retains loading intervals **185.6 / 284.2 / 178.7 ms**, all before ready
at **3541.7 ms**. The rolling trace does **not** fully cover those windows,
so none receives a causal label. Evidence:
`combat-s6-startup-diagnostic{,-trace,-trace-summary}.json`. This neither
explains nor erases the untraced stock **1807.9 ms** interval; prior covered
Session 3/4 compositor evidence remains unchanged.

Final stock acceptance: **five consecutive TDM/FFA pairs PASS**, with the
unchanged ordinary driver, browser flags, thresholds and two-natural-deaths
requirement. Every run has **2 deaths**, zero errors/recompiles, and passing
recorded first-damage/death windows. `combat-s6-release-acceptance.json`,
`combat-s6-release-accept-stats.json`, and `combat-s6-release-accept-*.json`:

| Pair | TDM max ms / result | FFA max ms / result |
|---|---|---|
| 1 | 24.6 / PASS | 13.6 / PASS |
| 2 | 29.4 / PASS | 13.9 / PASS |
| 3 | 16.0 / PASS | 14.1 / PASS |
| 4 | 21.4 / PASS | 326.6 / PASS |
| 5 | 953.3 / PASS | 14.0 / PASS |

These use the existing documented **1500 ms presentation / 150 ms callback /
25 ms p99 / 5% stalled-time** policy, not a claim that 953 ms is acceptable
player experience. FFA 4 retains **326.6 ms** at **44.574 s**, while alive,
**1.451 s** after first damage; **307/312** CPU samples are idle and stalled
time is **0.386%**. TDM 5 retains **953.3 ms** at **93.087 s**, while alive,
**1.308 s** after respawn; **910/919** CPU samples are idle and stalled time
is **0.988%**. Both are untraced and have no assigned cause. FFA has no squad
radio messages; neither result establishes a radio/compositor causal link.
Do not erase these intervals or the initial **1807.9 ms** FAIL when routing
the main renderer investigation. The final TDM 1 was ready at **3334.2 ms**,
ran **104.658 s**, and passed with max **24.6 ms** / callback **19.8 ms**.

Final telemetry after the explicit flank-action refinement also **PASS**:
`combat-s6-natural-radio-verified.json` / `combat-s6-release-natural.log`.
Three fresh **180 s** rounds use the normal seed/AI/weapon paths; no pose or
damage injection. Every team interval is still **>=8 s**. Different round
seeds explain why these counts differ; no balance delta is claimed.

| Mode | Contact | Suppress | Reload | Retreat | Flank | High ground | Kills |
|---|---:|---:|---:|---:|---:|---:|---:|
| TDM | 25 | 4 | 4 | 3 | 2 | 2 | 57 |
| DOM | 25 | 5 | 1 | 2 | 0 | 0 | 54 |
| FFA | 0 | 0 | 0 | 0 | 0 | 0 | 106 |

Final decision p50/p95/max: TDM **0.357/1.492/7.172 ms**, DOM
**0.305/0.607/3.066 ms**, FFA **0.272/1.183/3.759 ms**. These are local
Node wall-clock samples with fake game ticks, not an iGPU or deployed-network
claim. The telemetry waited **578.577 s** for the shared lease and ran after
the first hooked TDM browser closed. No tests/builds ran concurrently with
acceptance browsers, and no other stream's process was stopped.

Exact-hook acceptance: TDM 1 **PASS** (**20.7 ms** max, **16.3 ms** callback,
**8 ms** p99, two deaths). FFA 1 **FAIL**: **1533.1 ms** at **1.533 s** and
**2507.7 ms** at **41.602 s**, the latter coincident with respawn. It still
records two natural deaths in **45.762 s**, p99 **8 ms**, callback max
**8 ms**, zero errors/recompiles, and passing first-damage/death windows
(**8.4 / 7.9 ms**). Stalled time **4040.8 ms / 8.830%**. CPU profiles are
**1463/1482** and **2385/2398** idle samples; the intervals are untraced and
receive no causal label. Ready at **3209.3 ms**. The sequence stops here:
five passing candidate pairs were **not achieved**. Evidence:
`combat-s6-candidate-acceptance.json`, `combat-s6-candidate-accept-stats.json`
and both `combat-s6-candidate-accept-{tdm,ffa}-1.json` files.

The exact three-line main hook also passes a virtual TypeScript compiler-host
check with **zero diagnostics**, without changing main's source:
`combat-s6-hook-typecheck.json`. The first synchronous compiler wrapper
temporarily blocked its lease-owner identity endpoint, so a waiting diagnostic
failed **before launching a browser** (`combat-s6-candidate-diagnostic.log`).
The wrapper now runs compilation in a child while its parent services the
lease; the corrected check passes. This was inspection tooling, not a game
failure or concurrent browser run.

The next diagnostic (`combat-s6-candidate-diagnostic-2.json`) reproduces a
**2492.2 ms** first gap with **3.9 ms** callback, zero errors/recompiles and
no deaths (stop-on-spike diagnosis, not acceptance). A mistyped trace category
(`blink,user_timing`) omitted the clock anchor, so the summary correctly fails
with `Missing trace clock anchor`. Keep its report, trace and summary error;
no native-work attribution is made from this unaligned capture. A corrected
category capture follows; this is not an unchanged acceptance retry.

Corrected traced diagnostic (`combat-s6-candidate-diagnostic-3.json`) runs
**72.936 s**, records two natural deaths, max frame **21.1 ms**, callback
**9.7 ms**, p99 **8 ms**, zero errors/recompiles and zero measured stalls.
It is an instrumented diagnostic, excluded from the ordinary acceptance
sequence. Ready at **2896.3 ms**, measurement starts at **5222.1 ms**.
The **273.6 / 447.3 ms** pre-measurement intervals both have
`traceCoversWindow: false` in its `-trace-summary.json`; the latter occurs
after ready. It therefore neither locates nor erases the previous gameplay
failures. No speculative HUD/renderer fix, gate change or driver claim follows.

Session disposition: **NOT FULLY GREEN**. All final code/resource checks,
**824 tests**, fixed-camera inspections, natural and muted radio captures,
virtual main-hook typecheck and five consecutive stock acceptance pairs pass.
The exact hooked candidate fails FFA presentation acceptance, so the full
repeatability requirement remains unmet. The combat implementation is ready
for integration; the arc stays **partial** until main takes the documented
caption/audio hook and the combined build passes. Main's owner-rollback
activation remains pending separately. Evidence index:
`combat-s6-summary.json`; all rejected runs remain on disk.

Open owner questions: none blocking. Default: keep the compatible authoritative
markers on, preserve human priority and current performance limits, leave
the exact rich-radio hook with main, and prioritize its presentation/rollback
integration before the shared weapon-table audit. No new feature flag, asset,
Meshy credit, light/pass/texture, commit, push or deployment.

Cleanup: verified and stopped only the owned **8798** server tree, root PID
**83128**, including its Wrangler/workerd children. Port **8798** is free;
inspection scripts closed their own browsers and released the shared lease.
Cleanup and final scope evidence: `combat-s6-server-cleanup.json` and
`combat-s6-final-state.json`. No other stream's process or owned source file
was changed. Final `git diff --check` passes on `ironsight-aaa-combat`.

### Session 5 - 2026-09-11: Bot squad tactics, arc 2/3 - fight on every floor

Reference: **R-L11**, **R-M18**, **R-L14**, **R-G20**. The owner rollback
handoff remains the first release prerequisite: Session 4's movement assertion
passes, but `main.ts` still has no `Predictor.connect` activation in this
checkout. No further combat hook is required, and main owns both activation
and the retained compositor investigation. This session takes the next
actionable combat gap: bot routes through existing doors, stairs, roofs and
the trench, with the same movement solver and no collision/map edits.

Targets: ordinary 50 ms walking reaches both Relay roofs and returns through
their stairs; the same routing handles Undertow/Switchyard ramps and exact
wall contact. Hard/regular marksmen may plan one bounded high-ground trip per
life; easy retains patrol. Six-second holds, close-threat interruption and
objective/reload priority prevent permanent roof camping. Health, damage,
reaction delays, aim randomness and weapon handling remain unchanged.

Starting state: clean `ironsight-aaa-combat`. Only combat-owned source/tests,
this plan and new `.inspect/combat-s5-*` artifacts are edited. No Meshy, assets,
new dependencies, commit, push or deployment. The Session 4 failed runs remain
evidence despite the supervisor status's green summary. Baseline fixed cameras:
`combat-s5-before-{relay,practice-two}.png` and `combat-s5-before-report.json`.
Validation and measured results follow below.

Delivered, on by default:

- `rooms/bot-navigation.ts`: one-metre cells with separate supported feet
  heights for interiors, roofs and the trench. Every directed walking edge
  uses the normal capsule/step/ramp solver in <=20 cm increments. Runtime
  steering checks at most five look-ahead nodes. Spatial buckets bound the
  collision lists; at most 24 destination fields are retained per variant.
  No invented jump, teleport, cover, floor or collision change. Exact wall
  contact is swept as movement rather than passed to hitscan `nearestBox`.
- Both immutable shutter variants are built at room creation, cached per map
  and shared across rooms in the isolate. An event tick does not rebuild the
  graph. These derived indexes rebuild naturally on a cold isolate. Reported
  active graphs have 15,000-15,320 nodes / 55,388-56,438 edges. Cached field
  storage in the final samples is 722,304-1,470,720 bytes; this counts typed
  flow fields only, **not total JS heap**.
- `bots.ts` and the room: regular/hard marksmen select reachable high ground
  from their own spawn and static map, with a 35-second trip deadline and a
  six-second hold. Close visible threats interrupt; recovery and DOM/core
  orders retain priority. Easy keeps ordinary patrol. Rushers route toward a
  visible opponent on another floor even at close horizontal distance. All
  perception, aim noise, reaction, HP, damage and fire/reload rules stay normal.
- Nine full-collision route regressions cover exact contact at 87.59 / 87.6 /
  87.60000000000001, both Relay stairs/roofs and return trips, both other maps'
  decks, room-vs-slab separation, stair voids, trench descent, sealed/narrow
  doors, shutter variants and bounded fields. A tactical regression covers
  arrival/hold expiry, difficulty and objective/close-threat interruption.
  The room ADS fixture explicitly clears its spawn-time positioning order
  before its fixed-pose handling check; its original ADS assertions remain.

Initial complete code checks **PASS**: `pnpm typecheck`, `pnpm test` (**806 passed / 8 skipped**,
**96 files passed / 6 skipped**), `pnpm build:client`, `pnpm audit:assets`.
All 25 prediction-sync tests pass, with no predictor/physics/threshold change.
Evidence: `combat-s5-final-checks.json` and `combat-s5-final-*.log`; checks hold
the shared inspection lease and no bake/build/test runs alongside acceptance.

Natural room telemetry (`BOT_NAV_REPORT=1`, `test/bot-navigation-round.tool.test.ts`)
records three **180-second** ordinary bot rounds, with no placement, damage,
loadout or tactical state injection. Final evidence:
`combat-s5-natural-routes-verified.json` and `combat-s5-summary.json`.

| Mode / map | Kills | Roof bot-seconds | Interior bot-seconds | Lower-tier bot-seconds | Kills from roof |
|---|---:|---:|---:|---:|---:|
| TDM / Relay | 65 | 88.50 | 383.05 | 174.20 | 0 |
| DOM / Undertow | 51 | 0 | 0 | 0 | 0 |
| FFA / Switchyard | 97 | 127.70 | 0 | 0 | 6 |

All four marksman seats reached roofs in TDM and FFA. Bot-seconds sum time
across bots; they are not round duration. DOM retains its current ground-level
flags/approaches rather than being diverted to produce a roof statistic.
Undertow deck ascent/descent passes the actual movement test, but natural DOM
deck use is **not claimed**. This checkout has Relay interiors and the existing
Undertow/Switchyard decks; it does not contain main's later worktree geometry.

| Mode | Bot-decision p50 / p95 / max ms | Room setup ms |
|---|---|---:|
| TDM | 0.393 / 1.640 / 19.652 | 232.209 |
| DOM | 0.352 / 0.584 / 4.887 | 205.214 |
| FFA | 0.311 / 1.397 / 4.088 | 156.859 |

These are real wall-clock timings around `tickBots` in the local Node room
harness, with fake game timers. Setup includes the two graphs and normal room
initialization. They are not deployed latency/capacity or an iGPU claim.

Rejected/intermediate evidence is retained. `combat-s5-navigation-first.log`
found an incorrect Undertow fixture destination beyond the deck; correcting
the destination to the actual slab made both directions pass. The initial
natural tool incorrectly used a fake `performance.now()` (zero CPU timings)
and required DOM roof activity despite ground-objective priority. Its failed
report remains `combat-s5-natural-routes.json` / `combat-s5-natural-first.log`;
the final tool captures real wall time before fake timers and reports DOM's
zero honestly. The first full suite failed the old fixed-pose ADS fixture
because its fresh spawn now has a positioning order; the fixture correction
above preserves its purpose and assertions. No production behavior was changed
to manufacture those telemetry or fixture results.

Fixed-camera before/after inspection **PASS**, zero console errors/forbidden
requests: `combat-s5-{before,after}-report.json` and their Relay/practice-two
PNGs. Relay remains **27 draws / 200,300 triangles / 16 textures / 25.681 MiB**;
practice-two remains **49 draws / 101,470 triangles / 17 textures**. Relay
median **6.9 / 6.9 ms**, p99 **7.2 / 7.1 ms**, scene preparation
**1093.1 / 1046.3 ms** (before/after). This run variation is not a rendering
improvement: the client build and the fixed-camera scene are unchanged.
Asset bytes **30,121,938**, public bytes **37,222,385**, largest asset
**7,183,364**: all **zero delta** from Session 4. Zero new asset bytes,
textures, lights, passes, Meshy credits or generated-asset rejects.

Wow check: `combat-s5-wow-report.json` and `combat-s5-wow-roof-live-{0,5,10,15,20}s.png`,
**20.621 seconds** after a **13.024-second** ordinary-input approach. The first
still visibly catches bot-6 climbing the Comms stair; samples track it from
**0.56 m** to **3 m**, holding upstairs and returning to the doorway fight.
The roof occludes that bot from this ground camera during the hold, so the
5-second still alone is not roof-visibility evidence. The player takes damage,
dies and respawns. **305 shot/kill/ping events** were observed across the
approach plus capture, with zero errors. No player/bot state, camera position,
health, clock or geometry injection; only normal W input and aim. This is
visual/behavioral evidence, separate from hitch acceptance. Player sentence:
**"They take the stairs and fight through the rooms."**

Ordinary hitch attempts, all reports retained:

| Attempt | TDM max / result | FFA max / result |
|---|---|---|
| `combat-s5-accept-*-1.json` | 14.4 ms / PASS | 1210.0 ms / PASS under existing policy |
| `combat-s5-final-accept-*-1.json` | 17.4 ms / PASS | 2155.7 ms / FAIL, also only one death |

The first pair had two deaths per run and zero shaders/errors. FFA retained
one **1210 ms** gap, **2.510%** of measured time. The inspection-only wrapper
then failed with `ERR_STREAM_WRITE_AFTER_END` while starting TDM 2 (empty log,
no report/browser left running). It piped stdout/stderr to the same log with
automatic end; it now keeps both pipes open until child `close`, then ends the
log once. The fresh `final-accept` sequence followed that concrete tooling fix.
Original reports and the incomplete first manifest were not overwritten.

The fresh TDM pass has two deaths, p99 **8 ms**, callback max **12.8 ms**, zero
>150 ms frames/shaders/errors, first-ready **3233.2 ms**. Fresh FFA ends after
**151.418 s** with one death, p99 **8 ms**, callback **9.5 ms**, and gaps
**2155.7 / 1127.6 ms** (**2.168%** stalled time); first-ready **3309.2 ms**.
First damage/death windows pass (**7.9 / 8.6 ms**). The sequence stops at this
failure. Main's north-wall navigation reproduction and presentation evidence
are in the cross-stream request above. No repeated unchanged runs were used
to manufacture a passing streak.

The separate short `combat-s5-startup-diagnostic{,-trace,-trace-summary}.json`
does not reproduce the gameplay gap. It covers two **loading** intervals,
**273.7 / 165.5 ms**, before first-ready **3677 ms**. The former includes a
**252.915 ms** `GetProgramiv` wait (**0.020 ms CPU**); the latter includes a
**40.184 ms** wait (**0.030 ms CPU**). They do not explain the untraced
2155.7 ms gameplay gap. This short diagnostic has no ordinary frame/death
coverage and is explicitly **not acceptance**. Prior covered Session 3/4
compositor waits remain evidence, without attributing every new gap to them.

After adding the measured Switchyard contact regression, final typecheck and
the full suite pass: **807 tests / 8 skipped**, **96 files / 6 skipped**
(`combat-s5-post-{typecheck,test}.log` and their result JSON). The prior build,
asset audit and both inspectors remain current: only the additional test and
inspection/logging artifacts changed after those checks.

**Session status: not fully green.** All owned implementation/functional,
asset and fixed-camera checks pass, and the ordinary required TDM gate passes;
the repeated TDM/FFA acceptance is **FAIL**. Do not describe the presentation
issue or deployed rollback issue as fixed. `combat-s5-summary.json` and
`combat-s5-final-acceptance.json` carry the failure; neither policy nor browser
flags were changed. Main owns the remaining driver/renderer integration.
No owner answer is needed to route these existing requests. Default next arc:
tactical radio barks, preserving the main rollback/reliability prerequisites.

Cleanup complete: the verified Session 5 Wrangler process tree was stopped;
port **8798** has no listener and no Session 5 inspection processes remain.
The combat supervisor was identified separately and preserved. Evidence:
`combat-s5-server-cleanup.json` and `combat-s5-final-state.json`. Final branch
is `ironsight-aaa-combat`; all eight changed files are combat-owned, with
`git diff --check` clean. No commit, push or deployment was performed.

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
