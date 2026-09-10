# Ironsight AAA assets stream

Lane: `ironsight-aaa-assets`, `D:/wt-ironsight-assets`, app scope only. Local port
8797. No commit, push or deploy. Map/gameplay integration belongs to other streams.

## AAA gap list

1. **Soldier silhouettes with realistic prompt language.** Two helmets and the
   plate carrier remain rejected. Remove the old low-poly art wording, inspect
   clean manufactured/fabric silhouettes, and use the new opt-in normal repair
   only where the underlying geometry is sound. No blind bulk regeneration.
   Do not attach the accepted hollow chest rig as a flat armour plate. Prioritise
   a clean helmet shell and actual flat attachment geometry over more generic kit.
2. **Stationary generator and combat emplacements.** Generator rejected twice:
   removing the wheels did not fix folded panels or malformed pipework. A revised
   realistic-construction prompt is queued but unspent; use a new output folder
   for any deliberate third attempt. Pair with a defensive barrier once the main
   stream names its placement. Recovered fuel drums are delivered in Session 2.
3. **Integrate and judge supplies in actual map lighting.** Seven library names
   and before/after gallery evidence exist. Main owns placement/collision and
   must measure integrated draws, first load, and soldier contrast before claiming
   an in-map improvement. Do not hide weaker geometry by calling it a hero prop.
4. **War-worn vehicles and skyline.** Generate against named map views. The
   existing uplink/transformer are legacy distant silhouettes, not new close-up
   fidelity approvals. Replace them when a close player view warrants the spend.

## Reference scorecard

| Reference | Status | Checkable target / evidence |
|---|---|---|
| R-M03 | met | Seven-entry gallery asserts metre bounds/base pivots; crates 1.15 m, drums .9 m. Drums stay decoration, not enlarged waist cover; library supplies no collision. |
| R-M08, R-M13, R-M17 | partial | Supply silhouettes now include a worn three-drum cluster. Generator still rejected; placement and wayfinding remain with main. |
| R-G09, R-L12, R-L13 | partial | Inspect kit at human scale; equipment adoption does not approve rig attachment or override team read. |
| R-L14 | partial | No import-time fetches; seven individual requests even after repeated loads; 18.667 MiB all-library textures. Session 2 gallery p99 7.3 ms; final TDM/FFA PASS. RTX 5070 checks do not prove the iGPU floor or fix the existing hitch issue. |
| R-M01, R-M02, R-M04, R-M05, R-M06, R-M07, R-M09, R-M10, R-M11, R-M12, R-M14, R-M15, R-M16, R-M18, R-M19, R-M20 | n.a. | Map layout and match telemetry are owned by main. |
| R-G01, R-G02, R-G03, R-G04, R-G05, R-G06, R-G07, R-G08, R-G10, R-G11, R-G12, R-G13, R-G14, R-G15, R-G16, R-G17, R-G18, R-G19, R-G20 | n.a. | Gunplay, animation and audio are outside this library session. |
| R-L01, R-L02, R-L03, R-L04, R-L05, R-L06, R-L07, R-L08, R-L09, R-L10, R-L11, R-L15, R-L16, R-L17, R-L18, R-L19, R-L20, R-L21, R-L22, R-L23 | n.a. | Match flow, UI, combat and settings are owned by other streams. |

### Library ledger

| Asset | Status | Shipped GLB bytes | New credits / source session | Verdict |
|---|---|---:|---:|---|
| field-radio-pack | registered, existing | 260176 | 0 | Current vertex-colour version; no PBR duplicate. |
| relay-field-sandbags | registered, existing | 83456 | 0 | Single sack; placement/assembly remains in map lane. |
| relay-uplink | registered, existing | 279624 | 0 | Legacy distant communications landmark; close-up replacement is a later gap. |
| switchyard-transformer | registered, existing | 243392 | 0 | Legacy distant power landmark; no new model/texture. |
| field-chest-panel | adopted for static dressing | 229180 | 0 | Full hollow rig, not a flat plate; 3550 triangles, two 512px WebP images. |
| ammo-crate-stack | adopted, S1 | 238624 | ~30 allocated / S1 | Worn closed crates, 2840 triangles, three 512px WebP images. |
| fuel-drum-cluster | adopted, S2 | 195664 | ~30 allocated / S2 | Three battered drums, 3119 triangles, two 512px WebP images; repaired shading, preserved geometry/UVs. |
| field-helmet | rejected | 0 | 0 | Folded visor, orange strap protrusions and angular hardware. |
| field-helmet-shell | rejected | 0 | 0 | Crumpled dome, top protrusions and collapsed brim. |
| field-plate-carrier | rejected | 0 | 0 | Long hollow torso, distorted pouches and folded surfaces. |
| field-generator, S1 | rejected | 0 | ~30 allocated / S1 | Unwanted wheel/trailer, broken frame and poor cabinet silhouette. |
| field-generator, S2 | rejected | 0 | ~30 allocated / S2 | Wheel-free but folded cabinet, warped grilles and malformed orange pipework; normal repair did not recover the shape. |

