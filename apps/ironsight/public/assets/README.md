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
| `undertow-dusk.hdr` / `undertow-dusk-sky.png` | Original seeded dusk cloud/radiance field, Blender; 512x256 linear HDR 104,307 bytes and 1024x512 sRGB sky 122,555 bytes. Undertow only; see Session78 below | yes |
| `switchyard-overcast.hdr` / `switchyard-overcast-sky.png` | Original seeded stratus/radiance field, Blender; 512x256 linear HDR 144,190 bytes and 1024x512 sRGB sky 135,785 bytes. Switchyard only; see Session79 below | yes |

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


### Session 44: expanded Relay density, signal spine and metre-scale ground colour

Original collider-derived Relay kit only; no purchased or Meshy input. Relay now
has 107 boxes (61 full / 46 waist), retaining four 3 m ramps. A solid 14 m signal
spine sits on the 6 m core; its cassettes stay within 12 mm of authoritative cover.
The new lane screens and objective shoulders use the same material batches.

`maps/relay-architecture.glb`: 3,388,284 bytes, fresh 1024px AO followed by original
vertex weathering at 2 m subdivision spacing (30,420 concrete triangles, below the
unchanged 45,000 cap). The 0.7 m and 1.2 m settings exceeded the cap and were rejected.
`maps/relay-ground-ao.png`: 769,103 bytes, 2048x1365 = 13.65 pixels/metre along both
axes. The image remains a one-time multiply into the 512px low-frequency colour
atlas. Close ground grain now modulates colour using the EXISTING 128px / 0.8 m
roughness tile (160 px/m), alongside its existing normal map; no added texture.
This is the tiled-detail option, not a 2048px resident colour atlas. Broad painted
markings/contact colour remain atlas-limited. Source AO resolution alone does not
claim 13.65 px/m runtime AO. The original tire/repair coordinates now scale with
map bounds. All work happens during loading/offline, with no new lights or passes.

Reproduce from the app directory:

```powershell
node tools/dump-maps.mjs .inspect/session44-maps.json relay
node tools/dump-architecture.mjs .inspect/session44-architecture.json relay
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-ground-ao.py -- --maps .inspect/session44-maps.json --size 2048
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-architecture.py -- --input .inspect/session44-architecture.json
python tools/weather-architecture.py --input public/assets/maps/relay-architecture.glb --output public/assets/maps/relay-architecture.glb --report .inspect/session44-weather.json --edge-length 2
python scripts/audit-architecture.py --input .inspect/session44-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots overview,cooling,relay,freight,vista,effects-stress --assert-budgets --prefix session44-final
```

Existing exact asset allowlist entries remain sufficient. No new binary path,
dependency, external generation spend or purchased-source derivative is introduced.


### Session 46: Undertow vault routes, pressure stack and ground detail

Original collision-derived reclamation kit, with no purchased or generated input.
`src/map/arena2.ts` now owns 114 boxes (52 full / 62 waist), four true ramps,
paired home courts and the solid central pressure stack above the 6 m core roof.
The kit clads the stack inside its 4 x 4 m collider footprint; it adds no visual-only
cover. Original turbine faces and amber barrier caps reuse the existing materials.

`maps/undertow-architecture.glb`: 6,347,488 bytes, 81,208 source triangles,
10 material primitives, one embedded 1024-square AO image. The loader retains its
single-channel AO conversion. `maps/undertow-ground-ao.png`: 835,222 bytes,
2048 x 1365, 13.65 source pixels/metre. AO is multiplied into the existing 512-square
colour atlas at load; this is not a claim of 2048-square runtime AO residency.
Undertow now uses the original procedural 128-square / 0.8 m concrete normal and
roughness tile, including ground diffuse modulation (160 pixels/metre), shared
across its flat kit and ground/apron. Two resident textures, 0.166667 MiB including
mips, no new asset URL, light or render pass. All are prepared before play.
The existing explicit asset allowlists cover both files; per-map loading remains.

Reproduce from apps/ironsight, Blender 4.5:

```powershell
node tools/dump-maps.mjs .inspect/session46-maps.json undertow
node tools/dump-architecture.mjs .inspect/session46-architecture.json undertow
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-ground-ao.py -- --maps .inspect/session46-maps.json --size 2048
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-architecture.py -- --input .inspect/session46-architecture.json
python scripts/audit-architecture.py --input .inspect/session46-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots vault,undertow-overview,undertow-home,undertow-deck,undertow-maintenance,undertow-effects-stress --assert-budgets --prefix session46-verified
```

The geometry audit verifies original oriented surfaces/authored normals, finite UVs
and no degenerates. See AAA-PLAN.md Session 46 for timing, bytes and acceptance limits.

### Session 47: Switchyard induction deck and density

Original collision-derived switchgear kit, no purchased or generated source input.
`src/map/arena3.ts` owns 111 boxes (63 full / 48 waist), four ramps, pad trajectories
and the solid switching spine from the 3 m deck to 14 m. All opaque cover is cladded
to its authoritative envelope. Induction plates/chevrons and landing targets are
flush baked markings; their paint does not create collision. Two wall signs reuse
the existing sign atlas. No extra light, render pass or new asset URL.

`maps/switchyard-architecture.glb`: 7,184,816 bytes; 93,752 source triangles,
6,926 original parts merged into 10 material primitives; one embedded 1024-square
AO image, converted to single-channel residency by the existing loader.
`maps/switchyard-ground-ao.png`: 830,466 bytes, 2048 x 1365, 13.65 source px/m.
Source ground AO still multiplies into the existing 512-square colour atlas.
The visible scale improvement also uses the original 128px / 0.8 m seamless
normal/roughness tile and ground diffuse aggregate (160 px/m), shared across flat
kit/ground/apron: two resident textures, 0.166667 MiB including mips. Per-map lazy
loading and the existing explicit allowlist entries remain sufficient.

Reproduce from apps/ironsight, Blender 4.5 (factory settings avoid localized node names):

```powershell
node tools/dump-maps.mjs .inspect/session47-maps.json switchyard
node tools/dump-architecture.mjs .inspect/session47-architecture.json switchyard
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --factory-startup --background --python tools/bake-ground-ao.py -- --maps .inspect/session47-maps.json --size 2048
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --factory-startup --background --python tools/bake-architecture.py -- --input .inspect/session47-architecture.json
python scripts/audit-architecture.py --input .inspect/session47-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots launch,switchyard-overview,switchyard-center,switchyard-north --prefix session47-functional
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-effects-stress --assert-budgets --prefix session47-final
```

