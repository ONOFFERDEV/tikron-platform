# Ironsight AAA kit stream

## AAA gap list

1. Finish the soldier replacement arc (Session 4 completed candidate arc 2/3): fitted headgear, continuous torso/limbs, boots and all three LOD budgets pass bounded review. Next: face/neck, garment finish, hands and carried-kit fit, then full contact/hit calibration and admission. Active gameplay still uses the angular legacy soldier.
2. Restore the normal first-person loaded-model route in supervisor/look-owned `scene.ts` (exact request below), then complete five-weapon FP contact review.
3. Finish whole-hand fitting and fit the carried gear to the eventual soldier body: legacy carbine support index and pistol support thumb remain imperfect; firing-hand fit unchanged. Candidate pistol downward crouch contact saturates reach by 21 mm; the active rigid bedroll retains crouch/pelvis separation.
4. Complete candidate weapon mechanisms, geometry/material/draw-budget review and truthful admission. Current source-model approvals are not runtime or hero acceptance.

## Reference scorecard

Status is scoped to this session; n.a. does not mark a project-wide rule complete.

| Id | Status | Evidence / limit |
| --- | --- | --- |
| R-M01 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M02 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M03 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M04 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M05 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M06 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M07 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M08 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M09 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M10 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M11 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M12 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M13 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M14 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M15 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M16 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M17 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M18 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M19 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-M20 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G01 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G02 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G03 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G04 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G05 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G06 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G07 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G08 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G09 | partial | S4 continuous candidate body/boots and LODs pass 20-pair review after shoulder correction; active legacy body, hero face and fingers stay open. |
| R-G10 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G11 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G12 | partial | FP projection unchanged; shared loader prevents FP inspector completion, request routed. |
| R-G13 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G14 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G15 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G16 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G17 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G18 | partial | Existing projection/sway unchanged; no new first-person completion claim. |
| R-G19 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-G20 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L01 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L02 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L03 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L04 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L05 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L06 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L07 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L08 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L09 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L10 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L11 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L12 | partial | Opaque cloth/canvas/rim retained; S2 adds legible carried gear without changing materials. |
| R-L13 | partial | S4 retains faction helmet/value distinctions through all body LODs; whole-soldier admission remains open. |
| R-L14 | partial | S4 candidate LOD budgets and three draws pass; required runtime gates pass on unchanged legacy path, laptop/candidate runtime qualification remains open. |
| R-L15 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L16 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L17 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L18 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L19 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L20 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L21 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L22 | n.a. | Outside this kit session; no claim about whole-project completion. |
| R-L23 | met | Existing yellow/violet/team uniform path retained; source isolation and color stability tests pass. |

## Session plan

- Session 4 completed: preserved Session 3 candidate/source baseline; continuous blended torso, sleeves and trousers, shaped boots, and corrected shoulder sidewall weighting. Eight Blender geometry checks pass; candidate-only soldier replacement arc 2/3.
- Session 4 completed: full joined LOD reduction and true triangle metadata. Both factions fit 18,000 / 8,000 / 3,000 budgets; 55 joints, 64 clips and exact animation/skeleton content preserved. Twenty fresh matched whole-body/LOD/pose pairs captured.
- Session 4 completed: both fresh independent reviews PASS on all 54 images; required five-weapon rig, typecheck, tests, build, assets, map and TDM hitch gates PASS. Aside verifies all 20 browser states; its screenshot API times out, explicitly not passed. Owned tabs/processes closed, ports 8802/49986 clear, scope and session log reconciled.

- Session 3 completed: canonical-LF provenance repair, seven regression tests and live asset audit. Clean no-copy HEAD archive plus text patch verifies normalization; full clean audit separately fails because 15 required public assets are unversioned, routed below.
- Session 3 completed: compact candidate head and distinct fitted khaki/fieldgrey helmet shells; failing-first geometry checks, seven mesh tests, 20 matched stills, two independent PASS reviews. Soldier replacement arc 1/3; no public promotion.
- Session 3 completed: mandatory five-weapon rig/turntable, typecheck, tests, build, asset, map and TDM hitch gates all PASS. Aside captured all ten candidate views; supplemental independent review PASS. Owned server/process cleanup completed; fresh final Aside tab listing was unavailable because its account has multiple open profiles, while all three owned tab closures returned successfully.

- Completed: recover the supervisor's hitch failure with an unchanged passing rerun; reproduce the shared lease race and route the exact fix outside this lane.
- Completed: capture 14 current-build baselines, implement carried field gear, pass failing-first silhouette tests and real-rig CPU invariants.
- Completed: 14 final matched stills plus 18 motion states; both independent reviews; final map/hitch and source gates; budget measurements, session log and owned-process cleanup. Aside state confirmation completed; its optional screenshot failed inside the browser CDP layer and is recorded as unavailable.
- Removed: redundant before-motion and before-Aside run, canceled while still queued behind another stream's GPU lease. Fourteen required fresh before stills were already complete; all 18 final motion states are now complete.

## Cross-stream requests

5. **Supervisor: clean-checkout asset provisioning remains unresolved.** Session 3 repairs the newline false failures without changing historical raw hashes, GLB hashes, acceptance or quarantine. A no-copy HEAD archive plus exported text patch passes all seven normalization regressions, and candidate_builder_hash disappears. Full clean audit still exits 1 on unversioned world asset supply-wagon.glb; 15 required public files are absent, including licensed player/weapons-vm and the candidate GLBs. Do not copy arbitrary CRLF files to work around this: define lawful reproducible asset provisioning for clean workers. Exact list, canonical fingerprints, patch and commands: `.inspect/kit-session-3/provenance/report.md`. No commit was authorized, so this session does not claim the requested fixed-commit git-worktree proof.

