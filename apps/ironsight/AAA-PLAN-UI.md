# IRONSIGHT WW1 UI stream

## AAA gap list

1. Match presentation: deployment, scoreboard, honors, intermission and results need one coherent field-report treatment. Next UI arc.
2. Settings, loading and remaining connection overlays: complete the shared field framing and dense-screen checks. Training coach/HUD telemetry geometry is verified in Session 2.
3. Remaining combat overlays and shorter/mobile combat layouts: extend the HUD migration beyond the desktop states proven this session; retain gameplay information and compositor preparation.
4. Deployment world vistas await the world stream's WW1 artwork. Menu skin is complete; the live instruments now share its field palette.

## Reference scorecard

| Reference | Status | UI evidence / target |
| --- | --- | --- |
| R-L09 | partial | Menu objective/training/action readability and live training completion verified. Other presentation screens remain. |
| R-L12, R-L13 | partial | Sessions 1–2 menu/HUD use existing field tokens and Korean fonts. Session 2 critical text ≥14px, sampled neutral contrast ≥6.3388:1; 14 unchanged-copy pairs. Other screens remain. |
| R-L14, R-L23 | partial | Menu/HUD preserve controls, information and enemy choices; no new combat effects. Final hardware acceptance is recorded below separately. |
| R-L20 | partial | Four retained kill-feed entries and server messages stay separated in Session 2 captures; complete match presentation still pending. |
| R-L05, R-L06, R-L07, R-L17, R-L19, R-L21, R-L22 | partial | Functional presentation remains; visual migration scheduled next. |
| R-M01–R-M20, R-G01–R-G20, R-L01–R-L04, R-L08, R-L10–R-L11, R-L15–R-L16, R-L18 | n.a. | Gameplay, maps, weapon rendering and audio are outside the UI lane; no claim on other streams' acceptance. |

## Session 1 plan — 2026-09-22: Field orders, deployment skin

- Completed: eight baseline mode captures in Aside at 1920×1080 and 1280×720; existing shared primitives and canonical mode copy verified.
- Completed: shared palette, stencil wordmark, Korean hierarchy, field-order edge, reusable button states and collision-derived paper map diagrams. Existing controls, mode handlers, URL selection and gameplay rules retained.
- Completed: 35 fresh final captures, including both middle-scroll views and repaired hover midpoint; independent design and visual/CJK reviewers both PASS with high confidence.
- Completed: final evidence log, scope/diff checks and cleanup. Owned server tree and inspection browsers are stopped; port 8804 is no longer listening.
- Blocked: global green acceptance. Asset audit fails on unchanged kit-owned builder/metadata hashes. The unmodified hardware hitch probe exhausted its official 1,800,000ms shared GPU lease wait without launching a browser or producing a hitch result. Neither gate is waived or represented as passing.

## Cross-stream requests

Session 1 failures below remain historical receipts. Session 2 closes the weapon audit and required hitch acceptance requests; the existing soldier quarantine and world-vista request remain separate.

- **Session 2 / Look / supervisor, follow-up diagnostics (required gate passes):** preserve and correlate the 296.8ms/308.5ms first-ready gaps and earlier 156.2ms callback/231ms long-task failures in .inspect/ui-session-2/. Final locally quiet TDM gate passes without source/policy changes. Root cause and five-run TDM/FFA stability are not established by this UI session; trace that window in the owning renderer/probe lane.

- **Session 2 / Kit / supervisor: weapon blocker resolved externally.** Asset audit failed before UI changes and now passes after external admission/metadata edits. Raw and LF-normalized builder/metadata hashes are identical, ruling out Windows newlines. All candidate GLBs match, but both builders and five weapon/two soldier metadata files differ from admission receipts. See .inspect/ui-session-2/provenance.md and assets-before.log. The weapon request is closed by the passing unchanged audit. Soldier quarantine remains intact; UI did not change kit files.

