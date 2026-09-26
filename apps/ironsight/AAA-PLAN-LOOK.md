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

- **Session 7 / supervisor: Undertow and Switchyard fog and exposure.** `scripts/inspect-map.mjs:543-554` pins exposure, key, sun, fill, fog colour and fog near/far to `client/undertow-dusk.json` and `client/switchyard-overcast.json`, which are not in look's allowlist. Session 7 got its dusk and overcast looks from the grade, the sky shader and shadow strength instead. Please either assign look these two JSONs or apply: Switchyard `fogColor` `#9aa69c` (grey-green) and `fogFar` 340→230, keeping `fogNear` ≥90 for the combat-range rule, which gives haze in depth; Undertow `fogColor` `#a08a78` (warm dusk haze). `public/assets/README.md:33` also still lists `industrial-daylight.hdr` at 41,273 bytes. It is now 31,919 bytes after the Session 7 re-bake with the new sun (same tool). That line sits outside look's append-only block.

- **Session 8 / world + supervisor: impact surface kinds.** Impacts are picked from `MapSurface` (`src/map/materials.ts`: mud, gravel, wood, metal, concrete). No WW1 surface reports `brick` or `sandbag`, and brick walls arrive as `concrete`. The sandbag parapets I could locate are either exterior dressing (Relay fieldworks, z < 0, never hit) or `fieldKitPlacement('sandbag')` on Undertow boxes, which `arena2.ts` classifies as wood or concrete by height. Look already renders `brick` and `sandbag` (`client/scene-impact.ts` `ImpactKind`) and maps `concrete` to brick on Relay and Undertow. Request: add `"brick"` and `"sandbag"` to `MAP_SURFACES` (supervisor-owned `src/map/materials.ts`), then classify in `src/map/arena{1,2,3}.ts` (world): masonry walls → `brick`, sandbag parapet and cover boxes → `sandbag`, corrugated sheds → `metal`. After that, look deletes the `concrete`→brick site mapping; no other change is needed.

- **Session 9 / world: Undertow wet patches.** Look's reflection change (reflection saturation 0.85→0.5, luminance ceiling 0.45 in the graded dusk HDR) makes the puddles pale and cool from the aerial instead of gold. If the owner still reads them as coins, the remaining lever is the puddle material (world-owned): raise its roughness from mirror-like to about 0.35–0.45 and lower its envMapIntensity toward 0.6, so it catches the sky as a sheen rather than a hard disc. Look did not edit world files.

- **Session 17 / kit + supervisor: texture count in live rounds.** Live bot rounds hold 34–40 renderer textures against the 32 budget (TDM 35, DOM 40, FFA 34). The same maps offline without actors hold 20–26. The ~14 extra arrive with the soldiers: per-skeleton bone DataTextures plus soldier maps. Requests:
  - (kit) share or pool bone textures across calibrated actors, or confirm they are released with each rig;
  - (supervisor) decide whether the 32-texture budget counts tiny bone DataTextures; the byte budget is the meaningful one.
  - Also (kit): the legacy Synty `PolygonScifi_01_A` weapon atlas is 2048² (21.3 MiB with mips), the largest single texture on every map. A 1024² downscale saves ~16 MiB if the finish still reads.

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

### Session 4 - 2026-09-23: The rifle comes back

Task: the first-person weapon rendered as the procedural blue/purple box (owner playtest; kit request "Supervisor/look: normal FP loader").

Root cause (verified): `SceneRig.setWeaponVisual` refused every loaded model unless `resolveWeaponContractRoot(obj, key)` found the WW1 contract root and `WeaponPresentation.sockets` resolved. The normal `weaponSource` selects legacy `field-carbine` / `wep_*` nodes that predate the contract, so all five slots stayed on `buildWeaponMesh` and `inspectViewmodel` never reported ready. Reproduced on the unchanged build: `.inspect/look-r1/before-wall-{1..5}-{hip,ads}-before.png` show the box for every slot.

Change:
- New `client/scene-weapon.ts` `viewmodelWeaponPresentation(obj, key, candidatePreview)`: returns the contract presentation when its sockets resolve; otherwise `undefined` (reject) for `?weapon-candidates=1` previews, `null` (load, no presentation) for legacy nodes. The existing source-muzzle / eject fallback branches in `setWeaponVisual` now run again for legacy nodes.
- `client/scene.ts`: the single call site uses it (net -1 line). The one FP load path, so gameplay, the inspector and preparation all route through it.
- `test/scene-weapon.test.ts`: legacy node accepted with `null`; candidate without the contract (absent or partial) refused; full contract kept in both modes. Fails on the old unconditional rejection (1 failed / 1 passed verified by temporarily restoring it).

Evidence (`.inspect/look-r1/`): `before-*` vs `after-wall-{1..5}-{hip,ads}-{before,fired}.png` and `after-wall-*-reload.png` (viewmodel-play, real shots); `after-weapon-{ar,smg,shotgun,sniper,pistol}-{hip,ads}.png` (all ten inspector shots completed; they hung before); `contact-sheet.png`, `inspector-sheet.png`; `after-report.json`, zero console errors. viewmodel-play asserts source-muzzle error <=1e-6, tracer endpoint within 1px of the crosshair and casing separated from the muzzle for all ten hip/ADS shots: pass; flash and brass visibly leave the real muzzle/ejection side in the `-fired` stills.

Deltas: client.js +234 bytes (4,103,792 -> 4,104,026); art assets 0 bytes; lights unchanged (no new lights, passes or textures). Relay inspector 37 calls / 17 textures. viewmodel-play scene: 43 -> 44 calls, 28 -> 29 textures, 32 -> 34 programs (real weapon materials replacing the box).

Gates: typecheck pass; vitest 201 files / 1668 tests pass (7 files / 9 tests skipped, pre-existing), node --test 92/92; build:client pass; audit:assets exit 0 (publicBytes 47,360,772); inspect-map relay,practice-two exit 0, zero console errors (`.inspect/look-r1-report.json`); hitch-probe `--assert` PASS, 2 deaths, 0 recompiles, 0 frames >150ms (`.inspect/look-r1-hitch.json`), run on RTX 5070, not iGPU proof.

