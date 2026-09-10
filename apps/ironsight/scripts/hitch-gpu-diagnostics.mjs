// Optional, read-only WebGL submission diagnostics for hitch-probe. Installed
// through CDP before the app loads; never bundled into the game or enabled in
// the ordinary acceptance run. No gl.finish/readPixels/timer-query side effects.
export function installGpuDiagnostics() {
  const D = window.__hitchGpu = { frames: [], resources: [], totals: {}, peak: {}, started: 0 };
  const counters = {};
  const count = (name, amount = 1) => {
    counters[name] = (counters[name] ?? 0) + amount;
    D.totals[name] = (D.totals[name] ?? 0) + amount;
  };
  let frame, drawMaterials, frameSerial = 0;
  const objects = new WeakMap(); let nextId = 0;
  const id = object => { if (!object) return 0; if (!objects.has(object)) objects.set(object, ++nextId); return objects.get(object); };
  const methods = ['createTexture', 'deleteTexture', 'createBuffer', 'deleteBuffer',
    'createProgram', 'deleteProgram', 'createShader', 'deleteShader', 'compileShader', 'linkProgram',
    'createFramebuffer', 'deleteFramebuffer', 'createRenderbuffer', 'deleteRenderbuffer',
    'bufferData', 'bufferSubData', 'texImage2D', 'texSubImage2D', 'texStorage2D', 'generateMipmap',
    'renderbufferStorage', 'renderbufferStorageMultisample'];
  for (const name of methods) {
    const original = WebGL2RenderingContext.prototype[name];
    WebGL2RenderingContext.prototype[name] = function (...args) {
      const begin = performance.now(), result = original.apply(this, args), duration = performance.now() - begin;
      count(name); count('submissionMs', duration);
      if (name.startsWith('create') || name === 'compileShader' || name === 'linkProgram') {
        const entry = { t: begin, name, object: id(result ?? args[0]), duration,
          stack: new Error().stack.split('\n').slice(2, 6).join('\n') };
        D.resources.push(entry);
      }
      if (name === 'bufferData' || name === 'bufferSubData') {
        const data = args[name === 'bufferData' ? 1 : 2];
        count('bufferUploadBytes', typeof data === 'number' ? data : data?.byteLength ?? 0);
      }
      if (duration > 8) D.resources.push({ t: begin, name, duration, slowSubmission: true });
      return result;
    };
  }
  window.__THREE_DEVTOOLS__.addEventListener('observe', event => {
    const R = event.detail;
    if (!R?.isWebGLRenderer) return;
    const direct = R.renderBufferDirect;
    R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      if (frame) {
        drawMaterials.add(material.id);
        frame.submittedDraws++;
        if (material.transparent) frame.transparentDraws++;
        if (R.getRenderTarget()) frame.targetDraws++;
      }
      return direct.call(this, camera, scene, geometry, material, object, group);
    };
    const render = R.render;
    R.render = function (scene, camera) {
      // PMREM calls render recursively only outside live play. Keep the outer
      // frame as the resource/target accounting unit.
      if (frame) return render.call(this, scene, camera);
      const begin = performance.now();
      frame = { t: begin, serial: ++frameSerial, submittedDraws: 0, transparentDraws: 0,
        targetDraws: 0, shadowRequested: R.shadowMap.needsUpdate, shadowAuto: R.shadowMap.autoUpdate };
      drawMaterials = new Set();
      try { return render.call(this, scene, camera); }
      finally {
        Object.assign(frame, { end: performance.now(), materials: drawMaterials.size,
          calls: R.info.render.calls, triangles: R.info.render.triangles,
          textures: R.info.memory.textures, geometries: R.info.memory.geometries,
          programs: R.info.programs.length, commands: { ...counters } });
        for (const key of Object.keys(counters)) counters[key] = 0;
        D.frames.push(frame);
        if (D.frames.length > 512) D.frames.shift();
        if (D.started) for (const key of ['submittedDraws', 'transparentDraws', 'targetDraws', 'materials',
          'calls', 'triangles', 'textures', 'geometries', 'programs']) D.peak[key] = Math.max(D.peak[key] ?? 0, frame[key]);
        frame = undefined;
      }
    };
  });
  D.start = () => { D.started = performance.now(); D.startTotals = { ...D.totals }; };
  D.report = () => ({ started: D.started, peak: D.peak,
    totals: Object.fromEntries(Object.entries(D.totals).map(([key, value]) => [key, value - (D.startTotals[key] ?? 0)])),
    resources: D.resources.filter(entry => entry.t >= D.started),
    preparation: window.ironsight.preparationInfo() });
}