4. **Resolved by supervisor before resumed Session 4: lease owner EOF race.** Current `scripts/inspection-lease.mjs` handles `INSPECTION_OWNER_EMPTY_EOF` with the narrow retry. This lane did not edit it; fresh Session 4 map/hitch queues pass. Historical reproduction and patch evidence remain `.inspect/kit-session-2/lease/patch-request.md` (2/378 empty native releases; patched 100/100 acquisitions).

1. **Supervisor/look: normal FP loader.** `client/scene.ts`, `setWeaponVisual`, currently rejects `resolveWeaponContractRoot(obj, key) === null` and missing presentation sockets unconditionally. Normal `weaponSource` selects `field-carbine` / `wep_*` legacy nodes; these lack the WW1 contract, so `weaponIsModel` remains false and `?inspect=weapon&shot=weapon-ar-hip` waits forever. Restore the loaded legacy path with nullable `weaponPresentation`, retaining mandatory contract rejection for WW1 candidate preview. Existing source-muzzle/eject fallback branches are already present later in this function. Verify all five default FP inspectors afterward. This stream did not edit `scene.ts` or weaken inspector readiness. Evidence: `.inspect/kit-s1-final-report.json`, successful relay/practice-two entries followed by this extra FP readiness failure, zero console errors.
2. **Resolved in Session 3: canonical text contract.** The explicit `sha256-crlf-to-lf-v1` migration preserves historical raw fingerprints and binds proven canonical LF equivalents. No public metadata was rewritten; genuine staging16 fitter source drift stays visible. Root Git attributes no longer need a CRLF workaround. Clean missing-asset provisioning is the separate request 5 above.
3. **Supervisor/base:** the reported neutral foregrip test is already green in this branch. No change to `test/visuals.test.ts` was made.

## Session log

### Session 4 - 2026-09-23: Continuous infantry uniforms, soldier replacement arc 2

- **Closing status: all mandatory app gates and both final independent visual reviews PASS.** Kit-owned scope only, port 8802. No commit, push, deploy, paid generation or public asset promotion. This session resumed interrupted Session 4 source/evidence; incomplete prior launches were not counted as passes.
- **Reference: R-G09, R-L12, R-L13, R-L14.** Targets: continuous torso/elbow/knee cloth surfaces, recognizable boot soles/toes, preserve faction outlines, preserve skeleton/clips, three material draws per LOD, and actual 18,000 / 8,000 / 3,000 triangle budgets. Geometry/budget targets pass; final hero quality, runtime contact/hit identity and laptop performance remain unqualified.
- **Arc 2/3 is candidate-only.** Final GLBs are `.inspect/kit-session-4/after/characters/`; existing public soldiers remain quarantined. All 14 fresh gameplay rig frames still report `authority=legacy`, `rigKind=model`, `renderedSource=legacy-model`. Nothing in this entry claims the new body is live in normal play.

#### Geometry, skinning and truthful LODs

- New pure `tools/ww1_soldier_body.py` authors closed tapered tunic, sleeve/trouser and boot surfaces. `ww1_soldier_geometry.py` binds continuous cloth across the existing spine/elbow/knee joints, seats the inner sleeve in the shoulder, and retains the existing headgear/hand/kit source. No skeleton or animation data was edited.
- `fit-ww1-soldiers.py` now reduces the **entire joined soldier** instead of reducing only its first object, and records tessellated triangles rather than polygon counts. Metadata includes the new body helper's real SHA-256 alongside fitter, geometry and headgear hashes. No admission record was rewritten to accept these candidates.

| Faction | Before true LOD0 / LOD1 / LOD2 | Final true LOD0 / LOD1 / LOD2 | Before / final candidate bytes |
| --- | --- | --- | --- |
| Khaki | 8,820 / 8,734 / 5,206 | 11,048 / 6,076 / 2,762 | 4,522,248 / 3,868,180 |
| Fieldgrey | 9,196 / 9,110 / 5,432 | 11,424 / 6,282 / 2,856 | 4,634,824 / 3,976,044 |

- Both low LODs now meet the unchanged limits; LOD0 spends 2,228 additional triangles per faction on continuous anatomy. Each LOD retains three material primitives. Maximum rest-extents drift is **1.427 mm**; this is not a complete silhouette-distance metric. All vertices are weighted, weights normalize, the skin responds to a real spine pose, and all **55 bones / 64 clips** survive. Canonical animation-channel and skeleton/inverse-bind contents hash identically before/after. UV attributes exist; useful unwrap and finished textures are not certified.
- Failing-first evidence: `body-red.log`, `boots-red.log`, `shoulder-red.log`, `shoulder-sidewall-red.log`, and `lod-work/baseline-{test.log,regression.json}`. Final **8 Blender geometry tests**, exported LOD regression, pure body basedpyright check, and Python rule audit pass. Prior headgear and canonical-text regressions each pass 7 tests. The extra text test was initially invoked with Node instead of its required Vitest runner; `provenance-vitest-final.log` records the corrected 7/7 result, without a product edit.
- First body candidate left abrupt sleeve ends. Seating them on the clavicles then exposed a new small shoulder nub in posed views; both independent reviewers returned **REVISE**, recorded in `review-round-1.md`. Actual deformed-cap containment passed, disproving the initial cap-exposure explanation. CPU rays traced pixel (536,270) to exported triangle 1253 and authored sleeve sidewall vertices 2/23/22, agreeing within **3.1 micrometres** over 546 rays. The adjacent ring retained **63.6% clavicle influence** beyond the humerus. Shortening that transition to the first .08 ring removes the fold; the new anatomical weighting regression fails before and passes after. Full diagnosis: `shoulder-debug/REPORT.md`. Rejected meshes/renders remain under `candidate-1/` and `candidate-2/`.

#### Visual evidence and wow check

