# Switchyard: retired rail-loading cut

Session 97, Places D 2/3. The lower South service route is a 82 x 8 m
excavation at x34-116 / z68-76, with a floor three metres below the yard.
Two eight-metre end ramps enter the bed. Four-metre bridges at x44-48,
x73-77 and x102-106 preserve north/south crossings at yard level, above
the lower route. Open bridge sides are real drops. Maintenance and Dispatch
retain their interiors, stairs and +3 m roofs, four metres north of the cut.

The bed reads as a retired loading siding: inset rail/sleeper marks,
grease-darkened retaining panels, faded dock stripes, cabinet cover and
banded loading pallets. Four issued crate stacks reuse the frozen library,
at its documented real-world size, on the two lower pallets. The existing
four room supplies remain. All eight use the already qualified map-owned
matte finish; no additional texture, generated asset or Meshy credit.

The terrain and structure compiler supplies the same earth, walls, cover,
ramps and slabs to movement, current/historical shots, navigation and bakes.
Old yard boxes overlapping the excavation are removed. Four low yard cases
are relocated into the bed to leave clear staging at the end ramps and
south return; capture anchors and patrol destinations stay fixed. The visible yard has
a real hole; its exterior apron has no triangles over playable ground.
Paint and rail detail stay within two centimetres of their actual support.
No decorative railing suggests protection at an unblocked bridge edge.

All added solid volumes end at/below the old yard datum. Previously valid
player positions cannot be enclosed by the new geometry; removed support
allows an ordinary fall to the new floor. No persisted-state shape/version
change is needed. The supervisor must ship Worker and client geometry together.
Cargo Shift, induction pads, twelve spawns, capture anchors and North bus's
40 m rifle line remain. The ordinary playable datums are now -3/0/+3 m.

The ground navigator can reach the lower route. Bridge decks and room roofs
remain human routes: a reachable lower path is not evidence of deliberate
bot use. Bot orders and normal-play rollback/held-ADS integration belong to
combat. Live geometry verification uses ordinary movement, sprint, look and
fire through the inherited Training-only `movement-review=1` adapter, with
matched acknowledged-command error kept separate from replication lag.

Reproduce from `apps/ironsight`:

```powershell
node tools/audit-switchyard-rail.mjs .inspect/session97-rail-audit.json
node tools/audit-switchyard-structures.mjs .inspect/session97-structure-audit.json
node tools/dump-architecture.mjs .inspect/session97-architecture.json switchyard
node tools/dump-maps.mjs .inspect/session97-maps.json switchyard
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-architecture.py -- --input .inspect/session97-architecture.json --size 1024 --samples 64
python scripts/audit-architecture.py --input .inspect/session97-architecture.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-ground-ao.py -- --maps .inspect/session97-maps.json --size 2048 --samples 64 --architecture .inspect/session97-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-overview,switchyard-vista,switchyard-rail-entry,switchyard-rail-lower,switchyard-rail-bridge --prefix session97-after --write-vista
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-places-play --rail --prefix session97-live-west
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-places-play --rail --places-east --prefix session97-live-east
```

The three existing original assets are refreshed: `switchyard-architecture.glb`,
`switchyard-ground-ao.png` and `switchyard-vista.webp`. No purchased input enters
the bakes, and the existing allowlists and per-map lazy loading remain. No new
light, pass, animation, dependency or per-frame construction is introduced.
The next stage, Places D 3/3, replaces the remaining depot boundary.
