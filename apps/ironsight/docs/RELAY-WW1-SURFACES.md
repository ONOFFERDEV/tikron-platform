# Signal Station: field material conversion

Session 1 of the world stream converts the existing Relay shell without changing its collision layout. The full period conversion remains an arc: this pass owns earth, brick and timber finishes and the exterior wireless aerial; modern skyline buildings, service equipment and some signage remain for the next world pass.

## Material contract

`relay-palette.ts` remains the common palette for fallback geometry and the existing architecture bake. Its baked slot order remains unchanged. The stable loader calls `finishRelaySurface` with its original `ground`, `concrete`, `apron` or `coated` category; the world material module resolves the legacy baked name into these visual finishes:

| Existing slot | Surface | Treatment |
| --- | --- | --- |
| concrete | rough masonry | Staggered 0.38 × 0.145 m brick courses, recessed mortar and fired-brick variation on vertical faces; horizontal coping stays continuous. |
| dark, teal, amber, ramp | timber | 0.24 m planks, staggered end joints, longitudinal fibre and zero metalness. |
| pale | lime coping | Rough, nonmetallic stone/plaster trim. |
| metal | iron | Existing chipped and stained hardware finish. |
| ground, apron | earth/gravel | Irregular grain and soil relief; Relay's atlas carries paired wagon ruts and foot scuffs in place of rectangular concrete patches. |

The procedural relief perturbs shading normals only. It never displaces vertices, clips fragments, changes opacity, or introduces a hole into cover. Analytic derivatives fade subpixel mortar and plank seams. The existing fine normal/R8 roughness pair, ground R8 atlas and baked AO are reused, with no added sampler, texture asset, render pass or light. All CPU painting occurs during construction, with no frame-loop updates.

## Geometry and authority

The 225 boxes, eight ramps, openings, -3/0/+3 m floors, spawn locations and routes remain unchanged. Existing ground and architecture AO are retained because the occluding shell is unchanged. `audit-relay-site`, `audit-relay-yard`, `audit-relay-interior` and the map tests verify the existing authority rather than claiming a new layout.

`SignalArray` now renders a braced timber wireless mast and open wire aerial in place of the satellite dish. This exterior object keeps the existing event API and phase timing. Tests sweep all phases and alignment endpoints, check every opaque mesh stays at z < 0, retain geometry/material identity across updates, and cap the complete landmark (including cosmetic wave meshes) below 1,500 triangles. It has no new textures, lights, collision, or dynamic shadow requests.

## Evidence

Session measurements, exact gate outcomes, rejected intermediate attempts and fixed-camera captures are recorded in `AAA-PLAN-WORLD.md` and `.inspect/aaa-loop-world/`. Local desktop measurements do not certify the laptop iGPU target. This pass does not claim that the remaining industrial silhouettes have been converted.