- Twenty matched **1000×1000** before/after candidate views: both factions, rest front/right/back, idle LOD0/1/2, run .2/.5/.8 and crouch. All final frames were recaptured after the last body edit. PNG signatures, dimensions, alpha and source freshness pass. Full diffs and gallery: `.inspect/kit-session-4/{visual-diffs.json,gallery.md}`; source/GLB/animation fingerprints: `candidate-final-audit.json`.
- Fourteen fresh required active-rig captures: `.inspect/kit-s4-final-hands-w{0,1,2,3,4}-arms1-{hands,hands-right}.png` and `.inspect/kit-s4-final-turntable-w0-arms1-{front,right,left,back}.png`. Both reports have zero console errors or forbidden gameplay connections. These establish the current legacy presentation, not candidate weapon contact or first-person acceptance.
- **Candidate player sentence:** “The sleeves and trousers bend with the soldier instead of opening at the joints.” The before/after pose sequence is this session's wow check. Blank faces, cylindrical necks, crude fingers, rigid/floating gear, fieldgrey coat slabs and cloth finish remain plainly visible and unaccepted.
- Aside initially could not start because **multiple browser profiles were open on account u0**; raw redacted stderr establishes that failure. Signed-out u1 was not connected, and Computer Use reported Orca `runtime_unavailable`. Later availability changed without this lane closing any profile or changing accounts: Aside loaded the actual final GLBs and verified **all 20 states at 1440×900**, each ready with three draws, the expected LOD triangle count and 64 clips. Evidence: `aside-after-states/{report.json,transcript.json}`. Its annotated screenshot call still failed with a browser CDP capture timeout, so no Aside image pass is claimed (`aside-after/report.json`). Initial missing viewer manifest, profile ambiguity and screenshot timeout are three distinct capture-path failures, not product fixes.

#### Budgets and required gates

- Meshy spend **0**, public asset byte delta **0**. Final quarantined candidates total **1,312,848 bytes less** than their source baseline; that saving is not yet a public download reduction. No runtime material, texture, light, render pass or dependency was added.
- Asset audit PASS: counted assetBytes **40,336,654**, audit publicBytes **52,296,238**, maximum file **8,025,108** bytes. The audit excludes the existing quarantined soldier files; an independent physical public-tree count including them is **60,698,280 bytes / 57.8864 MiB**, leaving **2,216,280 bytes** below 60 MiB. Current client bundle **4,088,752 bytes**, gzip **928,715**; no Session 4 runtime source was changed.
- `pnpm typecheck`, `pnpm test`, `pnpm build:client`, `pnpm audit:assets`: PASS. **1,622 Vitest + 92 Node tests** passed; 9 inherited Vitest skips untouched. Editor LSP servers were unavailable after previously declined installation; full TypeScript checks and standalone pure-body basedpyright completed successfully.
- Required map command PASS: `node scripts/inspect-map.mjs --url http://localhost:8802 --shots relay,practice-two --prefix kit-s4-required-final`. Zero errors/forbidden connections. Relay: **40 calls, 225,382 triangles, 17 textures / 32.348 MiB**, median **6.9 ms**, p99 **7.1 ms**. Practice-two: **63 calls, 146,400 triangles, 26 textures**. These static views do not measure the new candidate body.
- Required TDM hitch PASS: `node scripts/hitch-probe.mjs http://localhost:8802 150000 .inspect/kit-session-4/hitch-tdm-final.json --assert`. **131,608.3 ms / 18,951 frames / two deaths**, p99 histogram upper bound **9 ms**, max frame **17.1 ms**, max callback **12.1 ms**, zero errors, recompiles, frames over 150 ms or stalled time. Lease wait **108,363 ms**, honored without interrupting its owner. Probe stops after its two-death condition; 150,000 ms is the requested upper bound.
- First gameplay-ready **3,234.6 ms**; scene preparation **1,145.4 ms**. Startup/warm-up maximum **270.6 ms** lies outside the measured gameplay gate. No startup hitch-free or causal performance-improvement claim. Hardware is **RTX 5070**, not the laptop iGPU target. Exact commands, process receipts and artifact hashes: `.inspect/kit-session-4/runtime-gates-final-summary.json`.

#### Closing work and next default

- Fresh `/root/s4_final_integrity` and `/root/s4_final_fidelity` each directly opened **54/54** images and returned **PASS, high confidence, no blockers** on the corrected source. Synthesis and source binding: `.inspect/kit-session-4/visual-qa-verdict.md`. Approval covers this bounded geometry increment only.
- Cleanup completed: verified command lines before stopping the eight processes in the owned Wrangler/viewer trees; no remaining owned processes or listeners on 8802/49986. Both Aside owned tabs closed and a fresh listing confirms zero remaining owned IDs. Receipts: `process-cleanup.json`, `aside-cleanup-final.log`. Other streams' profiles, tabs and processes were left alone. Final source fingerprints match the reviewed candidates, and `git diff --check` passes.
- Default next: finish garment/face/neck/hand and carried-kit fit, then complete candidate normalization/contact/hit-authority and admission review. Do not promote these geometry candidates on the basis of this bounded pass. The shared FP loader request and clean-worker asset provisioning request remain open.
- Open owner questions: none required. Keep existing quarantine and the 60 MiB ceiling; resolve cross-stream integration through the supervisor.

### Session 3 - 2026-09-22: Fitted infantry headgear, soldier replacement arc 1

