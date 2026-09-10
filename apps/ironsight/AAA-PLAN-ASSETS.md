# Ironsight AAA assets stream

Lane: `ironsight-aaa-assets`, `D:/wt-ironsight-assets`, app scope only. Local port
8797. No commit, push or deploy. Map/gameplay integration belongs to other streams.

## AAA gap list

1. **Stationary generator re-prompt and combat emplacements.** Use the corrected
   closed-cabinet/no-wheels prompt with a new output directory next session;
   add a concrete barrier or fuel drums within that session's cap. Generator
   Session 1 was rejected. Ask the map stream to pick its intended visible location.
2. **Soldier silhouettes.** Two helmets and the plate carrier remain rejected.
   Do not attach the accepted hollow chest rig as a flat armour plate. Prioritise
   a clean helmet shell and actual flat attachment geometry over more generic kit.
3. **War-worn vehicles and skyline.** Generate against named map views. The
   existing uplink/transformer are legacy distant silhouettes, not new close-up
   fidelity approvals. Replace them when a close player view warrants the spend.
4. **Library foundation: delivered Session 1.** Six lazy names, metre pivots,
   review gallery, provenance checks and bounded generation. Integration is
   explicitly routed to the owning streams below.

## Reference scorecard

| Reference | Status | Checkable target / evidence |
|---|---|---|
| R-M03 | met | Gallery asserts exact metre bounds/base-centre pivots; crates are 1.15 m high; library never supplies collision. |
| R-M08, R-M13, R-M17 | partial | Readable communications/power/supply silhouettes; placement remains with main. |
| R-G09, R-L12, R-L13 | partial | Inspect kit at human scale; equipment adoption does not approve rig attachment or override team read. |
| R-L14 | partial | No import-time fetches; six individual requests even after repeated loads; 16 MiB all-library textures. Current host checks below; map integration/iGPU validation still needed. |
| R-M01, R-M02, R-M04, R-M05, R-M06, R-M07, R-M09, R-M10, R-M11, R-M12, R-M14, R-M15, R-M16, R-M18, R-M19, R-M20 | n.a. | Map layout and match telemetry are owned by main. |
| R-G01, R-G02, R-G03, R-G04, R-G05, R-G06, R-G07, R-G08, R-G10, R-G11, R-G12, R-G13, R-G14, R-G15, R-G16, R-G17, R-G18, R-G19, R-G20 | n.a. | Gunplay, animation and audio are outside this library session. |
| R-L01, R-L02, R-L03, R-L04, R-L05, R-L06, R-L07, R-L08, R-L09, R-L10, R-L11, R-L15, R-L16, R-L17, R-L18, R-L19, R-L20, R-L21, R-L22, R-L23 | n.a. | Match flow, UI, combat and settings are owned by other streams. |

### Library ledger

| Asset | Status | Shipped GLB bytes | Credits this session | Verdict |
|---|---|---:|---:|---|
| field-radio-pack | registered, existing | 260176 | 0 | Current vertex-colour version; no PBR duplicate. |
| relay-field-sandbags | registered, existing | 83456 | 0 | Single sack; placement/assembly remains in map lane. |
| relay-uplink | registered, existing | 279624 | 0 | Legacy distant communications landmark; close-up replacement is a later gap. |
| switchyard-transformer | registered, existing | 243392 | 0 | Legacy distant power landmark; no new model/texture. |
| field-chest-panel | adopted for static dressing | 229180 | 0 | Full hollow rig, not a flat plate; 3550 triangles, two 512px WebP images. |
| ammo-crate-stack | adopted | 238624 | ~30 allocated | Worn closed crates, 2840 triangles, three 512px WebP images. |
| field-helmet | rejected | 0 | 0 | Folded visor, orange strap protrusions and angular hardware. |
| field-helmet-shell | rejected | 0 | 0 | Crumpled dome, top protrusions and collapsed brim. |
| field-plate-carrier | rejected | 0 | 0 | Long hollow torso, distorted pouches and folded surfaces. |
| field-generator | rejected | 0 | ~30 allocated | Unwanted wheel/trailer, broken frame and poor cabinet silhouette. |

The **actual session debit is 60**, account 1230 -> 1170. Individual 30-credit
figures are allocations from the measured job price. The original concurrent
receipts each show the shared 60-credit account interval; never sum them to 120.
Historical kit charges remain in Sessions 83/84, not charged again here.

### Placement API

| Stable name | Metres X / Y / Z | Origin / usage |
|---|---|---|
| field-radio-pack | .26 / .46 / .18 | Base centre; controls -Z; existing radio fitting stays separate. |
| relay-field-sandbags | .67 / .235 / .44 | Base centre; long axis X; one sack. |
| field-chest-panel | .510897 / .48 / .382378 | Base centre; pouches +Z; static supply dressing only. |
| ammo-crate-stack | .531171 / 1.15 / .598316 | Base centre; closed vertical stack; match collision if in play. |
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
- Supervisor: integrate the new `public/assets/props/.gitignore` with its explicit
  six-original allowlist and the two audit entries. Root `.gitignore` was not
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