Open: Task 2 (gap item 1, strict first-use shader wait) not started this session. The ADS legacy rifle still uses the look-era `rifleSight` reflex dot on `field-carbine`; whether WW1 wants iron sights only is a kit/owner call. The WW1 candidate path itself was only unit-tested here, not visually previewed.

Cleanup: own wrangler/workerd/esbuild processes stopped; port 8803 has no listener. No commit, push or deploy.

### Session 5 - 2026-09-23: First use after the real rifles, and dust in the air

**1. Measured first use after round 1 (no stall to fix).** Added `--first-actions` to `scripts/hitch-probe.mjs`. After the 3s warm-up it swaps to slots 2, 3, 4 and 5, then back to 1, fires once and reloads. It checks each action with the existing 150ms first-use window, and `firstUseWindows` now takes a kinds list. Documented in `docs/HITCH-GATE.md`. Each run uses a fresh Edge profile.
- Round 1 build (d5774b7), before any change this session: `baseline-{tdm,ffa}.json` both pass `--assert --assert-first-use`. First swaps are 8.7-50.4ms, first shot 9.3-16.6ms, first reload 12-19.7ms, first damage and death 8.7-10.6ms, **0 post-warm-up shader additions**. Preparation already compiles every weapon: the preparation fixture is gated on `weaponIsModel`, which round 1 made true, and it uses the same `finishLegacyWeapon` materials as first person. No fix was warranted, so no threshold changed.
- The coordinator's c969f60 case (d5774b7 plus ui HUD strings): I built the exact c969f60 client (bundle `a7f7340e3f66`) and interleaved it with the current build (`2d6a64dbd8dc`), 3 TDM runs each with first actions. Every run has exactly one >150ms interval: c969 445/186/233ms, current 156/425/253ms. None falls near a first action or first-use event, all 42 first-action windows are ≤77ms, and every run has 0 recompiles. In 5 of 6 the CPU profile is idle during the gap. Host CPU (typeperf, `cpu-series.csv`) averaged 62-91% per run with 95-100% peaks from other lanes. Both builds show the same gap at the same rate. **Verdict: environmental contention on this shared host, not a first-use stall.** No quiet window was available to prove the gap disappears.

**2. Next visual gap: airborne dust (ART-CONCEPT "dust motes").** Added `client/scene-dust-motes.ts`: one unlit `Points` draw per map with no texture, no light and no depthWrite, 800/520/600 motes (Relay/Undertow/Switchyard). They wrap around the eye in the vertex shader, and the only CPU work per frame is two uniform writes. The wind drift freezes under reduced motion, same as the sky weather. `scene.ts` changes by +6 lines. Added `test/scene-dust-motes.test.ts` (5 tests). Stills from the same fixed cameras: `.inspect/look-r2/{before,after3}-{relay,undertow-home}.png`, `pair-*.png`, `crop-relay.png`. The effect is deliberately subtle: 776 and 341 pixels change. `switchyard-center` could not be captured because of the known supervisor inspector assertion at inspect-map.mjs:609 (switchyard-transformer.glb). Relay inspector: 37→38 draw calls, 28→29 programs, 17→17 textures, 16→16 lights, median 6.9→7.0ms. p99 went 7.1→20.9ms on the loaded host; I did not verify whether that is contention or cost. client.js is +3,025 bytes against round 1 and art assets +0.

**Gates.** typecheck pass. vitest 202 files / 1673 tests pass, plus node 92/92. build:client pass. audit:assets exit 0 (47,369,216 public bytes). inspect-map relay,practice-two exit 0 with 0 console errors. `hitch-probe --assert`: the first run **FAILED** on main-thread stall (410.7ms idle gap, `look-r2-hitch.json`). The rerun PASSED (`look-r2-hitch-rerun.json`). Before the interleaved series, 7 of the 8 strict first-action runs (`final*`, `ab-*`, `final2-*`, both builds, with and without dust) failed on sustained frame pacing or a main-thread stall. The later `series-*` passed 5 of 6. None of these failures was in a first-action window. These are recorded as failures, not green.

**Open.** Repeat the dust A/B and the strict cohort when other lanes are not building, to settle the p99 question and close the environmental verdict. Switchyard stills need the inspector assertion fix (existing cross-stream request).

### Session 6 - 2026-09-23: Three times of day

**Per-map light and grade.**
- `client/scene-lighting.ts`: new `installSiteGrade`. It swaps the renderer to `CustomToneMapping`, and the custom function runs a per-site grade (saturation, shadow/highlight split tone, contrast about 0.18 grey) and then the same ACES curve. This happens inside the existing tone-mapping step of every material, so there are no new passes, textures, uniforms or lights. Each page holds one site, so the grade is baked in as constants before the first compile. Sites without a profile keep plain ACES.
- Relay (hard noon): key 3.1→4.2, warmer `#ffe4b8`, hemisphere 0.92→0.52, ambient 0.12→0.07, darker ground bounce, contrast 1.32, amber highlights and cool shade. The sun direction is unchanged because a test ties it to the reflection bake.
- Undertow (low dusk): contrast 1.12, blue shade `[0.84, 0.92, 1.14]` against amber highlights `[1.14, 0.98, 0.8]`, bluer ambient.
- Switchyard (flat overcast): contrast 0.88, saturation 0.72, faint cold cast.
- The dusk/overcast rig fields the supervisor's inspector pins (exposure, key, sun, fill, fog) are untouched.
- `client/scene.ts`: +1 line. `test/scene-lighting.test.ts`: +1 test (three distinct grades; an unauthored site restores ACES and the original chunk).

