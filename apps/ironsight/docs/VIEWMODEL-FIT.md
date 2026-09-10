# First-person fitting (Session 93)

`client/viewmodel-fit.ts` owns the closer hold for all five slots. It advances the
entire calibrated assembly, rather than changing the mesh while leaving its hands
behind. In AR/SMG/shotgun/sniper/pistol order:

| Parameter | AR | SMG | Shotgun | Sniper | Pistol |
|---|---:|---:|---:|---:|---:|
| Assembly advance, m | .12 | .14 | .14 | .14 | .18 |
| Effective mesh Z inside animated root, m | -.12 | -.16 | -.16 | -.16 | -.12 |
| Root hip Z, m | -.40 | -.40 | -.40 | -.43 | -.38 |
| Weapon ADS vertical FOV | 56 | 59 | 60 | 40 | 59 |

Weapon hip vertical FOV is 74 degrees; ADS root Z is -.38 m. World FOV and the
server's handling timings remain in their existing shared configuration. Scoped
sniper ADS hides the model and retains the world scope at 30 degrees.

The source mesh-to-grip transforms in `VM_WEAPON_TRANSFORMS` stay calibrated to
the existing meshes, wrists and reload contacts. `weaponHolder` and the complete
hand/sleeve group advance equally. The sight frame/dot, detachable magazine and
bolt inherit the holder transform. Sight height is measured from the source mesh
or its authored carbine rail marker. The ADS root centres the measured bore X and
sight Y, with the existing clearance above secondary-weapon iron sights.

The muzzle is measured from the foremost source vertices and transformed through
the mesh matrix; a second marker parented to that mesh independently verifies it.
The muzzle light stays outside the hideable weapon subtree and follows that
projected marker every frame. Brass starts from a source-space receiver marker
(right side of the mesh, bore height, Z=.025), also parented to the weapon.
The visible tracer runs from the current projected muzzle to the existing world
aiming-ray wall endpoint. Server hit resolution and authoritative impact events
are unchanged, including spread.

The weapon has an independent perspective without an additional render pass.
A camera-local parent scales X and Y by
`tan(worldFov / 2) / tan(weaponFov / 2)`, leaving Z unchanged. After the world
projection this is the same screen projection as a separate weapon camera.
Attachments share the parent; their world positions therefore match the visible
muzzle and ejection port. Depth testing remains enabled. No additional light,
material feature, shader, render target, texture or shadow bake is required.

`node tools/audit-viewmodel.mjs` compares this construction to an independent
Three.js camera across 1,350 aspect/FOV/ADS/animated-point cases.

Offline `weapon-*-hip`, `weapon-*-ads`, reload phase and `weapon-*-cycle`
fixtures use the production pose path. Their framing measurement compares frozen
frames with the held assembly hidden, then with only the gun hidden. It reports
visible assembly and weapon pixel fractions, central strip occupancy (X40-60%),
and aiming-region occupancy (X40-60%, Y0-60%). The lower part of the strip can
contain forearms; centred ADS necessarily contains the sight and weapon. These
definitions are reported explicitly rather than claiming a fully empty screen.
Framing readbacks and extra renders occur only in the offline inspector.

`node scripts/inspect-map.mjs --url http://localhost:8796 --shots viewmodel-play`
drives real hip/ADS wall shots and reloads for all five slots. It asserts the
loaded-mesh muzzle agreement, receiver separation and tracer endpoint at the
crosshair, and retains server echoes plus ordinary before/firing screenshots.
Visual capture runs are excluded from performance acceptance. It injects no
game state or shot events.
Before/after captures, the review gallery and measured outcomes are linked from
the Session 93 entry in `AAA-PLAN.md`.
