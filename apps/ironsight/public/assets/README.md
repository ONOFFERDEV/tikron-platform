# ironsight assets — provenance

| Path | Source | In git? |
|---|---|---|
| `models/player.glb` | Synty (retargeted/merged from Synty packs via the rig pipeline) | **no** — EULA forbids sharing source files |
| `models/weapons-vm.glb` | Synty weapon viewmodels | **no** |
| `maps/arena1-dressing.glb`, `maps/arena2-dressing.glb` | Synty dressing bundles baked per map | **no** |
| `maps/relay-skyline.glb` | Synty Power 01/02/03 and Warehouse 01, transformed and merged with a 1024px atlas by `tools/bake-relay-skyline.py` | **no** |
| `undertow-vista.webp` | Original procedural scene screenshot from `scripts/inspect-map.mjs --shots undertow-vista --write-vista` | yes; no purchased geometry in this map |
| `relay-vista.webp` | Flattened screenshot of the game scene, captured by `scripts/inspect-map.mjs --write-vista` | yes; see `../../LICENSE.md` |
| `maps/relay-ground-ao.png`, `maps/undertow-ground-ao.png` | Original ground ambient occlusion baked in Blender 4.5 (Cycles) from the server collision boxes/ramps only, by `tools/bake-ground-ao.py`; multiplied into the ground atlas by `client/site-ground.ts` | yes; no purchased geometry |

Relay service detail (session 12): original code-authored sealed access hatches,
breaker cabinets, louvers, warning plates and case latches. No purchased or AI
source input. `client/relay-service-detail.ts` paints a deterministic 512x256
RGBA canvas atlas once during scene creation; `relay-service-geometry.ts` batches
48 face quads derived from existing cover, offset by 12 mm. Estimated texture
storage including mipmaps is 0.67 MiB, one extra scene draw, no lights/passes.
`site-ground.ts` paints tire wear, patches, drains and worn maintenance clearances
into Relay's existing 512px ground canvas. Other maps keep their previous ground.
Reproduce with `pnpm build:client`; inspect with
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,freight,spawn,effects-stress --assert-budgets`.
These are runtime original textures, with no new binary asset or GLB allowlist
exception. Existing baked architecture/ground AO and collision geometry remain
unchanged. Do not enlarge the atlas without rechecking Relay's 64 MiB stress cap.

Original architecture / lighting pipeline (session 9):

| Path | Original source / runtime treatment | Versioned |
|---|---|---|
| `maps/relay-architecture.glb` | Exact Relay surfaces and MapDef ramps, 1024px embedded AO atlas; Session 22 vertex weathering, 2,346,620 bytes | yes, explicit original-only exception |
| `maps/undertow-architecture.glb` | Exact Undertow procedural kit, tanks/fans and MapDef ramps, 1024px embedded AO atlas; 1,553,824 bytes | yes, explicit original-only exception |
| `industrial-daylight.hdr` | Original mathematical sky radiance gradient and warm cloud halo, Blender 512x256 linear HDR; 41,273 bytes | yes |

Run from `apps/ironsight`, with the existing Node/esbuild and Python installations:

```powershell
node tools/dump-architecture.mjs
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-architecture.py -- --input .inspect/architecture.json
python scripts/audit-architecture.py
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-environment.py --
pnpm audit:assets
```

The dump imports the actual original client builders with canvas/sign generation
skipped, and the same ramp geometry function used at runtime. It never opens any
GLB, purchased source, rig or dressing. The baked selection excludes the licensed
Relay skyline AND its procedural fallback, signs, ground and emissive strips.
Those layers remain separate. No collision source or cover envelope is edited.
Whenever the procedural kit or MapDefs change, regenerate and audit BOTH bundles.

Blender 4.5 Cycles bakes AO at 64 samples, 2.5m distance, 4px dilation and a 1024px
smart UV atlas (island margin 0.0015); `--size` / `--samples` are explicit overrides.
The standard glTF occlusion slot uses TEXCOORD_0: architecture has no albedo map,
so a redundant UV2 attribute is unnecessary. Runtime converts the atlas once into
an R8 DataTexture with mipmaps (1.33 MiB), using AO intensity 0.75. Each map lazily
loads its own bundle and removes only its original fallback after successful load.
A load failure retains that fallback. The two exact GLB names are allowlisted in
.gitignore and the asset audit; every purchased GLB remains ignored as before.

Preserve authored triangle winding and custom split normals. Do NOT run Blender
recalculate-normals on this overlapping kit: it can invert boundary faces. Only
32 zero-area triangles at the dish centre are removed. The geometry audit compares
all 7,420 / 14,572 nondegenerate oriented triangles against the source, to 0.1mm
position quantization and 0.001 normal-component tolerance, and checks finite UVs,
no transforms/skins/animations and one embedded AO image. It writes
`.inspect/session9-geometry-audit.json`, including source and output SHA-256 values.

The shared HDR contains original radiance values, not physical point-light bakes
or external imagery. Standard view transform and Non-Color data prevent AgX from
compressing white. One PMREM is generated during loading; the HDR and generator
are then disposed. Environment intensity is 0.85; existing hemisphere fill drops
from 1.8 to 0.65 only after success. The warm directional key, ACES exposure and
1024 cached shadow map remain. No added lights, per-frame bake or postprocessing
passes. The texture estimator now counts R8 storage and the PMREM target.

The purchased derivatives must remain unversioned. The app `.gitignore` excludes
all GLBs under this directory. The original four can be restored from
`D:/game-assets/ironsight-synty-derived/`; no source pack is copied into the app.
Missing models fall back to procedural geometry, but the asset audit deliberately
fails a release missing its intended private assets.

Relay never loads the legacy arena1 dressing. Its playable geometry is original
procedural architecture derived from the server map. The new skyline is loaded
only on Relay and stays strictly outside the 60 x 40 m playable rectangle. A
procedural skyline remains visible until the licensed bundle finishes loading.

Rebuild the private skyline from the local converted pack using Blender 4.5:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-relay-skyline.py -- --source D:/game-assets/purchased/synty-scifi-city/GLB
```