The source/export audit verifies oriented triangles, authored normals, finite UVs
and zero degenerates. No raw source binary or new purchased derivative is shipped.
See AAA-PLAN.md Session 47 for before/after captures, resource deltas and open acceptance.

### Session 48: original Relay realignment assembly

`maps/relay-architecture.glb` is now 3,367,124 bytes (-21,160). Removed the old
static exterior dish/mast from the original kit, rebaked its 1024px AO, and
reapplied Session44's 2m concrete vertex-weathering pass. All playable geometry
is unchanged. Oriented triangles, authored normals, UVs and degenerate-face audit
pass; 2,228 source parts and 11 material primitives. Existing allowlist applies.

`client/signal-array.ts` builds the replacement original mechanical receiver:
15m dish on a 30m pivot, radial seams/back ribs, actuator/service mast and two
pooled light rings. Two merged solid batches, no texture downloads, no new lights
or passes. Every solid part remains outside the north boundary in all poses.
No purchased source or Meshy input; generation spend 0. The moving assembly is
deliberately excluded from the static architecture bake and casts no shadow.
The existing sign atlas labels the new mast. Runtime phase sampling comes from
the shared room epoch in `src/signal-event.ts`; Reduced motion omits light waves.

Reproduce from apps/ironsight:

```powershell
node tools/dump-architecture.mjs .inspect/session48-architecture.json relay
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --factory-startup --background --python tools/bake-architecture.py -- --input .inspect/session48-architecture.json
python tools/weather-architecture.py --input public/assets/maps/relay-architecture.glb --output public/assets/maps/relay-architecture.glb --report .inspect/session48-weather.json --edge-length 2
python scripts/audit-architecture.py --input .inspect/session48-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots signal --prefix session48-verified
node scripts/inspect-map.mjs --url http://localhost:8796 --shots effects-stress,signal-effects-stress --assert-budgets --prefix session48-final
```

### Session 49: Signal Break core transit (original procedural geometry)

The Relay core now has two permanent side walls, a 3m-clear lintel and two
0.5m shutters authored in `src/map/arena1.ts`. The open passage spans x70..80,
z48..52 beneath the unchanged 6m roof and 14m signal spine. Only the room's
replicated `coreOpen` removes the shutters; movement, shots and bot navigation
share these volumes. `client/signal-core.ts` batches the original shutter slats,
guide housings, floor paint and steady amber/teal indicators. Concealed retracted
panels are omitted from rendering. No moving part casts a cached shadow.

One immutable 256x64 canvas atlas supplies the two CORE / TRANSIT headers
(estimated 0.08333 MiB with mips). No external image, purchased source, new
asset URL or Meshy generation. The permanent architecture omits both shutters;
ground AO is baked from the permanent shell, preventing a stale door shadow.
Elevated kit boxes inset their main body above the foundation to avoid coplanar
undersides now that the core ceiling is visible. Existing 2m vertex weathering
is reapplied without new textures or materials.

Accepted `relay-architecture.glb`: 3,385,780 bytes (was 3,367,124; +18,656),
2,244 source parts / 26,912 source triangles / 11 material primitives, one
1024-square AO image. Concrete weathering changes 1,188 to 30,620 triangles;
authored-normal/oriented-triangle/UV audit passes. `relay-ground-ao.png`:
2048x1365, 773,641 bytes (was 769,103; +4,538). Both are existing allowlisted
original outputs, lazy-loaded for Relay. No asset-budget exception.

```powershell
node tools/dump-architecture.mjs .inspect/session49-architecture.json relay
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --factory-startup --background --python tools/bake-architecture.py -- --input .inspect/session49-architecture.json
python tools/weather-architecture.py --input public/assets/maps/relay-architecture.glb --output public/assets/maps/relay-architecture.glb --report .inspect/session49-weather.json --edge-length 2
python scripts/audit-architecture.py --input .inspect/session49-architecture.json
node tools/dump-maps.mjs .inspect/session49-maps.json relay
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --factory-startup --background --python tools/bake-ground-ao.py -- --maps .inspect/session49-maps.json --size 2048
node scripts/inspect-map.mjs --url http://localhost:8796 --shots core --prefix session49-verified
node scripts/inspect-map.mjs --url http://localhost:8796 --shots effects-stress,core-effects-stress --assert-budgets --prefix session49-final
```
# Session 50: original recon flyover (runtime geometry)

`client/recon-flyover.ts` authors the UAV from an original delta wing, hull,
twin engine pods, fins and short exhaust strips. No imported/generated model,
image, purchased derivative or new public binary. Two meshes share one
110-triangle geometry and one unlit vertex-colour material; no texture, light,
shadow, render pass or collision surface is added. Positions seek the room's
public flight times above the playable ceiling. Reproduce with
`pnpm build:client`; review `node scripts/inspect-map.mjs --url http://localhost:8796 --shots recon-flyover,recon-effects-stress --assert-budgets`.
Server-earned gameplay capture: the same inspector with `--shots support`.
Meshy spend: zero. Existing asset allowlists and private derivatives stay intact.

# Session 51: original mortar warning and impact geometry

`client/mortar-fx.ts` creates a fixed pool of four ground rings, two descending
shells and 48 shaded debris/flash fragments in three instanced draws. Original
procedural geometry and vertex colours; no imported model, texture, downloaded
asset, light, shadow, extra pass or collision surface. All material variants
warm with the existing arena preparation. Reduced motion preserves the exact
hazard boundary, while reducing the shockwave/debris motion. Short falling-shell
whistles use the existing spatial audio/voice/mute pipeline; confirmed impacts
use the existing synthesized explosion. Meshy spend: zero.

