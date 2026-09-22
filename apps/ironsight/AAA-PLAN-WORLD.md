# Ironsight AAA rebuild: world stream

Lane: `ironsight-ww1-world`, `D:/wt-ironsight-world/apps/ironsight`, local port 8801.
Scope: world-owned files in `tools/aaa-stream-world.md`. No commit, push, or deploy.

## AAA gap list

1. **Finish the Signal Station conversion arc (Session 3):** ruined village context, the wireless aerial and field-line equipment now establish the period. The playable core, oversized louvres and corrugated boundary still retain modern equipment silhouettes. Finish those remaining surfaces and period construction details against the existing collision shell before widening the arc.
2. Underpass Trench needs wet masonry, timber revetments and drainage identity.
3. Front Supply Depot needs timber freight/platform finishes and period rail equipment.
4. Add less regular damage, repair patches and human-scale use after each map's major period silhouettes are established.
5. Measure the finished three-map visual package on the actual laptop iGPU; desktop evidence is not that qualification.

## Session 2 work tracking

- [completed] Re-run the unchanged hitch assertion on port 8801; inherited source passed with two deaths, zero recompiles/errors/frames over 150 ms. Preserve source bytes and six headless/five Aside fixed-camera baselines. Shared lease diagnosis/request logged above.
- [completed] Implement Signal Station exterior village with one texture-free material, identical fallback/export source and field-equipment atlas repaint. Candidate shrinks skyline 1,168,772 → 661,416 bytes; 98 focused world tests pass.
- [completed] Capture matching ground/interior/overhead views in Aside and the required inspector; both independent visual reviews PASS/HIGH on all 12 fresh captures and 11 baseline pairs, with no blockers.
- [completed] All standing gates pass on the preserved source/build; measured deltas, cross-stream requests, source/capture hashes and cleanup are recorded. Owned runtime processes stopped, port 8801 clear. No commit, push or deploy.

## Session 1 work tracking

- [completed] Capture the unchanged Signal Station at fixed ground/interior/overhead cameras, including resource and frame metrics. `.inspect/world-s1-before-{overview,relay,cooling,freight,core-inside}.png` and report JSON; three readiness-confirmed Aside baseline captures also complete.
- [completed] Convert Signal Station surfaces within existing opaque geometry and add focused material/authority invariants; replace the exterior dish with timber wireless aerial. New material/mast tests pass, and typecheck passes.
- [completed] Capture and independently review the changed map; both visual reviewers pass the final build and matched stills.
- [completed] Finish runtime gates: headless inspection, final Aside captures and the unchanged bot TDM hitch assertion all pass after the shared GPU queue resumed.
- [completed] Global asset provenance audit passes after concurrent kit receipt line-ending restoration; integrated full tests also pass. World did not edit those files.
- [completed] Record measured deltas, wow check, cross-stream requests and final cleanup. Owned runtime processes stopped; no commit, push or deploy.

## Reference scorecard

World-owned conversion targets; unrelated reference rows are outside this session, not certified.

| IDs | Status | Evidence / target |
| --- | --- | --- |
| R-M01, R-M02, R-M03, R-M04, R-M05, R-M06, R-M07, R-M08, R-M09, R-M10, R-M11, R-M12, R-M13, R-M14, R-M15, R-M16, R-M18, R-M19, R-M20 | partial | Existing map layout retained; map invariants/timing and all three Relay audits pass. No new gameplay approval. |
| R-M17 | partial | Session 2 replaces cooling towers with original village ruins while preserving aerial prominence in ground/overhead views. Modern playable core forms remain Session 3 debt. |
| R-G09, R-L12, R-L13, R-L14 | partial | Session 2 ground/interior/overhead and Aside captures preserve visible routes and value separation, without new lights/passes/textures. Static evidence does not certify live soldier recognition or laptop-iGPU performance. |
| R-G01, R-G02, R-G03, R-G04, R-G05, R-G06, R-G07, R-G08, R-G10, R-G11, R-G12, R-G13, R-G14, R-G15, R-G16, R-G17, R-G18, R-G19, R-G20 | n.a. | Kit/combat/audio/UI work belongs to other streams or supervisor. |
| R-L01, R-L02, R-L03, R-L04, R-L05, R-L06, R-L07, R-L08, R-L09, R-L10, R-L11, R-L15, R-L16, R-L17, R-L18, R-L19, R-L20, R-L21, R-L22, R-L23 | n.a. | Gameplay, audio and interface flow remain outside the world lane. |