Run from `apps/ironsight`. The script bakes full world transforms, asserts placement
envelopes outside the arena, compares atlas pixels before deduplicating, resizes the
distant atlas to 1024, joins the scenery and exports the ignored GLB. It records
source SHA-256 values and exact placement envelopes in
`.inspect/relay-skyline-provenance.json`. Current output: **1,167,268 bytes**, one
material and one image. Run `pnpm audit:assets` to verify the deployed size limits.

Rebuild the versioned ground AO maps (run from `apps/ironsight`; ~6 s on CPU, both maps):

```powershell
node tools/dump-maps.mjs $env:TEMP/ironsight-maps.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-ground-ao.py -- --maps $env:TEMP/ironsight-maps.json
```

Output is 1024x683 8-bit grey PNG per presentation, AO ray distance 3.5 m
(`--distance`), 96 samples (`--samples`). Unoccluded ground is exactly 1.0; the
script pins the Standard view transform because Blender 4.x's default AgX would
save white as ~0.8.

UAL inventory checked in session 1: the installed `UAL1_Standard.glb` contains
43 animations, including six pistol clips but **no rifle-hold clips**. The active
player retains its nine original locomotion/reaction clips. The original authored
rifle family now has SMG, energy-shotgun, sniper and two-handed pistol variants:
eleven locomotion clips per weapon, 55 total. These are authored on the existing
skeleton, not renamed UAL clips. Older assets without a requested family retain
the original attachment fallback.

Rebuild and verify the private operator from the original local mirror (run from
`apps/ironsight`; no Blender/exporter dependency and no source files copied):

```powershell
node tools/bake-rifle-hold.mjs --source D:/game-assets/ironsight-synty-derived/models/player.glb
node scripts/audit-rifle.mjs --source D:/game-assets/ironsight-synty-derived/models/player.glb
```