- **Kit / supervisor, baseline gate blocker:** `pnpm audit:assets` fails before UI edits with `candidate_builder_hash` on `tools/build-ww1-production-weapons.py` and `candidate_meta_hash` on all five `assets/ww1/weapons/*.meta.json` files. Receipt: `.inspect/ui-session-1/assets-before.log`. Reconcile the authoritative builder/metadata bytes with the existing admission manifest in the owning stream. UI will not change these files or weaken the audit.
- **Kit / supervisor, additional provenance check:** the existing soldier quarantine integrity check also reports `soldier_builder_hash` for `tools/fit-ww1-soldiers.py` and `soldier_meta_hash` for the khaki/fieldgrey metadata. Weapon validation stops the full audit before this check. See `.inspect/ui-session-1/budget.json`; neither builder nor metadata was edited here. Quarantine is retained; the budget measurement conservatively includes those excluded files and does not certify admission.
- **Look / supervisor, required hardware gate:** rerun `EDGE='C:/Program Files/Aside/Application/Aside.exe' node scripts/hitch-probe.mjs http://localhost:8804 150000 .inspect/ui-session-1/hitch.json --assert` with this worktree's server running and the shared GPU available. The original attempt waited from approximately 10:50:53Z to 11:20:53Z on 2026-09-22 and failed at `scripts/inspection-lease.mjs:75` with `GPU inspection lease timed out after 1800000ms`. Receipt: `.inspect/ui-session-1/hitch.log`; no `hitch.json` exists. Other streams' leases/processes were left alone, no thresholds changed, and no software-rendered frame timing substitutes for the gate.
- **World:** Existing `relay-vista.webp`, `undertow-vista.webp` and `switchyard-vista.webp` show the earlier environment. Regenerate those existing menu vistas when the corresponding WW1 world is ready; keep their current URLs. This session changes menu framing only.

## Session log

### Session 2 - 2026-09-22: Field instruments (required gates green)

Branch `ironsight-ww1-ui`; app scope only. Retained uncommitted Session 1 work. No commit, push, deploy, new dependency, asset generation or gameplay/flow change.

Reference: R-L12/R-L13 (legible values and restrained palette), R-L20 (four readable kill-feed entries), R-L14/R-L23 (same information and enemy choices). Session 2 meets the scoped HUD presentation targets; remaining screens are listed in the gap list.

Plan:
1. Completed: reproduce and isolate the original kit provenance failure; build matching retained-style baselines.
2. Completed: shared field tokens on HUD instruments and feedback; loading preparation for new surfaces; UI invariants.
3. Completed: 29 final Aside captures, live practice interaction, and two independent PASS/HIGH design and visual/Korean reviews.
4. Completed: typecheck, full tests, build, audit, final-source map inspection and locally quiet hardware hitch acceptance all pass. Owned server/browser cleanup and final hash/lane checks pass.

#### Delivered change

- `client/ui/hud-field-style.ts` applies existing olive, paper and brass tokens to health, ammunition, loadout, scores, mode/objectives, connection/latency, leaderboard, feedback and radio plates. Critical labels are at least 14px. Intrinsic grid rows separate feed and server-event messages.
- `client/hud.ts` installs the skin and prepares detached objective, accepted-hit/kill, reload and directional combat fixtures during loading. `client/compositor-preparation.ts` also prepaints the ping hint. No new blur, filter, gradient, shadow, animation, WebGL texture, light or render pass.
- `client/tactical-map.ts` gives the existing hint readable backing and intrinsic width capped at 360px. `client/ui/field-copy.ts` preserves authored slash/bullet phrases and newlines. `client/training-coach.ts` clears the enlarged telemetry, keeps the final Korean phrase together, and compacts completion spacing. Text, actions, state and bindings are unchanged.
- `test/hud-field-skin.test.mjs` adds two presentation invariants for tokens, unchanged information and prepaint/effect boundaries. DESIGN.md records the geometry and copy treatment. User-selected enemy colors, reticle and damage effects remain unchanged.

#### Wow check and browser evidence

**“체력과 탄약, 명중 확인이 또렷해서 전투 중에도 바로 읽힌다.”**

Evidence root: `.inspect/ui-session-2/`. Final set: **43 PNGs**, comprising 14 before and 29 current captures. Primary before/after pairs cover TDM, FFA, domination, practice, combat and domination-combat at 1920×1080 and 1280×720. Completion-coach baselines add the other two pairs. Real Hud/TacticalMap/TrainingCoach classes render fixture DOM/canvas against a fixed Relay vista; the image supplies background only.

