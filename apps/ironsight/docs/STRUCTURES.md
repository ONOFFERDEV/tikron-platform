# Structure authoring — Places A

`src/map/structures.ts` composes buildings with the existing tile yard through
`withStructures(map, definitions)`. `relay-structures.ts` is the shipped example.
All coordinates in a definition are relative to its origin. Wall `axis` is the
direction along its length; `at` is the low edge on the perpendicular axis.
Openings specify intervals along the wall and a vertical bottom/top. Overlapping
openings form a union. Slabs accept rectangular holes for stairs and atriums.

The compiler emits ordinary `Box` and `RampDef` objects. The structure's parts
reference the same objects appended to `map.boxes`; both event collision states
retain them. No runtime CSG or parallel collision mesh exists. Thin walls must
use the structure renderer branch: the old closed-box kit adds foundations and
machinery that would obscure openings. Build exact solids first, then cladding
within the existing 2 cm allowance. Never rotate a rendered solid away from its
authoritative AABB. Offset axis-aligned segments can break up a footprint.

The stair contract is a smooth ramp, with surface-aligned anti-slip paint.
`RampDef.baseY` defaults to zero; structure origins translate both base and top.
A real stairwell requires a slab opening wide enough for the capsule and clear
headroom along the complete slope. The ordinary ground is the interior floor;
the roof has a real collidable underside. Runtime physics preserves box-top
support while the capsule straddles the ramp/roof lip.

`GroundNavigator` follows the yard and negative route heightfield: it passes
under lintels and slabs, through doors, and around consoles. Positive stair
footprints remain obstacles. Bots may shoot at elevated humans, but do not seek the roof.
Roof routing is deferred. The ground minimap omits overhead solids so that it
shows the room's entrances. It is not a floor-switching map.

Relay Places B 1/3: COMMS / WEST is x34..56,z34..44; CONTROL / EAST is its
exact x-mirror at x94..116. Each 22x10m room has two 2m-wide, 2.35m-high
yard-facing doors, seven firing windows with 1.1m sills, three solid consoles,
2.72m clear ceiling, a 2m-wide internal ramp to the +3m roof, 1.1m parapets
and a 4m south drop gap. Both inner door apertures fit inside a conservative
78-degree horizontal span from behind the central console; oblique jambs still
screen parts of the exterior approach. Windows can also be jumped/vaulted;
this is not a claim of only two possible attack directions.
The roof, openings and furniture are mirrored as actual collision geometry.
The northern rusher path crosses both ground floors; paired patrol targets
also bring anchors through the rooms under their ordinary perception rules.
Bots use these rooms on the ground. Human tactical balance and the whole-site
stage remain open.

Relay Places B 2/3: CABLE TRENCH cuts x38..112,z73..79 down to y=-3.
`excavate` replaces the implicit yard with four surrounding earth solids and
one lower floor, all shared by movement, hits and grenades. Five disjoint ground
faces keep the original global UVs; neither rendering nor AO leaves a face over
the cut. `relay-trench.ts` adds retaining walls, two 8m ramps, staggered full/waist
machinery and a 4m yard bridge with 2.7m clearance underneath. Yard, trench and
roofs are the three major levels (0/-3/+3m).

Negative ramps participate in bot routing; clearance samples reject crossings
through the vertical earth lip. This is a single yard/trench height per cell,
not stacked navigation: bots route underneath the bridge and do not plan on its
upper deck or the roofs. Ordinary human movement uses exact boxes and slopes
on both levels. Assisted waist vault remains on the yard datum; ordinary jumps
work below grade. Hits/grenades retain the existing conservative three-step ramp
occluder approximation. Pings and mortar designation query the actual ground;
mortar still rejects a target beneath overhead cover.

The shared player-y codec now starts at -3 with the existing 2cm quantization.
Rebuild client and server together; the schema fingerprint detects old bundles.
Room state version 15 resets old snapshots through the existing migration path.

Validation:

```powershell
pnpm exec vitest run test/structures.test.ts test/relay-service-detail.test.ts
pnpm exec vitest run test/terrain.test.ts test/bot-flanks.test.ts
node scripts/inspect-map.mjs --url http://localhost:8796 --shots trench-play --prefix trench-west
node scripts/inspect-map.mjs --url http://localhost:8796 --shots trench-play --trench-east --prefix trench-east
node scripts/inspect-map.mjs --url http://localhost:8796 --shots places-play --prefix structures
node scripts/inspect-map.mjs --url http://localhost:8796 --shots places-play --places-east --prefix control
```

The live probe approaches from normal deployment with W/aim, enters each door,
climbs the actual stair, fires from the roof and drops back to the yard. It never
writes positions, HP, bots or room clocks. Tests also exercise both directions
at three movement increments, ceiling/roof collision, aperture rays, and actual
analytic/hybrid server hits through a window versus an intact wall.

Re-bake ground and architecture after every layout edit. Reproduction commands
and provenance are in `public/assets/README.md`; capture overhead before editing,
then the identical camera after. Keep the shared service atlas and material
batches; new signs/consoles do not require new texture residency.
