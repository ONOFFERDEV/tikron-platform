# Undertow: breached maintenance bays

Session 100, Places E 2/3. The two southern 22 x 6 m pump blocks become
roofless maintenance bays. Four-metre north and south openings are offset
one metre; narrow side accesses and waist-high equipment create short
circuits inside each former solid. Stepped wall remnants change the skyline.
West uses concrete pump masonry and round service fittings; east uses ribbed
switchgear panels and rectangular controls. MAINTENANCE signs and ground
thresholds identify the new passage using the resident sign/material batches.
The channel review also found older yard stripes floating over the excavation.
All circulation and bay-threshold paint is now clipped to actual y=0 ground
or bridge faces; the rendered-geometry audit checks 69 supported ground marks.

The old volumes were x24-46 and x104-126, z76-82, y0-6. All 24 new
wall/bench solids and both crate envelopes lie inside them. This is a
subtraction from existing cover: no previously valid player position is
enclosed, and no persisted-state shape migration is needed. Ship Worker and
client together. The actual before-map comparison preserves every other
MapDef field, including both enterable rooms, +3 m roofs/stairs, -3 m channel,
terrain, ramps, spawns, capture positions, B approach baffles and Pressure Drop.

Power remains mirrored. The non-tile offsets, broken wall tops and distinct
surface treatments improve orientation, but this is not acceptance of a
fully asymmetric site layout. No rotated visual disguises an axis-aligned
collider. Walls have exact opaque authority shells; equipment remains solid
under its millimetre-offset cladding. Openings are real movement and firing
routes in both event states. Bots can navigate to both bays from every spawn;
natural occupancy is measured separately from that reachability check.

Two `ammo-crate-stack` copies reuse the frozen prop library at its published
real-world dimensions, on existing solid benches at y1.1. Their server boxes
exist during loading and on failure. The same map-owned loader/materials
serve the original room and exterior supplies; no new generated asset or
texture is introduced. No Meshy jobs/credits, new light, rendering pass,
dependency or per-frame construction. Purchased derivatives remain ignored.

All architecture and baked AO are original procedural work. The existing
allowlisted Undertow architecture, ground AO and vista are refreshed and
remain lazy per map. Asset-library and asset-README ownership stay with the
paused assets stream; this provenance document is linked in AAA-PLAN.md.

Reproduce from `apps/ironsight` in PowerShell:

```powershell
node tools/audit-undertow-yard.mjs .inspect/session100-yard-audit.json .inspect/session100-before-map.json
node tools/audit-undertow-channel.mjs .inspect/session100-channel-audit.json
node tools/audit-undertow-structures.mjs
node tools/dump-architecture.mjs .inspect/session100-architecture.json undertow
node tools/dump-maps.mjs .inspect/session100-maps.json undertow
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-architecture.py -- --input .inspect/session100-architecture.json --size 1024 --samples 64
python scripts/audit-architecture.py --input .inspect/session100-architecture.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-ground-ao.py -- --maps .inspect/session100-maps.json --size 2048 --samples 64 --architecture .inspect/session100-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-overview,undertow-vista --prefix session100-after --write-vista
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-yard-play --prefix session100-live-west
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-yard-play --places-east --prefix session100-live-east
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-places-play --prefix session100-live-room
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-places-play --channel --prefix session100-live-channel
```

The audit's final baseline argument is optional once session evidence is
archived. Live probes use ordinary look/walk/sprint/fire inputs through the
existing Training-only acknowledged-command review adapter. They qualify
map geometry; normal-play rollback and held-ADS integration remain combat
work. Local RTX measurements do not qualify laptop performance or CDN loads.
The yard driver walks the final metre of sprint legs for precise arrival:
one 0.45 m sprint command is wider than its 0.44 m arrival diameter. The
original overshoot failure is retained; no geometry or acceptance limit changed.
