# Relay: working-site boundary

Session 92 continuation completes Places B 3/3 around the existing two rooms,
two +3 m roofs and -3 m cable trench. `client/relay-site.ts` supplies original
box geometry to the same procedural fallback and architecture bake. There
are no generated or purchased inputs in this kit.

The west edge is a repair hall with three roof heights, roof lanterns and shut
roller doors. The east edge is a freight shed and offset dispatch block.
Receiver annexes and a service gallery connect the north side to the dish;
the central sandbagged outlook stays low. A solid retaining bank supports
two tracks along the south edge. Three rotated, closed freight boxes beyond
the tracks reserve exterior footprints for the assets stream's prop library.
The workshop and freight signs reuse two free tiles in the service atlas.
The five existing zone signs also share one static mesh/draw; their atlas,
placement, text and material are unchanged.

Every vertex stays outside the 150 x 100 m playable rectangle. Rotated boxes
are checked by their full extents, not their centres. The boundary audit also
checks 1,004 enclosure samples and the eight sign planes. No shared map,
cover, spawn, navigation, ramp, room state or combat rule changes. The two
enterable buildings are COMMS / WEST and CONTROL / EAST; the exterior halls
are shut background architecture. The broad internal grid and other maps'
boundaries remain further work in Places C/D/E.

All parts batch into the existing architecture materials. There is one
1024-square AO image; the existing tiling finishes provide fine surface
detail. Ground AO optionally accepts the original architecture dump and
includes only geometry outside the rectangle. Interior ground occlusion
still comes from shared boxes and ramps. There are no new textures, lights,
render passes, real-time geometry updates or dependencies.

Reproduce from `apps/ironsight` in PowerShell:

```powershell
node tools/audit-relay-site.mjs
node tools/dump-maps.mjs .inspect/session92-site-maps.json relay
node tools/dump-architecture.mjs .inspect/session92-site-architecture.json relay
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --factory-startup --background --python tools/bake-architecture.py -- --input .inspect/session92-site-architecture.json
python tools/weather-architecture.py --input public/assets/maps/relay-architecture.glb --output public/assets/maps/relay-architecture.glb --report .inspect/session92-site-weather.json --edge-length 2
python scripts/audit-architecture.py --input .inspect/session92-site-architecture.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --factory-startup --background --python tools/bake-ground-ao.py -- --maps .inspect/session92-site-maps.json --architecture .inspect/session92-site-architecture.json --size 2048 --samples 96
pnpm build:client
```

Outputs refresh the existing allowlisted `relay-architecture.glb` and
`relay-ground-ao.png`; map loading remains lazy. Keep the inherited skyline
derivative ignored. The asset README is owned by the assets stream; its
provenance update is requested in `AAA-PLAN.md` with this document as source.