- **Closing status: all mandatory app gates PASS on port 8802.** Aside also captured all ten candidate views, and supplemental independent reviews passed. Scope remains kit-owned files under apps/ironsight, branch ironsight-ww1-kit. No commit, push, deploy, paid generation or new public asset promotion.
- **Reference: R-G09, R-L12, R-L13, R-L14.** Checkable targets: remove exposed candidate crowns; broad/shallow khaki versus short-front/deep-rear fieldgrey; opaque actual geometry, no material concealment; unchanged rig and clips; preserve public quarantine and measure actual LOD triangles. Bounded head/helmet targets met; whole-soldier and runtime acceptance remain partial.
- **Arc 1/3 boundary:** source candidates only. Normal play and all 14 fresh rig frames still report authority=legacy, rigKind=model, renderedSource=legacy-model. The supervisor-owned FP loader remains unchanged; do not mistake the candidate gallery for an in-game soldier replacement.

#### Geometry and evidence

- Replaced the spherical authored head with compact jaw/temple/crown rings and reauthored two closed helmet shells. New pure typed source `tools/ww1_soldier_headgear.py`; Blender adapter in `tools/ww1_soldier_geometry.py`. Fitter metadata now explicitly hashes its new headgear dependency. Public soldiers and admission status were not changed.
- Failing-first Blender audit reproduced the prior **52 mm khaki / 32 mm fieldgrey** exposed crown and 32 open boundary edges per old shell. Corrected final audit reports head apex **1.728 m**, outer-shell minimum sampled crown clearance **20/27 mm**, no open edges, **896 triangles** per closed helmet. Independent seven-test suite checks inner-shell clearance >=3 mm, oriented manifold edges, positive signed volume, nondegenerate triangles, bounded head dimensions and faction profiles.
- Head apex drops 62 mm. Khaki helmet apex rises 10 mm and width shrinks 10 mm (308 -> 298); fieldgrey apex drops 3 mm and width shrinks 20 mm (266 -> 246). This is a compact profile correction, not a claim of zero dome enlargement. Fieldgrey front/rear rim separation is 50.61 mm in the sampled metric.
- First new rim closure had reversed directed edges. The added topology test caught two failures; winding was corrected and all seven tests pass. The initial renderer lacked a World after factory-reset; the evidence-only renderer now creates one explicitly. Neither intermediate was admitted.
- Twenty fresh matched **900x900** stills: `.inspect/kit-session-3/headgear-{before,after}/{khaki,fieldgrey}-{front,right,back,quarter,top}.png`. Every pair has matching dimensions and intact alpha; diff ratios 29.35–36.75%. Ten-pair [gallery](.inspect/kit-session-3/gallery.md), geometry JSON, source mesh JSON, renderer and `headgear-diffs.json` provide reproduction and comparison evidence.
- Both independent reviewers directly opened all 20 PNGs and returned **PASS, high confidence, no blockers for this increment**. Pass A independently reran seven tests and checked exported skin weights; Pass B consumed all 338 hotspots. Reports: `.inspect/kit-session-3/review-{integrity,visual}.md`. Face planes remain conspicuously faceted; no finished-head, whole-soldier or hero approval.
- **Wow check / player sentence:** “The helmets finally sit over the head, and I can tell the two silhouettes apart.” The source before/after turntable is the wow evidence; no claim of a newly shipped combat moment.

#### Export integrity and remaining admission gates

- Final candidates remain at `.inspect/kit-session-3/candidate-after/characters/`; frozen before source and GLBs remain under candidate-before/. Metadata binds donor rig, fitter, geometry helper, headgear helper and output bytes. Source kind remains licensed-derived; no replacement provider receipt or review signature was created.
- Raw GLB audit: **55 bones, 64 clips, 3 materials/draws per LOD, no images**; complete skeleton and animation data hashes equal before/after. All exported helmet vertices bind fully to head. Non-head position/joint/weight tuples match in LOD0/LOD1. Whole-mesh LOD2 redecimation changes some non-head geometry; LOD2 requires fresh whole-body review before admission.
- Actual triangle counts (before -> after): khaki **8,980/8,894/5,302 -> 8,820/8,734/5,206**; fieldgrey **9,420/9,334/5,566 -> 9,196/9,110/5,432**, LOD0/1/2 order. **LOD1/2 remain over 8,000/3,000**, an inherited blocker. Fitter lodTriangles still counts polygons; only `candidate-audit.json` actual triangulated GLB counts are used here. No threshold was widened.
- Candidate GLB byte deltas: **-47,376 khaki / -66,392 fieldgrey**. These are unshipped candidate deltas, not public download savings. Body/limb continuity, skin/face finish, LODs, five-weapon contact, runtime normalization/hit identity and final admission remain open for arc 2/3.

#### Canonical provenance repair

- Policy `sha256-crlf-to-lf-v1` removes only CR immediately followed by LF; lone CR, final newline, whitespace, invalid UTF-8 bytes and all other content remain significant. GLBs retain raw SHA-256 validation. Three admissions add explicit canonical fields and normalization-only migration history; historical raw hashes and acceptance/quarantine flags remain pinned.
- Three original regression failures became green; final seven cases pass live and in a no-copy HEAD archive plus exported text patch. Actual published-pair fixture tests also cover LF/CRLF/mixed metadata. Genuine old soldier-builder mismatch remains visible, not reclassified as a newline change.
- **Full clean audit is not green:** the archive lacks 15 unversioned required public binaries. This is separate from the repaired canonical-hash defect. Exact evidence and preserved patch are in `.inspect/kit-session-3/provenance/report.md`; request 5 routes provisioning. No fixed commit or git-worktree proof is claimed under the no-commit instruction.
- The first full test invocation discovered the temporary archive while it was being relocated and failed on archive-only suites. No product test failed. The archive is now retained under `.inspect/kit-session-3/provenance/node_modules/head-checkout`, excluded by the existing Vitest rule; the unchanged full command then passed. Initial log retained as `tests-initial-archive-discovery.log`.

#### Budgets and required gates

