# Switchyard: a working power depot

Session 98, Places D 3/3. The western capacitor service court, eastern crane
assembly hall, northern bus compound and southern freight depot replace the
thin perimeter and disconnected background boxes. Unequal hall heights,
clerestories, closed loading shutters, roof ventilation and two yawed rear
sheds give each edge a distinct industrial purpose. Six issued supply stacks
sit on the western service plinth, using the frozen library at its real size.

All new geometry, signs and supplies are outside the existing 150 x 100 m
playable rectangle. The capacitor tower footprints remain clear, and the
crane hall starts at x162 behind the hoist's swept envelope. Low east/west
plinths separate the yard from those equipment courts. The north containment
curb leaves the bus machinery visible; the southern halls close the loading
edge. Closed exterior shutters do not advertise playable entrances.

Maintenance and Dispatch remain the two enterable buildings. Their doors,
windows, internal stairs and opposing roofs are unchanged. The -3 m rail
bed and three yard bridges, Cargo Shift, induction pads, spawns, capture
anchors and rifle lane retain exactly the same shared map data. No saved
position can become enclosed and no room migration is necessary.

The new parts join the existing six procedural finish batches and original
architecture bake. The same tiling surface detail and weathering apply. No
new light, pass, texture, animation, dependency or per-frame construction is
introduced. The additional crate stacks share the already resident colour
texture and map-owned matte material; optional normal/ORM maps stay unused.
All assets remain lazy per map. No Meshy job or credit was spent.

Reproduce from `apps/ironsight` in PowerShell:

```powershell
node tools/audit-switchyard-site.mjs .inspect/session98-site-audit.json
node tools/audit-switchyard-structures.mjs .inspect/session98-structure-audit.json
node tools/audit-switchyard-rail.mjs .inspect/session98-rail-audit.json
node tools/dump-architecture.mjs .inspect/session98-architecture.json switchyard
node tools/dump-maps.mjs .inspect/session98-maps.json switchyard
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-architecture.py -- --input .inspect/session98-architecture.json --size 1024 --samples 64
python scripts/audit-architecture.py --input .inspect/session98-architecture.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-ground-ao.py -- --maps .inspect/session98-maps.json --size 2048 --samples 64 --architecture .inspect/session98-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-overview,switchyard-vista,switchyard-service,switchyard-north --prefix session98-after --write-vista
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-places-play --site --prefix session98-live-west
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-places-play --site --places-east --prefix session98-live-east
```

The existing original `switchyard-architecture.glb`, `switchyard-ground-ao.png`
and `switchyard-vista.webp` are refreshed. No purchased input or new allowlist
entry is involved. Asset README updates remain with the paused assets stream.

Live movement review uses ordinary movement, sprint, look and fire through
the inherited Training-only `movement-review=1` adapter. Matching the same
acknowledged commands qualifies geometry; it does not close the owner's
normal-play rollback or held-ADS report. Bot orders and contact pacing remain
with combat. Deliberate internal grid breaking is the next Places arc.
