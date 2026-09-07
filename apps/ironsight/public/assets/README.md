# ironsight assets — provenance

| Path | Source | In git? |
|---|---|---|
| `models/player.glb` | Synty (retargeted/merged from Synty packs via the rig pipeline) | **no** — EULA forbids sharing source files |
| `models/weapons-vm.glb` | Synty weapon viewmodels | **no** |
| `maps/arena1-dressing.glb`, `maps/arena2-dressing.glb` | Synty dressing bundles baked per map | **no** |

The four unversioned GLBs are required by the client build and the deployed
worker (embedding them in a shipped product is permitted by the Synty EULA).
Keep a private copy outside the repo and restore it into these paths on a
fresh checkout; without them the FPS client renders no player/weapon/dressing
meshes. Everything else under `assets/` is versioned normally.