## Cross-stream requests

- **Session 2 kit/look integration follow-up:** first final hitch run failed solely on `field-carbine-parkerised-steel` program disposal/recreation at measurement +120,407/+121,692 ms (33→32→33 programs), during the transition to a warmup phase. No village shader was added, maximum frame 60.2 ms, zero frames >150 ms/errors. Public menu-vista/README writes overlapped that run. The fresh resumed run with frozen public assets **passes unchanged** (two deaths, zero recompiles/errors/frames >150 ms, maximum 12.7 ms), but ends live rather than in warmup: this does not prove the round-transition weapon lifetime issue fixed. Please retain that targeted investigation with kit/look. Evidence `session2-hitch-attempt1-summary.json` and `session2-resumed-hitch-summary.json`. No assertion was waived. `practice-two` also still shows the pre-existing grey weapon fallback (`world-s2-resumed-practice-two.png`); kit owns that integration. World changed no kit source.

- **Session 2 supervisor lease fix:** `scripts/inspection-lease.mjs:29` parses an empty EOF as JSON, while the retry filter at lines 70-73 handles only ECONNREFUSED/ECONNRESET. An ephemeral-port reproduction with production `acquireInspectionLease` returned the exact supervisor error; a valid owner response waited until its bounded timeout. Please classify zero-byte EOF as a transient owner-disappearance error and retry under the existing deadline; keep nonempty malformed JSON/protocol mismatch as hard errors, and add the empty-EOF handover case to `tools/audit-inspection-lease.mjs`. World cannot edit these files. The retained failure establishes zero response bytes, not why the previous owner closed; it occurred before browser launch. No GPU result can be inferred from that failure. World retries the unchanged gate under the mandatory shared lease.

- **Resolved kit gate blocker:** six initial builder/weapon-metadata hash mismatches cleared when concurrent line-ending restoration arrived in kit-owned files during final verification. World did not edit them. All nine observed non-world files match HEAD after CRLF normalization; `session1-concurrent-receipts.json` records their physical hashes. `pnpm audit:assets` now exits 0 with no authored/weapon-candidate issues; `session1-assets-integrated.log`. Preserve the physical receipt bytes and rerun this gate after integration; no audit threshold was changed.
- Supervisor QA tooling: installed Aside CLI 1.26.906.1630 no longer exposes `page.cdp.send`; `scripts/aside-scenarios/maps.mjs::openOwned` requires it and fails. Current `page.goto`, `page.evaluate`, `annotatedScreenshot` remain usable. Request a feature-detected native navigation/capture path for CDP-free Aside. World uses only a `.inspect/aaa-loop-world/capture-aside.mjs` adapter and does not modify shared scripts.
- **Resolved runtime queue issue:** final Aside initially exhausted its 1,800,000 ms GPU lease timeout; the first hitch attempt failed on Windows `ENOBUFS` during acquisition. The long-running unrelated owner released the lease before final handoff. World resumed both jobs, acquired the same mandatory lease, and passed Aside and hitch checks without changing shared tooling or stopping another session. Initial blocker evidence is retained in `session1-runtime-blocker.json`; final results are `session1-aside-verification.json` and `session1-hitch-summary.json`.

## Session log

### Session 2 - 2026-09-22: Signal Station conversion arc 2/3, ruined village and field lines

**Session 2 is green.** The retained Session 2 implementation and all 15 records in its source manifest were unchanged when this continuation resumed. Fresh typecheck, full tests, client build, asset audit, Relay map audits, headless inspection, Aside captures, both independent visual reviews and the unchanged bot hitch assertion have passed. Owned runtime processes are stopped.