Source SHA-256: `691a8d8ed1a3d7ef3cc546dd16406b18b36257994a0946e1200349da9dc8f861`.
The ignored output remains `models/player.glb`: **2,913,320 bytes**, nine original
clips plus eleven clips for each `rifle_`, `smg_`, `shotgun_`, `sniper_`, `pistol_`
prefix: idle/walk/run/sprint/crouch_idle/crouch_walk, strafe_left/strafe_right/
backpedal/crouch_left/crouch_right. AR is sampled at 30 Hz, alternatives at 20 Hz;
constant finger rotations use two shared-time endpoints. The audit checks 29,880
unit quaternion samples across all 55 authored clips, unchanged mesh/skin/image
data and original clips, and base lower-body samplers. Directional variants author
thigh/calf/foot rotations over the original pelvis cadence; backpedal reverses the
in-place gait. Bind matrices and original source payload stay byte-identical.
Reports are `.inspect/rifle-bake.json` and `.inspect/rifle-audit.json`.
Never version the output or inspection backups. The supervisor must explicitly
include the reviewed private export when publishing the session 6 candidate.

First-person gloves/forearms are original procedural geometry. The AR drum and
charging handle, SMG/sniper magazines and handles, energy-shotgun side cell and
pistol slide are separated at runtime into complete welded components, keeping
the cached purchased mesh immutable. The pistol insert is original box geometry inside its integrated source grip.
No extra purchased weapon derivative is exported.
Undertow uses the original procedural reclamation kit, skyline and baked floor atlas; it never requests the
legacy `arena2-dressing.glb`. That older bundle remains local for rollback.


Session 3 original runtime assets: open AR reflex sight (no glass/postprocess),
Relay dish feed braces and core cassette cladding, Undertow clarifiers/turbine
cladding, site blueprint SVGs and two 512px collision-footprint ground atlases.
World signs use one 1024px atlas per map (Relay 1024×512, Undertow 1024×1024).
These are source-authored geometry/canvas assets, not new purchased exports.

Rig review supports `--poses`, `--aims` and `--samples` sweeps. Example:
`node scripts/inspect-rig.mjs --url http://localhost:8796 --weapons 0 --arms 1 --poses idle,walk,crouch --aims -89,0,89 --angles hands --prefix review`.
The runtime aim solver is distinct from baked authorship: it measures the baked
wrist frame, follows a short shoulder arc and preserves the support contact and
wrist roll. It restores all owned bone rotations before locomotion/reaction updates.

The rifle bake stabilizes clavicles in the authored idle frame while preserving
torso/head tracks, and fits the support hand to the measured rear fore-end contact
for every sampled locomotion pose. The source fallback clips remain untouched.

Session 6 retains the original procedural gloves, with per-weapon extraction,
insertion and charging contact paths driven by server reload acknowledgements.
The shotgun uses its sci-fi side cell, not a shell-by-shell ammo model. These
reloads are first-person presentation; remote reload replication/choreography is
still absent. Aim contact captures do not prove finger penetration or acceptance
of every extreme pose: upward crouch stock/neck clearance needs further work.
Explosion debris remains instanced original box geometry with four pooled lights.

### Session 11: Switchyard (arena3)

The former Crossyard blockout now uses original power-distribution architecture
from `client/switchyard-environment.ts`, the SAME 11 collision boxes/four ramps,
an original 1024px single-channel architecture AO atlas, collision-derived ground
AO and the existing industrial-daylight HDR. No purchased source enters this bake.
The map lazy-loads only its own architecture and generated transformer; Relay and
Undertow never request those assets. Signs use one original 1024x512 canvas atlas.
`switchyard-vista.webp` is a production-renderer screenshot, not concept art.

Rebuild only this site's bakes from `apps/ironsight` (Blender 4.5):

```powershell
node tools/dump-architecture.mjs
node tools/dump-maps.mjs .inspect/session11-maps.json
node --input-type=module -e "import fs from 'node:fs'; for (const [input,output] of [['.inspect/architecture.json','.inspect/session11-architecture.json'],['.inspect/session11-maps.json','.inspect/session11-switchyard-map.json']]) { const all=JSON.parse(fs.readFileSync(input)); fs.writeFileSync(output,JSON.stringify({switchyard:all.switchyard})); }"
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-architecture.py -- --input .inspect/session11-architecture.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-ground-ao.py -- --maps .inspect/session11-switchyard-map.json
python scripts/audit-architecture.py
# With the local preview running after build:client:
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-vista --write-vista
```