**Evidence (`.inspect/look-r3/`).**
- `maps-before-after.png`: Relay, Undertow and Switchyard from fixed inspector cameras. That sheet shows the first Relay pass; `relay-before-after2.png` shows the final Relay values.
- The Switchyard still is `*-sy-failure.png`, captured at the known `switchyard-transformer.glb` inspector assertion after the frame was ready.
- Enemy readability: the inspector's actor review paths (`review-enemy`, `glint-near`) never reach readiness on this tree (calibrated actors; kit/supervisor area, not investigated). Instead `bot30.mjs` joins a live TDM/DOM/FFA room, walks the nav route and aims at the first enemy bot 24–38 m away with a clear line. Crops are in `bot30-before-after-zoom.png` and `relay-before-after2.png`. The team colour and silhouette read at 25–38 m on all three maps after the change. The final Relay bot is seen through a window.

**Deltas.** Relay inspector: 37/28/17/16 (draws/programs/textures/lights), median 6.9ms, p99 7.1ms, same as round 1. client.js +1,561 bytes; art assets +0.

**Vfx teardown bug (ui-lane report).** Cause: `main.ts` disposed the scene on `beforeunload`, which can be cancelled, and the page and the room socket keep running until the document is really gone. A shot arriving in that window reached `Vfx.spawnCasing` with an empty pool. Harness navigations between runs trigger this. Fix: the early handler now uses `pagehide`, and `Vfx.spawnCasing`/`spawnMuzzleFlash`/`spawnImpact` return early after dispose, because a queued message can still land during real teardown. New test in `test/impact-vfx.test.ts` fails on the old `vfx.ts` (TypeError) and passes now. Not replayed in a live bot room.

**Gates.** typecheck exit 0; vitest 201 files / 1670 tests pass (7/9 skipped, pre-existing) plus node 92/92; build:client pass; audit:assets exit 0 (47,365,336); inspect-map relay,practice-two exit 0 with 0 console errors; hitch-probe `--assert` PASS (advisory under the new rule), 2 deaths, 0 recompiles, 0 frames >150ms.

**Open.** "Wet response" on Switchyard needs world-material roughness/env work (world lane). The coordinator's dust-motes stash@{0} is untouched.

### Session 7 - 2026-09-23: Noon, dusk and cloud

Round 3's grade was too subtle, so this pass uses sky, sun, shadow strength and grade together. Light count is still 16, with no new pass, texture or per-frame work.
- **Relay, hard noon:** sun lowered from about 57° to 30° elevation for long cast shadows. I re-baked `public/assets/industrial-daylight.hdr` with `tools/bake-environment.py` using the same direction. The old sun reproduces the committed HDR byte-for-byte (`368132bb…`), so the tool is trustworthy. Key 4.2→5.6, whiter `#fff0d8`. Clear sky (horizon `#d6d4c6`, zenith `#4e7496`) plus a sky-shader sun bloom, fog `#cdd0c8`, grade contrast 1.38. The fill stays at 0.52 because the existing lighting test sets a floor at 0.5.
- **Undertow, dusk:** a bright amber band low on the horizon, strongest toward the sun and at 40% elsewhere, plus a sun glow in the sky shader. Sky saturation 0.60→0.85. Grade contrast 1.34 with deep blue shade and strong amber highlights, so lit faces rake warm and the trench floor and interiors go dark.
- **Switchyard, overcast:** key shadow intensity 0.18 (`LightShadow.intensity`, a uniform), grade contrast 0.72, saturation 0.75, grey-green tint. I tried saturation 0.45 first and dropped it, because it washed the FFA bot's torso colour out.
- The shared grade now splits shade and light at luma 0.01–0.22 instead of 0.02–0.6, so lit surfaces keep their warmth.

Evidence (`.inspect/look-r4/`): `maps-before-after.png` compares round 3 with this round from the same fixed cameras, with Switchyard's final values in `sy-final.png`. `maps-r2-r3-r4.png` covers the first pass across rounds. `bot30-before-after-zoom.png` and `ffa-final-zoom.png` show enemy bots at 25–38 m: TDM red in a window, DOM blue in the dusk lane, FFA orange-tan at 32.8 m. All stay readable.

Deltas: Relay inspector 37/28/17/16 (draws/programs/textures/lights), p99 7ms. HDR −9,354 bytes. client.js +1,898 bytes against round 3.

Gates: typecheck exit 0; vitest 201 files / 1670 tests plus node 92/92 pass; build:client pass; audit:assets exit 0 (47,360,745 public bytes); inspect-map relay,practice-two exit 0 with 0 console errors; hitch-probe `--assert` PASS (advisory), 2 deaths, 0 recompiles, 0 frames >150ms.

Open: haze in depth and dusk fog colour need the pinned JSONs (cross-stream request above). The Switchyard still is the inspector failure capture (known transformer assertion).

### Session 8 - 2026-09-23: Every hit says what it hit

Surface-specific impacts, still pooled: 48 impact slots (seven particles per hit on every surface) plus a new 12-slot muzzle-dust pool. No lights, passes or textures added; one shader program (`pooled-impact-soft-edge-v2`).
- `client/scene-impact.ts` is now table-driven. Mud throws dark clods up and back plus a heavy brown cloud. Wood throws long pale splinters. Sandbag gives grit and a big pale burlap puff. Brick gives brown chips and an orange-brown cloud; I moved it off red after a first pass read like a blood hit. Metal (corrugated iron) gives a white-hot contact, long sparks and a hollow ring (negative softness in the same shader). Concrete and gravel are unchanged.
- Muzzle-blast dust: a low, faint puff (≤0.45 m tall, opacity ≤0.24) on the ground 0.6 m ahead of every remote shooter, via `Vfx.spawnMuzzleFlash` → `floorAt`. It marks the shooter; it cannot hide a torso or act as cover.
- Reduced motion: contact plus still dust only, no flying debris or ring, no foot dust. Synced from `SceneRig.render`.
- Masonry reads as brick on Relay and Undertow and stays concrete on Switchyard (`Vfx` option `site`). Real `brick` and `sandbag` classification is a cross-stream request above.
- Tests (`test/scene-impact.test.ts`): three new cases (brick masonry, seven particles plus reduced-motion stillness per surface, muzzle-dust height/opacity/pool bounds). Two existing cases were updated to the new design (metal additive 4→6, residual 3→1; pigment test now covers seven kinds and waits for the 700 ms sandbag tail). `impact-vfx.test.ts` is unchanged and passes, because the concrete profile reproduces the old behaviour exactly.