Reproduce: `pnpm build:client`. Review real earned gameplay with
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots mortar`;
review the full two-barrage render pool with `--shots effects-stress,mortar-effects-stress --assert-budgets`.
No public binary or purchased-source derivative added; existing allowlists suffice.


### Session52 original sentry drone / runtime geometry

Original authored geometry in client/sentry-drone.ts: compact ducted-fan chassis,
twin barrels and rotating blades, vertex colour/shading only. Three fixed instanced
draws share two sentries and their frozen warning beams/crosses. No source download,
third-party model, texture, light or binary asset. Reduced motion retains the exact
warning endpoint and freezes rotor/bob animation. Server-confirmed pulses reuse
existing tracer/muzzle pools; synthesized charge/fire use the capped spatial bus.
Reproduce: pnpm build:client, then node scripts/inspect-map.mjs --url
http://localhost:8796 --shots drone-hero,drone --prefix session52-game-final.
Only the hero shot is an offline render fixture; drone earns seven normal training
kills and records20s of server gameplay. Ownership: original project code/geometry.
# Session 53: weapon flash atlas (original procedural effect)

`client/weapon-flash.ts` bakes five original analytic flame silhouettes once at
startup: rifle crown, SMG fork, shotgun bloom, sniper lance and pistol star.
One 256x128 RGBA8 atlas (131,072 bytes of sampled storage, no mipmaps) backs
immutable UV views shared by the first-person flash and all eight remote slots.
No external image, purchased derivative, new light or render pass. Lifetimes
are 50/34/64/60/42 ms respectively. Reproduce with `pnpm build:client`, then
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots weapon-ar-flash,weapon-smg-flash,weapon-shotgun-flash,weapon-sniper-flash,weapon-pistol-flash,muzzle-lineup`.

Session53 also moves the existing original grenade spheres, blast rings/debris
and tracer boxes into `client/combat-fx.ts`:96tracers,32grenades,12blast slots,
four shared geometries,constructed and warmed once. No new external asset or
image. Reproduce the stress/drain with `--shots effects-stress --assert-budgets`
on the same inspector command.

### Session 54: scope glint (original procedural effect)

`client/weapon-flash.ts` fills the sixth unused cell of the existing 256x128
RGBA8 atlas with an original optical cross. `client/scope-glint.ts` draws up to
16 scope reflections in one warmed instanced plane draw. The source/sampler and
131,072-byte allocation are shared with all five flashes; no image download,
paid generation, new texture allocation, light, pass or collision asset.
The animated remote weapon supplies the lens anchor. Replicated sniper aim,
life/reload and current collision boxes gate visibility; hip fire also warns.
Reduced motion preserves the steady cue. Reproduce with `pnpm build:client`,
then `node scripts/inspect-map.mjs --url http://localhost:8796 --shots glint-before,glint-ready,glint-away,glint-cover,glint-reduced`.
These are offline presentation fixtures, not recorded player encounters.
Full render stress: `--shots glint-effects-stress --assert-budgets`.

### Session 62: Pressure Drop exterior sluices (original procedural geometry)

`client/flood-works.ts` creates the twin lift towers, ribbed gates, shaded water
sheets and pooled foam once when Undertow loads. Five draw objects, 50 instance
slots, no image downloads, textures, external sources, light or render pass.
Vertex colours are authored in code; matrices animate from the replicated map
event epoch. Every solid and effect stays outside the north movement boundary.
This is Pressure Drop arc 1/2; the playable maintenance-route payoff is pending.
No purchased derivative changed and no Meshy credits spent.

