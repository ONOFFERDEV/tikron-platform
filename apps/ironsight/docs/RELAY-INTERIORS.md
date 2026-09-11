# Relay working interiors

Session 103, Working Rooms 1/3. Original procedural art by the Ironsight rebuild;
no purchased source, generated model, external image, brand or Meshy credit.

Comms/West has recessed radio-service faces; Control/East has analogue meters
and local override panels. Printed distribution diagrams, shift sheets,
ceiling grilles, upper cable trays and worn washable lower panels make the
existing rooms read as working spaces. The schematic is on the south wall,
where it can be reached, clear of the internal staircase. All effects are
static, opaque surface treatments; instruments emit no light.

`client/relay-interior-detail.ts` paints the new right half of the service
atlas during map construction. The atlas grows from 1024x1024 to 2048x1024:
one additional 5.333 MiB including RGBA8 mipmaps, zero additional textures
or draws. The existing atlas tiles retain their pixel rectangles. All UV
consumers, including the sandbags loaded before renderer preparation, use
the actual atlas dimensions. The standalone sandbag helper retains its
original 1024x1024 default for existing callers.

Each new face sits 12-16 mm outside an existing wall, ceiling or console.
The full rectangle pushed inward 20 mm fits inside one authoritative solid;
no face spans a doorway, firing window, stair opening or clear route. The
geometry joins the existing `relay-service-detail` batch, with the same
material, depth test and shadow receiving. No new lights, passes, shadow
rebakes, animation or per-frame construction.

The complete gameplay MapDef is unchanged. Existing architecture, ground AO
and vista assets remain byte-identical: this changes surface paint rather
than geometry that needs a new occlusion bake. No prop-library modification
or new asset allowlist is needed. Both fallback and baked environments use
the same service-detail builder.

Reproduce from `apps/ironsight`:

```powershell
pnpm build:client
node tools/audit-relay-interior.mjs .inspect/relay-interior-audit.json
```

The audit checks solid backing, finite non-overlapping atlas rectangles,
packed sandbag/damage UVs and valid review-camera positions. An optional
second path names a `{map: ...}` baseline JSON for whole-map equality.
With the local preview running on port 8796:

```powershell
node scripts/inspect-map.mjs --url http://localhost:8796 --shots room --review-camera 41,1.65,42,47,1.5,35 --prefix relay-comms
node scripts/inspect-map.mjs --url http://localhost:8796 --shots room --review-camera 109,1.65,42,103,1.5,35 --prefix relay-control
node scripts/inspect-map.mjs --url http://localhost:8796 --shots room --review-camera 45,1.65,37,49,1.6,44 --prefix relay-interior-exit
```

Before/after pairs, operator fixture, live walk/sprint circuits and measured
resource results are linked from Session 103 in `AAA-PLAN.md`. Human visual
acceptance and representative laptop testing remain open.