Evidence (`.inspect/look-r5/`):
- `surfaces-before-after.png` and `surfaces-45ms-zoom.png`: seven hits on one Relay wall at fixed ages of 45, 160 and 420 ms, with the old `SceneImpact` against the new one. Brick and sandbag show as concrete in "before" because that is what the game sends today. Harness: `lineup.ts` and `lineup.mjs`.
- `bot-round-sheet.png` and `bot-round-fight-*.png`: 11 frames over 25 s of a TDM bot round with no errors.

Deltas: Relay inspector 37/28/17/16 (draws/programs/textures/lights), p99 7 ms. client.js +4,713 bytes. Art assets 0.

Gates: typecheck exit 0. vitest 201 files / 1673 tests plus node 92/92 pass. build:client pass. audit:assets exit 0 (47,375,351). inspect-map relay,practice-two exit 0 with 0 console errors. hitch-probe `--assert` PASS (advisory), 2 deaths, 0 recompiles, 0 frames >150 ms.

Open: impacts are small at combat range (unchanged particle scale); the bot-round stills catch few hits in flight at 2 s intervals. Metal's ring is thin at distance.

### Session 9 - 2026-09-23: Dusk you can see in

Merged `recovery/ironsight-ww1-20260912` (world trench conversion + supervisor fog `#a08a78`) first. Undertow's pinned fields (exposure, key, fill, ambient intensity, hemisphere colours, fog) are untouched; the existing contract test caught one attempt to lighten the hemisphere ground colour and I reverted it.
- Cause of the murk was look's own round-4 grade: contrast 1.34 about 0.18 plus a 0.7 blue shade multiplier crushed everything below mid-grey. It is now contrast 1.06, shade tint `[0.9, 0.96, 1.12]`, highlights `[1.22, 1, 0.74]`, and a new shade lift of 0.014 (linear, blue-tinted, only below luma 0.2). Ambient colour `#4e5f80`→`#8c9abb`, same intensity.
- Sky: the amber band and sun glow are kept but about 35–40% dimmer, so the horizon no longer out-shouts the ground.
- Reflections: `gradeSiteEnvironment` takes an optional `environmentSaturation` 0.5 and `environmentCeiling` 0.45 (Undertow only), so wet ground mirrors a dim dusk.

Luminance, Rec.709 luma 0–255, median/p10 of the player-height band (`luminance.json`, `measure.py`):

| Camera | Before | After |
|---|---|---|
| undertow-home | 27.2 / 7.8 | 57.7 / 36.3 |
| undertow-center | 12.5 / 0.1 | 42.1 / 21.6 |
| undertow-channel-lower (trench) | 0.9 / 0.0 | 23.6 / 18.6 |
| undertow-maintenance | 23.6 / 0.8 | 54.3 / 22.9 |
| undertow-overview (aerial) | 24.7 / 4.1 | 52.1 / 30.0 |

Enemy bots in live DOM rounds (Weber contrast of the chest core against a surrounding ring): before 12.1 m 0.02 (blue soldier on a black wall, effectively invisible), 31.3 m 0.52; after 16.9 m 1.02, 26.8 m 0.30 (partly behind cover). The bots stand in different places each run, so these are samples, not a controlled pair. No sampled bot stood in the trench; the trench readability evidence is the channel-lower still.

Evidence (`.inspect/look-r6/`): `undertow-before-after.png` (four player-height cameras plus the aerial), `bots-before-after.png`, `before-*`/`after-*` stills and bot frames, and the harness files `capture.sh`, `bot.mjs`, `measure.py`.

Gates: typecheck exit 0. vitest 203 files / 1679 tests plus node 92/92 pass. build:client pass. audit:assets exit 0 (48,805,493 public bytes, merge included). inspect-map relay,practice-two exit 0 with 0 console errors, so Undertow's pinned rig still matches its JSON. hitch-probe `--assert` FAILED on sustained frame pacing only, with 0 recompiles, 0 frames >150 ms, 2 deaths and 0 errors. Recorded as advisory per the shared-machine rule, not rerun.

Open: a controlled enemy-contrast pair needs a fixed-position actor fixture. The inspector's review-enemy path does not reach readiness on this tree (see Session 6).

### Session 10 - 2026-09-23: The war beyond the wall

The far front lives in the sky shader: `client/scene-sky-weather.ts` gains a `frontLine()` pass inside the existing `frontWeather()`. It adds no lights (still 16), no geometry, textures or passes, and the only per-frame CPU work is two uniforms.
- Each map gets one horizon sector (bearing ± ≤0.35 rad). Effects sit about 7–25° above the horizon, just over the far skyline; lower, the buildings hid them. They fade in and out at the band edges.
- Four guns fire on staggered 2.3–6.4 s cycles. Each shot is a warm glow under the cloud base with a double flicker: 90 ms decay, second pulse at 140 ms. Flash colour peaks below 1.0 in linear radiance, dimmer than the combat muzzle sprite, which is untonemapped.
- **Relay (day):** dark dust bursts rise and spread off the horizon; the day flash is faint.
- **Undertow (dusk):** stronger amber flashes plus two slow star-shell arcs on 9 s and 12.7 s cycles, with a pale core and halo.
- **Switchyard (overcast):** broad, muffled glows inside the cloud deck.
- Reduced motion switches all of it off (`frontMotion` uniform). Static plumes and haze stay.
- Bug caught while tuning: GLSL `pow()` is undefined for negative bases, which silently zeroed the flashes. I replaced it with explicit squares.

Evidence (`.inspect/look-r7/`):
- `stills-before-after.png`: fixed eye-level cameras toward each front, with a before frame, an after quiet frame and an after flash frame.
- `flicker-arena{1,2,3}.gif`: 41 frames at 100 ms of simulated time, 20.0–24.0 s.
- `seq/`: raw frames. Harness: `sky.ts`/`sky.mjs` renders in fixed 50 ms ticks so before and after share the clock.
- One-sentence player read (Undertow): "There's a battle going on over there — you can see the guns and the flares."