Reproduce with `pnpm build:client`, then
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-flood-warning,undertow-flood-active,undertow-flood-reduced`.
These are offline renderer fixtures. `--shots flood` records the real Undertow
training warning/discharge/recovery through ordinary movement and server time.
Budget fixture: `--shots undertow-effects-stress --assert-budgets`.


### Session 63: Pressure Drop maintenance gallery (original collision-derived kit)

Pressure Drop 2/2 completes the arc. Undertow's central block retains its outer
68..82 x 40..60 m shell and 6 m roof, with a 14 x 4 x 3 m gallery beneath it.
Two half-metre shutters are authoritative map boxes. Permanent architecture
and ground AO exclude moving doors; `client/signal-core.ts` supplies their
prebuilt original panels, flush trim, status strips and two portal signs.
The shared 256 x 64 sign atlas reads MAINTENANCE / TRANSIT and OPENS ON
PRESSURE DROP. No purchased source, Meshy generation, new light or render pass.
Only the x-length of the shared Relay gallery kit changes for Undertow.

`maps/undertow-architecture.glb`: 6,394,324 bytes (+46,836), 81,844 oriented
source triangles (+636), ten material primitives and one 1024-square AO image.
`maps/undertow-ground-ao.png`: 841,165 bytes (+5,943), 2048 x 1365, retaining
13.65 source pixels/metre and the existing runtime downsample/detail tile.
The bake audit verifies authored normals, winding, finite UVs and zero
source/export degenerates. Existing allowlists and per-map loading apply.

Reproduce from apps/ironsight:

```powershell
node tools/dump-maps.mjs .inspect/session63-maps.json undertow
node tools/dump-architecture.mjs .inspect/session63-architecture.json undertow
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --factory-startup --python tools/bake-ground-ao.py -- --maps .inspect/session63-maps.json --size 2048 --samples 96
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --factory-startup --python tools/bake-architecture.py -- --input .inspect/session63-architecture.json --size 1024 --samples 64
python scripts/audit-architecture.py --input .inspect/session63-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots gallery,undertow-gallery-closed,undertow-gallery-open,undertow-gallery-inside --prefix session63-review
```

### Session 64: Undertow deployment breakout screens

Four original full-height machinery screens, authored in `UNDERTOW_ROWS`,
stagger the north/south exits on both teams' deployment bays. The southern
screens join the existing pump returns. Collision tiles remain authoritative;
the existing procedural kit supplies the vent/fan cladding and baked AO.
No purchased input, new texture, light, render pass or Meshy generation.

`maps/undertow-architecture.glb`: 6,721,420 bytes (+327,096), 86,236 oriented
source triangles (+4,392), ten material primitives, one 1024-square AO image.
`maps/undertow-ground-ao.png`: 853,588 bytes (+12,423), 2048 x 1365.
The original-only allowlists and per-map loading remain applicable.

Reproduce from apps/ironsight:

```powershell
node tools/dump-maps.mjs .inspect/session64-maps.json undertow
node tools/dump-architecture.mjs .inspect/session64-architecture.json undertow
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --factory-startup --python tools/bake-ground-ao.py -- --maps .inspect/session64-maps.json --size 2048 --samples 96
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --factory-startup --python tools/bake-architecture.py -- --input .inspect/session64-architecture.json --size 1024 --samples 64
python scripts/audit-architecture.py --input .inspect/session64-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots dom --assert-breakout --prefix session64-review
```

### Session 71: Undertow Breakwater

Two original 2 x 3 x 8 m machinery baffles at x18-20 and x130-132, z24-32,
screen the northern deployment crossing from the inner lane. Both ends remain
walkable. Collision tiles own their full volumes; the procedural kit follows.
Two flush A/WEST CONTROL and C/EAST CONTROL signs reuse the existing atlas and
opaque material. No purchased inputs, Meshy generation, new light or render pass.

`maps/undertow-architecture.glb`: 6,919,320 bytes (+111,036), 88,924 oriented
triangles (+1,464), ten material primitives and one 1024-square AO image.
`maps/undertow-ground-ao.png`: 855,354 bytes (+1,724), 2048 x 1365, 13.65 px/m.
The existing original-asset allowlists and per-map lazy loading apply.

Reproduce from apps/ironsight:

```powershell
node tools/dump-maps.mjs .inspect/session71-maps.json undertow
node tools/dump-architecture.mjs .inspect/session71-architecture.json undertow
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --factory-startup --python tools/bake-ground-ao.py -- --maps .inspect/session71-maps.json --size 2048 --samples 96
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --factory-startup --python tools/bake-architecture.py -- --input .inspect/session71-architecture.json --size 1024 --samples 64
python scripts/audit-architecture.py --input .inspect/session71-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-home --review-camera 5,1.65,27.5,26.5,1.65,26.35 --review-enemy 26.5,0,26.35 --prefix session71-review
node scripts/inspect-map.mjs --url http://localhost:8796 --shots dom --assert-breakout --prefix session71-live
```

### Session 70: Undertow Pump Breach

Two original 3 m pump returns extend the southern housings at x62-64 and
x86-88, z84-88. The collision tiles also shorten their adjacent waist boxes.
Both break the long z85 firing line; the two existing B court doors stay open.
The procedural kit follows these authoritative volumes. Two flush B/PUMP HALL
signs reuse the existing 1024-square signage atlas and material. No purchased
input, new texture, light, pass or Meshy generation.

`maps/undertow-architecture.glb`: 6,808,284 bytes (+86,864), 87,460 oriented
triangles (+1,224), ten material primitives and one 1024-square AO image.
`maps/undertow-ground-ao.png`: 853,630 bytes (+42), 2048 x 1365, 13.65 px/m.
Existing original-only allowlists and lazy per-map loading still apply.

Reproduce from apps/ironsight:

```powershell
node tools/dump-maps.mjs .inspect/session70-maps.json undertow
node tools/dump-architecture.mjs .inspect/session70-architecture.json undertow
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --factory-startup --python tools/bake-ground-ao.py -- --maps .inspect/session70-maps.json --size 2048 --samples 96
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --factory-startup --python tools/bake-architecture.py -- --input .inspect/session70-architecture.json --size 1024 --samples 64
python scripts/audit-architecture.py --input .inspect/session70-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-maintenance,undertow-effects-stress --assert-budgets --prefix session70-review
node scripts/inspect-map.mjs --url http://localhost:8796 --shots dom --assert-approaches --prefix session70-live
```

### Session 65: Switchyard Cargo Shift, stage 1 of 2

Original procedural cargo and hoist in `client/cargo-crane.ts`: a corrugated
4 x 3 x 12 m module, corner castings, locking bars, spreader and four cables.
Four draw objects seek an absolute room timer; no texture, light, shadow update,
external model or purchased input. The moving load remains beyond x=153 m at
all times. This stage is an exterior transfer, not playable cover.

The permanent east gantry's old trolley/hook is removed from the original
`client/switchyard-environment.ts` bake. The exterior east hall moves eight
metres farther east to clear the load. A swept-envelope test checks the cargo
against every permanent exterior instance. Gameplay collision is unchanged.

`maps/switchyard-architecture.glb`: 7,183,364 bytes (-1,452 from Session 64),
93,704 oriented triangles, ten material primitives, one 1024-square AO image.
No ground rebake: the authoritative map and ground AO inputs did not change.
Existing original-asset allowlists and per-map loading apply. Meshy spend: 0.

Reproduce from apps/ironsight:

```powershell
node tools/dump-architecture.mjs .inspect/session65-architecture.json switchyard
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --factory-startup --python tools/bake-architecture.py -- --input .inspect/session65-architecture.json --size 1024 --samples 64
python scripts/audit-architecture.py --input .inspect/session65-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots cargo,switchyard-cargo-transfer --prefix session65-review
```

### Session 66: original freight counterweight (runtime geometry)

`client/cargo-counterweight.ts` authors the Switchyard gantry counterweight and
512x128 sign atlas from primitive geometry and Canvas text; no external source,
purchased derivative or generated binary. It follows the authoritative
`ARENA3.signalCore` envelope (4x3x6m) and replicated lock state. The down lock is
flush with the apron, with no baked shadow or permanent architecture at its spot.
The overhead Session65 crane retains its original mesh and motion. Reproduce with
`pnpm build:client`; no Blender re-bake or extra public asset file is needed.

### Session 74: baked damage border

`ui/damage-vignette.png` is an original 384 x 384 RGBA PNG, 18,491 bytes
(589,824 decoded bytes, 0.5625 MiB). `tools/bake-damage-vignette.mjs` computes
a deterministic rectangular soft falloff and writes PNG with Node's built-in
zlib; no external art, purchased source, dependency or image service. Reproduce:

```powershell
node tools/bake-damage-vignette.mjs
```

The HUD uses 128-pixel nine-slice borders so edge width survives viewport changes.
Only opacity animates. This replaces a full-screen animated inset box shadow,
a plausible trigger for the first-damage raster stall in the Session74 trace.
It does not eliminate the separately observed compositor/ANGLE stalls.
The image preloads with the page. It is shared UI; per-map loading is unchanged,
and no WebGL texture, light or render pass is added. Browser decoded image bytes
are reported separately from Three.js's texture-residency estimate.

### Session 75: Relay surface finish (original runtime assets)

`client/relay-surfaces.ts`, `client/concrete-detail.ts` and `client/site-ground.ts`
generate the Relay finish during scene preparation. No downloaded material,
purchased source or image service is involved; no new public binary is shipped.
Reproduce with `pnpm build:client`, then inspect Relay/Cooling at the existing
fixed cameras. Other maps retain their prior material data.

Relay uses one 1024 x 683 linear R8 ground atlas (6.83 texels/metre on each axis),
one 256-square RGBA8 tangent normal and one 256-square R8 roughness texture.
Both detail maps repeat every 0.8 m (320 texels/metre). Slab joints at 6 x 5 m,
concrete formwork at 2.4 x 1.2 m and recessed tie shading use metric coordinates
and screen derivatives in the existing opaque material pass. Subpixel joints
fade; there is no relief geometry, displacement, additional pass or live light.
Coated steel/paint retains its palette and gets a weaker shared fine finish.

The ground stores linear red intensity with a material tint; canvas rows are
explicitly reversed for the typed upload so north-side AO stays in the north.
The original 2048 x 1365 ground AO is unchanged and multiplied at load. Ground
AO completion is now awaited before the scene's shader/texture preparation.
Finer normal + roughness uses 0.4167 MiB with mips; ground uses 0.8893 MiB.
Their combined 1.3060 MiB is 0.1940 MiB below the previous 1.5000 MiB allocation.
No Meshy credits, new dependency, asset allowlist or per-map request is needed.

### Session 76: Undertow wet concrete (original runtime assets)

`client/undertow-surfaces.ts`, `client/undertow-wetness.ts`, `client/site-ground.ts`
and the existing `client/concrete-detail.ts` generate the finish during map
preparation. Original deterministic geometry/noise and Canvas2D masks; no copied,
purchased or generated-service images, no new public binary and no Meshy spend.
Reproduce with `pnpm build:client`, then:

```sh
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-home,undertow-maintenance,undertow-effects-stress --prefix undertow-surface-review --assert-budgets
```

The 1024 x 683 linear RG8 ground packs base red intensity and wetness separately.
Colour is decoded from sRGB; wetness remains linear, with both rows explicitly
reversed to align north-first canvas and the unchanged 2048 x 1365 baked AO.
AO updates intensity in place and leaves the wetness channel intact. The same
256-square normal/R8 roughness pair as Relay supplies 320 texels/metre, but with
weaker concrete normals and quieter coated paint. The map shares two detail
textures across twelve meshes; Relay and Switchyard keep their own map data.

Six-by-five-metre slab joints, cast panels and form ties use derivative filtering
in the existing opaque pass. Original seed76021 masks gather water beneath
stationary plant faces and along basin/maintenance service. Retracting gallery
doors are excluded. Wet patches darken the base, reduce roughness to0.27 and
smooth the aggregate normal; their sheen comes from the existing daylight PMREM,
not scene reflections. Concrete has a restrained damp lower band and runoff;
painted trim preserves its large colour mass. No animation, additional pass,
light, new cover or per-frame bake/upload is introduced.

Ground plus fine detail is2.1953MiB with mips, up0.6953MiB from1.5000MiB.
The matched full Undertow stress estimate is61.3008MiB, within64MiB, with
209draws/159284triangles/25textures/29programs unchanged. These are resource
measurements on the local RTX5070, not representative laptop-iGPU acceptance.

### Session 77: Switchyard steel and service floor (original runtime assets)

`client/switchyard-surfaces.ts`, `client/switchyard-service-wear.ts` and the
existing `client/concrete-detail.ts` / `client/site-ground.ts` author this finish
at map preparation. No downloaded material, purchased derivative, image service,
new binary, dependency or Meshy spend. Reproduce with `pnpm build:client`, then:

```sh
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-north,switchyard-service,switchyard-center,switchyard-effects-stress --prefix switchyard-surface-review --assert-budgets
```

Switchyard uses a 1024 x 683 linear R8 ground atlas, 6.83 texels/metre on both
axes. The tested Relay packer decodes sRGB red intensity, reverses north-first
canvas rows explicitly and updates the same allocation after the unchanged
2048 x 1365 ground AO arrives. A material tint retains the base yard colour.
The atlas holds broad aging, original seed77021 stains, tyre wear and dry grease
at static cabinet feet. Retracting freight is excluded from footprint stains.
Ground AO completes before the ordinary shader/texture preparation barrier.

One shared 256-square RGBA8 normal / R8 roughness pair tiles every 0.8 m,
320 texels/metre, across twelve meshes. Concrete gets fine aggregate and metric
6 x 5 m slabs / 2.4 x 1.2 m cast panels. Enamel and steel have weaker grain;
the existing material slots distinguish concrete, steel, coloured enamel and
ramps. Panel-edge coordinates are recovered once from validated rectangular
triangle pairs, including duplicated ramp corners. They leave all positions,
normals, indices and paint/AO UVs intact. Nonrectangular/curved regions stay
unmarked. Panel-edge float streams total 3,015,296 bytes (2.876 MiB), plus
861,072 bytes (0.821 MiB) of metric UVs for the two newly detailed steel meshes,
per CPU/GPU copy, separate from texture memory. No triangles are added.

The existing opaque PBR pass shades rubbed edges, dirt behind seams, a fine
rolled-steel roughness variation and 18 cm projected anti-slip tread on the
ramps. Derivatives fade small marks before they alias; there is no displacement,
extra pass/light, animated resource upload, per-frame CPU bake or new cover.
The original palette, signs, launch markings and cargo collision stay intact.
Ground plus detail uses 1.3060 MiB with mips, down 0.1940 MiB from 1.5000 MiB.
Per-map lazy loading is retained. This completes Surface Detail 3/3 by default;
human visual/readability and representative laptop-iGPU acceptance remain open.

### Session78: Afterlight 1/2 — Undertow dusk

`undertow-dusk.hdr` (104,307 bytes) and `undertow-dusk-sky.png` (122,555 bytes)
are original mathematical radiance/cloud fields, with no external imagery,
purchased source or Meshy generation. Both derive from the same seeded field
and `client/undertow-dusk.json`. Reproduce from this app:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-undertow-sky.py
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-home,undertow-flood-active,undertow-effects-stress --prefix dusk-review --assert-budgets
```

