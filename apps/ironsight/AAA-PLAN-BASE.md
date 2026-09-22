# Ironsight base stream

## Scope

Session 1 repairs the supervisor gates on the WW1 checkpoint only. Work stays in
`apps/ironsight/**`; no visual features, commits, pushes or deployment. The base
lane explicitly permits minimal fixes pointed to by failing gates. Visual ownership
remains with world, kit and look. Frozen `AAA-PLAN.md` is untouched.

## Work plan

1. Completed: reproduced all seven failed test files and the asset-audit failure.
2. Completed: implemented minimal fixture, runner, asset-boundary and probe repairs.
3. Completed: all six supervisor gates passed on port 8800.
4. Completed: session record and evidence retained; owned browser sessions and port-8800 server stopped.

## AAA gap list

1. Completed: restore all checkpoint gates (the sole base-stream deliverable).
2. World, kit, look and UI fidelity work remains with its owning streams.

## Reference scorecard

The base stream changes no visual or gameplay design. Existing design scores are not
reassessed here. R-L14's measured performance subcriterion passes the existing gate;
its overall clarity/target-device score remains partial, with no new art-quality claim.

## Cross-stream requests

- Kit: historical Stage16 soldiers remain quarantined. The base gate repair excludes
  their GLB/metadata pairs from Wrangler assets using `public/.assetsignore`, keeping
  immutable admission and metadata hashes unchanged. A future admission must replace
  this exclusion with reviewed evidence; do not overwrite historical builder hashes.
- UI / supervisor: the supplemental Aside smoke check stays in `flow: preparing`
  at the weapons/effects stage even after 45 seconds in a visible, focused tab.
  The six required headless/CLI gates pass. See `aside-foreground-transcript.json`
  and `aside-foreground.png` in the session evidence directory. This separate
  browser-specific preparation issue is not repaired in the base gate-only lane.
- Look / supervisor: merge the one-line `inspectRelayUplinks()` selector repair
  with the probe updates. It reports current WW1 field aerials without changing art.

## Session log

### Session 1 - 2026-09-22: Green-up

All six supervisor gates pass. Supervisor baseline: typecheck/build passed; tests and
asset audit failed; inspect and hitch had not yet run.

Failure inventory (`.inspect/aaa-loop-base/session-1/test-before.log`):
- `combat-acceptance.tool.test.mjs`, `combat-scenario.test.mjs`,
  `map-failure-proxy.test.mjs`, `target-device-report.test.mjs`: Node test suites
  discovered by Vitest produce `No test suite found`. Route all four to the existing
  Node test phase; no tests are removed or skipped.
- `aim-contact.test.ts`: 0.098994949 m vs <0.001 m. Its synthetic hands lack the
  three palm landmarks, so the current solver never registers its arms. Add the
  required landmarks and retain the full-pitch contact tolerance.
- `visuals.test.ts`: 0.302208670 m vs <0.002 m. Same incomplete skeleton plus an
  obsolete wrist-to-palm assumption. Add an explicit identity palm basis and measure
  its surface (14 mm thickness) against the loaded fixture's `grip_l`; keep 2 mm and
  0.002 rad tolerances. Actual runtime presentation is unchanged.
- `tilemap.test.ts`: newly authored WW1 environment colliders were mistaken for
  integer tile-grid solids. Assert their authoritative membership separately, then
  retain integer grid checks and all four yard/four structure ramp checks.

Asset audit cause: the soldier record is intentionally quarantined and its historical
builder SHA differs from today's tool. Current runtime tests confirm these candidates
are refused, contradicting the supervisor's initial assumption that they render.
The asset gate formerly required quarantined candidates to be admitted while Wrangler
would upload them anyway. Exclude exactly four files at the actual deployment boundary;
verify those exclusions and all candidate integrity failures. Preserve the original
builder receipt, metadata and rejection. Only the historical builder-drift issue is
nonfatal for excluded candidates. Their audit still reports `valid: false`.

Wrangler's installed `createAssetsIgnoreFunction` confirms `.assetsignore` support;
official contract: https://developers.cloudflare.com/workers/static-assets/binding/.
No acceptance threshold, provenance hash or runtime asset selection is changed.

