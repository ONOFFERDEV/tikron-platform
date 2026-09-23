# Ironsight AAA look stream

## Session 3 plan

Arc: **Dust from the impact**. Reference: R-G09, R-G20, R-L12, R-L14. Target: server-event surface impacts distinguish earth/wood/masonry spall from metal sparks, with a soft short dust tail, within the existing 48-particle pool. Zero new art bytes, lights, render passes or gameplay changes. Existing Session 2 working-tree changes are preserved.

1. Completed: retained the current-source baseline, three matching map cameras and four exact-age material fixtures in Aside; three new cases fail on the prior effect.
2. Completed: implemented material-aware pooled impact rendering in scene-impact.ts with minimal main/scene hooks, shared geometry and shader-only dust softness.
3. Blocked: visuals, source gates and inspector pass; pair 5 FFA fails strict first damage (251.2ms >150ms). Ten ordinary gates and nine strict runs pass. Covered diagnostic shader wait is investigated below; no causal fix is yet established.
4. Completed: bytes, timings, all failures/spikes, visual verdicts and remaining investigation recorded below; owned-process cleanup receipt accompanies the final entry. No commit, push or deploy.

The world-rendering contract is `ART-CONCEPT.md`; `DESIGN.md` explicitly delegates Three.js materials to domain modules. Frontend design/perfection and redesign references were read; their UI redesign/dependency/deployment work is outside the owner-authorized lane. Acceptance follows the project's real-renderer and hitch gates. Aside is the interactive surface; the expressly required headless scripts remain acceptance tools.

## Session 2 plan

Arc: **Light across the front**, following Air above the front. The top gap is distinct, readable per-map illumination with no new asset bytes, lights or passes. Reference: R-G09, R-L12, R-L13, R-L14. `ART-CONCEPT.md` governs the world; the existing `DESIGN.md` leaves world rendering to domain modules. UI, gameplay and other streams' files remain outside this session.

1. Completed: captured the three maps and clear actor corridors in Aside, with an isolated current-source control and full headless Relay timing baseline.
2. Completed: authored the existing per-map light/sky/environment balance in look-owned modules and twelve focused rendering invariants (red/green logs retained).
3. Completed: all eight fixed-camera pairs, the 27.637-second natural fight sequence, all required gates, five sequential strict TDM/FFA pairs and both independent visual reviews pass on the final build.
4. Completed: final evidence, budgets, timings, remaining gaps and cross-stream requests recorded. Owned preview and children stopped; own Aside tabs/REPLs closed, shared browser preserved for other streams.

The supervisor reports Session 1 accepted at `ac556ef`. Its local narrative below is retained as historical partial recording; Session 2 will establish its own complete evidence cohort rather than treating the unfinished local ten-run summary as proof.

## Session 1 plan

Arc: **Air above the front**, session 1 of up to 3. Scope: presentation lighting and skyline atmosphere only, per `tools/aaa-stream-look.md`. No commits, pushes or deploys.

1. Completed: capture the three maps at fixed cameras in Aside and record baseline render cost; identify the highest impact treatment.
2. Completed: implement bounded battlefield atmosphere with stable light/program counts and invariant tests inside look-owned files.
3. Historical partial record, superseded by supervisor acceptance at `ac556ef`: local narrative below does not establish a completed ten-run cohort.
4. Historical partial record: Session 2 owns its current evidence and process cleanup; no Session 1 evidence is silently promoted to a completed result.

## AAA gap list

1. Restore strict first-use acceptance: Session 3 pair 5 FFA fails at 251.2ms. Capture the actual failure with startup GPU trace, identify the program/material, fix its confirmed cause and prove five complete strict TDM/FFA pairs. A separate diagnostic captured a 1381.5ms WebGL shader/program wait after readiness; causality to the failed run remains open.
2. Persistent impact/scorch marks and surface-normal response need the next assessment. Session 3 now provides material-specific pooled dust/spall; its before/after fixtures and both independent visual reviews pass.
3. Recalibrate light against admitted WW1 world and soldier materials when integrated. Session 2 improves Relay direction/contact and all-map sky/environment colour; future dusk/overcast rig changes need the profile ownership request below.
4. Sky-to-world transition: revisit skyline layering once the world stream replaces industrial boundary props; sky smoke and wind are now implemented.
5. Presentation cameras need assessment after world and kit updates arrive.

## Reference scorecard

This stream evaluates rendering references only; gameplay/layout/UI references remain out of scope and are not claimed complete.

| Reference | Status | Checkable target |
| --- | --- | --- |
| R-G09 | partial | Session 2 clear 8m corridor pairs preserve legacy actor readability; obstructed original views are excluded from this claim. Incoming WW1 soldiers and all-angle visibility remain unqualified. |
| R-L12 | partial | Stronger Relay sun/contact and map-specific sky/HDR grading, eight reviewed before/after pairs; no new pass, lights or textures. Full WW1 integration remains. |
| R-L13 | partial | Restrained dusk and grey overcast grades support the sampled legacy actor value masses. `look-session2/visual-review-final.json` records both independent PASS verdicts. |
| R-L14 | partial | Fog ranges, collision/visibility logic, light identities and resource counts preserved; Session 2 strict cohort passes, but Session 3 strict first damage fails at 251.2ms (`look-session3/hitch-summary.json`). RTX 5070 evidence does not qualify a laptop iGPU. |