Before captures reconstruct the retained pre-session CSS through the fixture bundler; they are not an untouched earlier binary. `baseline-build.json` asserts all three transforms and different bundle hashes. The first comparison was rejected because a Windows path matcher had not applied its transform. The fixture clock was also corrected to settle throttled hints. Superseded evidence is not acceptance.

The 16 current check captures cover eight long FFA names, long confirmation, dense HUD/settings equivalent 200% reflow, 375/768px menus, font failure, reduced motion, long bindings, actual feed animation at 0/80/160ms, completed coach at both sizes, and completion plus long bindings/ready latency/mute at both sizes. Independent reviewers found two iterations of insufficient coach/hint clearance and awkward Korean wrapping; final intrinsic-width hint and phrase treatment repair both. Combined 1280 state: coach bottom 539.578px, hint top 548.406px, **8.828px gap**, two-line 58px hint.

All 14 text comparisons pass, with only nondeterministic FPS normalized. `evidence.json` verifies all PNG signatures/dimensions, seven exact source/bundle hashes, no geometry findings/errors, critical text at least 14px, and worst sampled neutral text contrast **6.3388:1** (primary 12.7821, secondary 9.3304, accent 7.5478, ink/paper 11.4164). Bundle SHA-256: `7054474923520af3e8eeae343fb051bf6a859d6aea4ece49fb490bafafe0ec65`, built at 12:23:16Z. All current captures follow this build.

The real Aside practice run (`live.json`, `checks/live-practice.png`) enters through the current deployment flow, obtains pointer lock, moves with W, switches to SMG with Digit2 and checks rendered HP against room state. It records movement, SMG/32 rounds, 100 HP matching state, no console errors and cleanup. No forged lock or state.

Visual harnesses use isolated Aside with software rendering to avoid competing for the shared GPU. They establish appearance/interaction only. The 200% case is equivalent 960×540 CSS reflow at DPR 2, not native browser zoom. Mobile evidence covers menus, not mobile combat. Preparation evidence confirms unchanged live text and zero remaining preparation nodes.

Final independent approvals: `review-design-final.md` (/root/signoff_design) and `review-visual-final.md` (/root/signoff_visual), both **PASS / HIGH**, all 29 current images directly opened and all seven hashes independently matched. Neither approval substitutes for hardware gates.

#### Gates and measured cost

| Gate | Result | Receipt |
| --- | --- | --- |
| `pnpm typecheck` | PASS | `typecheck-final.log` |
| `pnpm test` | PASS: 1,513 Vitest tests in 177 files and 83 Node tests; nine existing skips unchanged | `test-final.log` |
| `pnpm build:client` | PASS | `build-final.log` |
| `pnpm audit:assets` | PASS | `assets-final.log` |
| Required hardware Aside `inspect-map`, port 8804, `relay,practice-two` | PASS, zero console errors | `inspect-map-acceptance.log`, `../ui-session-2-acceptance-{relay,practice-two}.png` |
| Required 150000ms hitch probe with `--assert` | PASS: two deaths, max frame 21.3ms, max callback 6.3ms, p99 upper 13ms, zero shader changes/errors | `hitch-acceptance.json`, `hardware-gates-acceptance.json` |
| Independent design and visual/Korean review | PASS / HIGH | `review-*-final.md` |
| Final lane/diff check and cleanup | PASS; owned server tree stopped, no session browser/profile/runner, port 8804 closed | `cleanup.json` |

Shipping public bytes are **52,648,977** under the 60 MiB ceiling. Conservative disk sum including quarantined soldiers is 61,050,835 bytes; largest file 8,025,108 bytes. Session 2 adds no asset/texture bytes and spends 0 Meshy credits. Bundle grows **10,970 bytes** to 4,000,671; sourcemap grows **12,418 bytes** to 7,794,088. The raw public total changes with externally reconciled metadata, so it is not solely a UI delta.

Required Relay inspection on RTX 5070 at 1920×1080: median **6.9ms**, p99/max **7.1ms**, 38 draw calls, 230,200 triangles, 18 textures and **33.681 MiB** estimated texture residency. Scene preparation is **998.9ms**, construction 198.7ms. Practice-two reports one live player at 100 HP, 63 calls and 26 textures. No paired baseline gameplay frame/load delta was collected; these desktop results do not qualify the laptop iGPU target. Final local TDM first-ready time is **3,961.6ms** from navigation; scene preparation **1,251.6ms**, UI preparation **567.4ms**. These are fresh-profile local observations, not production load or paired before/after deltas.

