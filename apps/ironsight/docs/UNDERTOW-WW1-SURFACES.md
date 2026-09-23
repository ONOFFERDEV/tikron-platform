# Underpass Trench: period skyline and wet surfaces

Session 4 starts the Underpass conversion arc. `ART-CONCEPT.md` and `docs/WW1-MAPS.md`
remain the authorities. The authored environment is fictional: its ruined canal houses,
bell tower and timber lifting trestle make no claim to model a named historical place.

## Construction and material contract

- `undertow-skyline.ts` describes original exterior boxes with explicit yaw and roll.
  Thick masonry walls, open upper windows, interrupted pitched roofs, exposed rafters
  and unequal chimney stacks replace process tanks. The north tower and west roofline
  retain distinct orientation silhouettes; the east hoist remains lower.
- `buildUndertowEnvironment` sends those parts through its existing material batches.
  Runtime fallback and architecture export consume the same list. No separate hidden
  skyline, new loader/cache, light, texture file or render pass is introduced.
- All rotated exterior extents stay outside the 150 × 100 m playable rectangle. The
  floor tiers, structures, shutter states, spawns, capture points, routes and movement
  authority are unchanged. No decorative roof, pier or beam grants cover in the arena.
- `undertow-palette.ts` retains the existing baked slot order. Masonry is grey-brown;
  timber is muted brown/olive with zero metalness; iron hardware remains distinct.
- `undertow-surfaces.ts` reuses the existing derivative-filtered Relay brick, timber
  and soil patterns with Undertow's wetness channel and runoff treatment. Mortar and
  longitudinal grain alter shading normals only. Fine detail fades below its pixel
  footprint. Existing normal, roughness and AO textures keep their identity.
- The legacy loader's `coated` category contains both timber and iron. The baked finish
  name selects their physical properties and stable shader identity. Limestone is
  nonmetallic. The public loader API is unchanged.

## Reproduction and proof

```text
node tools/dump-architecture.mjs .inspect/undertow-period-architecture.json undertow
blender --factory-startup --background --python tools/bake-architecture.py -- --input .inspect/undertow-period-architecture.json --size 1024 --samples 64
uv run python scripts/audit-architecture.py --input .inspect/undertow-period-architecture.json
```

`test/undertow-period-skyline.test.mjs` constructs the real fallback, rejects exterior
process cylinders, checks the complete visual scene against authoritative supports,
and holds exterior submission below 14,000 triangles. `test/undertow-field-materials.test.ts`
checks finish identity, nonmetallic timber/limestone and resident map preservation.
The architecture audit checks exact oriented triangles, normals and finite AO UVs.

Ground AO is unchanged: its bake consumes the unchanged collision map. The architecture
AO is rebuilt for the new exterior geometry at the existing 1024-pixel resolution.

## Remaining arc work

Playable turbine faces, slab-like field-office walls, the high flood-sluice frames,
repetitive perimeter halls and modern floor markings remain conversion work. Their
presence is not certified as finished WW1 art. This increment supplies the period
skyline and common wet material language without changing event timing or collision.
The look lane owns dusk lighting and atmosphere. Laptop-iGPU performance remains an
explicit measurement gap; desktop screenshots and hitch passes do not certify it.
