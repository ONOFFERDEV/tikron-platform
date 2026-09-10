# Undertow: lower pump-service channel

Session 94 continuation, Places C 2/3. The paired pump rooms and +3 m roofs
now have a real -3 m service route behind them. `src/map/undertow-channel.ts`
defines an 82 x 6 m excavation at x34-116 / z68-74. Its drained floor has
retaining walls, pump baffles, work benches and two eight-metre end stairs.
Three four-metre bridges at x44-48, x73-77 and x102-106 keep yard crossings
open. There is a four-metre apron between the room doors and channel edge.
Bridges have flush steel and painted edges; their open sides are real drops.
The Pressure Drop event continues to discharge into its exterior basin.

The shared terrain/structure compiler supplies every solid to collision,
current and historical shots, route navigation, the renderer and both bakes.
Old yard boxes overlapping the cut are removed; no machinery floats above
the excavation. The floor has a real hole in the yard plane. Undertow's old
continuous exterior apron is replaced by four disjoint exterior rectangles
so it cannot render over the channel. No new light, pass, texture, dependency,
generated prop, dynamic geometry or per-frame bake is introduced.

The ordinary yard/roof/lower floor datums are 0/+3/-3 m. Buildings, objectives,
spawn screens, rifle lane and the gallery remain. End stairs and pump bypasses
are mirror-paired about x75. The existing ground navigator can plan through
the channel; upper bridge decks and room roofs are deliberately human routes.
Natural bot assignments are owned by combat. Reachability is not evidence
that bots choose the route. The acknowledged-command live check still uses
the inherited Training-only `movement-review=1` adapter. It qualifies shared
geometry, not the owner's unresolved normal-play snapback.

Every added solid is at or below the old yard datum. Old valid player feet
cannot be enclosed by new positive-height cover; a removed support allows a
normal fall. No room snapshot shape or persisted-state version is changed.
The supervisor must ship client and Worker geometry together.

Reproduce from `apps/ironsight`:

```powershell
node tools/audit-undertow-channel.mjs .inspect/session94-channel-audit.json
node tools/audit-undertow-structures.mjs
node tools/dump-architecture.mjs .inspect/session94-channel-architecture.json undertow
node tools/dump-maps.mjs .inspect/session94-channel-maps.json undertow
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-architecture.py -- --input .inspect/session94-channel-architecture.json --size 1024 --samples 64
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-ground-ao.py -- --maps .inspect/session94-channel-maps.json --size 2048 --samples 64 --architecture .inspect/session94-channel-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-overview,undertow-vista,undertow-channel,undertow-channel-lower --prefix session94-channel-after
python -c "from PIL import Image; Image.open('.inspect/session94-channel-after-undertow-vista.png').resize((1280,720),Image.Resampling.LANCZOS).save('public/assets/undertow-vista.webp',quality=86,method=6)"
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-places-play --channel --prefix session94-channel-live-west
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-places-play --channel --places-east --prefix session94-channel-live-east
```

These refresh the existing original `undertow-architecture.glb`,
`undertow-ground-ao.png` and `undertow-vista.webp`. Existing allowlists and lazy loading apply; no
purchased inputs enter either bake. Stage 3 is the plant/canal boundary mass.
