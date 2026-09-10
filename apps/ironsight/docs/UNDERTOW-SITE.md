# Undertow: plant boundary and outfall canal

Session 95 completes Places C 3/3. Original `client/undertow-site.ts` geometry
connects the existing rooms, lower channel and industrial skyline to a working
water plant. The west filter house has a loading ledge and three unequal roof
heights. The east maintenance hall backs the existing gantry. The north quay
connects the clarifiers and flood works; the south quay overlooks a canal,
service crossings and three offset pump buildings on the opposite bank. A
pair of low exterior parapets at x48-63 and x87-102 reveals the water from the standing yard;
the nearby quay still has mass, and the crossing remains out of bounds.

The external halls are closed background architecture. The two enterable
maintenance rooms, +3 m roofs and -3 m channel remain the playable places.
Every new part, sign and supply envelope is outside the convex 150 x 100 m
server rectangle, including the rotated buildings. A segment joining two
playable points therefore cannot cross this new geometry. No cover, spawn,
ramp, navigation, event, persisted state or combat rule changes. Internal
grid-breaking and bot use of the rooms/channel remain further work.

Six exterior crate stacks reuse the already loaded `ammo-crate-stack` from
the frozen prop library, at its published real-world scale on solid loading
ledges. The library and generated asset are unchanged. All new architectural
parts are original code geometry, share the existing material batches and
enter the original architecture AO bake. Static signs share one merged mesh
and the existing atlas. Canal water adds one opaque 1,600-triangle draw with
fixed ripple normals and the resident dusk environment reflection. It uses
no water texture, screen-space/planar reflection or animation. The first
candidate incorrectly inherited the rough cladding finish and was rejected.
Concrete bases stop below their steel coping; the cap supplies the remaining
height. The exterior audit rejects exposed coplanar top faces of different
materials, which caused speckling in an intermediate live capture.
No additional texture, light, pass, dependency or per-frame construction is
introduced; all assets remain lazy per map.

Reproduce from `apps/ironsight` in PowerShell:

```powershell
node tools/audit-undertow-site.mjs .inspect/session95-site-boundary.json
node tools/audit-undertow-channel.mjs .inspect/session95-site-channel-audit.json
node tools/audit-undertow-structures.mjs
node tools/dump-maps.mjs .inspect/session95-site-maps.json undertow
node tools/dump-architecture.mjs .inspect/session95-site-architecture.json undertow
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-architecture.py -- --input .inspect/session95-site-architecture.json --size 1024 --samples 64
python scripts/audit-architecture.py --input .inspect/session95-site-architecture.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-ground-ao.py -- --maps .inspect/session95-site-maps.json --size 2048 --samples 64 --architecture .inspect/session95-site-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-overview,undertow-vista --prefix session95-site-after --write-vista
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-places-play --site --prefix session95-site-room
node scripts/inspect-map.mjs --url http://localhost:8796 --shots undertow-places-play --channel --places-east --prefix session95-site-channel
```

The existing original `undertow-architecture.glb`, `undertow-ground-ao.png`
and `undertow-vista.webp` are refreshed. No new allowlist entry or purchased
input is needed. The asset README is owned by the paused assets stream;
its documentation update is requested through `AAA-PLAN.md`.

The live movement checks deliberately use the inherited Training-only
`movement-review=1` adapter. Matched acknowledged commands qualify shared
geometry; they do not establish a fix for the owner's normal-play rollback
report or combat's pending held-ADS work. Device and human acceptance remain
separate from local automated gates.