Gates: typecheck exit 0; vitest 203 files / 1682 tests plus node 92/92 pass (new far-front test); build:client pass; audit:assets exit 0 (48,814,925); inspect-map relay,practice-two exit 0 with 0 console errors, Relay 37/28/17/16, p99 7.1 ms; hitch-probe `--assert` PASS (advisory), 2 deaths, 0 recompiles, 0 frames >150 ms. client.js +4155 bytes; art assets 0.

Open: Switchyard's flashes are deliberately muffled and read mostly in motion (GIF), not in a still. No rumble sync; audio is outside the lane. Each sector is one fixed bearing per map, so a player facing away never sees it.

### Session 11 - 2026-09-23: Weight in the camera, room for the hand

Merged `recovery/ironsight-ww1-20260912` (140c116) first.

**1. Shotgun firing hand (kit request).** I copied kit's tools into `.inspect/look-r8/` (`measure.ts` from kit-r2, `travel.ts` from kit-r4, with the shotgun travel parameterised; kit's tree untouched) and swept x and y travel (`grid.ts`, 49 reload samples each).
- Shortening the −0.32 sideways travel does not help: x 0.24→0.36 leaves the mag-in overlap at 6.1–8.6 mm.
- The cause is the 4 cm downward travel (y 0.04), which drops the shell part into the firing hand.
- Fix in `client/scene.ts`: shotgun y travel 0.04 → 0, x unchanged. Firing-hand worst over the whole reload goes 6.4 mm @0.58 → 2.4 mm @0.21, within kit's own ~2.8 mm noise band. Other slots are unchanged (`travel-after-all.json`). The support hand stays 18.4 mm (kit's open item, not this part).
- Close-ups through the production weapon inspector: `shotgun-closeups.png` (mag-in 0.58 and mag-out 0.40, before/after).

**2. Camera weight.** Inventory of what already existed:
- viewmodel walk bob, sway and breath (`config/visuals.ts` MOTION);
- a camera landing dip of 5.5 cm, translation only;
- blast trauma, a ≤2° camera roll about the view axis, so the aim ray and crosshair stay put.

All three are disabled by reduced motion. Added only what was missing:
- **Lens dirt** (`client/scene-lens-dirt.ts`): one clip-space quad, camera child, drawn in the normal pass. It has no texture, is visible only while blast trauma is above about 0.05 (so gone within 2 s), and uses fine grit plus a faint smear masked to the screen rim. The centre stays clear, so it cannot cover the crosshair or an enemy in front of it. It follows the existing trauma, which reduced motion and the blast-feedback setting already hold at zero, with an explicit reduced-motion guard as well. It is compiled by `prepare()` (+1 prepared program), so there is no first-use stall. No DOM overlay, so no compositor request.
- **Heavier landing** on the viewmodel only: the weapon drops 2.5–10 cm, scaled by time in the air, and nods down 1.4 rad per metre of drop, decaying with a 170 ms time constant. The camera dip stays at 5.5 cm, so the aim ray gets no extra motion.
- Tests: `test/scene-lens-dirt.test.ts`, plus a landing case in `test/blast-trauma.test.ts`, which is the existing DOM-typed SceneRig test file.

Evidence (`.inspect/look-r8/`):
- `blast-before-after.png` and `land-before-after.png`: before/after sequences at +0–2400 ms, fixed camera, fixed 16 ms ticks (`weight.ts`/`weight.mjs`).
- `seq/`: raw frames.
- The harness blast shows no explosion sprite; only trauma, roll and dirt are exercised.

Deltas: Relay inspector 37 draws / 29 programs (+1 prepared lens-dirt program, not drawn in normal play) / 17 textures / 16 lights, p99 7.1 ms. client.js +2,446 bytes. Art assets 0.

Gates: typecheck exit 0; vitest 204 files / 1686 tests plus node 92/92 pass; build:client pass; audit:assets exit 0 (48,842,624); inspect-map relay,practice-two exit 0 with 0 console errors; hitch-probe `--assert` PASS (advisory), 2 deaths, 0 recompiles, 0 frames >150 ms.

Incident (resolved): a mistyped `git stash push` did nothing, and the following `git stash pop` tried to apply the coordinator's dust-motes stash. Git aborted on the tracked file but had already written the stash's two untracked files. I confirmed both were byte-identical to `stash@{0}^3` and deleted them. `stash@{0}` is intact and the tree matches the pre-mishap state. The gate runs happened before this.

Open: no live gameplay capture of a real mortar blast; the harness exercises the same SceneRig path. The landing drop is tuned by eye.

### Session 12 - 2026-09-23: Walnut and blued steel

Finish-only pass under this round's grant: `client/equipment-finish.ts` (material assignment through the existing `finishLegacyWeapon` hook in `weapon-loader.ts`, which is unchanged). No geometry, sockets, transforms, sights or animation touched.
- Each shipped weapon is a single mesh with one material: the field carbine has its own baked atlas plus a metallic-roughness map; the four `wep_*` nodes share the Synty palette atlas. So wood cannot come from material names. I drew side profiles of each mesh (`.inspect/look-r9/profiles.png`, via `profile.ts`) and wrote wood zones in mesh-local coordinates. That space survives the reload-part split, which keeps the same vertex positions.
- Wood mapping (logged in code):

| Weapon | Wood zone |
|---|---|
| field-carbine | buttstock z<−0.12, wrist/grip, handguard 0.14<z<0.56 under the barrel |
| wep_smg | buttstock, rear grip, front grip |
| wep_shotgun | buttstock, pistol grip, pump fore-end |
| wep_sniper | stock including thumbhole, fore-end |
| wep_pistol | grip panels |

  Everything else, including magazines and sights on the mesh, is steel.