Reference: R-M17, R-G09, R-L12/R-L13/R-L14. Targets: replace the unmistakable cooling-tower skyline with damaged masonry buildings, retain aerial prominence and readable playable silhouettes, preserve every collider and opening, and reduce shipped/resident resource cost without adding lights or passes.

#### Delivered increment

- Replaced the inherited cooling-tower skyline with eight original ruined brick buildings: real window openings, pitched roof remnants, broken gables, exposed rafters, chimney flues and rubble. Four exterior geometry batches share one opaque vertex-colour material, 12,674 triangles and no textures. `client/relay-skyline.ts` is the sole geometry source for export and failed-load fallback.
- Repainted the resident equipment atlas as timber stores panels, wood field telephones, paper orders and brass socket/cord patch boards. Updated zone signs to SIGNALS/WIRELESS/SUPPLIES and FIELD POST. Former white decorative strips use the existing dark timber finish. Atlas dimensions, supporting surfaces and allocations remain unchanged.
- The lazy skyline GLB and failed-load geometry use the existing asset cache ownership. Two simultaneous leases retain geometry until the last release; final release disposes the four geometries and shared material, and a later map retries the asset. An earlier eagerly allocated hidden fallback was rejected and removed after source review. The regression's original red/green evidence and real HTTP 503 fallback proof are retained.
- Updated the menu vista from the production renderer at the existing 1920×1080 dimensions. Original asset provenance and rebuild command are appended only inside marked world blocks. No paid generation, new texture asset, new light, render pass, gameplay or other-lane source edit.
- Collision/AO are unchanged: 225 boxes, eight ramps, existing -3/0/+3 m floors, doors/windows and all routes. Arena1, ground AO and architecture GLB hashes match the pre-session records. The skyline sectors are wholly outside playable bounds. No layout rebake is warranted for an unchanged occluding shell.

#### Verification in this continuation

- `session2-resumed-source.json`: all prior source/asset/build hashes match; current vista, provenance and ignore-file hashes added.
- `session2-resumed-{typecheck,test,build-client,audit-assets}.{log,exit}`: all exit 0. Full tests: 179 passing Vitest files / 1,521 passing tests, seven existing skipped files / nine existing skipped tests, followed by all 83 Node tests. No test or threshold weakened.
- `session2-resumed-{site,yard,interior}-audit.json`: all pass. Map geometry SHA256 remains `3f7643d722a2bc6a0dc8a00ffb0a504d66256af97a1c0f71af6063811e1b8c82`.
- Earlier source review: `session2-code-review-attempt2.md`, APPROVE/CLEAR, no remaining findings. Current sources match that reviewed manifest. Original fallback transport result: `session2-fallback-http.json`, one real HTTP 503, four fallback meshes and complete final cache disposal.

- `world-s2-resumed-report.json`: seven headless shots at 1920×1080 (overview, relay, cooling, freight, core-inside, vista, practice-two), zero console errors and zero forbidden offline network operations. `session2-resumed-inspect.exit`: 0.
- `session2-resumed-aside-after/`: five captures at 1440×900, each readiness-confirmed with no final error and the same URL/camera as its Aside baseline. `session2-resumed-aside-verification.json` includes owned-tab cleanup. The freight/interior cameras are supplemental views, different from the headless cameras; only compare each to its own Aside baseline. Native navigation can report a caught interactive-readiness timeout before the subsequent document/readiness check succeeds; no stale frame is accepted.
- `session2-resumed-visual-packet.json` and `session2-resumed-capture-hygiene.json`: all 12 PNG signatures/dimensions and hashes validated, every image newer than the current build, six headless and five Aside baseline diffs, unchanged production-source hashes. Pixel differences represent intentional conversion, not an exact-match target.
- `session2-resumed-hitch-summary.json`: original 150000 ms TDM invocation with `--assert`, exit 0, 110.8234 seconds / 15,960 post-preparation frames, two bot deaths, p50/p95/p99 histogram upper bounds 7/8/8 ms, maximum 12.7 ms, zero frames over 150 ms, zero shader recompiles and zero console errors. First damage/death windows peak at 8.2/9.0 ms. No gate/script/threshold change.
- LSP is not installed and the user previously declined installation. Both project TypeScript checks pass; no LSP-clean claim is substituted.

