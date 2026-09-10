# Relay: breached freight compounds

Session 99, Places E 1/3. Four sealed blocks behind the cable trench become
two open working courts and two staggered cargo pockets. The courts have
broad southern entries, three-metre northern breaches, waist-height work
benches, broken returns and surviving stepped wall tops. The western court
uses damaged repair masonry; the eastern court uses ribbed freight panels.
Labels, old impact scars and loading marks give the spaces a purpose.

This is open yard cover in the existing box layer. The two enterable northern
rooms, their stairs and roofs, the lower trench, bridge, Signal Break, spawns
and objective positions are unchanged. One-metre offsets and L footprints
break the former two-metre tile rhythm. Collision remains mirrored; the
different finishes and background provide orientation. Truly asymmetric
collision needs a coordinated update to the combat-owned layout contracts.

The old solids occupied x22–40 and x110–128, z80–86, and x52–62 and x88–98,
z84–90, all y0–6. Every replacement fits wholly inside those volumes. No
previously valid player position becomes enclosed, so no persisted-state
migration is required. Worker and client must still be rebuilt together.
Visible opaque shells exactly match the shared boxes. Real angled walls
cannot be represented by this AABB engine; no rotated visual hides a larger
invisible collision box. Existing -3/0/+3m route datums remain.

Eight real-size ammo-crate stacks from the frozen library sit on the exterior
rail bank at y3.9, z100.4. Their complete envelopes remain outside the play
rectangle and clear of the track beds. The library resolves before scene
preparation; an exact procedural fallback survives a failed load. No new
generated asset, Meshy job, light, pass, animation or dependency is added.
Their albedo is sampled into vertex colours and the eight copies merge once
during loading. These distant supplies use one draw and no additional GPU
texture. Original geometry and real-size envelopes are retained; fine label
texture detail is traded for the 32-texture budget at this inaccessible edge.

All architecture is original procedural geometry. It uses the existing
eight material batches, one AO bake and tiled finishes. Signs and scars share
the existing service atlas and draw. The refreshed architecture, ground AO
and deployment vista keep their existing allowlist and load only for Relay.
Purchased derivatives remain ignored. Asset-library and asset-README files
are unchanged; the provenance link is recorded for that stream in AAA-PLAN.md.

Reproduce from `apps/ironsight` in PowerShell:

```powershell
node tools/audit-relay-yard.mjs .inspect/session99-yard-audit.json .inspect/session99-before-map.json
node tools/dump-architecture.mjs .inspect/session99-architecture.json relay
node tools/dump-maps.mjs .inspect/session99-maps.json relay
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-architecture.py -- --input .inspect/session99-architecture.json --size 1024 --samples 64
python tools/weather-architecture.py --input public/assets/maps/relay-architecture.glb --output public/assets/maps/relay-architecture.glb --report .inspect/session99-weather.json --edge-length 2
python scripts/audit-architecture.py --input .inspect/session99-architecture.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-ground-ao.py -- --maps .inspect/session99-maps.json --size 2048 --samples 96 --architecture .inspect/session99-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots overview,vista,relay --prefix session99-after --write-vista
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay-yard-play --prefix session99-live-west
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay-yard-play --places-east --prefix session99-live-east
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay-yard-play --yard-section roof --prefix session99-live-roof
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay-yard-play --yard-section trench --prefix session99-live-trench
```

The audit's final baseline argument is optional after this session's evidence
has been archived. It compares the actual pre-session map, including every
unchanged field, in addition to checking containment, shots, navigation,
supported library envelopes and decal backing. Live probes use the existing
Training-only acknowledged-command review adapter. They qualify geometry;
they do not close the owner's separate normal-play rollback/held-ADS issue.