The **actual Session 1 debit was 60**, account 1230 -> 1170. Individual 30-credit
figures are allocations from the measured job price. The original concurrent
receipts each show the shared 60-credit account interval; never sum them to 120.
Historical kit charges remain in Sessions 83/84, not charged again here.
**Session 2 also debited 60**, account 1170 -> 1110, one adopted and one rejected
job. Batch receipt: `.inspect/assets-session2-meshy/batch-1789054473454.json`.
Assets-stream spend to date is **120 measured credits**. The separate overhaul
programme total still requires the supervisor's reconciliation noted below.

### Placement API

| Stable name | Metres X / Y / Z | Origin / usage |
|---|---|---|
| field-radio-pack | .26 / .46 / .18 | Base centre; controls -Z; existing radio fitting stays separate. |
| relay-field-sandbags | .67 / .235 / .44 | Base centre; long axis X; one sack. |
| field-chest-panel | .510897 / .48 / .382378 | Base centre; pouches +Z; static supply dressing only. |
| ammo-crate-stack | .531171 / 1.15 / .598316 | Base centre; closed vertical stack; match collision if in play. |
| fuel-drum-cluster | 1.490802 / .9 / 1.507426 | Base centre; horizontal drum round end +Z; static dressing, no explosion behavior, preserve .9m height. |
| relay-uplink | 7 / 8.86056 / 2.69281 | Base centre; wholly outside playable boundary. |
| switchyard-transformer | 7 / 5.00102 / 3.42663 | Base centre; wholly outside playable boundary. |

```ts
import { createPropLibrary } from './prop-library.js';
const props = createPropLibrary(); // one per map lifetime, no downloads yet
const crates = await props.load('ammo-crate-stack'); // map loading stage
crates.position.set(x, floorY, z); // base pivot already centred in metres
crates.rotation.y = yaw;
scene.add(crates); // placement/collision remains the map author's responsibility
// At map teardown: remove instances, then props.dispose().
```

Clones have independent transforms and share immutable geometry/materials.
Clone materials before customising, and dispose any caller-owned clones separately.
Load failures reject and can be retried; disposal also covers pending loads.

## Cross-stream requests

- Main: `await props.load('fuel-drum-cluster')` is ready for Relay supply dressing
  beside COMMS or a future generator bank. Its full envelope is 1.490802 x .9 x
  1.507426 m, base-centred, horizontal drum end +Z. Keep outside play or within
  matching authoritative cover; do not stretch it to waist height or imply an
  explosive mechanic. Load before scene warm-up, merge repeated instances where
  appropriate and dispose at map teardown. See the Session 2 fixed-camera gallery.
- Supervisor/main: freeze public writes before runtime gates. The first S2 FFA
  probe crossed Wrangler reloads while this stream published the GLB/metadata;
  its room reset and later callback reached 196.9 ms (gate FAIL). The final
  unchanged-build FFA passed. Preserve both reports; this is not a renderer fix
  or proof that hot reload alone caused that callback. The owning stream should
  keep the existing hitch investigation separate from this unused asset library.
- Main: import `createPropLibrary` during map loading, use `ammo-crate-stack`
  for Relay/COMMS supply dressing and `field-chest-panel` on supply shelves.
  A crate is .531171 x 1.15 x .598316 m; match the server collider if accessible,
  otherwise keep it wholly outside play. Preload before normal scene preparation,
  merge repeated instances where appropriate, and dispose the map library on exit.
  No placement or collision files were edited by this stream.