The HDR is linear 512x256 and becomes the existing 128px PMREM during arena
preparation. Its source and generator are disposed after that one generation.
The PNG is 1024x512, explicitly sRGB-encoded once; the shader sampler decodes
it once. The bake reopens the saved PNG and validates every pixel's encoded
value and orientation to within 2/255. Non-Color/Standard bypasses Blender's
display transforms; do not apply AgX or another gamma conversion.

The visible sky is 2 MiB RGBA8, linear-filtered without mipmaps, sampled by the
existing sky sphere's one draw. The sun disc is analytic within that shader;
its broad baked halo drives reflections, and its direction matches the existing
directional light. Camera translation is excluded from sky projection. The sky
has no animation, per-frame CPU bake, extra pass, new light or bloom overlay.
Warm low sun, blue hemisphere fill, exposure and distant fog are map-specific;
fog still begins at 90m, beyond the 40m rifle lanes. Shaded surfaces and operators
retain fill and existing actor rim/team-colour settings. Shadows use the same
cached 1024 atlas. This changes no collider, actor material, gameplay or wire data.

Only Undertow requests these two files, replacing its 41,273-byte daylight HDR
request (net +185,589 bytes on that map). Relay and Switchyard retain daylight.
Stress texture residency rises 61.3008 -> 63.3008 MiB, within 64 MiB; the other
maps allocate no new texture. Inspector validates map-only requests, all 16
prepared lights, matching sun/key direction, cached shadows and sky residency.
Load/PMREM call timings describe local preparation, not isolated GPU timing or
CDN first-load performance. Human visual/device acceptance remains open.