#### Measured deltas

The same fixed cameras on the desktop RTX 5070 / ANGLE renderer retain **6.9 → 6.9 ms** medians. Final ground-view p95 is **7.0–7.1 ms**, with maxima **7.1–7.2 ms**, and no measured ground frame over 16.7 ms. This is not the mid-laptop iGPU floor or an internet load benchmark.

| View | Draw calls before → final | Triangles before → final | Scene preparation ms before → final |
| --- | --- | --- | --- |
| Overhead | 42 → 45 | 231,432 → 231,004 | 957.5 → 938.8 |
| Relay | 38 → 40 | 228,824 → 225,382 | 361.3 → 581.2 |
| Cooling lane | 32 → 34 | 228,672 → 225,230 | 387.0 → 372.6 |
| Freight/trench | 24 → 26 | 228,144 → 224,702 | 379.6 → 374.1 |
| Core interior | 21 → 23 | 226,474 → 223,032 | 384.4 → 362.7 |
| Vista | 42 → 45 | 231,432 → 231,004 | 399.6 → 367.7 |

- Estimated resident textures: **33.681 → 32.348 MiB** (−1.333 MiB), 18 → 17 textures and 30 → 28 prepared shader programs. Draw calls rise by 2–3 for the exterior batches; submitted triangles decrease. First overhead preparation in the fresh inspector profile is 0.958 → 0.939 s, while the Relay navigation preparation is slower in this run; do not describe all load paths as faster.
- Skyline GLB: **1,168,772 → 661,416 bytes** (−507,356). Vista: **164,588 → 153,486 bytes** (−11,102). All-assets audit total: **40,814,970 → 40,298,169 bytes** (−516,801, including provenance text). Public set: **52,576,668 → 52,192,328 bytes** (−384,340, including generated bundle/sourcemap). Largest file: 8,025,108 bytes. The local checkout passes the 60 MiB/25 MiB caps; it does not reserve shared integrated headroom for this lane.
- Client bundle: **3,984,313 → 4,059,323 bytes** (+75,010); sourcemap: **7,776,622 → 7,834,073 bytes** (+57,451), including the deterministic failed-load builder. No new image or texture asset, no Meshy spend (**0 credits**). Detailed receipts: `session2-byte-delta.json`, `session2-resumed-render-delta.json`, `session2-resumed-audit-assets.log`.

#### Rejected attempts, limits and cleanup

- Initial hidden fallback ownership was rejected by source review and corrected through the existing asset lease; `session2-lifecycle-{red,green}.log` and `session2-code-review-attempt2.md` preserve the failure and approval. Original/exported geometry hashes match.
- First final hitch failure remains `session2-hitch-attempt1.*`; a subsequent queued retry was interrupted before this continuation. The fresh passing run is `session2-resumed-hitch.*`. No failed result was overwritten or portrayed as success. The exact round-transition weapon concern remains routed under Cross-stream requests.
- GPU queue time was 168.431 s for hitch, 336.960 s for headless inspection and 354.387 s for Aside. Queue delays are not rendering cost. All jobs held the mandatory shared lease; no unrelated owner was stopped or bypassed.
- `session2-resumed-cleanup.json` verifies the owned server wrapper/process tree before stopping it, with no remaining owned process and no listener on port 8801. Inspection/hitch exited normally through browser cleanup; the Aside report records closure of its owned tab. Supervisor and other lanes were left running.
- World-only scope preserved; pre-existing kit receipt CRLF bytes were neither edited nor normalized. No commit, push or deploy.

Both independent reviews approve this same source/capture manifest, **PASS / HIGH**, no blockers:

