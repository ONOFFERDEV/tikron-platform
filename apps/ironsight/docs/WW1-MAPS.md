# WW1 map authoring contract

This contract governs the conversion of Relay, Undertow, and Switchyard into original WW1 infantry spaces. It records authoring boundaries and proposed targets. It does not claim that the three geometry conversions, surface assignments, movement retune, or browser play review are complete.

## Compatibility baseline

The runtime keeps the stable arena IDs `arena1`, `arena2`, and `arena3`, and the presentation keys `relay`, `undertow`, and `switchyard`. The wire mode order stays `tdm`, `ffa`, `dom`, `practice`. TDM uses arena1, FFA uses arena3, DOM uses arena2, and practice retains its existing room-ID selection across all three arenas.

Every current map is 150 x 100 m with six red and six blue spawn points. The common playable floor heights are -3, 0, and +3 m. Current caps are:

| Arena | A | B | C |
| --- | --- | --- | --- |
| arena1 / Relay | 25,0,15 | 75,0,85 | 125,0,15 |
| arena2 / Undertow | 27,0,15 | 75,0,55 | 123,0,15 |
| arena3 / Switchyard | 31,0,13 | 75,0,83 | 119,0,13 |

The current Task 12 movement rules are walk 5.5 m/s, sprint 8 m/s, crouch 2.6 m/s, and a grounded ADS multiplier of 0.75. The pre-retune 6/9/3 m/s values remain an explicit historical comparison. Map timing reports name the ruleset that produced them; the sorted-ETA test characterizes the active rules rather than approving another retune.

## Shared data

`src/map/types.ts` defines the only shared map shape. Map authors use `MapNavigationDef` to publish stable, map-prefixed anchors and links. An anchor names its exact point, one of the -3/0/+3 layers, and its purpose. A link names two anchors, its walk/ramp/drop traversal, direction, and clear width. Required walk and ramp links are at least 2 m wide. A drop is directional. These records describe intended access but never grant movement through blocked collision.

Cover uses `standing-block`, `crouching-block`, or `body-exposed`. A `MapCoverDef.box` must be the same object present in `MapDef.boxes`; visual dressing cannot be classified as cover by itself.

`src/map/materials.ts` supports exactly `mud`, `gravel`, `wood`, `metal`, and `concrete`. Its flat `SurfaceBinding` union carries `kind` and the corresponding `box`, `ramp`, or `face` directly. Map authors install bindings only through `withSurfaceBindings`; unsupported runtime strings, duplicate IDs, multiple materials on one support object, and foreign support objects are rejected. Footstep and impact consumers read these bindings; a binding never adds collision or triggers a render-mesh raycast.

## Geometry and collision authority

`compileStructure` cuts real doors, windows, and slab holes into shared boxes. `withStructures` threads the same boxes and ramps into the map. `excavate` owns the existing rectangular -3 m cuts and exact earth solids. `MapDef.boxes` plus `MapDef.ramps` remain the movement authority. Authoritative shot and grenade slope corrections belong to Task 23 and consume these same objects.

Rendered architecture follows the authoritative shell. Cladding may extend at most 0.02 m from that shell and cannot close a door, window, roof opening, bridge underpass, or excavation. Opaque faces require backed collision. If an art asset fails to load, the same authoritative cover silhouette remains.

## Access and capture rules

Each spawn has a stable `*.spawn.red.N` or `*.spawn.blue.N` anchor and two distinct protected walk/ramp exits in the completed map. The server retains spawn choice authority and prioritizes unoccupied and hidden candidates. FFA treats every other live player as hostile. When every candidate is dangerous, the system chooses the least dangerous candidate; it does not claim safe invulnerability.

DOM occupancy uses x/z radius and ignores y. Each cap therefore intersects exactly one playable support floor. No lower channel, roof, bridge, or stair landing on another layer may fall within the 4 m capture radius. Undertow B may move to the proposed sluice square near 75,0,55 only after this check and two independent protected ground approaches pass.

The runtime bot implementation is `src/rooms/bot-navigation.ts::BotNavigator`. It already holds multiple supported-height nodes at one x/z, sweeps directed edges with the real capsule, uses 32-bit fields, bounds its destination cache, and separates open/closed signal-core graphs. `src/map/nav.ts` and `src/map/navigation.ts::GroundNavigator` remain ground characterization tools. They cannot approve roof, bridge, or lower/upper overlap. Task 28 hardens the existing runtime graph and adds the greater-than-32767 node regression; it does not build another runtime navigator.

## Authorized geometry conversions

Relay may replace cooling equipment, the pressure-core presentation, uplink/dish props, and modern panels with ruined brick rooms, a communications yard, and timber/earth traverses. The existing southern cut, bridge relationship, two-ended rooms, spawn count, and stable map identity remain constraints.

Undertow may replace the clarifier, pump-industrial dressing, and dusk treatment with embankments, a sluice office, a dry drain, and readable wet stone/timber. Its three bridges and lower bypass remain. Moving B from the southern court is authorized only as the measured single-floor gameplay change described above. Swimming is outside scope.

Switchyard may replace high-voltage equipment, launch pads, and the moving counterweight route with a rail embankment, loading platforms, walkable ramps, and fixed freight cover. All 12 spawns need two exits and FFA crossfire review. Launch and slide authority changes remain in the combat tasks.

Each map author may change only that map's arena, structures, cut/yard, client presentation modules, and focused tests. Shared types, materials, contract validators, spawn helpers, navigation runtime, room, main, scene, net, and generated client output have one owner and are integrated once.

## Verification

Task 5 runs:

```text
pnpm exec vitest run test/map-invariants.test.ts test/map-timing.test.ts test/ww1-map-contracts.test.ts
pnpm exec vitest run test/map-invariants.test.ts test/map-timing.test.ts test/ww1-map-contracts.test.ts -t "rejects sealed required route|rejects stacked capture volume"
```

The first command proves the current map identities, spawn counts, ground reachability, sorted ETA characterization, typed support bindings, layers, and cover vocabulary. The second proves that a full-height sealed route and a second playable layer inside a capture cylinder are rejected. Later tasks add map-specific geometry, multilayer runtime, art/collision, and Aside real-input evidence without converting these contract tests into claims about unimplemented play results.