`props/switchyard-transformer.glb` is an original Meshy-generated exterior prop,
created 2026-09-08 with the project's account: 30 credits, preview plus PBR refine.
`props/switchyard-transformer.meta.json` records exact prompts and task IDs.
The model is 2,599 triangles; raw 6,746,160 bytes becomes 243,392 bytes with 512px
WebP PBR textures. Three placements share geometry/material/texture data. Bounds
normalization fits each to at most 7m wide / 6m tall / 6m deep, grounded at y=0,
entirely north of z=0. It creates no playable cover and has no lights/animation.
The stylized radiator silhouette is approved for exterior distance, not a weapon
or close-interaction asset. Purchased Synty/UAL derivatives remain private.

Generate a new variant from the recorded prompt (consumes credits; Meshy generation
is not byte-deterministic), then shrink and inspect before replacing the asset:

```powershell
node --input-type=module -e "import fs from 'node:fs'; import {execFileSync} from 'node:child_process'; const m=JSON.parse(fs.readFileSync('public/assets/props/switchyard-transformer.meta.json')); execFileSync(process.execPath,['tools/meshy-generate.mjs','--name',m.name,'--prompt',m.prompt,'--texture',m.texture_prompt,'--polycount',String(m.target_polycount),'--out','.inspect/meshy'],{stdio:'inherit'});"
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/shrink-glb.py -- --input .inspect/meshy/switchyard-transformer/model.glb --output public/assets/props/switchyard-transformer.glb --size 512 --webp
```

Both new GLBs are explicit original/generated allowlist exceptions in `.gitignore`
and `scripts/audit-assets.mjs`. Keep raw Meshy output under ignored `.inspect`.
The 40 MiB public and 25 MiB per-file limits still apply to the complete product.

### Session 13: Relay uplink assemblies

`props/relay-uplink.glb` is original Meshy-generated exterior machinery, created
2026-09-08 with the project account (30 credits). Exact prompts, task IDs and
generation metadata are in `props/relay-uplink.meta.json`. The result is a paired,
side-by-side dish assembly on a tripod, rather than the requested vertical stack
on a cabinet. It is used as a secondary communications landmark below the original
mast, entirely outside play. The 2,827-triangle mesh is 279,624 bytes after shrinking
the 7,641,968-byte raw output to three 512px WebP PBR images. Both placements share
geometry, materials and textures; no lights, animation, cover or collision is added.
Bounds are grounded at y=0, centered at x=25/37, z=-6, normalized to at most 7m wide,
11m tall and 4.2m deep. The inspector records actual envelopes and checks them.

The distant private Relay skyline palette is resized from 1024px to 512px ONCE
in `client/dressing-loader.ts`, before GPU preparation, retaining glTF UV/color
space settings. Its private GLB stays unchanged/ignored. This saves 4 MiB including
mips, funding the new PBR set's 4 MiB. No per-frame resizing or extra pass is used.
`relay-vista.webp` is refreshed from the production renderer.

Reproduce a variant (generation consumes credits and is not byte-deterministic),
then compress and inspect from the app directory:

```powershell
node --input-type=module -e "import fs from 'node:fs'; import {execFileSync} from 'node:child_process'; const m=JSON.parse(fs.readFileSync('public/assets/props/relay-uplink.meta.json')); execFileSync(process.execPath,['tools/meshy-generate.mjs','--name',m.name,'--prompt',m.prompt,'--texture',m.texture_prompt,'--polycount',String(m.target_polycount),'--out','.inspect/meshy'],{stdio:'inherit'});"
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/shrink-glb.py -- --input .inspect/meshy/relay-uplink/model.glb --output public/assets/props/relay-uplink.glb --size 512 --webp
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,cooling,uplink,vista,effects-stress --assert-budgets --write-vista
```

