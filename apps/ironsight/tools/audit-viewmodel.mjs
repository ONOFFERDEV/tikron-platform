import assert from 'node:assert/strict';
import { build } from 'esbuild';
import * as T from 'three';
import { fileURLToPath } from 'node:url';

const result = await build({ entryPoints: [fileURLToPath(new URL('../client/viewmodel-fit.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const { VIEWMODEL_FITS: fits, VIEWMODEL_HIP_FOV, viewmodelProjectionScale: scale } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
let samples = 0, maximumError = 0;
// Compare the single-pass construction to an independent perspective camera,
// across aspect ratios, world zooms, ADS interpolation and animated local poses.
for (const aspect of [16 / 9, 4 / 3, 9 / 16]) for (const worldFov of [30, 55, 78, 86, 100, 110])
  for (const fit of fits) for (const ads of [0, .25, .5, .75, 1]) {
    const weaponFov = VIEWMODEL_HIP_FOV + (fit.adsFov - VIEWMODEL_HIP_FOV) * ads;
    const world = new T.PerspectiveCamera(worldFov, aspect, .05, 500);
    const weapon = new T.PerspectiveCamera(weaponFov, aspect, .05, 500);
    const projection = new T.Matrix4().makeScale(scale(worldFov, weaponFov), scale(worldFov, weaponFov), 1);
    const pose = new T.Matrix4().compose(new T.Vector3(fit.x, fit.y, fit.z),
      new T.Quaternion().setFromEuler(new T.Euler(.2, .13, -.4)), new T.Vector3(1, 1, 1));
    for (const xyz of [[0, .02, -.74 + fit.advance], [.02, -.057, -.28 + fit.advance], [-.014, -.043, -.51 + fit.advance]]) {
      const p = new T.Vector3(...xyz).applyMatrix4(pose);
      const expected = p.clone().project(weapon), actual = p.clone().applyMatrix4(projection).project(world);
      const error = actual.distanceTo(expected);
      assert(error < 1e-12, 'Single-pass weapon projection differs from separate camera');
      maximumError = Math.max(maximumError, error); samples++;
    }
  }
assert.equal(fits.length, 5);
assert(fits.every(f => f.advance > 0 && f.advance < .25));
console.log(JSON.stringify({ pass: true, samples, maximumError, fits, note: 'Independent projection equivalence; no rendering or gameplay authority change.' }, null, 2));