- `/root/world_s2_integrity`: `session2-resumed-integrity-review.md`; independently checked the real geometry/material system, exterior bounds, fallback lifetime, all 18 source hashes, 12 current images and 11 before comparisons. The evidence-only follow-up confirmed all five Aside diff records.
- `/root/world_s2_fidelity`: `session2-resumed-visual-fidelity.md`; directly viewed every current/baseline image and shipped vista, verified freshness/alpha/dimensions and accounted for all 223 hotspots across 11 comparisons. Exact region mapping: `session2-resumed-hotspot-trace.json`. No CJK or clipping regression; scope limitations remain explicit.
- Synthesized verdict: `session2-resumed-visual-qa.md`. Final gates/source/scope/cleanup receipt: `session2-resumed-final-verification.json`. The nine kit-owned paths already dirty at entry have no normalized text diff against HEAD; physical CRLF bytes were preserved. All reviews use the dirty-source manifest, not an invented commit SHA.

#### Wow check and next session

Fixed-camera comparisons show cooling towers replaced by ruined roofs and chimneys, with brown/brass field equipment replacing electrical panels. Player sentence: **“The wireless post sits inside a shelled town now.”** The remaining playable industrial forms are explicit Session 3 debt; this is an increment, not a whole-world AAA certification. No blocking owner question; default is to finish Signal Station's period shell next within existing collision authority.

### Session 1 - 2026-09-22: Signal Station material conversion

**Session 1 is green.** Typecheck, full tests, client build, asset audit, headless inspection, Aside captures, both independent visual reviews and the bot TDM hitch gate pass. Initial kit receipt and GPU queue blockers resolved before handoff. Authority: standing brief, Session 1 supervisor status, WW1 art concept and map contract. The world plan did not previously exist.

Reference: R-M17, R-G09, R-L12/R-L13/R-L14. Targets: recognisable earth/brick/timber at actual play cameras, preserve combat silhouettes and collision, reuse resident material resources, no new lights/passes, public assets below 60 MiB.

#### Delivered increment

- Retained baked material slots and loader API. Masonry gets staggered brick courses and recessed mortar; timber gets planks, end joints and longitudinal fibre with zero metalness; iron remains distinct. Relief changes shading normals only. Fine seams and plank contrast fade with their pixel footprint.
- Replaced Relay's slab grid, rectangular patches and maintenance clearances with deterministic soil wear, paired wagon ruts and scuffs in its existing R8 atlas. No new texture asset or sampler.
- Replaced the exterior satellite dish with an original braced timber wireless mast and open wire aerial. The existing signal event API, phases and timing remain. Complete landmark: 1,484 triangles, including cosmetic wave meshes; tested below 1,500 and outside playable bounds through every phase/alignment sample.
- No collision/layout change: 225 boxes and eight ramps, doors/windows, -3/0/+3 m floors, spawns and routes remain identical. Ground and architecture AO retained because their occluding shell is unchanged. The exterior aerial does not cast a new shadow. No new lights or render passes.
- Material authoring contract: `docs/RELAY-WW1-SURFACES.md`. This is the first conversion increment, not a claim that Signal Station or all three maps are finished AAA environments.

#### Verification and evidence

