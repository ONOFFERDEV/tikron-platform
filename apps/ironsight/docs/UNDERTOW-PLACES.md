# Undertow: pump-service rooms (Session 94, Places C 1/3)

The west pump hall occupies x30–52 / z58–64; east operations mirrors it at
x98–120. Two 2m doors on each south face open into a working room with console
cover, five permanent firing windows, an internal stair and a holdable +3m roof.
The 0.28m roof slab meets the 3m perimeter walls without overlapping faces.
The south parapet has a 4m opening for a return to the yard. Ground navigation
can enter the rooms, but the first three natural DOM samples contain no room
traffic: current B orders retain their southern approach. Routing combat bots
through the rooms and roof pathfinding remain combat-stream requests. The lower canal route
is now implemented in [Places C 2/3](UNDERTOW-CHANNEL.md); the built plant
boundary is the remaining stage of this arc.

`src/map/undertow-structures.ts` owns the shared collision definition. The tile
layer's two sealed housings are removed by exact footprint before composition.
The central Pressure Drop gallery, existing control decks, objectives, spawn
screens and map rectangle stay in the compiled map. Presentation consumes these
same thin walls/slabs and never paints a filled housing over the real openings.
Paint and stair nosings remain within centimetres of their supporting surfaces.

Four issued crate stacks from the frozen `ammo-crate-stack` library sit on
console worktops at y1.1. Their exact 0.531171 × 1.15 × 0.598316m envelopes are
server solids. The loader replaces matching procedural boxes before shader
preparation; a failed asset load retains the boxes. Only Undertow requests the
crate asset, and its instances share geometry/materials/textures. No Meshy job,
new asset, real-time light or render pass is added.

Reproduce the original architecture and ground AO in the app directory:

```powershell
node tools/dump-architecture.mjs .inspect/session94-architecture.json undertow
node tools/dump-maps.mjs .inspect/session94-maps.json undertow
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-architecture.py -- --input .inspect/session94-architecture.json --size 1024 --samples 64
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-ground-ao.py -- --maps .inspect/session94-maps.json --size 2048 --samples 64 --architecture .inspect/session94-architecture.json
```

No purchased inputs enter these bakes. The existing map-asset allowlist and
provenance apply. The Blender shader-node lookup uses its stable type so local
display-language preferences cannot silently stop the bake.

Validation commands:

```powershell
node tools/audit-undertow-structures.mjs
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-places-play --prefix session94-west-final
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-places-play --places-east --prefix session94-east-final
```

The live probe uses ordinary walk/sprint/aim/fire inputs and observes combat's
acknowledged-command telemetry with `?movement-review=1`. It checks both doors,
stairs uphill/downhill, thin-wall clearance, roof landing and the yard drop.
Matched command error must stay below the existing 0.15m soft threshold. Raw
distance to the delayed owner snapshot is retained separately. Observation
is bounded to 4096 events and disabled during normal gameplay.

The acknowledged adapter is restricted to Training with `?movement-review=1`.
It supplies fixed-step intents and consumes owner snapshots, never client
positions. Normal play retains `Net.setMoveIntent` and its reconnect seed.
Session94 rejected enabling the adapter globally: one missing command tick
clears held ADS server-side, and live ADS/fire/sprint timing checks failed.
Combat owns that repair; see the plan's cross-stream request and the retained
`session94-command-handling.json` reproduction. The predictor, room protocol
and combat tests are unchanged. These training reviews isolate geometry
agreement; they do not claim the owner's normal-play snapback is fixed.
The first legacy-stream drill remains a failed observation (zero acknowledged
samples); successful geometry reviews use `session94-*-final`.