- Main/combat: do not attach `field-chest-panel` as a flat rig plate: Meshy returned
  an entire hollow vest. Existing radio is retained. Rejected helmet/plate-carrier
  candidates remain inspection-only. Team readability, skinning, merged draws and
  hit geometry belong to the fitting stream.
- Supervisor: integrate `public/assets/props/.gitignore` with its explicit
  seven-original allowlist and the three audited library additions. Root `.gitignore` was not
  touched; purchased GLBs remain ignored. Also retain the new `.inspect` gallery
  sources/evidence when moving this workstream's artifacts (they are ignored).
- Supervisor: reconcile programme accounting separately from the account balance.
  Session 89's retained README says 1000 authorised credits remained before this
  stream, implying 940 after this session; the status header uses account 1230.
  Both permit this 60-credit batch and leave more than the 200-credit reserve.
- Main/supervisor: TDM `--assert` passes the existing Session 74 policy, but the
  diagnostic first-damage window still has an **805 ms presentation gap**. Its
  max animation callback is 24.2 ms and shader recompile count is zero. The new
  library is not imported by the game, so no new prop was involved. Retain
  `.inspect/assets-session1-hitch-tdm.json` for the existing hitch investigation;
  do not interpret the policy PASS as a hitch-free player experience.

## Session log

### Session 2 - 2026-09-11: Field supply arc - recovered fuel drums

Reference: R-M03, R-M08, R-M13, R-L12/14. Target: a readable closed stationary
generator and a grounded fuel supply cluster, each <=4000 triangles, 512px WebP,
base-centred metre bounds, one lazily loaded asset per stable name. Review each
thumbnail and shrunk GLB from three angles and capture the same gallery camera
before/after with a 2 m reference. Integration/collision remain in the map lane.

Baseline: clean `ironsight-aaa-assets` branch; public 36,353,050 bytes, assets
29,300,907 bytes, max file 7,183,364 bytes. Status's stricter 60-credit session
cap / 300-credit reserve retained. Verified account balance 1170; launched two
jobs with `--concurrency 4 --only field-generator,fuel-drum-cluster --out
.inspect/assets-session2-meshy --budget-credits 60 --reserve-credits 300`.
The generator uses Session 1's corrected closed-cabinet/no-wheels prompt.
The batch receipt records the shared debit; overlapping job intervals are not
summed. Programme-wide accounting remains a supervisor request above.

**Delivered.** One adopted prop: `fuel-drum-cluster`, three battered olive drums
(two upright, one horizontal), 1.490802 x .9 x 1.507426 m, base-centred and Y-up.
The prompt asked for four; the returned three-drum composition was reviewed
and accepted as static supply dressing. One material, two embedded 512px WebP
images, 3119 triangles. Its stable lazy entry, explicit ignore/audit allowlist
and SHA256-bound provenance are published. No map, gameplay, soldier fitting,
light, pass or existing public GLB was changed.

**Generation and rejection.** Both jobs finished in four minutes. Exact batch
debit **60 credits**, account **1170 -> 1110**; estimated 30 per job. The stricter
60/session and 300-reserve status limits were respected. Source models:
generator 7,167,356 bytes, drums 7,171,576 bytes. Generator rejected again after
thumbnail, front/side/back, normal-map-free, clay and normal-repair inspection:
the closed wheel-free silhouette improves on S1, but the folded cabinet panels,
warped grilles and malformed pipework fail plausible manufactured construction.
Neither generator variant is public. No further paid task was submitted.

The initial drum shading was also rejected. Removing the generated normal map
alone did not fix it; smoothing without welding left disconnected faces.
Welding coincident seam vertices (4233 -> 1566 in Blender) and rebuilding
normals at a 50-degree split recovered the cylinder shading. This is now an
explicit `shrink-glb.py --smooth-angle-deg 50` option, never a default or a
blanket change to existing assets. Do not use it on the overlapping kit. The
final source-to-shipped command also uses `--size 512 --webp --height-m .9
--omit-normal-map`. The oriented triangle/UV comparison proves that all 3119
triangles, positions and winding survived at 0.1mm / .0001 UV tolerance:
`.inspect/assets-session2-geometry-check.json`. No face winding was recalculated.
The faceted initial, no-normal-only and smooth-only variants remain inspection
evidence, not alternative public assets.