| R-M01 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M02 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M03 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M04 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M05 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M06 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M07 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M08 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M09 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M10 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M11 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M12 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M13 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M14 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M15 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M16 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M17 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M18 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M19 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-M20 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G01 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G02 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G03 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G04 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G05 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G06 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G07 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G08 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G10 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G11 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G12 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G13 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G14 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G15 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G16 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G17 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G18 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G19 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-G20 | partial | Session 3 shares one map-material classification between cues and VFX at the server-confirmed endpoint; no hit, timing or authority changes. Whole-game feel-table audit is outside this lane. |
| R-L01 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L02 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L03 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L04 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L05 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L06 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L07 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L08 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L09 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L10 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L11 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L15 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L16 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L17 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L18 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L19 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L20 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L21 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L22 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
| R-L23 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |

## Cross-stream requests

- Session 3 supervisor notice: strict acceptance is blocked by pair 5 FFA first damage 251.2ms. Preserve this candidate and failure evidence without accepting it as green. Look owns the next covered shader/program-wait investigation. If the correlated call belongs to UI compositor preparation or kit material loading, route the exact call/material evidence to that owner before edits; no ownership transfer or UI/kit defect is assumed from the present trace.

- **Session 2 / supervisor, next lighting arc:** `scripts/inspect-map.mjs:543-554` pins Relay exposure=1.05 and dusk/overcast rig fields to `client/undertow-dusk.json` and `client/switchyard-overcast.json`. Those JSONs and the inspector are outside look's allowlist. Please assign the two profile JSONs to look for a future coordinated rebake/rig change, or relay a supervisor-owned update that keeps key direction, fill, exposure and baked-sky checks tied to one authoritative profile. Current Session 2 preserves the pinned values and delivers sky/HDR grading plus Relay sun alignment; no foreign files or assertions were changed.

- **Session 2 / clarification, no new asset-gate blocker:** `.inspect/look-session2/assets-before.log` exits 0. Its `soldier_builder_hash` and `soldier_candidate_quarantined` entries describe excluded soldier candidates; `audit-assets.mjs` explicitly removes those paths using `.assetsignore`. An initial reading of the nested diagnostic as a gate failure was incorrect. No kit files or admission rules were changed, and no repair is requested by look. Baseline deployed public set: 52,589,066 bytes; asset subset: 40,814,970 bytes.

- **Resolved externally: supervisor / kit baseline asset gate.** audit:assets initially reported candidate_builder_hash for tools/build-ww1-production-weapons.py and candidate_meta_hash for automatic-rifle, trench-smg, pump-shotgun, bolt-rifle and service-pistol metadata. None was edited by look. Diagnosis: the six receipts were minted for CRLF bytes; the initial worktree had LF-only bytes, and each LF-normalized file matched the recovery checkout content exactly. The requested repair was to restore the original CRLF bytes without changing hashes or relaxing the audit. An external repair arrived at approximately 11:36 UTC: all six raw hashes now match the expected receipts. The subsequent filesystem-only pnpm audit:assets passes (audit-after-external-repair.log). Existing quarantined soldier candidates remain excluded; look did not change admission policy. The original failure is retained in assets-before.log.
- **Test fixtures:** four existing weapon-contact tests need ignored production-candidates-v3 GLBs. Resolved: five candidate GLBs restored as new .inspect files with the exact test SHA256s; all five tests in the two affected suites pass. Receipt: .inspect/look-session1/fixture-restore.json.

- **Supervisor inspector maintenance:** the optional switchyard-vista baseline run fails because scripts/inspect-map.mjs:609 still requires /assets/props/switchyard-transformer.glb, which current WW1 art does not request. Required relay,practice-two gate is unaffected. Please update the supervisor-owned legacy asset assertion to the admitted WW1 resources. Retained report: .inspect/look-s1-before-report.json.

- **Supervisor lease helper:** one queued Aside capture exited when the prior lease owner closed the socket with an empty response (Unexpected end of JSON input in scripts/inspection-lease.mjs:29). Retried as a separate run, preserving candidate-aside-retry.log. The helper is supervisor-owned; please treat empty response during owner shutdown as a retryable acquisition race while retaining rejection for a nonempty invalid service response.

- **Historical Session 1 GPU scheduling request, superseded:** five of ten local runs were recorded while waiting behind other streams. See `.inspect/look-session1/hitch-series-resume2.log` and `hitch-summary.json`. Session 2 establishes a separate complete cohort; no foreign process is interrupted and all limits remain unchanged.

## Session log

### Session 1 - 2026-09-22: Air above the front

In progress. Supervisor status and standing brief read. Lane branch `ironsight-ww1-look`, dev port 8803. Baseline working tree clean. No Meshy spend; no new dependencies planned. Baseline and final evidence will be retained under `.inspect/look-session1/`.