Only the explicitly allowlisted compressed GLB and its metadata are versioned;
raw generated output remains in ignored `.inspect/meshy`. The unrelated rejected
cable-drum example is not used. Purchased-source derivatives remain ignored.

### Relay concrete surface detail (Session 14, original runtime data)

`client/concrete-detail.ts` generates one shared pair of 128px RGBA8 normal and
roughness textures from seeded periodic aggregate noise (seed 14071). Both have
repeat wrapping, linear mipmaps, anisotropy 4 and linear data color space; combined
GPU storage is approximately 0.167 MiB including mips. No external source, bitmap
download, new render pass/light, shader injection or per-frame generation is used.
The normal strength is 0.2 on concrete, 0.12 on pale trim, ramps and ground.
Original baked architecture and purchased assets remain byte-identical.

`site-lighting.ts` applies detail only after Relay's architecture loads and before
renderer preparation. Nonmetallic materials with roughness >=0.8 and the named
Relay ground/apron share it. A separate metric UV channel (`uv2`, 0.8m repeat)
preserves paint and baked AO UVs. Positions, normals and collision data are not
modified. Other maps and the original fallback do not allocate these textures.
The fallback still works if the baked architecture fails to load.

Reproduce from the app directory with `pnpm build:client`, then on the running
preview: `node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,cooling,freight,spawn,effects-stress --assert-budgets`.

### Relay exterior paving (Session 15, original runtime geometry)

`client/relay-apron.ts` builds one vertex-colored, flat paving mesh during scene
construction: concrete slab joints, flush machinery pads below the existing
uplinks/mast, an asphalt service road with worn center dashes, and a broad horizon
skirt beyond the existing fog end. All faces lie at y=-0.03 and outside the
60 x 40 m playable floor; no new collision, cover, raised curb or physics is added.
Disjoint rectangles prevent coplanar decal fighting. Cell colors use a deterministic
integer hash; no external source or downloaded asset is involved. The apron shares
Session 14's existing concrete textures and metric UVs, with no additional texture,
light, render pass or frame-loop bake. Subtle pour-to-pour aging is painted once
into Relay's existing 512px floor atlas at its original resolution.

All three maps now tag site ground so the architecture replacement does not remove
their untextured exterior aprons. Ground is intentionally excluded from offline
architecture bakes. Undertow/Switchyard retain their existing flat apron shape and
material; only Relay receives the new paving and extended horizon. No baked or
purchased GLB changes. The Relay deployment vista is refreshed from the production
renderer using the command below.

Reproduce from the app directory with `pnpm build:client`, then on the running
preview: `node scripts/inspect-map.mjs --url http://localhost:8796 --shots exterior,relay,cooling,vista,effects-stress --assert-budgets --write-vista`.
Ground presence/height/extent and triangle budget are asserted by the inspector;
`pnpm test -- test/relay-apron.test.ts` checks architecture selection and paving
winding, coverage, finite data and separation from playable ground.

### Original first-person tailored gloves and sleeves (Session 17)

`client/hand-geometry.ts` builds original oval sleeve sections with compression
folds, reinforced vertex-colour panels, rounded closed gloves/padded knuckles and
a dark cuff with an amber seam. No external source, purchased derivative, bitmap
or Meshy generation is involved. Constructed once by `ViewmodelHands`; six draws,
no texture allocations, existing wrist fits and server-driven reload timeline.
Reproduce with `pnpm build:client`; inspect with
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots weapon-ar,weapon-sniper-reload-out,weapon-pistol,weapon-ar-cycle --prefix hands`.

### Session 18 impact layers (original runtime geometry)
Surface impacts reuse the existing seven pooled spheres for a 65 ms contact core,
three ballistic sparks and three 480 ms expanding dust fragments. Player hits use
five dark, elongated droplets. All remain server-shot-event presentation; no decals
or cover are inferred. No bitmap, purchased derivative, light or pool is added.
Reproduce: pnpm build:client; run the preview and node scripts/inspect-map.mjs
--url http://localhost:8796 --shots impact,effects-stress --prefix impact-review.
Source: client/vfx.ts; the paired impact fixture is in client/map-inspect.ts.

### Session 19: remote combat animation layering

`client/rig-loader.ts` creates cached, upper-body additive views of the existing
private player GLB hit clips at load time (spine/neck/head rotations only). The
original clips, mesh, skin and textures remain unchanged and ignored. Hits blend
in over 35 ms at 70% strength and out over the final 90 ms; locomotion and authored
weapon holds continue. The 2.4 s death clip now finishes with a 250 ms settled hold
(3 s cap, authoritative respawn cancels it). A constant set of support joints grounds
the inherited death root offset; no per-vertex skin scan or ragdoll. No new downloaded
assets or lights.
Reproduce with `pnpm build:client`, then the preview server and
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots reaction-body,reaction-head,reaction-crouch,reaction-death`.