Two earlier hardware attempts remain recorded: `hitch.json` fails with a 156.2ms maximum animation callback; `hitch-final.json` fails with a 231ms long task despite a 14ms maximum callback. Both have two deaths, zero shader changes/errors and passing first-damage/death windows. Own full-suite/software-browser work overlapped both measurements; the final queued acceptance follows completion of that work. This is a distinguishing control, not proof that concurrency caused either failure. See `hitch-triage.md`. No threshold, official script, gameplay or renderer source was changed.

#### Final hardware acceptance and limits

The exact required command, using hardware Aside and the official GPU lease, passes on the reviewed bundle. The probe acquired the lease at **12:33:00Z**, finished at **12:34:51Z**, and measured **104,012.9ms / 14,975 frames** (150000ms is the configured maximum; the existing probe stops after its second death/respawn). There are **two deaths, no long tasks, no shader recompiles, no console errors and no frames over 24ms**. Maximum frame **21.3ms**, maximum animation callback **6.3ms**, p99 upper bound **13ms**. First-damage/death windows are **19.3ms / 14.3ms**, both PASS.

All own full-suite/software capture work ended before this run. No code or gate policy changed between the preceding failed run and this control. It supports avoiding simultaneous local verification workloads but does **not** identify the failures’ root cause or establish the look stream’s five-run TDM/FFA stability target. Both failed receipts are retained.

Separate startup diagnostics record two post-ready/pre-measurement frame gaps, **296.8ms and 308.5ms**, before hitch measurement begins. The required gate excludes that window; this session does not claim hitch-free startup. Exact timestamps and preparation measures are retained in acceptance-summary.json and hitch-acceptance.json for the look stream. No UI effect or product workaround was added to conceal them.

#### Provenance and handoff

The starting asset audit failure was reproduced before source edits. Raw/LF hashes ruled out line endings; candidate GLBs matched but kit builder/metadata receipts did not (`provenance.md`). During this session, external edits reconciled the admission manifest and weapon/character metadata. The unchanged audit now passes. UI did not edit or revert those kit-owned files. Soldier assets remain quarantined and excluded by the existing audit; their builder mismatch is not represented as repaired/admitted.

During this session, the working tree retained Session 1 UI edits and showed external modifications to `config/ww1-authored-admission.json`, five weapon metadata files and two character metadata files. Session 2 changes HUD, tactical map, training coach, compositor preparation and field-copy, plus the new HUD style/test, DESIGN.md, AAA-PLAN-UI.md and evidence. `AAA-PLAN.md`, other lane source, test thresholds and shared inspection scripts are untouched by UI.

Open owner questions: none needed. Defaults: unchanged gameplay, copy, flows and enemy-color settings; retain prior world vistas pending the world stream; match presentation is the next coherent UI arc. Owned Wrangler root PID 46268 and its six descendants are stopped. No session browser, profile directory or gate runner remains; port 8804 is closed (cleanup.json). No commit, push or deploy occurred.

### Session 1 - 2026-09-22: Field orders, deployment skin (UI complete; global gates blocked)

Branch `ironsight-ww1-ui`; app scope only; no commit, push or deploy. Source inspection found that `client/ui/tokens.ts`, primitives and Korean fonts already exist, contrary to the supervisor's older note. Reuse them; do not add a second system. `AAA-PLAN.md` is untouched.

Reference: R-L09 (read objective/training and act), R-L12/R-L13 (value hierarchy and legibility), R-L14/R-L23 (unchanged information and enemy choices). The deployment-menu targets are met in the evidence below; the global hitch requirement is explicitly unverified.

Initial test gate found four missing-fixture failures in two weapon-contact test files. Restored the five local `.inspect/ww1-art/production-candidates-v3/*/candidate.glb` fixtures from the already-published public GLBs, verifying each against the existing admission SHA-256 first. No kit source, assets, expectations or thresholds were edited. `.inspect/ui-session-1/restored-fixtures.json` records this setup repair; full suite now passes (1,511 Vitest tests plus 83 Node tests; 9 pre-existing skipped cases unchanged).