The existing `DESIGN.md` explicitly places Three.js world rendering in domain modules; this arc uses `ART-CONCEPT.md` as its visual contract and leaves UI files with the UI stream. Aside is the interactive visual inspection surface. The specifically required existing headless inspector and hitch scripts remain the acceptance gates.

#### Implementation and evidence so far

- Added client/scene-sky-weather.ts (sky shader weather, no scene nodes/textures) and five hook lines in client/scene.ts. Three authored per-map profiles drive broad wind-shaped smoke and subdued cloud veils inside the existing opaque sky material. Far-plane depth makes world and actors occlude the weather. Uniform-only motion freezes under reduced motion without resetting or recompiling.
- Before/after Aside captures: .inspect/look-session1/{before,after}/{arena1,arena2,arena3}.png, identical cameras at the actual 1440x900 Aside viewport. Per-map facts and source hashes: visual-manifest.json. All images opened locally and image-diff signature/dimension/alpha checks pass. Changes concentrate in the sky (diff ratios 0.3441/0.3646/0.3023); this is an intentional redesign, not a clone similarity target.
- Rejected intermediates: first smoke bearings hid behind Relay's central building; a second placed Relay outside its actual 78-degree vertical FOV. Thin high plumes read like streaks and floated above the finite skyline from the elevated depot camera. Final profiles move into open sky, use isotropic billow noise and broaden/extend bases behind world geometry. Old evidence retained in candidate/ and look-s1-after-relay.png.
- Typecheck, build and six new sky invariants pass. Full suite after fixture restore: 176 Vitest files / 1,515 tests pass; existing 7 skipped files / 9 skipped tests unchanged; 83 Node tests pass. LSP is unavailable (previous installation declined), so both project TypeScript checks are used.
- Exact final required headless relay,practice-two inspector passes with zero console/network errors. Relay 1080p baseline→final: 38→38 draw calls, 29→29 programs, 18→18 textures, 33.681→33.681 estimated texture MiB, p50 6.9→6.9ms and p99 7.1→7.1ms. Host is RTX 5070, not a laptop iGPU qualification.
- Aside static resources before→after: Relay 37→37 draws / 29→29 programs / 18→18 textures; Undertow 43→43 / 29→29 / 22→22; Switchyard 36→36 / 26→26 / 16→16. All three keep 16 existing lights, one PMREM generation and cached shadows.
- Assets added by look: zero; Meshy credits: zero; client bundle +3,847 bytes. Final audited assets: 40,814,970 bytes; public total: 52,589,066 bytes; largest file: 8,025,108 bytes, all within existing limits. The 970 asset-byte increase comes from the external metadata line-ending repair, not new look art. Byte receipt: bytes.json; audit: audit-after-external-repair.log.
- Runtime validation: five sequential TDM/FFA pairs are in progress. The separate 28-second bot capture, wind samples and static/motion visual reviews have completed.

- Independent static review: look_visual_fidelity PASS; look_visual_integrity found no product blocker and waits only for completed final performance evidence. Receipt: .inspect/look-session1/visual-review-initial.json.

- First completed strict TDM run: PASS, two natural deaths, p99 upper bound 8ms, max measured frame 14.4ms, max callback 9.3ms, zero measured >150ms intervals, shader additions or console errors; first-damage/death windows 10.3/8.5ms. First-ready 3134.4ms. Five startup gaps (165.7–279.8ms) retained, including 214.2ms and 260.4ms after first-ready and before ordinary measurement. These are untraced and are not assigned a driver cause. Full list: hitch-summary.json.
- Architecture self-review: focused 81-pure-line sky-weather module, internal typed parameters, no assertions or new input boundary, no listeners/resources requiring new cleanup. The existing large scene hub remains minimally edited per the explicit lane rule; no unrelated refactor.

#### Wow check

Before/after fixed-camera images show smoke beyond all three skylines while foreground readability stays intact. First-time-player sentence: “There is a battle going on beyond these walls.” Eleven natural bot-round frames span 28,125ms, including damage, death and respawn; three wind samples show sky-only progression. These captures are visual evidence, separate from asserted hitch acceptance.

#### Open owner questions and defaults

None needed for this arc. Default: preserve the current light/exposure/fog balance until world materials arrive, keep sky weather always available, and freeze its motion with the existing reduced-motion setting. No new quality toggle, asset generation, dependency, commit, push or deployment.

- Validation scheduling failure: supplementary refined-relay inspection exceeded the unchanged 1,800,000ms GPU-lease acquisition limit while PID 79260 (ULW browser-current / trusted controls and content fault probes) held the lease. The final required relay,practice-two run had already passed. No foreign process was stopped and no lease bypass was used. Other queued visual/combat jobs remain pending. Evidence: .inspect/look-session1/refined-relay.log.

- The initial separate bot capture timed out after 1,800,000ms waiting for the same foreign GPU lease, before launching its browser. The subsequent retry completed as recorded below. Both attempts remain in .inspect/look-session1/bot-capture.log.

