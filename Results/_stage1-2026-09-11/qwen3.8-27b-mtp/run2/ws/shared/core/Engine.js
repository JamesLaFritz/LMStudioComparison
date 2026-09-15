import * as THREE from 'three';

/**
 * Engine — renderer / scene / camera ownership + fixed RAF loop.
 *
 * Memory contract: every GPU resource a game allocates should be registered
 * via registerDisposable(); dispose() walks the registry and calls .dispose()
 * exactly once on each, then disposes the renderer itself.
 */
export class Engine {
  constructor({ canvas = null } = {}) {
    this.canvas = canvas || document.createElement('canvas');

    const size = this._measure();
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(size.width, size.height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, size.width / Math.max(size.height, 1), 0.1, 200);
    this.camera.position.set(0, 1.4, 14);
    this.camera.lookAt(0, 0.6, 0);

    /** @type {Array<{dispose: Function}>} */
    this.disposables = [];
    this._disposedSet = new Set();

    this.clock = new THREE.Clock(false);
    this.elapsed = 0;
    this.running = false;
    this._rafId = 0;
    this.onFrame = null; // (dt, elapsed) => void — set by the game
    this.onResize = null; // (width, height) => void — composer hook
    /** Optional: (scene, camera) => void. When set, replaces renderer.render() each frame (e.g. EffectComposer). */
    this.renderFrame = null;

    window.addEventListener('resize', this._onWindowResize);
  }

  _measure() {
    const parent = this.canvas.parentElement || document.documentElement;
    return {
      width: Math.max(parent.clientWidth || window.innerWidth, 1),
      height: Math.max(parent.clientHeight || window.innerHeight, 1),
    };
  }

  registerDisposable(obj) {
    if (obj && typeof obj.dispose === 'function' && !this._disposedSet.has(obj)) {
      this.disposables.push(obj);
      this._disposedSet.add(obj);
    }
    return obj;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this._rafId = requestAnimationFrame(loop);
      // Clamp dt so a backgrounded tab does not produce one giant step.
      const rawDt = Math.min(this.clock.getDelta(), 0.1);
      this.elapsed += rawDt;
      if (typeof this.onFrame === 'function') {
        try {
          this.onFrame(rawDt, this.elapsed);
        } catch (err) {
          console.error('[Engine] onFrame error:', err);
        }
      }
      // A game may replace the plain render with a post-processing chain.
      if (typeof this.renderFrame === 'function') {
        try {
          this.renderFrame(this.scene, this.camera);
        } catch (err) {
          console.error('[Engine] renderFrame error:', err);
        }
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
    this.clock.stop();
  }

  resize(width, height) {
    const w = Math.max(width || this.canvas.clientWidth || window.innerWidth, 1);
    const h = Math.max(height || this.canvas.clientHeight || window.innerHeight, 1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (typeof this.onResize === 'function') this.onResize(w, h);
  }

  _onWindowResize = () => {
    const size = this._measure();
    this.resize(size.width, size.height);
  };

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onWindowResize);
    for (const d of this.disposables) {
      try { d.dispose(); } catch (_) { /* already disposed */ }
    }
    this.disposables.length = 0;
    this.scene.clear();
    this.renderer.dispose();
  }
}