| Check | Result |
| --- | --- |
| `pnpm typecheck` | PASS after final source edit; `.inspect/aaa-loop-world/session1-typecheck.log`. LSP is not installed and the user previously declined it; both TypeScript project checks run. |
| `pnpm test` | PASS after the final concurrent receipt restoration: 177 Vitest files / 1,517 tests; seven existing skipped files / nine existing skipped tests. Then 83 Node tests pass. `session1-test-integrated.log` and `.exit` (0). Earlier complete reviewed-source runs also passed. |
| Final focused map/material tests | PASS: 81 tests across material residency, aerial bounds, map invariants, timing and WW1 map contracts; `session1-focused-final.log`. |
| `pnpm build:client` | PASS; `session1-build.log`. |
| `pnpm audit:assets` | PASS / exit 0 after concurrent kit receipt line-ending restoration; `session1-assets-integrated.log` and `.exit`. Initial failures retained in `session1-assets-before.log`, `session1-assets-final.log`, `session1-kit-hash-diagnosis.json`. Existing quarantined soldier-candidate diagnostics remain non-gating; world edited no kit receipt or threshold. |
| Relay site/yard/interior audits | PASS; `session1-{site,yard,interior}-audit.json`; map SHA256 `3f7643d722a2bc6a0dc8a00ffb0a504d66256af97a1c0f71af6063811e1b8c82`. |
| Required headless inspection, port 8801 | PASS with `--shots overview,relay,cooling,freight,core-inside,practice-two`; zero errors and zero forbidden offline network operations. `.inspect/world-s1-final-report.json`. `practice-two` exercises arena2, not two clients. |
| Source review | APPROVE / CLEAR, no blockers; `.inspect/aaa-loop-world/session1-code-review.md`. |
| Independent visual QA | PASS / HIGH, no blockers from both implementation-integrity and visual-fidelity reviewers; `.inspect/aaa-loop-world/session1-visual-qa.md`. Both reviewed all six final images and five matching baseline pairs against the unchanged source manifest. |
| Aside final captures | PASS after the queue resumed: all three fixed cameras ready, matching 1440×900 viewports, owned-tab cleanup recorded; `session1-aside-after-resumed.log` / `.exit` (0), `session1-aside-verification.json`. Initial timeout preserved separately. |
| `hitch-probe.mjs` on port 8801, 150000 ms, `--assert` | PASS / exit 0: two bot deaths, 16,738 measured frames over 116.271 s; p99 histogram upper bound 8 ms, maximum 28 ms, zero frames over 150 ms, zero recompiles, zero console errors. `session1-hitch.json`, `session1-hitch-summary.json`, `session1-hitch-resumed.log`. No assertion changed or waived. |

Five matched 1920×1080 camera pairs: `.inspect/world-s1-before-{overview,relay,cooling,freight,core-inside}.png` → `.inspect/world-s1-final-{overview,relay,cooling,freight,core-inside}.png`. Each has `session1-<shot>-diff.json`; the captures have valid PNG signatures, matching dimensions and intact alpha. Diff percentages measure intentional conversion, not an exact-match target.

Aside baseline: `.inspect/aaa-loop-world/session1-aside-before/` has three readiness-confirmed captures at the same Relay/cooling/overhead cameras, actual 1440×900 viewport, plus owned-tab cleanup. The evidence adapter uses the inspector's static mode because 151 timing frames are too slow under Aside's observed frame delivery. These captures are visual evidence, not performance qualification.

Final Aside counterparts are in `session1-aside-after/`, directly inspected by the parent. All three camera URLs and dimensions match the baseline, with intact alpha. `session1-aside-{relay,cooling,overview}-diff.json` ratios are 0.6405 / 0.6211 / 0.8260; these trace intentional material/landmark changes. Red capture borders/number markers are Aside annotations, not game UI.

#### Measured deltas

`session1-render-delta.json` compares the same RTX 5070 / ANGLE / 1920×1080 cameras. All four ground-level medians remain **6.9 → 6.9 ms**; p95 remains about **7.0–7.1 ms**. Cooling's isolated maximum is **7.2 → 13.9 ms**; other final maxima are 7.1 ms. No ground-level frame in this capture exceeds 16.7 ms. This is a desktop observation, not the laptop iGPU floor.

| View | Draw calls before → final | Triangles before → final | Scene preparation ms before → final |
| --- | --- | --- | --- |
| Overhead | 42 → 42 | 232,808 → 231,432 | 971.6 → 1,082.4 |
| Relay | 38 → 38 | 230,200 → 228,824 | 392.6 → 368.8 |
| Cooling lane | 31 → 32 | 227,508 → 228,672 | 383.0 → 404.4 |
| Freight/trench | 24 → 24 | 227,304 → 228,144 | 364.1 → 390.3 |
| Core interior | 21 → 21 | 226,474 → 226,474 | 383.0 → 447.7 |