Browser evidence uses isolated **Aside Browser** executable instances, exact device metrics and owned profiles, driven through CDP. Aside CLI selection/snapshot worked, but its screenshot calls timed out and it exposed no viewport API; no CLI screenshot success is claimed. The 200% evidence uses a 960×540 CSS viewport with DPR 2 for 1920×1080 pixel output, an equivalent reflow check, not an observed native browser zoom shortcut.

Rejected intermediates: the first narrow treatment broke “시간 제한 없음” across lines; existing slash/bullet-separated phrases now stay together without changing text. The first paper-map low-cover color measured 2.449:1; replaced it with the shared subtle-border tone (6.284:1 on paper), and gave ramps an ink outline (11.416:1). Final product captures were regenerated after those changes. No threshold was widened.

#### Delivered change and boundaries

- `client/ui/deployment-style.ts` contains the scoped field-order treatment, consuming the existing shared palette, spacing, type and button primitives. `client/mode-select.ts` retains the existing DOM shell, handlers, settings/focus restoration, URL selection and duplicate-deploy guard. Responsive grid placement separates the briefing, map and mode cards without changing the player flow.
- `client/ui/field-copy.ts` groups authored slash/bullet-separated phrases to avoid awkward Korean wrapping. Training cards use the existing canonical Korean site names. All four mode objectives remain authoritative.
- `client/map-presentation.ts` adds only SVG presentation classes; collision-derived shapes and fallback colors are unchanged. Menu-scoped paper/ink styles do not restyle other consumers. `test/deployment-skin.test.mjs` checks geometry preservation and shared-token/effect boundaries.
- The only new asset is the self-hosted Stardos Stencil bold wordmark font plus its SIL OFL license. Korean remains in the existing Hangul-capable body/system stack. Official google/fonts provenance and reproducible download commands are appended to `public/assets/README.md`; exact hashes are appended in the permitted `# ui` audit block and allowlisted in `.gitignore`. No existing audit was weakened.
- No new live HUD/combat effects, blur, filter, shadow, animation, WebGL texture, light, render pass or dependency was added. The menu's existing directional gradients are recolored; menu CSS is painted before deploy and removed on deploy, while direct mode entry does not install it. `client/compositor-preparation.ts` therefore needs no additional combat pre-render entry for this change. This reasoning does not waive the blocked hitch gate.

#### Wow check and browser evidence

Fixed-size before/after stills cover all four menu modes at 1920×1080 and 1280×720: `.inspect/ui-session-1/before/{1920,1280}-{tdm,ffa,dom,practice}.png` and the matching `after/` paths. The first-time-player sentence is: **“이제 출격 전에 야전 지도를 펴 놓고 작전을 고르는 느낌이다.”**

The current evidence set contains 35 final PNGs: eight primary after captures, 25 interaction/responsive/stress captures in `checks.json`, and two middle-scroll additions in `extra.json`. Coverage includes 375px/768px layouts, all three training sites, dense settings at equivalent 200% reflow, rest/mid/settled hover, keyboard focus, reduced motion, actual font-request failure with hover, long rebinding labels and the shared primitive showcase. Those supplemental screens were stress-checked, not migrated in this session. Browser assertions confirm native selection, footer reachability, critical text size, no horizontal overflow, no unexpected console errors and no matchmaking/WebSocket before deploy.

Final source changed at 11:01:44Z, build at 11:01:45Z; `refresh.json` binds seven exact source/bundle SHA-256 values to the complete refresh finished at 11:14:43Z. One screenshot-only defect was found independently: the initial hover midpoint had landed after the 100ms transition. `hover-middle.mjs` paused the five actual CSS transitions at 50ms and replaced that frame at 11:21:12Z, with intermediate background `rgb(232,209,161)`. `checks.json` records the method; both reviewers reopened the replacement. Product source did not change during this repair.

The final capture harness used the real isolated Aside executable with `--disable-gpu --disable-gpu-compositing`, allowing layout/interaction evidence while another session held the exclusive hardware lease. The baseline captures and required map inspection used hardware Aside. Software screenshots prove appearance only. `menu-diff.json` confirms matching dimensions and intact alpha; its 0.9959 changed-pixel ratio describes the intended reskin, not a clone-fidelity score.

