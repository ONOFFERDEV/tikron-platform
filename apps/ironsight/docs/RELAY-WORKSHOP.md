# Relay workshop frontage

Session 102, Working Site 1/1. The west repair hall now carries two unequal
ventilation housings, raised skids, louver banks, flanged extraction ducts,
capped outlets and a supported roof service rail. Patched facade sheets,
supply risers, equipment plates and dust abrasion give the wall a working
purpose. The central dish remains the primary landmark.

All 127 original box parts and nine atlas faces stay outside x=0. The west
wall is still solid: the equipment introduces no false doorway, playable
roof, cover, light or sight-blocking smoke. The complete serialized Relay
MapDef is identical to Session 101, including its rooms, +3 m roofs, -3 m
trench, bridges, spawns, objectives and Signal Break. No migration is needed.

Four real-size `ammo-crate-stack` library instances sit fully on the existing
hall roof at y=11.24 m. They join the existing rail-supply batch: one static
draw, vertex-sampled albedo and no additional resident texture. Loading and
sampling occur once before scene preparation. The visible envelope fallback
remains available if loading fails; the map owns and disposes the resources.
The frozen library and generated source files are unchanged, with zero Meshy
jobs or credits. Fine label detail remains traded for the existing texture
budget on these inaccessible supplies.

The procedural kit is original geometry, compiled into the existing material
batches and per-map AO bake. Atlas faces reuse the resident service image and
draw. The architecture, ground AO and vista retain their existing asset paths
and allowlists. No purchased derivative is added. The asset README belongs to
the paused assets stream; its requested provenance link is in AAA-PLAN.md.

Reproduce from `apps/ironsight` in PowerShell:

```powershell
node tools/audit-relay-workshop.mjs .inspect/relay-workshop-audit.json
node tools/dump-architecture.mjs .inspect/relay-workshop-architecture.json relay
node tools/dump-maps.mjs .inspect/relay-workshop-maps.json relay
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-architecture.py -- --input .inspect/relay-workshop-architecture.json --size 1024 --samples 64
python tools/weather-architecture.py --input public/assets/maps/relay-architecture.glb --output public/assets/maps/relay-architecture.glb --report .inspect/relay-workshop-weather.json --edge-length 2
python scripts/audit-architecture.py --input .inspect/relay-workshop-architecture.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-ground-ao.py -- --maps .inspect/relay-workshop-maps.json --size 2048 --samples 96 --architecture .inspect/relay-workshop-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots overview,vista,spawn --prefix workshop --write-vista
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay-arrival --review-camera 12,1.65,50,0,7,42 --prefix workshop-front
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay-yard-play --yard-section roof --prefix workshop-roof
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay-yard-play --yard-section trench --prefix workshop-trench
```

The placement audit independently checks full exterior envelopes, connectivity
to existing structure, complete crate footprint support, opaque decal backing
and standing review cameras. An optional third argument accepts the retained
Session 102 baseline JSON for whole-map equality. Live route probes compare
matching acknowledged commands through the existing Training-only adapter;
they do not qualify normal-play prediction or held ADS.