- Meshy spend **0 credits**; no paid calls, newly published GLBs/textures, lights, render passes or material/draw changes in active play. No new npm dependency. Current public total **52,669,075 bytes**; audited assets **40,853,455 bytes**, under 60 MiB; per-file audit also PASS. Canonical migration writes no public metadata or GLB bytes.
- Identical esbuild options with the three HEAD admission JSONs versus final JSONs: client **4,007,560 -> 4,008,369 bytes (+809)**; gzip **912,201 -> 912,628 (+427)**; source map **+1,132 bytes**, total comparable public build delta **+1,941 bytes**. Final compiled hash matches the shipped client. `bundle-metrics.{mjs,json}` records the comparison.
- `pnpm typecheck`, `pnpm test`, `pnpm build:client`, `pnpm audit:assets`: PASS. Full tests: **1,608 Vitest + 92 Node**, nine preexisting Vitest skips unchanged. Python geometry tests **7/7**, Blender actual-mesh audit PASS. Python LSP unavailable; ephemeral basedpyright on the new pure mesh module reports zero errors and one exhaustive-match Never warning; application tsc covers both TS configurations.
- Required map command PASS: `node scripts/inspect-map.mjs --url http://localhost:8802 --shots relay,practice-two --prefix kit-s3-required`. Zero console errors/forbidden gameplay connections. Relay **38 calls, 230,200 triangles, 18 textures / 33.681 MiB**, median **6.9 ms**, p99 **7.1 ms**, preparation **919.3 ms**. Practice-two **63 calls, 146,400 triangles, 26 textures**. Static counts equal S2. RTX 5070 hardware is not the target laptop iGPU; no laptop qualification or candidate performance claim.
- Required TDM hitch PASS: **108,824.2 ms / 15,671 measured frames**, two deaths and respawns; zero errors, recompiles, >150 ms frames or stalled time. p99 histogram upper **8 ms**, maximum frame **16.8 ms**, maximum callback **12.8 ms**. First-damage/death windows PASS. First-ready **3,246.5 ms**; startup/warmup includes **305 ms**, outside gameplay acceptance. No hitch-free startup or causal speedup claim. Full report: `.inspect/kit-session-3/hitch-tdm.json`.
- Required 14 fresh active rig stills completed: `.inspect/kit-s3-current-hands-w{0,1,2,3,4}-arms1-{hands,hands-right}.png` plus `kit-s3-current-turntable-w0-arms1-{front,right,left,back}.png`. Both reports have zero errors/forbidden connections. First observed software-rendered rig readiness **8,721.9 ms**; not a normal gameplay load benchmark or whole-hand contact certification.

#### Cleanup and next default

- Game Wrangler identity and its **seven-process tree** were verified before stopping it after completed map/hitch gates. The temporary candidate-only HTTP viewer was subsequently stopped, port 8802 has no listener, and all five capture/gate job PIDs are gone. Receipts: `game-server-cleanup.json`, `process-cleanup.json` under the session evidence directory. No other stream's process or profile was stopped.
- Aside completed **10 valid 1440x900 annotated screenshots** in `.inspect/kit-session-3/aside-ready/`, with correct per-view readiness, 3 draws and 1,564 triangles for head/neck/helmet. Independent Pass B opened all ten and returned PASS, high confidence. The red border/1 is Aside annotation. These are a candidate-only Three.js viewer, not ordinary gameplay or asset admission.
- Aside limits and recovery: the first request refused a workspace filesystem read outside its session roots; that request was not retried. A normal loopback HTTP viewer left filesystem permissions unchanged. Initial navigation timed out; the viewer's empty hash selected an empty stage, so its inspection flag was initially absent. Explicit faction/angle hashes then rendered all ten views successfully. The evidence-only viewer now defaults an empty hash to after/khaki/quarter; explicit captured states are unchanged. Original captured HTML/bundle is preserved as `headgear-viewer-captured.*`. Corrected default bootstrap is compiled and route-checked but not browser-reverified; this does not qualify the initial navigation as error-free.
- All three `closeTab` calls returned successfully. A fresh final tab-list check could not start because Aside reported multiple profiles for the account; those other profiles were left alone. Exact capture/closure transcripts and redacted final-list failure remain in the evidence directory. No fresh zero-tabs claim is made.
- Final scope audit confirms exactly 16 changed/new tracked-source paths, all kit-owned. Candidate output and all three builder/helper hashes match the reviewed metadata; final client hash matches the measured bundle. Ten Aside PNG dimensions/byte counts rechecked. `git diff --check` passes. Fingerprints and checks are recorded in `.inspect/kit-session-3/final-source-hashes.json`.
- Open owner questions: none required. Default next session: continuous soldier body/face work and correct LOD reduction, followed by full contact/normalization/hit-authority integration through the supervisor. Keep candidates quarantined until the complete admission packet passes.

### Session 2 - 2026-09-22: Carried field gear, arc 2

- **Closing status: all mandatory gates PASS on port 8802.** Scope stayed in the kit lane on branch `ironsight-ww1-kit`; inherited Session 1 work remains intact. No commit, push or deploy.
- Recovered the supervisor gate first: the unchanged baseline hitch passed. Isolated Windows lease experiments reproduced empty EOF during normal owner release; the exact tested retry patch is routed above because `scripts/inspection-lease.mjs` is supervisor-owned. The historical failure log alone does not establish its response bytes. The shared race remains unfixed in this lane even though both Session 2 hitch runs passed.
- Selected the top bounded visual improvement after inspecting the active runtime: lower and shape carried equipment. The active soldier remains `authority=legacy`, `rigKind=model`, `renderedSource=legacy-model`. Quarantined candidates were not enabled or given replacement receipts. Triage: `.inspect/kit-session-2/soldier-triage.md`.
- **Reference: R-G09, R-L12, R-L13, R-L14.** Targets met for this increment: clear the nape, readable cloth closures and secured roll, opaque material/rim and torso identification cue retained, body/hit vertices and weapon/hand transforms preserved, no added draws/textures/lights/passes, and less than 1,800 added triangles per role. Whole-soldier, hand and laptop-performance completion remain partial.