- GPU lease later released. Wind sequence completed in Aside: motion/arena1{,-10s,-20s}.png with actual timing in motion/transcript.json. Diff ratios 0.0462 and 0.0703 stay entirely above y=450; PNG dimensions/alpha remain valid, foreground unchanged. These are time-separated stills in Aside, not iGPU frame-rate proof.
- Bot capture retry completed: bot-capture-fight-00..10.png spans 28,125ms from first natural damage and includes death and respawn. Two natural deaths, zero console errors, no measured >150ms interval; screenshot run is visual evidence only and is deliberately excluded from the asserted hitch cohort.
- First FFA acquisition timed out before launching a browser; archived as hitch-1-ffa-acquisition-timeout.log and hitch-series-attempt1.json. Resumed at that unexecuted FFA after verifying every captured source hash unchanged and retaining the completed strict TDM pass. No gameplay failure was discarded, no limit changed, and no completed run was repeated to fish for a pass.
- A second FFA acquisition encountered the existing empty-response lease handover race, also before launching its browser. Preserved as hitch-1-ffa-handover-error.log and hitch-series-attempt2.json; the same unexecuted case was retried after source-hash verification.
- Pair 4 TDM encountered the same pre-browser handover race after three complete pairs passed. Preserved as hitch-4-tdm-handover-error.log and hitch-series-attempt3.json. The remaining driver refuses a retry if a gameplay report exists, verifies all six completed ordinary/first-use passes and the frozen source hashes, then resumes only pair 4 TDM. The original full-suite waiter aborted without running tests and was requeued; no performance assertions or shared helper files changed.
- Independent motion/combat review: look_motion_review PASS after opening all 14 images. Three wind PNGs are 1440x900; eleven bot PNGs are 1920x1080. The reviewer corrected an initial dimension-report typo without changing the verdict. Captures show complete sky/world/actor/UI compositing, subtle sampled wind, natural damage/death/respawn and preserved readability. The existing pause/pointer-lock overlay appears after respawn, so this is not claimed as uninterrupted player control or continuous frame-rate evidence.

### Session 2 - 2026-09-22: Light across the front

Arc continuation from Air above the front. **Complete; all acceptance gates PASS.** Reference: R-G09, R-L12, R-L13, R-L14. Target: distinct hard daylight, readable dusk and neutral overcast; preserve actor silhouettes and fog distances, add zero lights/passes/art bytes, retain the ordinary and first-use hitch limits. All edits remain in look-owned files; no commit, push or deploy.

- Continued the existing Session 2 candidate: `client/scene-lighting.ts` centralizes three profiles, applies the existing key/hemisphere/ambient rig, grades the opaque sky before tone mapping, and grades the loaded HDR once before its existing PMREM preparation. `scene.ts` has four hook changes; `site-lighting.ts` shares the profile and reports the one-time grade duration. No per-frame bake, new texture, quality toggle or change to visibility distances.
- The initial nine lighting cases covered constant light identities/dormant flash visibility, Relay sun alignment, untouched unauthored maps, preserved fog distances, half/float HDR range and alpha, and opaque texture-free sky grading. Three later exposure/profile contract tests bring the final total to twelve; final full-suite counts appear below. Rejected intermediate gates are retained under `rejected-gates/`; `.inspect/look-session2/gates.json` and current logs cover the final build. LSP installation was previously declined; both project TypeScript checks provide diagnostics.
- Baseline correction: the old archived client bundle (`a97a0a...`) predates integration changes in this worktree. It is retained as historical evidence, not used to attribute final lighting deltas. The control builds current source with only the two look hook files loaded from HEAD, verified to override exactly those files. Control SHA `4182130043e918e488e72171e812c32097ebf8f6ac49d823c4a4c47d9be2e6ce`, 4,007,560 bytes. `baseline-build-check.json` records the subsequently rejected candidate `0be8059e47d7962bfbae430a8e1f252ea0ff3f2b1718232a8ac7597ffd1f144f` (+3,968 bytes); `bytes-final.json` and the final SHA below supersede its candidate metrics. New art assets and Meshy credits: zero.
- Aside startup recovery: no local Aside process was running, and explicit local REPL reported that the browser was stopped. Started the installed application, then used the local host. Failed startup is retained in `before-resumed.log`; no game/adapter/auth source was changed. Baselines and final captures use six matching camera views (three maps plus an actor view each), with PNGs, facts and complete transcripts. The queued old final capture was stopped before browser launch when the stale baseline was discovered.
- Comparison and acceptance run serially under the shared GPU lease. The isolated baseline bundle is served only for its capture/inspection and restored in `finally`; tracked source is never reverted. The final bot sequence is separate from the asserted hitch cohort. Remaining runner and receipts: `.inspect/look-session2/remaining-qa.mjs`, `remaining-qa.json`, `hitch-series.mjs`.
- Architecture: the lighting module has 82 nonblank/non-line-comment lines, test 63 and site-lighting 175. The inherited 2,276-line scene hub is left structurally intact as the lane explicitly requires minimal hub edits. New module owns per-site illumination, adds no input boundary/listener/resource lifetime, and introduces no assertions or dependencies. World materials, kit, UI and collision/netcode remain with their owning streams.

