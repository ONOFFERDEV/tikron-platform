# Signal Station: ruined village context

World Session 2 continues the Signal Station conversion. `ART-CONCEPT.md` is the
look authority. Targets: R-M17 central aerial remains dominant; R-G09 and
R-L12/13/14 preserve actor contrast and authoritative cover. This is fictional
late-war scenery, not a reconstruction of a named site.

## Construction and materials

`client/relay-skyline.ts` is the only village geometry source. It builds four
exterior batches used by both the fallback and the exported GLB. Window holes,
broken roof areas, stepped gables, trusses, chimney flues and rubble are geometry.
Brick, plaster, timber, slate and soot use one rough opaque vertex-colour material;
colours are stored as normalized bytes. Derivative-filtered brick relief reuses
the resident Relay shader pattern, with restrained soot streaks and no sampler.
No image, new light, per-frame CPU work or new render pass is used. Palette values
live in the builder's `FINISH` table.

Resident atlas treatment lives in `relay-service-detail.ts`: brown planks with
iron straps, paper field orders, a wood telephone case and brass sockets with
cords. No modern voltage labels, barcode or sealed electrical cabinet artwork
remains in its upper-left equipment tiles. The service mesh and atlas allocation
are unchanged. `relay-environment.ts` keeps the existing strip mesh but uses the
dark timber colour and updates the zone signs in their existing atlas.

## Authority and rebuild

Each skyline sector is wholly exterior to the playable bounds. No map data or
playable geometry changes; ground and architecture AO inputs are unchanged.
The existing one-time shadow preparation includes the new skyline. Failed skyline
loads construct the same village inside the existing GLTF asset lease, so scene
instance disposal and final cache release own both loaded and generated geometry.
There is no eagerly allocated hidden runtime copy. The bake-only exterior audit
still constructs the fallback but excludes it from the architecture bake.

```text
node tools/dump-relay-skyline.mjs
pnpm exec vitest run test/relay-skyline.test.ts
pnpm build:client
pnpm audit:assets
```

The old purchased-source `tools/bake-relay-skyline.py` recipe is superseded for
this filename. Use only the original builder above. The export must stay below
the inherited 1,168,772 bytes; the geometry test requires fewer than 14,000
triangles, one material, zero textures/lights and unchanged map state.

Session evidence and measured runtime limits are logged in `AAA-PLAN-WORLD.md`.
Remaining conversion debt includes the central equipment-like architecture and
the two other maps; this increment does not certify the entire world as AAA.
