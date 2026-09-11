# Switchyard: breached transformer service courts

Session 101, Places E 3/3. Two sealed 14 x 8 m housings beside the central
deck become open service courts. Four-metre north and south entries are
offset by one metre, with an inner side passage and waist-high equipment.
Supported stepped wall remnants replace the flat roof silhouette. West is
cast masonry with a faded maintenance dado; east is a ribbed steel enclosure.
The resident sign atlas marks CAPACITOR / SERVICE, DISPATCH / 03 and the
return to NORTH BUS. Threshold paint identifies the actual openings.

The former volumes are x40-54 and x96-110, z36-44, y0-6. All 26 new
wall/bench solids and both crate envelopes lie inside them. No previously
valid saved position is enclosed, so no state-shape migration is needed.
Worker and client must ship together. Comparison against the actual before
map verifies that every other MapDef field stays identical: rooms, roofs,
stairs, lower rail, terrain, ramps, spawns, caps, routes and Cargo Shift.

Power remains paired. Offsets, stepped silhouettes and different finishes
improve the repeated grid, but fully asymmetric collision remains future
work. No rotated visual hides an axis-aligned collider. Each wall and bench
has a complete opaque authority shell; millimetre cladding stays backed.
The gaps pass movement and eye rays in either Cargo Shift state. All twelve
spawn positions navigate into both courts with the production navigator.
Natural bot occupancy is measured separately from reachability.

Two `ammo-crate-stack` copies use the frozen library at its published size,
standing on solid benches at y1.1. Their exact authority boxes remain during
loading or failure. Existing map-owned library textures/materials serve the
new stacks. No new asset, Meshy credit, light, pass, dependency, animation or
per-frame construction is introduced. Architecture/AO are original procedural
work; purchased derivatives and the asset library remain unchanged.

The existing allowlisted architecture, ground AO and vista are rebuilt and
stay lazy per map. This document supplies provenance while the asset README
lane is paused.

Reproduce from `apps/ironsight` in PowerShell:

```powershell
node tools/audit-switchyard-yard.mjs .inspect/session101-yard-audit.json .inspect/session101-before-map.json
node tools/audit-switchyard-structures.mjs .inspect/session101-room-audit.json
node tools/audit-switchyard-rail.mjs .inspect/session101-rail-audit.json
node tools/dump-architecture.mjs .inspect/session101-architecture.json switchyard
node tools/dump-maps.mjs .inspect/session101-maps.json switchyard
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-architecture.py -- --input .inspect/session101-architecture.json --size 1024 --samples 64
python scripts/audit-architecture.py --input .inspect/session101-architecture.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-ground-ao.py -- --maps .inspect/session101-maps.json --size 2048 --samples 64 --architecture .inspect/session101-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-overview,switchyard-vista --prefix session101-after --write-vista
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-yard-west --review-camera 46,1.65,47,46,2,38 --prefix session101-after-west
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-yard-play --prefix session101-live-west
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-yard-play --places-east --prefix session101-live-east
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-places-play --prefix session101-live-room
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-places-play --rail --prefix session101-live-rail
```

The yard audit's last argument is optional once baseline evidence is archived.
It checks union support for ground paint: a mark can cross two abutting
terrain slabs without being contained by either slab alone. The first copied
audit used single-box containment and incorrectly rejected such a mark at
x3,z67-69; this was an audit defect, requiring no geometry change.

Live circuits use ordinary look/walk/sprint/fire through the inherited
Training-only acknowledged-command adapter. They qualify geometry; they do
not close normal-play rollback or held-ADS integration, owned by combat.
The yard driver walks the final metre of a sprint leg for precise arrival,
retaining the 0.22 m arrival radius and 0.15 m matching-command error limit.
Local RTX measurements do not qualify the laptop or CDN first-load targets.