### Session79: Afterlight 2/2 — Switchyard overcast

`switchyard-overcast.hdr` (144,190 bytes) and
`switchyard-overcast-sky.png` (135,785 bytes) are original mathematical stratus
clouds and radiance. No external images, purchased content or Meshy input.
Blender's seeded Perlin field produces broad blue-grey cloud bodies and a
diffuse silver opening, aligned with the existing directional key. Reproduce:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-switchyard-sky.py
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-north,switchyard-cargo-transfer,switchyard-effects-stress --prefix overcast-review --assert-budgets
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-vista,switchyard-vista --prefix afterlight-vistas --write-vista
```

`client/switchyard-overcast.json` supplies the bake and runtime key direction,
cool fill, exposure and distant fog. The high, weak key and stronger hemisphere
fill reduce sunlight contrast without hiding or adding lights. Fog begins at
100 m, beyond the tested 40 m rifle corridors. The scene retains its 16 prepared
lights and cached 1024 shadow atlas. All gameplay, collision and actor palettes
are retained. The sky has no solar disc, animation, extra pass or live bake.

HDR stays linear at 512x256 and becomes one 128px/1.5 MiB PMREM before ready.
The 1024x512 sRGB PNG is 2 MiB RGBA8 without mipmaps, in the existing sky draw;
the same texture projection excludes camera translation. Explicit sRGB encoding
and saved-pixel validation use the same Standard/Non-Color approach as Session78.
The maximum saved encoded error is 0.001961, below 2/255. This is sky reflection
lighting, not real-time scene reflections or volumetric clouds.

Only Switchyard loads these two files, replacing its 41,273-byte daylight HDR:
279,975 bytes total, net +238,702 map-load bytes. Its stress texture estimate
rises 61.9948 -> 63.9948 MiB, leaving only 5,461 estimated bytes under 64 MiB;
future texture work must first free residency. The estimate omits driver and
vertex-buffer overhead. Relay daylight and Undertow dusk retain their own loads.
Afterlight 2/2 completes by default across the three maps. Both weather-map
selection vistas are refreshed from the production renderer using the command
above; these are flattened game screenshots, not concept art. The menu uses
images without loading the map's 3D assets. Numeric first-load/stress comparisons
and paired-camera evidence are in the Session79 AAA plan log; hardware and human
visual/readability acceptance remain open.

## Session81: original operator field kits

`client/operator-kit.ts` authors bevelled carriers, shoulder plates, magazine
pouches, straps and thigh guards in the cached operator's bind pose. RUSH uses
a light asymmetric kit, ANCHOR a broad paired-shoulder carrier, and SCOUT a
compact raised collar and back module. `src/bot-roles.ts` supplies stable role
identities; humans use the balanced ANCHOR carrier. Equipment grants no stats.

Reproduce with `pnpm build:client`, then
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots roles-after`.
The original procedural geometry is merged into the existing skinned draw once
per role during arena preparation. The complete quantized inverse-bind transform
places each part; the source model's vertices, clips, head and foot normalization
are preserved. All three buffers are prepared before input. No new image, asset
download, light or render pass. Team-coloured plates, graphite underlayers and a
pale chest identification strip share one shader with the existing enemy rim and
colour choices. The private source GLB and its textures remain unchanged/ignored;
no purchased-source derivative is exported or versioned. Measured geometry,
resident textures and before/after evidence are in the Session81 AAA plan log.

## Session82: original first-person field sleeves

`client/hand-geometry.ts` generates tapered forearm reinforcement, two fitted
webbing straps, seam stitches, pale identification bars and glove ribs. These
original vertex-coloured surfaces merge into the existing six hand draws; they
use no texture, extra material, purchased derivative or per-frame geometry.
The existing wrist/grip and server-driven reload paths place the entire sleeve.
Reproduce with `pnpm build:client`, then
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots weapon-ar,weapon-ar-ads,weapon-ar-reload-out`.
Matched before/after stills, all-weapon pose review and performance measurements
are recorded in the Session82 AAA plan log. No binary asset is added.


### Session 83 ? Relay field finish and kit generation

Relay's original material finish is defined in `client/relay-palette.ts` and
`client/relay-surfaces.ts`. The authored slot mapping applies to the procedural
fallback and existing AO GLB. Geometry, AO images and UVs are unchanged; no bake
or purchased derivative is exported. `relay-weathering.ts` adds static face-height
attributes and preserves the rendered triangle stream. It uses the original
parent accessor metadata retained by `tools/weather-architecture.py` for the
subdivided concrete, preventing triangle-shaped runoff. Existing R8 roughness is
sampled at fine and broad scales; no new surface image or resident texture.
Build with `pnpm build:client`. Regenerate the original menu capture with
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots vista --write-vista`.

Meshy programme begun under ART-CONCEPT.md's owner-authorized 1300credit budget,
150/session maximum: Session83 spent90credits, account1530 ->1440. Three original
kit candidates, sequential preview/PBR refine calls30credits each, are retained in
`.inspect/session83-meshy/{field-helmet,field-radio-pack,field-helmet-shell}` with
exact prompts, task IDs, timestamps and accounting in each `meta.json`. Raw
models remain inspection-only. Both helmet attempts are rejected for weak/warped
silhouettes; the radio pack is staged for later bone-fit/readability inspection.
None is deployed, allowlisted as a game asset, or attached to the purchased rig.
No generated body replaces the skeleton or its55 clips. Programme credit
remaining1210; account balance1440 (different quantities).