#### Change and invariant evidence

- Only product source changed this session: `client/field-equipment.ts`. New test: `test/field-equipment-silhouette.test.ts`. Pack and blanket share the lower-spine frame; rounded canvas bodies gain flaps, straps and open buckle frames; the blanket sits beneath the pack with bindings and rolled-end detail; the canteen has a shaped upright body, separate cap and harness. Geometry remains merged into the existing cached skinned draw/material path.
- Failing-first silhouette checks: 12 failures before; all 18 cases pass after. Combined field-equipment/operator checks: 29/29. Coverage includes placement bounds, shared load bone, under-slung roll, upright cap, finite geometry and the unchanged triangle ceiling. No new skip or weakened threshold.
- Corrected real-rig CPU sweep: `.inspect/kit-session-2/gear-measurements.json`. 96 baseline/current samples and 6,912 rays; 7,417 raw equipment intersections filtered to zero by production raycasting, with body hits preserved. Original position/skin prefixes match between variants; hand/finger/weapon mount and muzzle matrix differences are zero. This preserves existing behavior; it does not certify whole-hand contact.
- Anchor/flanker/sniper added triangles: 624/528/528 before, 1,512/1,272/1,272 after. No new material, texture, render object, draw, real-time light, pass, dependency or per-frame allocation path.
- First rendered fit rejected for excessive back-load separation; source and captures retained under `.inspect/kit-session-2/candidate-1/`. Uniform forward translation and stronger tilt were rejected after increasing sampled penetration. Final pack/roll rotate -0.25 rad together about their upper-front pivot, then move 15 mm rearward.
- Contact exploration across 36 poses / 3,744 samples: pack median gap 48.76 -> 27.71 mm (central region 10.86 mm), blanket 113.19 -> 42.85 mm; sampled maximum penetration 18.98/19.40 mm. The rigid blanket still stands off from the pelvis in crouch. Evidence: `.inspect/kit-session-2/gear-contact.json` and `gear-contact-journal.md`. No flush-contact, zero-clipping or eventual-soldier-fit claim.

#### Visual evidence and wow check

- Fourteen fresh matched before/after stills: `.inspect/kit-s2-{before,after}-hands-w{0,1,2,3,4}-arms1-{hands,hands-right}.png` and `.inspect/kit-s2-{before,after}-turntable-w0-arms1-{front,right,left,back}.png`.
- Eighteen additional final motion stills: `.inspect/kit-s2-after-motion-{run,sprint,crouch_walk}-aim0-t{0.2,0.5,0.75}-w0-arms1-{right,back}.png`. These sample poses, not continuous animation or before-motion comparisons.
- All 32 final images are valid 1200x900 PNGs captured after the corrected source; all 14 matched pairs preserve dimensions and alpha. Reports contain zero console errors and forbidden gameplay connections. Inventories: `.inspect/kit-session-2/{all-visual-diffs,capture-summary}.json`; reproduction wrapper: `rig-capture.mjs` in that evidence directory.
- Both independent reviews PASS, high confidence, no blockers: `.inspect/kit-session-2/review-integrity.md` and `review-visual.md`. Each reviewer directly opened all 32 final images plus all 14 baselines. Synthesis: `visual-qa-verdict.md`. The earlier journal hash was explicitly relabeled as the superseded candidate.
- **Player sentence:** “That looks like a field pack being carried, with the bedroll strapped underneath.” [Before/after gallery](.inspect/kit-session-2/gallery.md). Approval covers incremental carried gear; angular body/head, faction silhouette and remaining hand fit are open.
- Aside loaded the final port-8802 rig, returned an interactive snapshot and confirmed readiness and legacy model identity. Its documented screenshot call failed with “page.screenshot: browser CDP command timed out while capturing viewport screenshot before the default screenshot timeout completed”. The installed page API also lacks the attempted CDP helper. Reports/transcripts: `.inspect/kit-session-2/{aside-final,aside-native}/`. No final Aside screenshot or field-grey visual approval is claimed. Completed mandatory headless rig captures provide the rendered evidence.

#### Budgets and gates

- Meshy credits spent **0**; no generated/admitted assets or new downloaded GLB/texture bytes. The unknown provider balance was not used for generation.
- Client bundle 3,987,296 -> 3,989,239 bytes (**+1,943**); gzip 908,365 -> 908,744 (**+379**). Identical build options: `.inspect/kit-session-2/bundle-metrics.json`.
- Asset audit PASS: assetBytes 40,814,970; publicBytes **52,587,622**, below the current 60 MiB ceiling; largest file 8,025,108 bytes, below 25 MiB. Existing soldier quarantine/builder-hash issues remain visible and excluded from admission; no hash or gate was weakened.
- `pnpm typecheck`, `pnpm test`, `pnpm build:client`, `pnpm audit:assets`: all PASS on corrected source. Tests: **1,536 Vitest + 83 Node**; nine preexisting Vitest skips untouched. Logs: `.inspect/kit-session-2/{typecheck,tests,build,assets}.log`. LSP was unavailable because TypeScript server installation had previously been declined; both full TypeScript configurations passed tsc.
- Required map gate PASS: `node scripts/inspect-map.mjs --url http://localhost:8802 --shots relay,practice-two --prefix kit-s2-required`. `.inspect/kit-s2-required-report.json`: zero errors/forbidden connections. Relay: 38 calls, 230,200 triangles, 18 textures / 33.681 MiB estimated texture memory, median 6.9 ms, p99 7.1 ms, scene preparation 965.1 ms. Practice-two: 63 calls, 146,400 triangles, 26 textures. Counts match the same Session 1 static shots. Neither view includes changed remote gear, so those zero deltas do not measure its cost; role geometry counts and the bot hitch provide relevant checks. Device: RTX 5070, not the target laptop iGPU; no laptop qualification claimed.
- Required final TDM gate PASS: `node scripts/hitch-probe.mjs http://localhost:8802 150000 .inspect/kit-session-2/hitch-tdm.json --assert`. **120,238.6 ms**, **17,315 measured frames**, **two deaths and respawns**, zero console errors, shader recompiles, frames over 150 ms or stalled time. p99 histogram upper bound **8 ms**, maximum frame **13 ms**, maximum callback **6.3 ms**. First-damage/death windows PASS. Shared lease honored, including 704,130 ms queued; no other owner interrupted.
- Unchanged baseline hitch: 107,338.1 ms / 15,458 frames, two deaths, p99 upper bound 8 ms, max frame 14.8 ms, max callback 8.8 ms, zero errors/recompiles/frames over 150 ms. Samples differ in duration and combat trajectory; their difference is not a causal speedup. Evidence: `hitch-baseline.json` and `hitch-tdm.json` in `.inspect/kit-session-2/`.
- First-ready observed at 3,328.1 -> 3,263.3 ms in gameplay runs. Startup/warmup maximum was 283.0 -> 295.6 ms outside the gameplay gate; no hitch-free startup claim. Software rig first-view readiness was 9,673.5 -> 7,726.2 ms, with mixed per-view deltas (`rig-ready-metrics.json`); this is polling-observed software rendering, not normal-play or laptop speedup.