Future prompts now ask for realistic manufactured construction and clean
shading instead of “low-poly”; the API still requests 3000 triangles. The
generator's next prompt emphasises straight doors and attached pipework.
This is a hypothesis to test next session, not a claim about an ungenerated
result. `node --check tools/meshy-batch.mjs` and a completed-batch `--dry-run`
pass; the dry run selects zero jobs and spends nothing. Historical prompts and
task IDs remain in the receipts so the wording change does not rewrite history.

**Measured deltas and first load.** Adopted GLB **195,664 bytes (0.1866 MiB)**.
Including metadata, README and allowlist, assets grow **202,630 bytes** to
29,503,537; rebuilt public is **36,555,680 bytes (34.862 MiB)**, same +202,630
delta. Max file remains 7,183,364 bytes; 60 MiB / 25 MiB caps pass. The new prop
adds **2.667 MiB** estimated RGBA+mips residency when loaded; omitting its
normal saves **1.333 MiB**. The complete seven-name library is 17,873 triangles,
seven materials, fourteen textures / **18.667 MiB**, and seven prop draws
(18 including the gallery's mannequin, ground and grid).

Cold-page local gallery load/decode and renderer preparation: **715.2 ms**;
drum load/decode **353.6 ms**, HTTP request duration **337.4 ms**, 195,664 response bytes.
These are localhost measurements, not internet download estimates. Across
180 post-warm-up frames, p50 **6.9 ms**, p99 **7.3 ms**, max **7.6 ms**. Six
shader programs stay six. Import-time fetch count zero; seven asset requests,
one per stable name even after repeat loads. Clone isolation, shared buffers,
metre bounds/base pivots and disposed-loader rejection pass. Report:
`.inspect/assets-session2-gallery-final.json`. The URL is absent from the
game bundle, so this session adds **zero game downloads/resident textures**
until main performs the requested lazy placement. Integration must be remeasured.

**Visual review and wow check.** Same-camera before/after files:
`.inspect/assets-session2-gallery-final-field-power-{before,front}.png`, plus
`...-equipment-{before,front}.png` and `...-all-{before,front}.png`. The full
row includes every adopted prop and the 2m figure. All seven names have final
front/side/back shots; the shipped drum byte sequence was reviewed before
adoption in `.inspect/assets-session2-final-review-fuel-drum-cluster-*.png`.
Candidate, no-normal, clay, smooth-only and welded comparisons are retained
under the corresponding `assets-session2-*` prefixes. Player sentence:
**“Those battered fuel drums make the supply post look used and abandoned in
a hurry.”** This is an isolated library wow check; no in-map spectacle or
generator delivery is claimed. R-M03 and asset-budget targets met; wayfinding,
soldier contrast and actual map placement remain partial with their owning stream.

**Validation.** `pnpm typecheck`, `pnpm test` (689 pass / 6 skip, 92 files pass /
4 skip), `pnpm build:client`, `pnpm audit:assets` PASS. Logs are
`.inspect/assets-session2-{typecheck-final,test-final,build-final,audit}.log`.
Required map inspection on **8797**: `--shots relay,practice-two --prefix
assets-session2-map`, zero console errors and zero forbidden network requests.
Report: `.inspect/assets-session2-map-report.json`. Relay: 30 draws, 25.681 MiB
textures, median 7 ms / p99 13.9 ms; construction 239.8 ms + preparation
1197.2 ms. Rendering checks use RTX 5070 at 1920x1080, not a mid-laptop iGPU
claim. Test/build scope remained the existing app scripts; no new npm package.

Required-style hitch acceptance, 150000 ms maximum and `--assert`:

| Mode / run | Gate | Natural deaths | Recompiles / errors | p99 upper | Max frame / callback | >150 ms frames |
|---|---|---:|---|---:|---|---:|
| TDM | PASS | 2 | 0 / 0 | 8 ms | 23.1 / 18.6 ms | 0 |
| FFA initial, crossed reloads | FAIL, retained | 2 | 0 / 0 | 19 ms | 198.1 / 196.9 ms | 1 |
| FFA final, public writes finished | PASS | 2 | 0 / 0 | 19 ms | 123.6 / 10.4 ms | 0 |

Reports: `.inspect/assets-session2-hitch-{tdm,ffa,ffa-final}.json` plus logs.
The initial FFA room reset during Wrangler's public-asset reload; the stall
occurred later at 49.201 s with profiler samples in `setValueV1f`. Both the
reload and failure are retained; no causal driver/hot-reload attribution is
asserted from those sparse samples. The first all-library gallery also hit a
fetch failure during reload; all seven URLs returned 200 once stable and the
final run was clean. Runtime checks were then performed with public writes
finished. Final first-damage/death windows pass too: TDM 7.9 / 8.7 ms, FFA
27.9 / 30.8 ms. No gate policy, browser flags, shader warm-up or threshold was
changed. This is assets validation, not a five-pair hitch-fix claim.

Cleanup: stopped only this session's validated pnpm/Wrangler process tree for
port 8797; inspection browsers close in their runners. Other stream servers
and the assets supervisor are left running. Final `git diff --check` and lane
audit PASS: all nine tracked/untracked paths are assets-owned, under the app;
new ignored inspection artifacts also remain under its `.inspect/` directory.
Port 8797 has zero listeners and no Session 2 gallery browser remains.
No commit, push or deploy.

Open owner questions/defaults: none block progress. Keep the generator rejected,
use the drums as static dressing, keep 60/session and a 300-credit floor until
the supervisor reconciles the status header, and prioritise clean soldier kit
with the revised prompt style next. Main owns the visible in-map payoff.

### Session 1 - 2026-09-11: Field supply library

Reference: R-M03, R-M08, R-M13, R-G09, R-L12/13/14. Targets: stable lazy registry,
base-centred metre bounds, <=4000 triangles per newly adopted prop, 512px WebP,
all adopted props shown at common scale with a 2 m figure; public <=60 MiB.

Baseline: clean branch; `pnpm audit:assets` PASS. Public 35,850,349 bytes;
assets 28,822,600 bytes. Account balance checked: 1,230 credits. The stricter
status header's 60/session cap and 300-credit floor are used despite the newer
150/session/200-reserve ceilings. Two jobs reserve 60 credits, within either rule.
Raw outputs and evidence stay under this worktree's `.inspect/assets-session1-*`.
Prior soldier sources were missing locally; copied read-only from the main
worktree's retained Session 83/84 sources into new local inspection directories.

Delivered: six-entry lazy registry and map-scoped cleanup, two newly adopted
GLBs, explicit original allowlist, byte-verified provenance, and a standalone
gallery without changing `map-inspect.ts`, `scene.ts`, map layout or gameplay.
`shrink-glb.py` can uniformly fit a metre height and base pivot and omit a
rejected generated normal map. Default existing shrink behaviour is retained;
its report now counts actual triangles. Both new models were inspected as
shrunk GLBs before copying into public.

Generation tools now default to a 60-credit plan, reject reserves below 200,
defer jobs beyond budget, validate selections, refuse accidental re-submission
over existing models/task receipts, record preview/refine IDs immediately,
serialize manifest writes and report one batch debit. No additional paid call
was used to test the fix. A local fake generator verifies actual concurrent
accounting, budget deferral, reserve checks, completed skips and interrupted
job refusal in `.inspect/assets-session1-batch-check.json`.

**Measured deltas and first load.** New GLBs total 467,804 bytes (0.446 MiB).
With metadata/provenance/allowlist, the asset directory grows 478,307 bytes to
29,300,907. Rebuilt public total is 36,353,050 bytes (34.67 MiB), +502,701 from
the initial audit (includes refreshed ignored build outputs); max file remains
7,183,364 bytes. All six library props total 14,754 triangles, six materials and
12 textures: 16 MiB estimated RGBA+mips. The two additions account for 6.667 MiB
if loaded; removing the chest normal saved 1.333 MiB. Existing shipped GLBs were
not changed.

Final gallery cold-page load/decode plus renderer preparation: **827.8 ms**
on localhost (not an internet download claim). Chest load 354.4 ms; crates 407.2 ms.
180 post-warm-up frames: p50 **6.9 ms**, p99/max **7.4 ms**. Six prop draws;
17 total including reference mannequin, ground and grid. Six shader programs
remain six. Registry import made zero requests; repeated radio loads still
produced only one radio request; cloned transforms and shared buffers passed.
The game entrypoint does not import the library yet: the two added URLs are
absent from `public/client.js`, so this session adds zero game downloads or
resident textures. The map stream must measure again after placement.

**Visual review and wow check.** Matched before/after views:
`.inspect/assets-session1-gallery-equipment-before.png` and
`.inspect/assets-session1-gallery-equipment-front.png` (same camera; new supply
slots appear), plus `...-all-before.png` / `...-all-front.png` for the complete
row with a 2 m reference. Three angles of every registered prop use
`assets-session1-gallery-<name>-{front,side,back}.png`. Candidate rejection views
are under `assets-session1-candidates-*` and `assets-session1-final-review-*`.
Player sentence: **"Those worn ammo crates and field rigs make this feel like
a deployed supply post."** This session proves the isolated assets; the visible
in-map result awaits the main stream's authorised placement.

Rejected: four models (generator, two helmets, long plate carrier), the chest
normal texture, and the duplicate PBR radio in favour of the existing zero-texture
version. No raw source or rejected GLB enters public. Re-prompts are queued for
the next session because the stricter 60-credit session cap has been reached.

**Validation.** `pnpm typecheck`, `pnpm test` (689 pass, 6 skip; 92 files pass, 4 skip),
`pnpm build:client`, and `pnpm audit:assets` PASS. Initial `pnpm test` had a
5-second navigation timeout while Blender conversion was active; rerunning the
full unchanged suite after conversion passed in 14.27 s. No test or timeout was
edited. Final logs: `.inspect/assets-session1-{typecheck,test-final,audit}.log`.
`node scripts/inspect-map.mjs --url http://localhost:8797 --shots relay,practice-two
--prefix assets-session1-map` PASS, zero console errors; report at
`.inspect/assets-session1-map-report.json`. Relay p99 = 7.1 ms, 30 draws,
25.681 MiB textures; construction 241.2 ms + preparation 1246 ms. GPU is RTX 5070;
these checks are not proof of a mid-laptop iGPU floor.

Hitch acceptance, both with 150000 ms maximum and the required `--assert`:

| Mode | Existing gate | Natural deaths | Recompiles / console errors | p99 upper | Max frame / callback | >150 ms frames |
|---|---|---:|---|---:|---|---:|
| TDM | PASS | 2 | 0 / 0 | 21 ms | 805 / 24.2 ms | 1 |
| FFA | PASS | 2 | 0 / 0 | 9 ms | 104.2 / 13.5 ms | 0 |

Evidence: `.inspect/assets-session1-hitch-{tdm,ffa}.json` and matching `.log`.
The repository's existing Session 74 policy (`docs/HITCH-GATE.md`) uses a
1500 ms headless presentation ceiling, 150 ms main-thread ceiling, p99 <=25 ms
and <=5% stalled time. No gate, threshold or browser flag was changed here.
TDM's first-damage diagnostic still fails the stricter 150 ms window at 805 ms,
0.712% of measured time; it is preserved and routed above. No driver attribution
is asserted without tracing. FFA has no >150 ms presentation interval. These
are the two required-style acceptance runs, not a five-pair hitch-fix claim.
The local workerd terminal also emitted a backlog warning and a network-lost
error during the inspection/probe session; browser console/network assertions
remained clean. Server diagnostics belong to the combat/main investigation.

Cleanup: stopped the Wrangler process launched for port 8797 after validation.
No listener remains on 8797 and no assets-gallery browser remains. Inspection
drivers closed their browsers; the other streams' servers/probes were left alone.
Final `git diff --check` PASS. Every tracked/untracked change is inside the
assets lane under `apps/ironsight`; no commit, push or deploy was performed.

Open owner questions/defaults: none block this lane. Default to static supply
dressing, keep weak kit rejected, and require separate rig/readability approval
from the owning stream. Honour the stricter 60/session and 300-reserve status
limits until the supervisor reconciles its header with newer programme notes.