- Rejected candidate: the first final inspector correctly failed at `scripts/inspect-map.mjs:554` because its exposure did not match the pinned daylight contract. Further read found equivalent dusk/overcast rig pins. Added three failing profile-agreement cases (3 failed / 9 passed) before repairing the candidate: Relay keeps exposure 1.05; dusk and overcast derive their full rig fields from the existing JSONs. Sky/HDR grading and Relay key alignment remain. Prior afters/comparison and CPU gates are retained under `rejected-candidate/`, `rejected-visual-comparison.json` and `rejected-gates/`; the failure log/report remains. No gate threshold or assertion was relaxed. Fresh source gates and all after captures run on the corrected build.
- Initial independent review round: lighting_integrity REVISE for the pinned-profile conflict; lighting_visual REVISE for superseded evidence and obstructed actor2/3 cameras. Two clear 8m corridor pairs, chosen against current authoritative map boxes, replace those cameras as silhouette evidence while all original captures stay retained. New reviewers will judge the corrected full packet. Receipt: `.inspect/look-session2/review-round1.json`.
- Corrected build gates: 186 Vitest files / 1,613 tests pass (existing 7 skipped files / 9 skipped tests unchanged), 92 Node tests pass, both TypeScript checks, build and asset audit pass. Required `relay,practice-two` inspector passes with zero console/network errors. Candidate SHA is now `4f13aa076695a4cc4a32069b963b3b76ccb68efe13fb0baf90c88ebe2ac5db4a`. Corrected final images replace the archived rejected set; the final review must bind to this hash.
- Corrected Relay 1080p control → final: 38 → 38 draws, 29 → 29 programs, 18 → 18 textures, 33.681 → 33.681 estimated texture MiB, median 6.9 → 6.9ms, p99 7.1 → 7.1ms. One-time HDR grade 2.5ms; full environment preparation 276.0 → 275.9ms. Scene preparation 953.5 → 978.3ms is a single-run observation, not a causal cost estimate. Current rig is the RTX 5070 host, not iGPU qualification. Receipt: `render-summary.json`.
- Final budget: zero new art bytes/credits, JS +4,548 and source map +7,714 bytes versus the isolated current-source control. Audited deployable public bytes 52,679,396; all physical public files 61,081,438 bytes / 58.2518 MiB (94 files), below the unchanged 60 MiB ceiling. Receipt: `bytes-final.json`.
- Bot capture infrastructure failure: the first attempt timed out before room readiness and produced no fight/performance report. Port 8803 had no listener and the owned preview PID had exited; server log ends with a network-loss error, backlog warning and canceled alarm. Exit cause is not proven. Restarted only the owned preview and verified unchanged source hashes before resuming the unexecuted capture. The failed log and original server log are preserved; no gameplay or hitch failure was discarded. See `capture-debug.md`, `bot-capture.log`, `server-resume.log`, `server-recovery.log`, `finish-evidence.mjs`.
- Independent final visual QA: `lighting_integrity_final` and `lighting_visual_final` both PASS with no blockers on bundle `4f13aa076695a4cc4a32069b963b3b76ccb68efe13fb0baf90c88ebe2ac5db4a`. Each opened all eight before/after pairs and all eleven fight frames, and checked source plus comparison fields/hotspots. Receipt: `visual-review-final.json`. The original obstructed arena2/3 actor views are retained but do not support silhouette claims; the two added 8m corridor pairs do. This does not qualify all-angle visibility or incoming WW1 soldier assets.
- Wow check: all three maps have matching fixed-camera before/after images, plus eleven natural fight frames spanning 27,637ms with damage, death and respawn. Hypothetical first-time-player sentence: “The light makes these feel like three different places on the same front.” Bot frames 00–06 show controlled combat and visible impact/tracer/actor responses; frames 07–10 include the existing pause menu around death/respawn and are not uninterrupted-control evidence. All frames are valid 1920x1080 PNGs; Aside stills are 1440x900. Captures are separate from asserted performance. Receipts: `visual-comparison.json`, `readability-comparison.json`, `bot-capture.json`, `bot-image-integrity.json`.

#### Final strict acceptance

Five sequential TDM/FFA pairs pass both `--assert` and `--assert-first-use` on the unchanged final bundle `4f13aa076695a4cc4a32069b963b3b76ccb68efe13fb0baf90c88ebe2ac5db4a`. All ten retain the existing presentation/main-thread/p99/stall-share limits. Each run has two natural deaths (20 total), zero console errors, zero post-warm shader additions and 0 measured >150ms intervals. Maximum measured frame 23ms, maximum measured callback 18.2ms, p99 upper bounds 8–12ms; first-damage/death maxima 9.3/8.7ms.

First-ready times are 2605.7–3952ms. The pre-profiler observer retains **44 startup intervals above 150ms (161.2–913.9ms)**, including **20 ending at or after first-ready (190.5–913.9ms)**. These untraced gaps have no assigned cause and are not erased by the green gameplay gate. This evidence does not close the historical Switchyard FFA 2622.7ms issue or qualify laptop iGPU performance; the measured host is RTX 5070.