### Session 20: original layered weapon synthesis

`client/weapon-sound.ts` authors mechanical attacks, ballistic body and filtered
outdoor reflections for AR/SMG/shotgun/sniper/pistol. Three deterministic variants
per weapon are baked once per AudioContext and share one source per shot, including
the full spatialized tail. No recorded/purchased samples or new binary downloads.
At 48 kHz the fifteen mono buffers use 1,065,600 bytes; no GPU textures are added.
The existing master compressor now feeds a fixed safety knee, linear below 0.8,
preventing synchronized volleys from exceeding output range.

Reproduce: `pnpm build:client`; `node scripts/inspect-audio.mjs audio-review`.
The latter renders the production graph in Edge OfflineAudioContext and writes
eleven WAVs and a JSON report under ignored `.inspect`: five weapons, remote pan,
saturation, voice recovery, local priority, mute and volume zero. `--baseline`
permits over-range peaks only when recording an earlier implementation; final
acceptance must omit it. Offline rendering validates signals/lifecycle, not human
headphone mix approval, actual browser audio-device latency or occlusion.


### Session 21: combat feed and confirmed elimination presentation
Original DOM/CSS in `client/hud.ts`; no image/model/audio assets added. The optional
kill-event weapon slot comes from the server damage resolution, with a neutral
fallback for older events. Amber highlights local eliminations; confirmation has
an 1800 ms lifetime and feed entries expire at 5000 ms, capped at five. Motion
respects both the OS preference and the game setting. Offline fixtures reuse the
existing Relay vista only for a matched background; gameplay loads no new asset.
Reproduce: `pnpm build:client`, run the local preview, then
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots match-combat,match-combat-mobile,match-combat-reduced --prefix session21-final`.
### Session 22: original baked Relay wall weathering and flush roof service plates

`relay-architecture.glb` remains the allowlisted original procedural kit. After
the existing Blender architecture/AO bake, `tools/weather-architecture.py` adds
linear vertex-color mineral runoff and foundation grime to its concrete primitive.
It subdivides flat triangles offline, interpolates the existing UVs/normals, shares
vertices, and verifies unchanged bounds/surface area and a 45,000-triangle concrete
cap. No displacement, image edits, new texture/material, purchased source, runtime
bake or extra pass. Final GLB: 2,346,620 bytes; the original AO image bytes remain
intact. Only Relay requests this asset. A fresh bake is required before reapplying;
the tool refuses an already-colored input instead of compounding weathering.

From the app directory, **after the existing architecture bake**:

```powershell
python tools/weather-architecture.py --input public/assets/maps/relay-architecture.glb --output public/assets/maps/relay-architecture.glb --report .inspect/relay-weather.json
python scripts/audit-architecture.py
pnpm build:client
# With the local preview running:
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,cooling,overview,vista --prefix relay-weather --write-vista
```

`client/relay-service-geometry.ts` adds sixteen original flush roof access/vent
plates using the existing 512x256 service atlas and existing draw. They stay 12 mm
above the four service-house colliders, with no overhang into routes. The geometry
test checks roof normals and every full plate envelope, including wall cladding.
The refreshed original `relay-vista.webp` reflects these roof details in deployment.
No new asset allowlist entries or Meshy credits are needed. Review evidence and
accepted/rejected measurements are in `AAA-PLAN.md`, Session 22.

The GLB retains original triangle references for the architecture audit. It checks
every subdivided triangle's winding, containment, surface area and interpolated
UV/normal against that original, then compares the original against the MapDef kit.
These audit references add 81,096 bytes to the compact weathered export and are
not uploaded as render attributes. All other materials and image bytes are intact.

### Session 28: expanded Relay, 150 x 100 m

Original collision-derived architecture and ground AO were rebaked for the expanded
MapDef, including 3 m decks/ramps and 6 m service buildings. Existing allowlisted
paths and provenance apply: no new purchased input in the versioned kit. Final
architecture is 2,499,400 bytes; ground AO 122,886 bytes. The original deployment
vista is recaptured from the same build. The existing private skyline derivative
was repositioned outside the new bounds and remains ignored.

Reproduce from the app directory (Blender 4.5 on PATH, or its full executable path):

```powershell
node tools/dump-maps.mjs .inspect/session28-maps.json relay
node tools/dump-architecture.mjs .inspect/session28-architecture.json relay
blender --background --python tools/bake-ground-ao.py -- --maps .inspect/session28-maps.json
blender --background --python tools/bake-architecture.py -- --input .inspect/session28-architecture.json
python tools/weather-architecture.py --input public/assets/maps/relay-architecture.glb --output public/assets/maps/relay-architecture.glb --report .inspect/session28-weather.json
python scripts/audit-architecture.py --input .inspect/session28-architecture.json
# Private skyline: use the licensed GLB directory documented above.
blender --background --python tools/bake-relay-skyline.py -- --source <licensed-GLB-directory> --maps .inspect/session28-maps.json
pnpm build:client
# Restart the preview after writing public assets, then:
node scripts/inspect-map.mjs --url http://localhost:8796 --shots vista --prefix relay-expanded --write-vista
```

No Meshy generation or new texture/light/pass is added. Existing Meshy uplinks
move to flank the centered relay mast. Material weathering remains an offline
vertex-color operation. See AAA-PLAN.md Session 28 for measurements and limits.


### Session 29: expanded Undertow (original collider-derived kit)

The 150 x 100 m Undertow layout, paired 3 m control decks, 6 m service buildings,
B court and perimeter are owned by `src/map/arena2.ts`. The original reclamation
kit follows these envelopes; the exterior 24 m control stack and clarifiers stay
outside playable bounds. The lower box and upper cap meet without overlapping
roof faces. Existing allowlists cover these original files; no purchased input.
Ground AO remains 1024 x 683 R8, architecture AO 1024 square, lazy per map.
Reproduce from apps/ironsight using Blender 4.5:

```powershell
node tools/dump-maps.mjs .inspect/session29-maps.json undertow
node tools/dump-architecture.mjs .inspect/session29-architecture.json undertow
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-ground-ao.py -- --maps .inspect/session29-maps.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-architecture.py -- --input .inspect/session29-architecture.json
python scripts/audit-architecture.py --input .inspect/session29-architecture.json
pnpm build:client
# Restart the local preview after writing assets, then capture its original vista:
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-vista --prefix session29-vista --write-vista
```

The generated GLB is 3,783,288 bytes, ground AO 121,119 bytes. Architecture audit
verifies 47,176 oriented source triangles and their authored normals at 0.1 mm
position tolerance. No added image or material texture; no Meshy credits spent.


### Session 30: expanded Switchyard (original collider-derived kit)

Switchyard now spans 150 x 100 m. `src/map/arena3.ts` owns its tile geometry,
twelve distributed screened spawns, three anchors, four six-metre ramps and
3 m switching deck / 6 m switchgear halls. The original procedural cabinet kit,
perimeter and exterior switching mast follow that layout. Existing generated
transformers share one lazy asset and stand north of the current map boundary.
No purchased inputs or new textures. Existing allowlists cover the same paths.
Ground AO remains 1024 x 683 R8; architecture AO remains 1024 square, lazy per map.

Reproduce from apps/ironsight with Blender 4.5:

```powershell
node tools/dump-maps.mjs .inspect/session30-maps.json switchyard
node tools/dump-architecture.mjs .inspect/session30-architecture.json switchyard
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-ground-ao.py -- --maps .inspect/session30-maps.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-architecture.py -- --input .inspect/session30-architecture.json
python scripts/audit-architecture.py --input .inspect/session30-architecture.json
pnpm build:client
# Restart the local preview after writing assets, then capture the actual renderer:
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-vista --prefix session30-vista --write-vista
```

GLB: 5,016,936 bytes, 66,092 oriented triangles, ten material primitives.
Ground AO: 145,770 bytes. Architecture audit matches the original source at
0.1 mm position tolerance, with zero degenerate triangles. No Meshy credits spent.


### Session 33: Undertow orientation kit (2026-09-09)

Original procedural filter vessels identify the west half; the east half has an
amber service gantry. A forked north control crown and unequal south pump flues
separate the routes by silhouette. All new structures lie outside the playable
rectangle. Existing cover receives teal/amber flush cladding; collision remains
unchanged. The existing sign atlas adds west/east wall labels and removes one
overlapping north-wall label, with no extra texture. No purchased inputs or Meshy
credits. Existing original-asset allowlist applies.

`maps/undertow-architecture.glb`: 3,937,488 bytes, 48,928 triangles, one 1024px AO
image. `undertow-vista.webp`: 128,178 bytes, original production-renderer capture.
Reproduce from the app directory (PowerShell, Blender 4.5):

```powershell
node tools/dump-architecture.mjs .inspect/session33-architecture.json undertow
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-architecture.py -- --input .inspect/session33-architecture.json
python scripts/audit-architecture.py --input .inspect/session33-architecture.json
pnpm dev:preview
# In a second terminal after preview is ready:
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-vista --prefix session33-vista --write-vista
```

No ground AO rebuild is needed: collision boxes/ramps and ground are unchanged;
the added exterior equipment receives AO in the architecture bake.

### Session 34: Switchyard orientation kit (2026-09-09)

Original procedural west capacitor towers, east maintenance crane and south
service-hall roof monitors distinguish the perimeter by shape. East wall panels
use the existing amber material. All new opaque structures remain outside play;
collision geometry and collision-derived ground AO are unchanged. No purchased
inputs, new textures or Meshy credits; existing original-asset allowlists apply.

`maps/switchyard-architecture.glb`: 5,229,544 bytes, 68,588 triangles, ten material
primitives and one 1024px AO image. `switchyard-vista.webp` is refreshed from the
production renderer. Reproduce from the app directory (PowerShell, Blender 4.5):

```powershell
node tools/dump-architecture.mjs .inspect/session34-architecture.json switchyard
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-architecture.py -- --input .inspect/session34-architecture.json
python scripts/audit-architecture.py --input .inspect/session34-architecture.json
pnpm dev:preview
# In a second terminal after preview is ready:
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-vista --prefix session34-vista --write-vista
```


### Session 37: Switchyard northern arrival courts (2026-09-09)

Two inner southern spawn anchors move to screened northern courts. The original
procedural kit follows four added authoritative full-cover boxes; existing ramp,
objective and boundary geometry stays in place. Amber exit chevrons are baked
strips on northern screen faces, reusing the existing material. No purchased
inputs or Meshy generation. Existing original-asset allowlists apply.

`maps/switchyard-architecture.glb`: 5,858,908 bytes, 74,972 oriented triangles,
ten material primitives and one 1024px AO image. `maps/switchyard-ground-ao.png`
is rebaked from the changed colliders (156,996 bytes). The deployment vista is
refreshed from the production renderer. Reproduce from the app directory:

```powershell
node tools/dump-maps.mjs .inspect/session37-maps.json switchyard
node tools/dump-architecture.mjs .inspect/session37-architecture.json switchyard
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-ground-ao.py -- --maps .inspect/session37-maps.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-architecture.py -- --input .inspect/session37-architecture.json
python scripts/audit-architecture.py --input .inspect/session37-architecture.json
pnpm dev:preview
# In a second terminal:
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-vista --prefix session37-art --write-vista
```
