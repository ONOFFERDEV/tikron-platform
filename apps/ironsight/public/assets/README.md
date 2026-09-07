# ironsight assets — provenance

| Path | Source | In git? |
|---|---|---|
| `models/player.glb` | Synty (retargeted/merged from Synty packs via the rig pipeline) | **no** — EULA forbids sharing source files |
| `models/weapons-vm.glb` | Synty weapon viewmodels | **no** |
| `maps/arena1-dressing.glb`, `maps/arena2-dressing.glb` | Synty dressing bundles baked per map | **no** |
| `maps/relay-skyline.glb` | Synty Power 01/02/03 and Warehouse 01, transformed and merged with a 1024px atlas by `tools/bake-relay-skyline.py` | **no** |
| `undertow-vista.webp` | Original procedural scene screenshot from `scripts/inspect-map.mjs --shots undertow-vista --write-vista` | yes; no purchased geometry in this map |
| `relay-vista.webp` | Flattened screenshot of the game scene, captured by `scripts/inspect-map.mjs --write-vista` | yes; see `../../LICENSE.md` |

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