- Estimated resident textures: **33.681 → 33.681 MiB**. Shader programs: **29 → 30**, prepared before play. Geometry submission varies by aerial visibility; it is not a uniform per-camera triangle reduction.
- First map preparation (first overhead navigation in fresh inspector profile): **0.972 → 1.082 s**, including asset/render preparation. This is not an internet first-load benchmark.
- Separate live TDM hitch measurement: **116.271 s / 16,738 frames**, p50 histogram upper bound 7 ms, p95/p99 upper bound 8 ms, maximum 28 ms. First damage/death windows max 8.1 / 13.6 ms. Pre-measurement startup still contains a 356 ms maximum in the first-ready window; the unchanged gate measures gameplay after preparation. This is one TDM pass, not a five-run TDM/FFA or laptop-iGPU qualification.
- World-only assets: **40,814,000 → 40,814,000 bytes** (delta 0). World-only public inventory, applying existing `.assetsignore`: **52,578,447 → 52,575,698 bytes**. Concurrent restoration of 970 CRLF bytes across five kit metadata files brings the final passing audit to **40,814,970 asset bytes / 52,576,668 public bytes**, still below 60 MiB. Largest file 8,025,108 bytes, below 25 MiB.
- Bundle: **3,986,286 → 3,984,313 bytes** (−1,973); sourcemap −776; world-only public delta −2,749 bytes, integrated total delta −1,779 bytes. `session1-byte-delta.json` is the isolated world comparison; `session1-assets-integrated.log` is the final inventory. Meshy credits spent **0**; new asset files **0**.

#### Rejected intermediates and local setup

- `.inspect/world-s1-after-*.png` is the first material attempt, rejected for overly mottled ground. Final output lowers earth contrast/relief, strengthens ruts and fades distant plank-value variation. Do not use the `after` prefix as final evidence.
- A first mast draft exceeded the 1,500-triangle test. Fewer overlapping mast collars and lower wave tessellation brought it to 1,484 without widening the threshold.
- The original full test run failed because this worktree lacked five offline kit fixture GLBs. Restored only new files under `.inspect/ww1-art/production-candidates-v3/` from the existing shipped GLBs after verifying every source hash against the exact test/admission contract. No kit source, shipped asset or test was edited. Receipt: `session1-fixture-restoration.json`; affected tests then passed and the full suite passed.
- The legacy Aside helper first failed on absent `page.cdp.send`, then the normal 151-frame capture exceeded its deadline. The world-only evidence adapter feature-detects unavailable CDP and uses existing static inspection cameras. Shared QA tooling remains untouched.
- One foreground capture command hit the shell timeout while waiting for another stream's GPU lease, before opening its browser. It was retried as an owned background job; final capture acquired the same mandatory lease after 375.4 seconds of queueing. Queue time is not frame time.
- Final Aside initially exhausted its complete 30-minute queue budget. The queued hitch retry was also stopped during an initial cleanup, with no browser children and without touching the unrelated owner. A final availability check then observed that owner release the GPU, so the owned server and both jobs were resumed. Aside acquired the lease after 163.948 s and passed; hitch acquired it after 270.887 s and passed. Initial queue failures remain evidence, not substituted gameplay results.

#### Cleanup and handoff

`session1-cleanup.json` records verified process identity before stopping the resumed port-8801 Wrangler tree and confirms no owned runtime processes remain. Successful headless inspection and hitch probes exited through browser/profile cleanup; both Aside reports record owned-tab cleanup. Earlier cleanup is retained as `session1-cleanup-attempt1.json`. The reviewed source and built client remain unchanged, identified by `session1-source.json`; final scope/hash/port verification is in `session1-final-verification.json`.

All standing gates passed against the reviewed world source and the final physical receipt state. Concurrent non-world line-ending changes are recorded separately from world-owned edits; none was reverted or authored by this stream. No approval, commit, push or deployment was attempted.

#### Wow check and next session

Before/final stills replace the grey panel yard and satellite dish with brick/timber surfaces, wagon-worn earth and a wire aerial. Player sentence: **“This feels like a timber signal post built into a battered brick yard.”** The remaining industrial skyline and equipment are visible debt, ranked first for the next world pass.

Open owner questions: none blocking. Default: complete Signal Station's period exterior context next before broadening to the other two maps, with collision authority and the current camera set retained.
