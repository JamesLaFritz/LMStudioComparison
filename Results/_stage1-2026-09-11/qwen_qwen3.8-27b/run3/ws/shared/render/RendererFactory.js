import * as THREE from 'three';

/**
 * RendererFactory — creates a tuned WebGLRenderer and camera, and binds
 * resize handling. All resources are registered with the given MemoryRegistry
 * so teardown is a single disposeAll().
 */
export default class RendererFactory {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container
   * @param {import('../core/MemoryRegistry.js')} [opts.registry]
   * @param {number} [opts.fov=42]
   * @param {number} [opts.near=0.1]
   * @param {number} [opts.far=200]
   * @param {number} [opts.exposure=1.1]
   * @param {number} [opts.maxPixelRatio=2]
   */
  static createRenderer({
    container,
    registry = null,
    fov = 42,
    near = 0.1,
    far = 200,
    exposure = 1.1,
    maxPixelRatio = 2,
  }) {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposure;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    container.appendChild(renderer.domElement);
    if (registry) registry.track(renderer);
    return renderer;
  }

  /**
   * @param {object} opts
   * @param {number} [opts.fov=42]
   * @param {number} [opts.near=0.1]
   * @param {number} [opts.far=200]
   * @param {number} [opts.aspect=16/9]
   */
  static createCamera({ fov = 42, near = 0.1, far = 200, aspect = 16 / 9 } = {}) {
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 2.2, 15);
    camera.lookAt(0, 0.5, 0);
    return camera;
  }

  /**
   * Binds a resize handler that keeps renderer, camera, and an optional
   * composer in sync. Returns the bound handler (for removal).
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.PerspectiveCamera} camera
   * @param {object} [opts]
   * @param {HTMLElement} [opts.container]
   * @param {Function} [opts.onResize] — called after resize (e.g. composer.setSize)
   * @returns {Function}
   */
  static bindResize(renderer, camera, { container = null, onResize = null } = {}) {
    const apply = () => {
      const w = (container ? container.clientWidth : window.innerWidth) || 1;
      const h = (container ? container.clientHeight : window.innerHeight) || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      if (onResize) onResize(w, h);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }
}