- Final independent Pass A: `.inspect/ui-session-1/review-design-final.md`, PASS / HIGH, all 35 current captures directly opened and seven source hashes verified.
- Final independent Pass B: `.inspect/ui-session-1/review-visual-final.md`, PASS / HIGH, all 35 current captures plus eight baselines directly opened; PNG dimensions/bytes/freshness and rendered map colors independently verified.
- Contrast receipt: `.inspect/ui-session-1/contrast.json`. Low cover/paper 6.284:1; high cover and ramp outline/paper 11.416:1; secondary text/raised plate 10.038:1; deploy label/hover 9.774:1; selected border/plate 3.918:1.

#### Gates and measured cost

| Gate | Result | Receipt |
| --- | --- | --- |
| `pnpm typecheck` | PASS | `.inspect/ui-session-1/typecheck.log` |
| `pnpm test` | PASS: 1,511 Vitest tests in 176 files plus 83 Node tests; nine existing skipped cases in seven files unchanged | `.inspect/ui-session-1/test-final.log` |
| Final focused UI tests | PASS: 13/13 after final CSS change | `.inspect/ui-session-1/ui-tests-final.log` |
| `pnpm build:client` | PASS | `.inspect/ui-session-1/build.log` |
| `pnpm audit:assets` | FAIL: same pre-existing kit builder/five metadata hashes as before UI work | `.inspect/ui-session-1/assets-before.log`, `assets-final.log` |
| Required `inspect-map`, port 8804, `relay,practice-two` | PASS, zero console errors, hardware Aside | `.inspect/ui-session-1/inspect-map.log`, `.inspect/ui-session-1-{relay,practice-two}.png` |
| Required 150000ms hitch probe with `--assert` | BLOCKED: shared GPU lease timed out after 1800000ms, no probe result | `.inspect/ui-session-1/hitch.log` |
| Two independent visual reviews | PASS / HIGH | `review-design-final.md`, `review-visual-final.md` |
| `git diff --check` and lane audit | PASS | Final worktree check; only permitted app paths changed |
| Owned-process cleanup | PASS | `.inspect/ui-session-1/cleanup.json` |

`budget.json` measures 61,026,195 public bytes against the current 60 MiB (62,914,560 byte) limit, a 45,155-byte increase from 60,981,040. It conservatively includes quarantined soldier files and is not an asset-admission verdict. Largest file: 8,025,108 bytes, below 25 MiB. Font/license add 37,468 bytes; client bundle grows 3,415 bytes to 3,989,701 and sourcemap grows 4,272 bytes to 7,781,670. New WebGL texture bytes: 0; Meshy spend: 0 credits. The two UI asset hashes pass independently, although the full audit exits earlier on kit provenance.

First-load observation in `extra.json`: cache-disabled loopback menu navigation in the same isolated software Aside session after viewport captures gave FCP 168ms, load event 270.9ms and observed fonts-ready 279.8ms. Stencil font transferred 22,150 compressed bytes in 31.7ms. These are local navigation observations, not a fresh browser-process/production/device cold-start measurement; no comparable baseline load delta was collected.

Required Relay inspection at 1920×1080 on the RTX 5070 reports median frame 6.9ms, p99/max 7.1ms, 38 draw calls, 230,200 triangles, 18 textures and estimated 33.681 MiB texture residency; scene preparation 1,079.6ms. Practice-two reports one live player at 100 HP, 63 calls and 26 textures. No before/after gameplay frame delta was collected. These static desktop-GPU results do not prove the laptop iGPU target or first-fight hitch acceptance.

#### Handoff and defaults

Global green acceptance is **blocked**, not complete: the supervisor must reconcile kit provenance in its owning lane, then rerun the unchanged asset audit and exclusive hardware hitch gate. No prohibited file was changed to work around either issue. Other streams' processes and leases were left intact. Owned Wrangler PID 47016 and its descendants were cleaned up; no session-owned Aside browser remains and port 8804 is closed (`cleanup.json`). No commit, push or deploy occurred.

Open owner questions: none required for this session. Defaults remain active: retain the current gameplay/copy/URLs and selectable enemy colors; use existing shared tokens for the next HUD pass; accept the old menu vistas until the world stream supplies replacements; do not call this session globally green until both outstanding gates pass.
