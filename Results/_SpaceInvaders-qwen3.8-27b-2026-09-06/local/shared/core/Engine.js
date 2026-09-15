// shared/core/Engine.js
// Renderer + scene + camera + fixed-timestep loop + full dispose().
// Simulation state lives outside Three.js objects; this is the render adapter.

import * as THREE from 'three';

export function createEngine(canvas, opts = {}) {
  const {
    clearColor = 0x05060f,
    antialias = true,
    pixelRatioCap = 2,
    onFrame = null, // (dt, elapsed) => void, called with effective (hit-stop scaled) dt
    onResize = null,
    render = null    // (renderer, scene, camera) => void; if set, used INSTEAD of renderer.render()
  } = opts;
  let renderFn = render; // mutable via setRender()

  const renderer = new THREE.WebGLRenderer({ canvas, antialias, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(clearColor, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(clearColor, 0.012);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 14);
  camera.lookAt(0, 0, 0);

  // --- Fixed-timestep loop with hit-stop timescale hook -------------------
  let timescale = 1;
  let running = true;
  let rafId = 0;
  let last = performance.now();
  let elapsed = 0;

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // tab-switch clamp
    // onFrame receives RAW dt: the game applies its own hit-stop timescale
    // (HitStop.scale) before stepping simulation. timescale is reserved for
    // engine-level slow-mo (e.g. global freeze) and is NOT applied here.
    elapsed += dt;
    if (onFrame) onFrame(dt, elapsed);
    if (renderFn) renderFn(renderer, scene, camera);
    else renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(frame);

  // --- Resize ---------------------------------------------------------------
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (onResize) onResize(w, h);
  }
  window.addEventListener('resize', resize);

  // --- Context loss safety ---------------------------------------------------
  const onContextLost = (e) => { e.preventDefault(); running = false; };
  const onContextRestored = () => { last = performance.now(); running = true; rafId = requestAnimationFrame(frame); };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  // --- Full dispose: walk scene graph, free every GPU resource ---------------
  function dispose() {
    running = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);

    const seen = new Set();
    scene.traverse((obj) => {
      if (seen.has(obj)) return;
      seen.add(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          for (const key of Object.keys(m)) {
            const v = m[key];
            if (v && v.isTexture) v.dispose();
          }
          m.dispose();
        }
      }
    });
    scene.clear();
    renderer.dispose();
  }

  return {
    renderer,
    scene,
    camera,
    resize,
    dispose,
    setTimescale: (t) => { timescale = t; },
    getTimescale: () => timescale,
    setRender: (fn) => { renderFn = fn; },
    get elapsed() { return elapsed; }
  };
}