Reproduce each request with `node tools/meshy-generate.mjs --name <slug> --prompt
"<meta.json prompt>" --texture "<meta.json texture_prompt>" --polycount 2000
--out .inspect/session83-meshy` (consumes credits; output is nondeterministic).
All three were shrunk with Blender4.5:
`blender --background --python tools/shrink-glb.py -- --input <dir>/model.glb
--output <dir>/shrunk.glb --size 512 --webp`.
The nine retained Blender review stills are reproduced by
`blender --background --python .inspect/session83-assets-review.py`.
Future adoption must pass the game rig/map inspectors and texture/draw/hitch
budgets first. No raw Meshy or purchased-source binary was added to public.


### Session 84 ? Undertow field finish

`client/undertow-palette.ts` maps the original architecture's ten baked material
slots and the procedural fallback to grey concrete, worn grey steel, faded olive
and ochre paint. `undertow-surfaces.ts` reuses the resident metric normal/R8
roughness pair for aggregate, ledge runoff, form-tie rust, paint wear and damp
silt. Ground wetness still comes from the original RG8 mask and reflects the
existing dusk environment. All rendering is opaque in the existing pass.

`relay-weathering.ts` is shared as the static panel-height preparer: it expands
shared corners while preserving the rendered positions/normals/AO UVs. Original
parent accessors are respected if a bake has subdivision metadata. The existing
FloodWorks metal body and moving gates share these detail textures and retain
their existing draws; wear moves with each gate. No new light, texture image,
collision volume, per-frame bake or purchased derivative is introduced. Buffer
memory, first-load measurements and matching screenshots are in Session84's log.

Reproduce with `pnpm build:client`. Update the original deployment screenshot:
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-vista --write-vista`.
Asset loading remains per map. The source architecture GLB and AO images are
unchanged. Generated equipment candidates stay outside public until fitted and
accepted; the programme accounting and dispositions are in AAA-PLAN.md.

Session84 generated two inspection-only candidates for60credits (account1440 ->
1380; programme1150credits remaining). Both are rejected: `field-plate-carrier`
has folded/warped shoulder edges and faceted pouches; `field-chest-panel` ignored
the isolated panel request and generated another crumpled full vest. Sources,
exact prompts, task IDs and balance receipts live under
`.inspect/session84-meshy/<slug>/meta.json`. Raw models are6171356/6651012bytes;
512px WebP shrinks are166320/230444bytes and2468/3550triangles. Neither enters
public or the purchased rig. Reproduce requests with `tools/meshy-generate.mjs`
using the metadata's prompt/texture_prompt and2500/3500polycount respectively,
`--out .inspect/session84-meshy` (consumes credits, nondeterministic). Shrink with
`tools/shrink-glb.py --input <dir>/model.glb --output <dir>/shrunk.glb --size 512 --webp`
under Blender4.5. Review: `blender --background --python .inspect/session84-assets-review.py`.

### Session 85 - Switchyard field finish

`client/switchyard-palette.ts` assigns grey/olive/ochre industrial finishes to
the existing original architecture slots and procedural fallback. The original
AO GLB stays unchanged. `switchyard-surfaces.ts` reuses the resident 256px normal
and R8 roughness pair for ledge rust, broken paint, edge corrosion and damp
asphalt. Ground intensity/AO remains R8; broad wet patches sample the same detail
tile at two scales and reflect only the resident overcast sky. There is no new
reflection pass, image download, texture allocation, light or transparent layer.
Original flush asphalt repairs/tyre wear are painted into the existing ground
atlas by `switchyard-service-wear.ts` during loading.

The moving cargo, trolley and counterweight share these detail textures in their
existing draws. Prepared height/ledge/normal attributes travel with each mesh;
geometry buffers do not change during the event. The existing signs and lock
markers retain their text and gameplay meaning. All original triangle positions,
normals, colours and AO UVs are preserved; splitting corners changes decoded
buffer storage, reported separately from texture residency in Session85's log.
No purchased-source derivative, generated model or dependency is added.

Reproduce with `pnpm build:client`; refresh the original deployment screenshot:
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-vista --write-vista`.
Fixed-camera pairs, moving-cover views, geometry audit and performance evidence
are under `.inspect/session85-*`. Meshy spending is zero this session: this
material pass does not need generated geometry. The soldier/weapon programme
retains1150 authorized credits; account1380 is the supervisor's last receipt.
## Session 86: field uniforms and radio (2026-09-10)

`props/field-radio-pack.glb` is an original Meshy-generated prop, first generated
in Session83 and fitted in Session86. It contains no purchased soldier geometry.
Preview task `01a08aa5-fbae-701a-9922-1904e5e7db2f`, refine task
`01a08aa7-707b-740d-b774-e2ca642d7e0a`; generated 2026-09-10T09:31:50.683Z,
2000-triangle request, 30 credits already charged to Session83. Prompt: a compact
rectangular olive canvas military radio backpack, flat back, compression straps,
exposed dark control block and short antenna; no person, brand or insignia.
Raw source 7,767,328 bytes, 512px WebP intermediate 188,000 bytes. The adopted
vertex-colour GLB is 260,176 bytes / 1,895 triangles / one mesh / zero textures;
SHA256 `f929f61404ac98cbd2ad3feb7981ad74e7b66d7f7fce5831b5f53ea45ece153a`.