Additional browser failures measured after the original red gates were repaired:
- Inspector `Relay uplinks not loaded`: WW1 replaced the downloaded uplink with
  procedural `relay-field-aerial` nodes, while `inspectRelayUplinks()` still queried
  the old node name. Correct that single diagnostic selector; require two exterior
  aerials under the existing 5000-triangle limit and the duckboard/sandbag/wire kit.
  Include `/assets/ww1/environment/` in the request inventory. Keep the prohibition
  on the obsolete uplink asset and existing foreign-map/load-error checks.
- Inspector `Gameplay click failed to engage pointer lock`: the old center click
  hits the deployment panel, not its actionable button. Wait for the real
  `control-required` state and use a CDP mouse click on the displayed button.
- Hitch `timeout !!document.pointerLockElement`: same obsolete entry click. Use
  the displayed control button, retaining the pointer-lock assertion.
- Hitch `fewer than two deaths`: first run after entry repair recorded one death
  at 60.524 s, a respawn at 63.940 s, then stayed alive at `(3,59)` through 150 s.
  Final phase remained `live`; all performance checks passed (p99 8 ms, maximum
  frame 14.5 ms, no >150 ms frames, no recompiles/errors). The app releases pointer
  lock on death and returns to `control-required` on respawn. Make each ordinary
  probe click target the control button when present, otherwise the center for
  firing. No movement, bot, room, respawn or score logic changes.

Quarantine proof: `asset-serving.json` records 404 for all four excluded paths and
200 for the existing 2,913,320-byte `player.glb`. `quarantine-integrity.json` records
`PASS_QUARANTINED_STAGING16` including changed-GLB, changed-meta and forged-acceptance
rejection. Seventeen additional exclusion-boundary assertions pass. A read-only
`audit_cause` check found no additional code issue.

Retained failed runs: `inspect-before.json/png`, `inspect-control-before.json/png`,
`hitch-before.log`, `hitch-one-death.json` in the session evidence directory.

Reference: R-L14 performance/clarity guardrails. No scene styling, information or
quality settings change. Reference scorecard: R-M01–R-M20, R-G01–R-G20 and
R-L01–R-L13/R-L15–R-L23 are n.a. to this gate-only repair. R-L14's measured performance
subcriterion passes; overall clarity and the target laptop iGPU remain unqualified.

#### Final gates and measurements

Evidence root: `.inspect/aaa-loop-base/session-1/`.

| Gate | Result | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | PASS | `typecheck.log` |
| `pnpm test` | PASS: 175 Vitest files, 1509 tests; 83 Node tests | `test-final.log` |
| `pnpm build:client` | PASS | `build.log` |
| `pnpm audit:assets` | PASS | `audit-final.log`, `asset-serving.json` |
| `node scripts/inspect-map.mjs --url http://localhost:8800 --shots relay,practice-two` | PASS; no console/network errors or forbidden offline sockets | `inspect-pass.json`, `relay-pass.png`, `practice-two-pass.png` |
| `node scripts/hitch-probe.mjs http://localhost:8800 150000 .inspect/hitch.json --assert` | PASS; two deaths, zero recompiles/errors/>150 ms frames | `hitch-pass.json`, `hitch.log` |

- Existing 7 opt-in Vitest files / 9 skipped tests are unchanged. No test was deleted,
  skipped, or given a larger tolerance in this session. Node phase skips: zero.
- Hitch: 109226.3 ms measured through two deaths; p50 7 ms, p95/p99 8 ms;
  maximum measured frame 25.3 ms; maximum callback 7.6 ms; stalled time 0 ms.
  Original policy remains 1500 ms presentation / 150 ms main-thread / 25 ms p99 /
  5% stalled time. This run also has zero frames above the original 150 ms trigger.
- Relay inspector: 1920x1080, p99 7.1 ms, 38 draws, 230200 triangles,
  estimated textures 33.681 MiB. Preparation: construction 219.5 ms + preparation
  971.1 ms. Measured GPU is RTX 5070/ANGLE D3D11, not the target laptop iGPU.
