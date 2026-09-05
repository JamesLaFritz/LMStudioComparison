import * as THREE from 'three';

/**
 * The session-wide `WebGLRenderer`.
 *
 * Exactly one renderer exists for the lifetime of the page. Games are mounted
 * and unmounted against it; they never create or destroy it. Two reasons:
 *
 *  1. Creating a WebGL context is expensive and browsers cap the number of live
 *     contexts per page — churning one per cabinet switch eventually fails
 *     outright, and the failure mode is a permanently blank canvas.
 *  2. A stable renderer gives us a stable `renderer.info.memory` baseline, which
 *     is what makes the leak assertion after each unmount meaningful.
 *
 * ### Context loss
 *
 * `webglcontextlost` is not an edge case. It fires on GPU driver resets, on
 * laptop GPU switching, on some OS sleep/wake cycles, and whenever the browser
 * decides to reclaim resources from a background tab. The default browser
 * behaviour is to *not* restore the context unless `preventDefault()` is called
 * on the event, so handling it is mandatory rather than defensive.
 *
 * Because simulation state in this project never lives inside Three.js objects,
 * recovery is genuinely possible: the scene graph is rebuilt and the game
 * continues from the state it was already holding.
 */

/** @type {THREE.WebGLRenderer|null} */
let renderer = null;
/** @type {HTMLElement|null} */
let host = null;

/**
 * @typedef {object} RendererHandle
 * @property {THREE.WebGLRenderer} renderer
 * @property {(w:number, h:number) => void} setSize
 * @property {() => void} dispose
 */

/**
 * Create (or return) the session renderer.
 *
 * @param {HTMLElement} container element the canvas is appended to
 * @param {object} [opts]
 * @returns {THREE.WebGLRenderer}
 */
export function createRenderer(container, opts = {}) {
  if (renderer) return renderer;

  const {
    antialias = false,
    powerPreference = 'high-performance',
    maxPixelRatio = 2,
    exposure = 1.06
  } = opts;

  renderer = new THREE.WebGLRenderer({
    antialias,
    powerPreference,
    // Stencil and depth on the *default* framebuffer are unused: everything is
    // composited through EffectComposer render targets. Turning stencil off
    // saves bandwidth on tiled mobile GPUs for nothing given up.
    stencil: false,
    depth: true,
    alpha: false,
    // Required for the "save image" affordance in some browsers, and harmless.
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false
  });

  // Colour management. ACES filmic gives the highlight roll-off that makes an
  // over-bright neon emitter read as *hot* rather than as clipped white. The
  // bloom thresholds across the project are authored against this curve; a
  // different tone mapper would require re-tuning every emissive value.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;

  renderer.shadowMap.enabled = true;
  // PCFShadowMap, not PCFSoftShadowMap. At r182 the latter is deprecated and the
  // shadow compiler emits SHADOWMAP_TYPE_BASIC for it — hard, unfiltered shadows —
  // with no console warning, because the intended coercion tests `lights.type` on an
  // array and never fires. The soft filtering now lives in PCFShadowMap itself.
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // Capping the device pixel ratio at 2 is a real performance decision, not
  // laziness: a 3x phone display costs 2.25x the fragments of a 2x one for a
  // difference no one can see on a bloom-heavy scene.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1, false);

  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  // Prevent the browser's default touch gestures from fighting the game.
  canvas.style.touchAction = 'none';

  container.appendChild(canvas);
  host = container;

  return renderer;
}

/** The session renderer, or null before `createRenderer`. */
export function getRenderer() {
  return renderer;
}

/**
 * Resize the renderer to a CSS pixel size.
 *
 * `updateStyle = false` because the canvas is already sized to 100% by CSS;
 * letting Three write inline width/height styles would fight the layout and
 * produce a one-frame flicker on every resize.
 */
export function setRendererSize(width, height) {
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
}

/**
 * Install context-loss handling.
 *
 * @param {object} handlers
 * @param {() => void} handlers.onLost      called after the default is prevented
 * @param {() => void} handlers.onRestored  called once the context is back
 * @returns {() => void} teardown
 */
export function installContextLossHandlers({ onLost, onRestored }) {
  if (!renderer) throw new Error('installContextLossHandlers: renderer not created yet.');
  const canvas = renderer.domElement;

  const lost = (event) => {
    // Without this the browser will never fire `webglcontextrestored`.
    event.preventDefault();
    console.warn('WebGL context lost. Suspending render loop.');
    if (onLost) onLost();
  };

  const restored = () => {
    console.warn('WebGL context restored. Rebuilding GPU resources.');
    // Every cached program is invalid; forcing a re-init prevents Three from
    // handing out stale program references.
    if (renderer && renderer.info.programs) {
      renderer.info.programs.length = 0;
    }
    if (onRestored) onRestored();
  };

  canvas.addEventListener('webglcontextlost', lost, false);
  canvas.addEventListener('webglcontextrestored', restored, false);

  return () => {
    canvas.removeEventListener('webglcontextlost', lost, false);
    canvas.removeEventListener('webglcontextrestored', restored, false);
  };
}

/**
 * Force a context loss. Exposed purely so the QA pass can exercise the recovery
 * path deliberately instead of waiting for a driver reset.
 * @returns {boolean} whether the extension was available
 */
export function simulateContextLoss() {
  if (!renderer) return false;
  const ext = renderer.getContext().getExtension('WEBGL_lose_context');
  if (!ext) return false;
  ext.loseContext();
  window.setTimeout(() => ext.restoreContext(), 1200);
  return true;
}

/**
 * Tear down the renderer entirely. Only used on full page teardown; switching
 * cabinets must *not* call this.
 */
export function disposeRenderer() {
  if (!renderer) return;
  renderer.dispose();
  if (host && renderer.domElement.parentNode === host) {
    host.removeChild(renderer.domElement);
  }
  renderer = null;
  host = null;
}

/**
 * Capability report, used to pick sensible defaults on first boot and shown in
 * the debug panel.
 */
export function describeCapabilities() {
  if (!renderer) return null;
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    webgl2: renderer.capabilities.isWebGL2,
    maxTextureSize: renderer.capabilities.maxTextures,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    precision: renderer.capabilities.precision,
    vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
    device: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown'
  };
}