- Finish: oiled walnut (dark brown, fine grain along the stock that fades at distance, roughness 0.52–0.64, non-metal) and blued steel (blue-black, worn brighter edges from a scuff field, roughness 0.34–0.5, metalness 0.62). Source panel shading is kept as relief only, so the grey-blue plastic colour is gone.
- The field carbine now takes the finish too; before, it kept its raw grey-blue material.
- One shader program for all five: the zone is a per-material uniform, so there is no program-count change; Relay stays at 29. Remote third-person weapons share the same finish through `remoteWeaponTemplate`. Bots at 29.8 m (TDM) and 32.7 m (DOM) stay readable (`bot30-zoom.png`); weapon detail is not resolvable at that range.
- Test: `test/equipment-finish.test.ts` updated for the intended change. Weapons now have separate materials sharing one program key, and the carbine is finished with its own maps kept. Held views still share one material; the source is never mutated.

Evidence (`.inspect/look-r9/`): `weapons-arena1.png` and `weapons-arena2.png` (all five weapons, hip and ADS, before/after, Relay and Undertow; harness `fp.ts`/`fp.mjs`). The production weapon inspector also passed five FP shots in the gate run.

Deltas: Relay 37/29/17/16 (draws/programs/textures/lights), p99 7.1 ms. client.js +3,879 bytes. Art assets 0.

Gates: typecheck exit 0. vitest 204 files / 1686 tests plus node 92/92 pass. build:client pass. audit:assets exit 0 (48,852,141). inspect-map relay,practice-two plus five weapon shots exit 0 with 0 console errors. hitch-probe `--assert` PASS (advisory), 2 deaths, 0 recompiles, 0 frames >150 ms.

Open:
- No brass: none of the meshes has a separable brass part in mesh-local space, and the shotgun shell is steel.
- The boxy ghost-ring sight on the carbine is kit's `rifleSight` (`client/rifle-*.ts`) geometry and material, outside this grant. Request for kit: WW1 blade front sight and open-notch rear. Sight readability was checked by eye across 20 ADS stills; the dark steel posts silhouette against sky and walls.
- The old `'weapon'` branch of `equipmentFinish` is now unused (left for a separate cleanup, not deleted in this pass).

### Session 13 - 2026-09-23: Blade in the notch

The carbine's box aperture is **baked into the GLB** (`field-body`), but it is three separate connected parts (two uprights and a top bar, 44 triangles each) sitting on a separate base plate (`.inspect/look-r9/components.ts`). It can therefore be removed at load without editing the asset, using the same per-view index-subset pattern `splitRifleMagazine` already uses. The GLB and the cached source geometry are untouched.
- `client/rifle-sight.ts` (granted this round):
  - `stripIssuedSightHousing` drops those three parts from a per-view copy of the body index.
  - `issuedIronSights` builds period sights in the carbine's mesh space: a rear leaf on the kept base plate with a U-notch, and a front barrel band with a thin blade 5 mm ahead of the muzzle. It uses the body's own service-finish material.
  - Sight line `ISSUED_SIGHT_LINE_Y` = 0.060 mesh-m through the bore's x, clear of the handguard (top 0.039). Centre hold: the blade tip sits flush with the tops of the notch shoulders.
- `client/scene.ts`: the issued-carbine branch now strips, adds the sights to the model and sets `sightHeight` from the sight line. A diagnostic marker at the blade tip keeps `sightScreen` reporting. The non-issued branch and every other weapon are unchanged.
- The remote (third-person) carbine keeps the baked aperture; that was out of scope.

Alignment evidence:
- At ADS on sky, brick and dark mud, the front blade tip is at (960, 540.07–540.11) and the rear shoulder line at (960, 540.10–540.16) px, against a crosshair at (960, 540) (`shots/new-*.json`).
- The production weapon inspector reports ADS `sightScreen` (960, 539.82).
- Live `viewmodel-play`, all five weapons, hip and ADS, real wall shots: source-muzzle error ≤ 7.1e−15 and tracer endpoint 0.000–0.093 px from the crosshair (`vm/`).
- The live probe only reaches one range (7.8 m walls). The sight line and aim ray are both the camera axis, so the projection does not depend on range; the three sight-picture backgrounds sit at different distances.
- Hip is unchanged: muzzle position and viewmodel root are identical before and after.

Tests: `test/issued-iron-sights.test.ts` has two cases. It checks that only the 3 × 44 aperture triangles are removed with the source untouched, and that blade tip and shoulders lie on one line through the bore with nothing of the carbine crossing it. Both fail on HEAD, where the functions do not exist.

Evidence (`.inspect/look-r10/`): `sight-before-after.png` (hip/ADS, sky/brick/mud) and `sight-ads-zoom.png` (4× crops at the crosshair).

Deltas: Relay 37/29/17/16 (draws/programs/textures/lights), p99 7 ms. client.js +3,016 bytes. Art assets 0.

Gates: typecheck exit 0; vitest 205 files / 1688 tests plus node 92/92 pass; build:client pass; audit:assets exit 0 (48,861,846); inspect-map relay,practice-two exit 0 with 0 console errors; hitch-probe `--assert` PASS (advisory), 2 deaths, 0 recompiles, 1 frame >150 ms (within limits).

Open: against dark mud the blued blade is a low-contrast silhouette, as real sights are. A lighter blade face or a white-line insert would help if the owner wants it.

### Session 14 - 2026-09-23: The front beyond the wire

New `client/scene-far-field.ts`, hooked from `scene.ts` right after the sky (+5 lines, including dispose). Relay and Undertow only; Switchyard and unauthored maps get nothing. No world files touched.
- **Layout:** a ring walked along the playable rectangle's outline (straight edges plus rounded corners), so every point is exactly its offset outside the boundary.
  - Starts 28 m out on Relay, past its fenced yard on the flat apron. Starts 58 m out on Undertow, under its 60 m apron.
  - Runs to 520 m beyond, where the site fog is already opaque.
  - Low swells rise to about 5 m far out: fields, not dunes.
  - The ground sits 0.25 m above the apron once it surfaces.