- TDM first ready: 2794.6 ms; scene preparation 1150.6 ms. The retained startup
  window includes a 333.1 ms frame before ordinary hitch measurement. This is
  recorded, not relabelled as post-warmup acceptance or hidden by threshold changes.
- Deployable assets: 40814971 bytes; public total 52595262 bytes (50.16 MiB);
  maximum file 8025108 bytes. Excluded quarantine bytes: 8401858. No asset bytes
  were generated or rewritten; runtime texture delta is zero. Source public files
  remain available offline; only the four rejected paths are omitted from serving.
- Meshy credits: 0. Paid asset generation: none.
- Added negative regression: leading whitespace must not be trimmed into an accepted
  `.assetsignore` path, since ignore-pattern semantics differ. Red evidence:
  `quarantine-whitespace-red.log`; final exact-path checks pass in the full suite.
- LSP is unavailable (installation previously declined). Both TypeScript CLI projects
  and `node --check` on changed probe scripts pass. `git diff --check` is clean.
- Supplemental Aside QA is not a pass: the visible/focused page remains in the
  preparation overlay before pointer lock. Its screenshots/transcripts are retained
  and the exact concern is routed above. The required headless practice and two-death
  bot-round scenarios did pass. No claim of equivalent Aside readiness is made.

#### Observed result and scope

Wow check (base exception, no new visual feature): required fixed-camera stills were
opened and inspected. Relay renders; Undertow practice shows a usable Korean HUD,
health/ammo and the training objective. Player sentence: “I can enter practice and
return to the fight after respawning.” The current art and fallback weapon remain
baseline material for the world/kit/look/UI streams, not a claimed AAA improvement.

Rejected intermediate choices: do not rewrite the historical soldier builder hash or
admit quarantined assets; do not weaken the integer-grid/contact assertions; do not
restore the obsolete uplink just to satisfy the inspector; do not reduce the death
count or alter bots to satisfy the hitch gate.

Self-review: changes own only test fixtures/runner routing, deployment exclusions,
and diagnostic/probe behavior. The sole client change is the inspection node selector.
No new dependencies, application logging, runtime gameplay or visual features. Existing
large modules were kept intact for the requested minimal gate repair.

Concurrent changes left untouched: `scripts/inspection-lease.mjs`,
`tools/aaa-stream-kit.md`, `tools/aaa-stream-look.md`, `tools/aaa-stream-world.md`,
`tools/aaa-stream-ui.md`, and unrelated root `.omo/`, `artifacts/`, `exit=0`.

Open owner questions: none required for this lane. Default: preserve rejected asset
provenance and route remaining art/Aside concerns to their owning stream.

### Debug journal

- Environment: Windows, Node/ESM, pnpm, Vitest, Three.js, local Wrangler on port 8800.
- Initial app working tree is clean; unrelated root untracked files are left alone.
- H1: WW1 fixture assumptions are stale (grid boxes and grip coordinates). Compare
  failing values against authoritative map composition and loaded weapon sockets.
- H2: runtime presentation/admission has drifted. Check actual socket transforms,
  shipping GLB receipts and source hashes before changing code or metadata.
- H3: test suites fail at module load due to asset paths or environment resolution.
  Record every suite-load error from the full test run, then isolate its boundary.
- Temporary artifacts: `.inspect/aaa-loop-base/session-1/` holds retained gate logs
  and diagnostic evidence. Any diagnostic source copies there will be removed after
  root-cause confirmation. Required inspect/hitch outputs are retained evidence.
- Processes: any port-8800 server and inspection browsers started here must be stopped.
- Cleanup complete: all owned Aside tabs closed in `finally`, REPLs exited and GPU
  leases released. Headless probes closed their browsers. The verified Wrangler
  wrapper PID 56908 and its descendant processes were stopped (`cleanup.json`).
- Final gate line: TYPECHECK PASS | TEST PASS | BUILD:CLIENT PASS | AUDIT:ASSETS PASS |
  INSPECT relay,practice-two PASS (0 errors) | HITCH --assert PASS (2 deaths, 0
  recompiles, 0 frames >150 ms, 0 errors). No commit, push or deployment.