| Pair / mode | Max frame ms | p99 upper ms | Max callback ms | First damage / death ms | First ready ms | Startup gaps >150ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 / TDM | 10.6 | 8 | 5.6 | 7.6 / 8.5 | 3227.4 | 5 |
| 1 / FFA | 23 | 12 | 18.2 | 7.7 / 8 | 3952 | 5 |
| 2 / TDM | 10.9 | 8 | 5.8 | 7.9 / 7.9 | 2725 | 5 |
| 2 / FFA | 9.3 | 8 | 4.4 | 8 / 8.7 | 2743.2 | 3 |
| 3 / TDM | 12.6 | 8 | 7.2 | 9.1 / 8.3 | 2936.5 | 6 |
| 3 / FFA | 10.8 | 8 | 5.7 | 8.1 / 8.4 | 2605.7 | 3 |
| 4 / TDM | 12.3 | 8 | 5.2 | 9.3 / 8.4 | 2842.3 | 6 |
| 4 / FFA | 17.9 | 8 | 13.3 | 8.2 / 8.2 | 2790.3 | 3 |
| 5 / TDM | 10.1 | 8 | 4.4 | 7.9 / 8 | 3225.7 | 5 |
| 5 / FFA | 12 | 8 | 5.6 | 7.7 / 8.2 | 3015.9 | 3 |

Artifacts: `.inspect/look-session2/hitch-{1..5}-{tdm,ffa}.json`, `hitch-summary.json`, `final-metrics.json`, `visual-manifest.json` and the zero-exit `finish-evidence.json`. The driver stopped on any nonzero exit and made no gameplay retries. GPU acquisition waits are retained; no foreign process was stopped or lease bypassed. The screenshot-bearing bot run remains separate from acceptance.

#### Open owner questions and defaults

None blocks this arc. Default: preserve the authoritative dusk/overcast profile values and Relay exposure, grade the existing sky and HDR in linear radiance, retain fog visibility and all gate limits, and add zero asset bytes or paid credits. Future direct-rig/bake changes require the supervisor to route profile ownership as requested above. World/kit integration, all-angle soldier visibility and laptop iGPU certification remain future work. No commit, push or deployment.

#### Startup observation and cleanup

The largest retained startup interval is in pair 4 TDM: 913.9ms from navigation time 3279.2 to 4193.1ms. First-ready was 2842.3ms, UI preparation ended at 2828.7ms, and ordinary profiling began at 4325.7ms. It is after readiness and before the measured gate, not hidden loading time or a first-damage/death event. This run has no startup trace/GPU diagnostics, so CPU work, browser raster/driver waiting and host scheduling cannot be distinguished from this record. No cause or fix is claimed; retain it for covered startup investigation and do not describe entry as universally smooth. Source: `hitch-4-tdm.json`, `summary.preparation`.

Owned preview PID 38472 and all six descendants were identity-checked and stopped. Port 8803 has no listener, the prior preview and evidence driver exited, and own Aside tabs/REPLs are closed. Aside's shared application stays running because two other stream tabs were open; no foreign tab or process was closed. Receipts: `.inspect/look-session2/cleanup.json` and `aside-cleanup-tabs.log`. The log, hitch documentation and final source/hash checks are complete.

### Session 3 - 2026-09-23: Dust from the impact

Arc: **Dust from the impact**. Reference: R-G09, R-G20, R-L12, R-L14. Target: use existing material tags at server-confirmed endpoints for distinct wood/earth/masonry fragments and metal ricochets; a soft dust tail clears within 480ms. Keep the existing 48-particle cap, constant lights, depth testing and all performance limits. Zero art-asset bytes, paid credits or dependencies. Session 2 work is preserved; only look-owned files are edited.

- Resumed the pre-existing Session 3 baseline and red-test setup. Baseline bundle SHA `5cff4a63f6bd6e0edf46ed530b6fb8698b153c26018682865e6ced318d561d23`, 4,092,491 bytes. `baseline-source-check.json` confirms the prior source snapshot differs only in this session's main/scene/VFX files and its test. Three Aside fixed-camera baseline stills and the completed baseline Relay inspector are retained. The earlier failed fourth navigation and capture recovery remain in `debug-journal.md` and `baseline.log`.
- Material fixtures render the real Vfx implementation in Aside at exactly 20/100/300/500ms with identical random seeds; they do not enter the game bundle. Baseline fixtures all show the same orange sparks regardless of their material label. Prior isolated baseline imports are retained under `.inspect/look-session3/`.
- Three new assertions fail on the old implementation (mud/wood emission and insufficient dust diameter); seven targeted cases pass after the change. Additional invariants cover resource stability under saturation, material pigments versus player-hit response, and one-time geometry/material disposal. Existing cadence/lifetime tests remain unchanged.
- `scene-impact.ts` owns the bounded impact pool (107 nonblank/non-comment lines). It shares one sphere geometry and applies a fixed shader with per-slot softness uniforms. Particle birth/update changes only transforms, colour, blending, alpha and uniforms. No texture or render pass is added; no per-frame allocation/bake. The Vfx facade delegates birth/update/disposal, while main and scene merely carry the existing surface tag. Those compatibility facades keep their existing three arguments plus one optional typed material, avoiding changes in supervisor-owned inspector callers. The inherited large scene/main hubs are kept surgical as explicitly required by the lane; the impacted unit is extracted from Vfx rather than expanding that file.
- Diagnostics: LSP installation remains previously declined; use both project TypeScript checks. Source gates and acceptance are queued serially under the shared GPU lease. No foreign process is interrupted, and no wait bypass or threshold change is made.