- **Ground shader** (`onBeforeCompile`, no texture), drawn per pixel so it stays crisp at any mesh resolution:
  - churned-mud blotching;
  - a shell crater in most 13 m cells (dark bowl, lighter rim);
  - three zig-zag trench lines parallel to the front, with a dark wire belt 7 m in front of each (derivative-faded far off).
- **Instanced detail:**
  - ~720–744 leaning wire pickets along the belts;
  - 140 shattered stumps;
  - one ruined, roofless farm (10 broken walls, 20 blocks) about 230 m out on each map.
- **Budget:**
  - 4 draws: ground 2,816 tris; pickets 12 × 722/744; stumps 20 × 140; ruin 12 × 20. Total 14.5k / 14.8k tris.
  - 1 static build; no lights, no shadows cast or received, no per-frame work, raycast off.
  - Relay inspector 37→41 draws, 184,842→199,362 tris, 29→32 programs (compiled by `prepare()`), 16 lights, p99 7.1 ms. Practice-two (Undertow) 61→64 draws, +14.5k tris.
- **Safety:** `test/scene-far-field.test.ts` checks every ground vertex and every instance corner.
  - nearest element more than 20 m outside the boundary;
  - nothing taller than 1.5 m within 40 m of it;
  - ground faces up;
  - exactly 4 draws, under 20k tris, no lights, no shadows;
  - Switchyard untouched.

Evidence (`.inspect/look-r11/`):
- `fly-arena1.png` and `fly-arena2.png`: deployment fly-through at progress 0.35 and 1.0, before/after. The harness `fly.ts`/`fly.mjs` drives the production `introPose` + `SceneRig.render(intro)` path. The inspector's own `intro-*` shots still stall on actor readiness, before and after (Session 6 note).
- `roof-before-after.png`: roof eye views. The far field shows as a crater and picket strip above the boundary walls, with nothing rising over them.

client.js +10,337 bytes. Art assets 0.

Gates: typecheck exit 0; vitest 206 files / 1691 tests plus node 92/92 pass; build:client pass; audit:assets exit 0 (48,892,242); inspect-map relay,practice-two exit 0 with 0 console errors; hitch-probe `--assert` PASS (advisory), 2 deaths, 0 recompiles, 0 frames >150 ms.

Open: Undertow's field is dark under dusk and reads mostly as a silhouette band; the ruined farm is small at 230 m. Both are tunable in `SITES`.

### Session 15 - 2026-09-23: Sights on every carbine, a farm on the ridge

**1. Third-person carbine.** `client/remote-weapon.ts` (sight grant extended to third person): `remoteWeaponTemplate` now applies `stripIssuedSightHousing` and adds `issuedIronSights` to the issued-carbine template. The GLB and cached geometry stay intact; the template tip and length are unchanged, so mounting and muzzle anchoring are unchanged. Hit safety is unchanged: `RemoteWeapon` already sets `raycast = () => {}` on every node of the cloned mesh (the existing traverse), which now includes the sights. Test: a third case in `test/issued-iron-sights.test.ts` checks the template has the sights, exactly 3 × 44 aperture triangles removed, and the same tip. Live TDM bots carrying the carbine at 12.0/33.0 m (before) and 17.4/30.6 m (after): `carbine-before-after.png`. The soldier reads as before; weapon detail is not resolvable at those ranges.

**2. Undertow far field** (`client/scene-far-field.ts` `SITES.undertow` only; Relay unchanged):
- Soil 0x3f3d38/0x2f2d2a/0x4d4a42 → 0x6b5b49/0x4b3f34/0x7e6c57, so the fields keep crater and trench texture under the amber dusk.
- The ruin moves to the north ridge, in the deployment glide's view, at 60 m instead of 230 m beyond the far-field seam, scaled 1.8×, with lighter plaster/brick tones.
- The play space is untouched: the far field starts 58 m outside the boundary, and the Session 6 grade and rig are unchanged.
- Evidence: `undertow-before-after.png` (fly-through at 0.35, roof view).

Gates: typecheck exit 0; vitest 206 files / 1692 tests plus node 92/92 pass; build:client pass; audit:assets exit 0 (48,894,353); inspect-map relay,practice-two exit 0 with 0 console errors (Relay 41 draws unchanged, practice-two 64→65); hitch-probe `--assert` PASS (advisory), 2 deaths, 0 recompiles, 0 frames >150 ms.

Open: from the roof the farm is still a small silhouette between the towers; scale or distance are the next values to raise if wanted.

### Session 16 - 2026-09-23: Menu cards from the current build

