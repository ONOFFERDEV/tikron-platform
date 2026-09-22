# Ironsight AAA look stream

## Session 1 plan

Arc: **Air above the front**, session 1 of up to 3. Scope: presentation lighting and skyline atmosphere only, per `tools/aaa-stream-look.md`. No commits, pushes or deploys.

1. Completed: capture the three maps at fixed cameras in Aside and record baseline render cost; identify the highest impact treatment.
2. Completed: implement bounded battlefield atmosphere with stable light/program counts and invariant tests inside look-owned files.
3. **In progress:** capture the same cameras and a 20-second bot round; run typecheck, tests, build, asset audit, required inspector and five sequential TDM/FFA hitch pairs; obtain independent visual reviews.
4. Pending: record evidence, measured deltas, remaining gaps and cross-stream requests; stop all owned servers/browsers.

## AAA gap list

1. Per-map illumination: cohesive hard daylight / readable dusk / neutral wet overcast, coordinated with the incoming world materials.
2. Impact dust, spall and persistent surface marks need assessment in moving combat.
3. Sky-to-world transition: revisit skyline layering once the world stream replaces industrial boundary props; sky smoke and wind are now implemented.
4. Presentation cameras need assessment after world and kit updates arrive.

## Reference scorecard

This stream evaluates rendering references only; gameplay/layout/UI references remain out of scope and are not claimed complete.

| Reference | Status | Checkable target |
| --- | --- | --- |
| R-G09 | partial | Existing enemy highlights and silhouettes remain readable at fixed combat cameras. |
| R-L12 | partial | Lighting separates figures from the environment without a new rendering pass. |
| R-L13 | partial | Restrained environmental colour supports the existing soldier value masses. |
| R-L14 | partial | Cosmetic atmosphere cannot become cover; no quality-dependent visibility, constant lights, unchanged hitch limits. |

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
| R-G20 | n.a. | Outside Session 1 sky-atmosphere scope; no claim of project-wide completion. |
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

- **Resolved externally: supervisor / kit baseline asset gate.** audit:assets initially reported candidate_builder_hash for tools/build-ww1-production-weapons.py and candidate_meta_hash for automatic-rifle, trench-smg, pump-shotgun, bolt-rifle and service-pistol metadata. None was edited by look. Diagnosis: the six receipts were minted for CRLF bytes; the initial worktree had LF-only bytes, and each LF-normalized file matched the recovery checkout content exactly. The requested repair was to restore the original CRLF bytes without changing hashes or relaxing the audit. An external repair arrived at approximately 11:36 UTC: all six raw hashes now match the expected receipts. The subsequent filesystem-only pnpm audit:assets passes (audit-after-external-repair.log). Existing quarantined soldier candidates remain excluded; look did not change admission policy. The original failure is retained in assets-before.log.
- **Test fixtures:** four existing weapon-contact tests need ignored production-candidates-v3 GLBs. Resolved: five candidate GLBs restored as new .inspect files with the exact test SHA256s; all five tests in the two affected suites pass. Receipt: .inspect/look-session1/fixture-restore.json.

- **Supervisor inspector maintenance:** the optional switchyard-vista baseline run fails because scripts/inspect-map.mjs:609 still requires /assets/props/switchyard-transformer.glb, which current WW1 art does not request. Required relay,practice-two gate is unaffected. Please update the supervisor-owned legacy asset assertion to the admitted WW1 resources. Retained report: .inspect/look-s1-before-report.json.

- **Supervisor lease helper:** one queued Aside capture exited when the prior lease owner closed the socket with an empty response (Unexpected end of JSON input in scripts/inspection-lease.mjs:29). Retried as a separate run, preserving candidate-aside-retry.log. The helper is supervisor-owned; please treat empty response during owner shutdown as a retryable acquisition race while retaining rejection for a nonempty invalid service response.

- **Supervisor GPU scheduling:** five of ten strict look runs have passed. Pair 3 FFA has been queued since 11:44 UTC behind kit rig inspection and then ULW browser-current UI inspection. Please allow the remaining look cohort (3 FFA, 4 TDM/FFA, 5 TDM/FFA) to finish before scheduling more GPU inspection. Keep the shared lease and all gate limits unchanged. Current progress: .inspect/look-session1/hitch-series-resume2.log and hitch-summary.json. No foreign process was interrupted.

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