Reproduce from the retained generated source (Blender4.5):

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/shrink-glb.py -- --input .inspect/session83-meshy/field-radio-pack/model.glb --output .inspect/session86-radio-shrunk.glb --size 512 --webp
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/bake-radio-colors.py -- --input .inspect/session86-radio-shrunk.glb --output public/assets/props/field-radio-pack.glb
```

Cycles bakes albedo only into original prop vertex colours; no light is baked.
`client/field-equipment.ts` loads this only alongside actors, normalizes it to
0.26 × 0.46 × 0.18m, and `operator-kit.ts` merges it into anchors' existing skinned
draw with rigid upper-spine weights. Radio triangles cannot produce hit claims.
Original procedural sleeves, trousers, helmet cover and goggles use the same
draw and bind-coordinate fabric finish. No additional light or rendering pass.

The purchased `models/player.glb` stays ignored and unchanged. Its actual64
animation clips and original vertices are retained; runtime atlas preparation
downsamples the shared2048px colour atlas to512px once before play, saving20MiB
of estimated mipmapped texture residency. No purchased derivative is exported.
Session87 adopts the fitted second carbine below; the first attempt stays rejected.

### Session87 — issued carbine (generated + original fitted parts)

`weapons/field-carbine.glb` replaces the AR in both held views. Meshy generated
the receiver, polymer stock and handguard; the capped magazine, charging latch
and open reflex housing are original geometry from `tools/fit-field-carbine.py`.
No purchased geometry, soldier mesh or animation was read by this export.

Source: Session86 `field-carbine-clean`, generated 2026-09-10T11:11:43.725Z.
Preview task `01a08b01-f110-74fd-8c88-fa159785be81`; refine task
`01a08b03-02b8-73e6-9beb-80f32c2982fe`. Requested 3000 triangles, PBR, generic
issued rifle with no brand/real model, flat receiver, tubular slotted handguard,
detachable magazine and iron sights; matte parkerised steel, olive polymer,
rubbed edges, dust and khaki magazine tape. Full prompts/receipt remain in
`.inspect/session86-meshy/field-carbine-clean/meta.json`. Generated original for
this project under the account's Meshy terms. Cost: 30 credits in Session86;
zero new credits in Session87.

Raw 6,910,652 bytes -> 512px WebP intermediate 255,784 bytes -> fitted
320,296 bytes, 3210 triangles, three meshes sharing one PBR material and two
512px images (albedo and packed metallic/roughness). The generated normal map
is deliberately omitted to retain the 32-texture stress budget. The uneven
front sight and folded magazine underside were rejected during close review.
SHA256: `c6bc34fa6240ad9db54324d7bad3a85846526951fb1ff75eb3719492c428b5a6`.

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/shrink-glb.py -- --input .inspect/session86-meshy/field-carbine-clean/model.glb --output .inspect/session86-meshy/field-carbine-clean/shrunk.glb --size 512 --webp
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/fit-field-carbine.py -- --input .inspect/session86-meshy/field-carbine-clean/shrunk.glb --output public/assets/weapons/field-carbine.glb
```

The fitted +Z-bore asset is 1.20m in grip space, normalized to 0.72m remotely;
first person keeps its existing 0.65 scale. The barrel tip is measured from
vertices; the open optic centre is y=0.085 in asset space. Authored magazine
and latch groups move independently on the existing server-deadline reload.
Templates and buffers are cached and prepared before play. Shared weapons
load with the viewmodel; map assets retain per-map lazy loading. The old
purchased weapon bundle remains private for the other four slots.

### Session88 - shared issued-equipment finishes (original runtime code)

`client/equipment-finish.ts` supplies original static object-space grain,
longitudinal metal scuffs, mottled dye and filtered fabric weave. Secondary
weapon clones remap their existing shared palette atlas to parkerised steel,
olive polymer and faded tape; generated PBR replacements retain their own
materials. First-person sleeves/gloves use the same texture-free detail family
over original vertex colours in `client/hand-geometry.ts`, with lower fabric
reinforcement and webbing profiles. Detail fades below pixel size.

This creates no exported asset, texture, render pass or light. Source GLBs,
images and source materials stay unchanged; both held views share cached
finish materials, and split reload parts retain object-space detail. Purchased
derivatives remain ignored. Meshy cost: zero new credits. Reproduce with
`pnpm build:client`, then `node scripts/inspect-map.mjs --url http://localhost:8796 --shots weapon-smg-hip,weapon-shotgun-reload-out,weapon-sniper-hip,weapon-pistol-hip`.

### Session89 - Relay fieldworks (generated sack, original assembly and damage)

`props/relay-field-sandbags.glb` contains one original Meshy-generated filled
canvas sack. Preview `01a08b5d-8d37-72a7-8051-e45b08d115cb`, refine
`01a08b5f-049f-7643-bb1b-befb15c55d8d`, generated 2026-09-10. Full prompts,
source/output hashes and rejected task IDs are in the adjacent metadata JSON.
The raw 8,104,804 bytes shrink to 86,988; removing unused normal/metallic/AO
images and smoothing the sack produces 83,456 bytes, 1,043 triangles, one
mesh/material and one 512px WebP albedo. The source geometry accessors occupy
54,770 bytes. Coincident source vertices are welded before recalculating smooth
prop normals; UV seams remain intact. Architecture normals are never changed. The source hash
is `0d87b6aa1dd8a65df759935c4ba7ed590c649c45e49e1e9ace8190c11c5e15a2`;
the shipped hash is `927db93d34e31719cc658f6c9ab308481eb4536c6f74adc9ad8499078f71766e`.

Reproduce from the ignored Session89 raw source with Blender 4.5:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/shrink-glb.py -- --input .inspect/session89-meshy/field-sandbag-single/model.glb --output .inspect/session89-sandbag-single-512.glb --size 512 --webp
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python tools/pack-field-sandbag.py -- --input .inspect/session89-sandbag-single-512.glb --output public/assets/props/relay-field-sandbags.glb
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots fieldworks-wall --review-camera 71,1.65,8,75,3.25,0
```

To regenerate the source, pass the recorded `prompt`, `texture_prompt` and
`target_polycount` from `props/relay-field-sandbags.meta.json` to
`tools/meshy-generate.mjs --name field-sandbag-single --out .inspect/session89-meshy`.
Generation consumes credits and is nondeterministic; the processing/assembly
above is reproducible from the retained source. Session spend: **90 credits**,
including two rejected 30-credit wall candidates. The accepted sack cost 30.
Balance after all three: 1,230; owner programme remaining: 1,000 of 1,300.
No purchased derivative is exported or newly versioned.

`client/relay-fieldworks.ts` fits the sack to 0.67 x 0.235 x 0.44 m and merges
96 copies into eight staggered three-course sections, wholly outside the north
movement boundary, seated on the existing 2.9 m coping. It also paints original
shallow spall, chip clusters and powder aprons on four existing service shelters.
Wall patches stay within 17 mm of intact solid faces; residue is a flat decal
19 mm above ground. These are static battle traces, not destructible openings.
The collision map, architecture bake and ground AO remain unchanged.

Relay lazy-loads the sack before scene preparation. Its albedo is dyed dusty
khaki and copied once into the existing service atlas, expanded from 512x256
to 1024x1024 (0.6667 -> 5.3333 MiB with mipmaps). Service plates, damage and
sacks remain one opaque, alpha-tested draw. No new resident texture, light,
pass or per-frame CPU bake. The intermediate source textures/geometry are
disposed after packing. Other maps never request the sack. The alpha-tested
material is included in normal loading-time WebGL preparation.
The existing dark coping/foundation material also resolves coplanar depth ties
with a fixed polygon offset in both the procedural fallback and baked kit;
this removes the flickering concrete/trim seam without changing geometry.