Granted this round: `public/assets/relay-vista.webp`, `public/assets/undertow-vista.webp` and their `public/assets/README.md` rows. `switchyard-vista.webp` is untouched. The integration branch was already merged.
- Re-rendered through the recorded path, `scripts/inspect-map.mjs --shots vista,undertow-vista --write-vista`, from the current build. Same fixed vista cameras, 1920×1080. The new captures show the per-map light, the Relay floor and the far fields.
- Capture exposure only (the game's lighting is untouched): `.inspect/look-r13/finish-vista.py` applies a gamma lift and re-encodes WebP (method 6).
  - Relay: gamma 0.85, q82 → 205,642 bytes (was 216,408), SHA256 0f70a006…1324.
  - Undertow: gamma 0.65, q88 → 146,288 bytes (was 164,580), SHA256 aacc9ced…56ff.
  - Raw captures are kept as `raw-*-vista.webp`.
- Menu-size evidence: `menu-before-after.png` (real menu at 1920×1080, Relay and Undertow selected). Median luma on the right edge, where the vista is least covered by the menu's shade overlay: Relay 58 → 56, Undertow 48 → 55.
- Finding: at menu size the darkness comes mostly from the ui lane's `.shade` overlay and dark panels over the vista (`client/ui/deployment-style.ts`), not from the images. The vistas themselves are now brighter and carry more detail. Request for ui: lighten the `.shade` gradient on the right third if the cards should read brighter.

Gates: typecheck exit 0; vitest 206 files / 1692 tests plus node 92/92 pass; build:client pass; audit:assets exit 0 (48,865,573); inspect-map relay,practice-two exit 0 with 0 console errors; hitch-probe `--assert` PASS (advisory), 0 recompiles, 0 frames >150 ms.

### Session 17 - 2026-09-23: The sum of today

(Logged as Session 17; Session 16 was used by round 13.) The integrated build was measured on 8d37cd6 (integration branch already merged). The GPU lease was free and host CPU was around 52% at the start. Evidence: `.inspect/look-r14/`.
- **Offline** (`budget.ts`/`budget.mjs`, production `SceneRig`, 1920×1080, no actors). Views: fly-through at 0.35 and 1.0, aerial overview, roof eye view, and a synthetic firefight (12 muzzles, casings and tracers, 7 impacts, grenade, mortar strike and lens dirt every 0.5 s). The harness records peaks, frame p99 and per-top-level-node draw/triangle contributions.
- **Live** (`live.mjs`): 75 s bot rounds, TDM/Relay, DOM/Undertow and FFA/Switchyard, sampling `renderInfo` every 200 ms and rAF intervals.

| Map | Worst draws (limit 240) | Worst tris (500k) | Textures (32) | Tex MiB (64) | p99 ms (25) |
|---|---|---|---|---|---|
| Relay | 212 offline firefight / 201 live | 277,574 live | **35 live** / 21 offline | 56.3 offline | 7.1 (fly-1.0 offline 14.0) |
| Undertow | 220 / 191 | 208,078 | **40** / 26 | 57.9 | 7.1 |
| Switchyard | 200 / 189 | 204,674 | **34** / 20 | 50.3 | 7.1 |

Texture memory is offline without soldiers; live bytes were not measurable through `renderInfo`. The host is an RTX 5070, not the iGPU target. Inspector static cameras over today (look-r1 → now): Relay 37→40 draws, 179,682→199,362 tris; practice-two (Undertow) 60→64 draws, 109,958→144,210 tris.

Top contributors on the worst views (offline, per-node hide/re-render):
- Relay: `relay-service-detail` 100,714 tris / 1 draw; `relay-yard-issued-supplies` 39,240 / 1; unnamed map meshes 29,056 / 8; far field 14,520 / 4 (now 3); in a firefight, pooled effect meshes add up to ~158 draws but only 5.2k tris.
- Undertow: the unnamed `Scene` dressing root 84,916 tris / 7; `undertow-issued-supplies` 34,080 / 12; `undertow-ww1-field-kit` 14,076 / 21 draws; far field 14,784 / 4 (now 3); effects as Relay.
- Switchyard: `Scene` 101,142 / 7; `switchyard-issued-supplies` 45,440 / 16.

Fix (own file): `scene-far-field.ts` now bakes pickets and stumps into one static geometry, 4 → 3 draws per map with identical triangles. Measured: every Relay and Undertow view −1 draw; inspector Relay 41→40, practice-two 65→64. The test asserts 3 draws and checks every baked vertex against the boundary.

Not changed, reported: the impact particle pool draws each particle as its own mesh (up to ~60 draws in a firefight, still inside 240). Instancing it would save most of those draws but needs a pool rewrite and test rework; that is the next budget lever if draws climb. Over-budget texture counts and the 21 MiB weapon atlas are requests above.

Gates: typecheck exit 0; vitest 206 files / 1692 tests plus node 92/92 pass; build:client pass; audit:assets exit 0 (48,865,708); inspect-map relay,practice-two exit 0 with 0 console errors; hitch-probe `--assert` PASS (advisory), 2 deaths, 0 recompiles, 0 frames >150 ms.

### Session 18 - 2026-09-23: Sixty particles, two draws

`client/scene-impact.ts`: the 60-slot pool (48 impact plus 12 foot-dust) is now drawn through two `InstancedMesh`es, one normal-blend and one additive, instead of one mesh per particle.
- Every visual is unchanged: per-instance colour (`instanceColor`), alpha and softness (instanced attributes), the same soft-edge/hollow-ring shader using a per-instance normal matrix, and the same profiles, lifetimes, pool arithmetic and reduced-motion rules.
- Upload happens once per `update()` while anything is live, and only then.
- Draw order: soft puffs are written first and chips, contacts and rings after, so debris still draws over its own dust. The first instanced pass lost that ordering (mud clods and brick chips vanished behind the dust at 45 ms); caught in the lineup and fixed.
- Program key is now `pooled-impact-instanced-v3`, compiled by `prepare()`; the hitch probe shows 0 recompiles.
- `Vfx.impactParticles()` and `SceneImpact.particlesView()` expose live particles for tests. `test/scene-impact.test.ts` and `test/impact-vfx.test.ts` keep every original assertion through that view; the disposal case now checks the two instanced draws. One new case: the whole pool, all 7 surfaces plus 12 foot puffs, is exactly 2 instanced draws.

Offline firefight fixture (`.inspect/look-r15/`, same `budget.ts` fixture, HEAD vs new):

| Map | Draws | Triangles | Frame p99 / median (ms) |
|---|---|---|---|
| Relay | 211 → 153 | 213,612 → 216,492 | 7.1 → 7.1 / 6.9 → 6.9 |
| Undertow | 219 → 161 | 144,038 → 146,918 | 7.1 → 7.1 / 6.9 → 6.9 |
| Switchyard | 200 → 130 | 143,740 → 146,476 | 7.1 → 7.1 / 6.9 → 6.9 |

Triangles rise about 2.9k because the instanced draws submit all 60 instances (idle ones at zero scale). Setting the instance count to the live high-water mark would remove that if it ever matters.

Lineup (`lineup-before-after.png`, `lineup-45ms-zoom.png`): mud/wood/sandbag/brick/metal/concrete/gravel at 45/160/420 ms, old pool vs new. Debris directions are random per run; otherwise identical at a glance.

Gates: typecheck exit 0; vitest 206 files / 1693 tests plus node 92/92 pass; build:client pass; audit:assets exit 0; inspect-map relay,practice-two exit 0 with 0 console errors; hitch-probe `--assert` PASS, 2 deaths, **0 recompiles**, 0 frames >150 ms.