#### Open owner questions and defaults

None blocks this arc. Default: surface classification reuses the current authoritative-map tags and existing concrete fallback; no collision, hit result, audio, balance or UI-flow change. Keep blood response unchanged and cosmetic dust short and translucent. Unbound future world surfaces should be tagged by the world stream, not inferred from render-material names.

#### Validation and retained failures

- Final source gates PASS on bundle `80cfe2422a745a080116c92e887b913630b34ca11de85df61acc4928d588f518`: both TypeScript projects, 192 Vitest files / 1,634 tests, 92 Node tests, build and asset audit. Existing 7 skipped files / 9 skipped cases are unchanged. The initial typecheck failure is retained in `rejected-gates/`: the new test imported the DOM-dependent Vfx facade through the server configuration. The test now exercises SceneImpact directly, while existing client Vfx tests cover delegation; neither compiler config was changed. Final pool module is 107 nonblank/non-line-comment lines.
- Required final `relay,practice-two` inspector PASS, with zero console/network errors. Relay at 1080p, baseline → final: 40 → 40 calls, 28 → 29 prepared programs, 17 → 17 textures, 141 → 94 geometries, 32.34765625 → 32.34765625 estimated texture MiB, median 6.9 → 6.9ms, p99 7.1 → 7.1ms. One custom particle shader replaces 47 duplicate geometry allocations; it is prepared by the unchanged loading path. Single-run preparation 1082.2 → 1019.3ms is not a causal speedup claim. This host is RTX 5070, not an iGPU certification.
- Seven 1440x900 before/after pairs pass PNG dimension/alpha checks. All three map images use identical cameras; their 6.12%/7.48%/9.55% diffs concentrate in the moving sky, whose source is unchanged, and are not impact-improvement evidence. The exact-age material fixture is the impact comparison: all five materials at 20/100/300/500ms. Its residual 500ms diff is confined to text-label rasterization; no impact remains. Full hotspot fields are retained in `visual-comparison.json` for independent inspection.
- Aside failures happened before navigation, with the CLI reporting multiple browser profiles for one account. An extra browser root later disappeared without intervention from this stream. A second failure followed the fixture REPL closing, while its temporary profile registration briefly overlapped. Preserved under `failed-aside-startup/`, `failed-aside-handover/` and `debug-journal.md`, with account identity redacted. Evidence-only `aside-start.mjs` makes at most six attempts, five seconds apart, only for that precise pre-navigation error; every error is recorded, other failures stop immediately. No shared adapter/auth code or foreign process was changed.
- The final natural bot capture has eleven 1920x1080 PNGs spanning **26,395ms**, two natural deaths and zero console errors. Frames 00–02 show live combat; 03–10 include the inherited pause/pointer-lock overlay across death and respawn, so this is not uninterrupted-control evidence. Every frame was opened and its PNG signature/dimensions checked (`bot-image-integrity.json`). Screenshots stay separate from asserted performance.
- Exact public-file hash delta (`asset-delta.json`): client JS **+1,982 bytes**, source map **+3,352 bytes**, art assets **0 bytes**. Physical public total **60,713,935 bytes / 57.901320 MiB**, 94 files, largest 8,025,108 bytes. The unchanged 60 MiB/25 MiB ceilings pass. Credits: zero. First-ready times and every startup gap are recorded in the final cohort below.

#### Wow check

Same-age material comparisons show the prior universal orange spark changed into brown wood/earth fragments and pale mineral dust, while metal alone retains the bright ricochet. The separate 26.4-second natural combat sequence establishes live integration and preserves its pause-overlay limitation. Hypothetical first-time-player sentence: “I can see what my bullets are hitting.” Both independent visual reviews pass. The completed five TDM/FFA pairs include a strict first-damage failure; final acceptance is blocked as detailed below.

Independent visual QA **GOOD**: `impact_integrity` and `impact_visual` both returned PASS / HIGH confidence with no blockers on bundle `80cfe2422a745a080116c92e887b913630b34ca11de85df61acc4928d588f518`, independently checking manifest hashes and opening all 25 images. Receipt: `.inspect/look-session3/visual-review.json` (both terminal reports, coverage, findings and limits). Fixture rendering keeps 36/31/16/1 calls and 1682/1442/722/2 triangles at 20/100/300/500ms, before and after; both sets report four prepared programs, zero textures and eight existing lights. Static game preparation retains one additional program for the new material, as measured above. Neither visual reviewer certifies hitch timing, all-angle readability or iGPU performance.

#### Final acceptance: BLOCKED, not green