#### Cleanup and next default

- All mandatory gates and both reviews completed. Redundant before-motion/Aside queues and superseded candidate queues were canceled before browser launch; receipts remain in `.inspect/kit-session-2/`. No missing motion baseline or supplemental FFA pass is implied.
- Aside freshly listed zero owned port-8802/known-ID tabs. Verified Wrangler PID 22476's command line, stopped only its seven-process tree, verified no port-8802 listener or final-gate jobs. Headless tools completed browser/profile cleanup. Receipts: `aside-cleanup.json`, `process-cleanup.json`. Other streams' processes/tabs were untouched.
- Final source/bundle hashes equal the reviewed/tested files: `final-source-hashes.json` and `source-drift-check.json`. `git diff --check` passes; inherited receipt-bound CRLF warnings are not normalized away. No temporary product instrumentation remains. Required evidence retained.
- Open owner questions: none required. Default next-session priority remains admitted soldier geometry and real hand contact, with the shared FP loader and lease correction routed through the supervisor. Retain gear improvements while fitting the eventual accepted body.


### Session 1 - 2026-09-22: Field cloth and grounded support holds, arc 1

- Scope: kit-owned files in `apps/ironsight/**`; branch `ironsight-ww1-kit`; port 8802. No commit, push or deploy.
- Reference: R-G09, R-L12, R-L13, R-L14, R-L23. Target: restore ownership of baked support poses, preserve configurable identification/rim and opaque cover occlusion, separate faction cloth from identification color, and add no geometry, draw, texture or light. R-G12/R-G18 first-person projection remains unchanged; full contact certification remains partial.
- Baseline: clean worktree; kit plan absent. Supervisor reports 0.302 m support-hand gap versus 0.002 m tolerance. Claims about rejected WW1 assets are treated as open work.
- Meshy: zero credits spent; no generation planned for a transform/contact repair.
- **Actual diagnosis:** ordinary play and `?inspect=rig` use `authority: legacy`, `rigKind: model`, `renderedSource: legacy-model`. The candidate soldier record is quarantined. The historical 0.302 m wrist failure did not reproduce. The real regression was generic finger curl applied on top of the already-baked legacy support hold with no grip frame to solve against.
- **Change:** `remote-weapon.ts` still snapshots the current animated finger pose before skipping extra support curl when `gripL` is absent. Candidate contact solving, firing fingers, arm/weapon placement, authoritative state and animation timing are unchanged. Three failing legacy-pitch tests became green; candidate solving and restoration/repeat cases also pass.
- **Material change:** `ActorAppearance` retains a stable khaki or field-grey cloth uniform while `setColor` still controls the identification color and rim. `kitShader` uses existing attributes for filtered cloth grain, muted torso identification, dark boots and brown canvas. This is an active legacy-material pass, not replacement geometry or asset admission. Two material invariants failed first and now pass.
- **Inspection:** `?inspect=rig&team=0|1` selects faction for offline review; `scripts/inspect-rig.mjs` now records readiness time before capture. No ordinary-game query routing changed.

| Actual legacy support fingertip to nearest weapon triangle | Before, mm | After, mm |
| --- | ---: | ---: |
| Carbine thumb | 87.901 | 0.719 |
| SMG thumb | 86.793 | 0.623 |
| Shotgun thumb | 81.293 | 4.508 |
| Sniper thumb | 79.357 | 2.043 |
| Pistol index | 118.463 | 0.346 |

These are sampled tip-bone-to-triangle distances, not a certification of whole-hand penetration, orientation or every visible finger. The retained carbine support index is 49.102 mm away and the pistol support thumb 54.409 mm away. The firing hand remains unchanged. The separate unadmitted-candidate sweep found four long guns within 0.0041 mm of their contact frames and a 21.041 mm pistol reach gap in downward crouch locomotion; no skeleton stretching or threshold widening was shipped.

#### Evidence and wow check

