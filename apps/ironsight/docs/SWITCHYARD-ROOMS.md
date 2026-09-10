# Switchyard: maintenance and dispatch rooms

Session 96, Places D 1/3. Two sealed 16 x 6 m South service housings become
enterable rooms at x34–50 and x100–116, z58–64. Each has two two-metre south
doors, five permanent firing windows, three waist-high work consoles, an
internal stair to a +3 m roof, and a three-metre south roof escape. The
opposing roofs can see one another. The west room is Maintenance; the east
room is Dispatch. The existing capacitor bank and gantry identify their halves.

The structure compiler emits the same thin walls, sills, lintels, slabs and
ramps consumed by client movement, authority, current/historical hits and
ground navigation. New solids remain inside the old six-metre sealed housings.
No previously valid standing position is enclosed, so this change requires no
snapshot shape/version change. Ship client and Worker geometry together.
Cargo Shift, the induction pads, spawns, objectives and the 40 m rifle lane
remain. These buildings add ground and +3 m routes; the lower rail/loading
route and depot boundary are the remaining two stages of Places D.

Both door centres are visible from a standing position behind the central console
(west x42,z61; east x108,z61), within a 78-degree cone. Windows add attack
directions and can be vaulted; this is not a claim that the entire room has
only two ways to attack it. Roof and window defensive balance needs playtesting.
Ground navigation can enter either door. Deliberate bot room orders and roof
use belong to the combat stream; a reachable route is not proof of bot use.

Architecture is original procedural geometry with baked AO. The exact
authority shell is rendered once; cladding stays within 2 cm of its solid.
Stair tread paint follows the continuous ramp without adding physics lips.
Signs share one atlas and draw. No new light, extra pass, animation or per-frame
construction is introduced. The existing Switchyard finish supplies concrete,
steel and paint detail.

Four `ammo-crate-stack` props reuse the frozen library at
0.531171 x 1.15 x 0.598316 m, base at y1.1 on the work benches. Their exact
box colliders exist regardless of visual loading. Separate instanced fallback
boxes are excluded from the architecture bake using `architectureExclude`;
only a completed library load replaces them. Loading is Switchyard-only and
finishes before normal texture/shader preparation. No Meshy spend or new asset
allowlist is required. Source provenance for the existing generated crates
remains in the asset library/README; the new bakes use only original geometry.
The small supplies retain their colour texture with a map-owned matte finish;
their optional normal and ORM textures are not used. The full PBR candidate
exceeded the 32-texture fight budget. The frozen source/library is unchanged.

Reproduce from `apps/ironsight`:

```powershell
node tools/audit-switchyard-structures.mjs .inspect/session96-structure-audit.json
node tools/dump-architecture.mjs .inspect/session96-architecture.json switchyard
node tools/dump-maps.mjs .inspect/session96-maps.json switchyard
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-architecture.py -- --input .inspect/session96-architecture.json --size 1024 --samples 64
python scripts/audit-architecture.py --input .inspect/session96-architecture.json
& 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe' --background --python-exit-code 1 --python tools/bake-ground-ao.py -- --maps .inspect/session96-maps.json --size 2048 --samples 64 --architecture .inspect/session96-architecture.json
pnpm build:client
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-overview,switchyard-vista --prefix session96-after --write-vista
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-places-play --prefix session96-live-west
node scripts/inspect-map.mjs --url http://localhost:8796 --shots switchyard-places-play --places-east --prefix session96-live-east
```

The live checks use ordinary walk/sprint/look/fire inputs and the inherited
Training-only `movement-review=1` adapter. They compare acknowledged commands,
with raw replication lag kept separate. They qualify the layout; normal-play
snapback and held-ADS continuity remain combat work. Performance and natural
round results are recorded in the Session 96 log in `AAA-PLAN.md`.