The final candidate remains SHA `80cfe2422a745a080116c92e887b913630b34ca11de85df61acc4928d588f518`. All ten ordinary `--assert` gates pass, but only nine of ten `--assert-first-use` gates pass. **Pair 5 FFA fails first damage at 251.2ms against the unchanged 150ms limit.** Its first death passes at 11.2ms. No failed gameplay run was retried; no threshold or assertion changed. This session does not satisfy the standing brief's green completion requirement and is not ready for acceptance. Source gates, inspector and both visual reviews remain passing as recorded above.

| Pair / mode | Ordinary | Max frame ms | p99 upper ms | Max callback ms | First damage / death ms | First ready ms | Startup gaps >150ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 / TDM | PASS | 14.4 | 9 | 10.7 | 9.5 PASS / 10 PASS | 2982.3 | 5 |
| 1 / FFA | PASS | 13.2 | 9 | 8.2 | 10.2 PASS / 10.6 PASS | 3244.9 | 3 |
| 2 / TDM | PASS | 14.9 | 9 | 10.2 | 9.6 PASS / 9.2 PASS | 2806.2 | 6 |
| 2 / FFA | PASS | 474.8 | 9 | 8.4 | 8.8 PASS / 9.8 PASS | 3118.4 | 4 |
| 3 / TDM | PASS | 14.6 | 9 | 8.2 | 11.6 PASS / 10.7 PASS | 2966 | 6 |
| 3 / FFA | PASS | 12.4 | 9 | 7 | 8.7 PASS / 8.8 PASS | 2984 | 3 |
| 4 / TDM | PASS | 14.4 | 9 | 8.3 | 9.4 PASS / 9.4 PASS | 2913 | 4 |
| 4 / FFA | PASS | 12.5 | 10 | 7.1 | 11.3 PASS / 10.8 PASS | 2967 | 3 |
| 5 / TDM | PASS | 12.7 | 9 | 7.7 | 11.2 PASS / 8.2 PASS | 2895.7 | 5 |
| 5 / FFA | PASS | 837.9 | 10 | 6.7 | 251.2 FAIL / 11.2 PASS | 3005.1 | 4 |

The cohort records 20 natural deaths, zero console errors and zero post-warm shader additions. It retains **43 startup intervals above 150ms**, 156.1–1040.5ms, including **18 ending at/after first ready**. First-ready range 2806.2–3244.9ms. Full startup observations stay in each report and `hitch-summary.json`; none is excluded from the evidence.

Pair 5's failed first-damage interval ends at navigation 3630.5ms and starts at 3379.3ms: after first ready at 3005.1ms, before the ordinary profiler starts at 4254.3ms. Separately, measured presentation gaps are **474.8ms in pair 2 FFA** and **837.9ms in pair 5 FFA**. Both occur alive after respawn, with no long tasks or shader additions; CPU samples are predominantly idle (448/459 and 809/817). Their ordinary gates pass under the existing 1500ms presentation limit and 5% stall-share rule. These are retained problems, not smoothness claims. The original three intervals have no covered GPU trace, so their causes remain unassigned.

A single separate same-build startup diagnostic used `--trace-startup --gpu-diagnostics --diagnostic-timing --stop-on-spike`, with a 1000ms measured window and no acceptance assertions. It captured four covered startup gaps (290.6, 158.3, 235.4, 1381.5ms), not the original first-damage failure. The largest spans navigation 2718.9–4100.4ms, after first ready 2229.6ms and before profiler origin 4719ms. Its renderer BeginMainFrame spends 1378.689ms wall / 14.529ms CPU; GetProgramiv waits 1128.603ms wall / 1.161ms CPU, an ANGLE worker spans 1121.159ms wall / 330.110ms CPU, and GetShaderiv waits 228.247ms wall / 0.033ms CPU. This establishes a WebGL program/shader wait in that diagnostic interval, not its game material identity, not a driver defect and not the cause of the untraced acceptance failure. Concurrent host tasks are correlation only. The short diagnostic has no natural first damage/death and cannot count as an acceptance pass.

Evidence: `qa.json`, `hitch-{1..5}-{tdm,ffa}.json`, `hitch-summary.json`, `first-use-failure-context.json`, `spike-diagnostic.json`, `spike-diagnostic-trace.json`, `spike-diagnostic-trace-summary.json`, `diagnostic-outcomes.json`. The earlier queued measured-only diagnostic was stopped before browser launch after the failure located the relevant interval before profiling; its prelaunch log is retained. Only owned processes were touched. No speculative production fix was made without a covered causal link. Next look work must identify the program/material and first-use call path in a covered natural-fight trace, fix the confirmed cause within ownership, then run a fresh complete five-pair strict cohort. The historical Switchyard 2622.7ms issue remains open.

#### Session cleanup

Identity-checked owned preview PID 40100 and its six descendants, plus fixture-server PID 44228, were stopped. Port 8803 has no listener; own Aside tabs/REPLs closed and the shared application remains available to other streams. Receipt: `.inspect/look-session3/cleanup.json`. Final bundle hash is unchanged; no commit, push or deployment. The session ends with strict acceptance blocked as explicitly recorded above.