- Aside baseline captures and actual source identity: `.inspect/kit-session-1/before/`. Raw Aside screenshot calls timed out; annotated captures succeeded for the first three weapon views. All browser tabs used port 8802 and were owned by this session.
- Required rig tooling: `.inspect/kit-s1-{before,after}-hands-w{0,1,2,3,4}-arms1-{hands,hands-right}.png` and `.inspect/kit-s1-{before,after}-turntable-w0-arms1-{front,right,left,back}.png`. Fourteen matched 1200x900 pairs; after reports have zero console errors and zero gameplay network connections.
- Named pixel comparisons for all fourteen pairs: `.inspect/kit-session-1/all-visual-diffs.json`. Dimensions match and alpha is intact in every pair. First carbine view changes 11.04% of pixels, concentrated on the actor.
- Independent `kit_visual_integrity` and `kit_visual_fidelity`: both PASS, high confidence, all fourteen after and matching before images opened. Reports: `.inspect/kit-session-1/review-integrity.md`, `review-visual.md`. Approval covers this incremental change; both retain the angular body/head and remaining hand-fit debt.
- Reproduction, toggle proof and real-asset sweeps: `.inspect/kit-session-1/investigation/{legacy-contact-findings.md,legacy-contact-before.json,legacy-contact-results.json,contact-transform-findings.md,contact-transform-results.json}`.
- **Player sentence:** “The squad has field-kit colors now, and the support fingers stay with the gun.” Before/after stills are the session's wow-check evidence; no full AAA or final WW1 silhouette claim.

#### Budgets and gates

- No Meshy calls, credits spent 0, no newly generated/admitted assets. No new geometry, textures, render passes or lights. New GLB/texture payload bytes: 0.
- Client bundle: 3,986,286 -> 3,987,296 bytes (**+1,010**); gzip 908,071 -> 908,365 (**+294**), measured with identical esbuild options and source maps. `.inspect/kit-session-1/bundle-metrics.json`.
- Exact receipt restoration added 1,252 bytes of metadata line endings relative to the normalized checkout; no JSON content or receipt hash changed. `.inspect/kit-session-1/{metadata-byte-delta.json,soldier-byte-restoration.json}`. The matching frozen weapon GLBs needed by preexisting tests were copied into ignored `.inspect/ww1-art/production-candidates-v3/` after verifying all five pinned hashes; none was newly published.
- Asset audit PASS: assetBytes 40,814,970; publicBytes 52,581,928 (below 60 MiB), largest file 8,025,108 bytes (below 25 MiB). Soldier candidates remain excluded/quarantined; their existing `soldier_builder_hash`/admission issues were not papered over.
- Typecheck PASS; build:client PASS; tests PASS: **1,518 Vitest tests + 83 Node tests**. Nine existing Vitest skips remain; this session added none. Logs: `.inspect/kit-session-1/{typecheck,build,tests,assets}.log`.
- Fourteen final rig captures PASS. First reported rig readiness 7,895 ms using the mandated software-rendered rig tool; this is not a normal-play or laptop-iGPU timing claim. No valid before readiness delta is available because timing instrumentation was added this session.
- Hardware Relay sample: 38 calls, 230,200 triangles, 33.681 MiB estimated textures, median 6.9 ms, p99 7.1 ms, scene preparation 956.2 ms. Device is RTX 5070, not a laptop iGPU. No comparative frame-time delta was measured; texture allocation delta is zero by the unchanged texture/resource path.
- Required map gate PASS: `node scripts/inspect-map.mjs --url http://localhost:8802 --shots relay,practice-two --prefix kit-s1-required`; both reports completed, zero console errors and zero forbidden gameplay connections. Evidence: `.inspect/kit-s1-required-report.json`.
- Required TDM hitch gate PASS: 107,460.8 ms measured gameplay, 15,459 frames, two deaths, zero console errors, zero shader recompiles, zero frames over 150 ms; p99 histogram upper bound 8 ms, maximum frame 19 ms, maximum callback 9.2 ms. Evidence: `.inspect/kit-session-1/hitch-tdm.json`.
- TDM first-ready was 3,039 ms. Startup/warmup includes a 302.7 ms maximum frame before the probe's measurement window; the gameplay PASS does not certify hitch-free startup. The gate and warmup policy were unchanged.
- Supplemental FFA and final Aside state confirmation were canceled before browser launch after prolonged GPU-lease contention. Another session's `ULW browser-current / trusted controls and content fault probes` held the lease from 10:59:47 UTC through the final 11:19:23 UTC check. Only this session's queued PIDs 54420 and 9820 were stopped; the lease owner was untouched. `.inspect/kit-session-1/queue-cancellation.json` and the two queue logs retain this limit. There is no FFA pass claim.
- Aside final screenshot attempt timed out; `.inspect/kit-session-1/aside-final/transcript.json` retains the failure and successful owned-tab closure. No final Aside screenshot or field-grey rendered approval is claimed. The fourteen completed headless rig pairs remain the final rendered evidence required by the brief; faction separation also has unit coverage.
- Cleanup: Aside listed zero tabs at `http://localhost:8802/`. Verified this session's Wrangler command line before stopping PID 46808 and its descendant processes; port 8802 has no listener. All started headless capture/probe browsers completed their cleanup. No other stream's process or tab was stopped.
- Closing status: all mandatory Session 1 gates PASS. Source/bundle hashes in `.inspect/kit-session-1/final-source-hashes.json` match the reviewed implementation; `git diff --check` passes. All changes remain in the kit lane. No commit, push or deploy.

#### Rejected intermediates and remaining limits

- Rejected the historical 0.302 m diagnosis after the existing test passed unchanged. Did not alter the base stream's test.
- Rejected applying a candidate-only reach result to gameplay; candidate pistol fit remains open.
- Did not enable quarantined assets or claim that recoloring solves the robot silhouette.
- Extra FP closeup inspector did not become ready because of the shared loader contract mismatch; the exact cross-stream request is recorded above. The precise required map command passed independently with both required shots and no console errors.
- Open owner questions: none required for this session. Default next-session priority is accepted soldier/hand geometry, with the shared FP loader repair routed through the supervisor.
