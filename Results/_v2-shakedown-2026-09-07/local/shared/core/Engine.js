import * as THREE from 'three';

/**
 * Engine — renderer, scene, camera, and the RAF loop.
 *
 * Owns the frame clock: each registered frame callback receives
 * (realDt, gameDt, time) where realDt is wall-clock delta (clamped to 50 ms
 * so a stalled tab can't explode physics) and gameDt = realDt * timescale
 * (the hit-stop hook). `time` accumulates real time for VFX clocks.
 *
 * `dispose()` walks the scene graph and frees every geometry, material, and
 * texture exactly once, then disposes the composer (if attached) and the
 * renderer. Safe to call twice.
 */
export class Engine {
  constructor({ container, width, height, camera = null } = {}) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width || container.clientWidth || 800, height || container.clientHeight || 600);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04060d);
    this.scene.fog = new THREE.FogExp2(0x04060d, 0.012);

    this.camera = camera || new THREE.PerspectiveCamera(
      52, (width || 800) / (height || 600), 0.1, 120
    );

    this.timescale = 1;
    this.time = 0;
    this._cbs = [];
    this._composer = null;
    this._raf = 0;
    this._last = 0;
    this._running = false;
    this._disposed = false;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  /** Register a per-frame callback. Returns an unregister function. */
  onFrame(cb) {
    this._cbs.push(cb);
    return () => {
      const i = this._cbs.indexOf(cb);
      if (i >= 0) this._cbs.splice(i, 1);
    };
  }

  /** Attach a post-processing composer (from PostFX.createPostFX). */
  setComposer(composer) {
    this._composer = composer;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    const tick = (now) => {
      if (!this._running) return;
      this._raf = requestAnimationFrame(tick);
      const realDt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      this.time += realDt;
      const gameDt = realDt * this.timescale;
      for (let i = 0; i < this._cbs.length; i++) {
        this._cbs[i](realDt, gameDt, this.time);
      }
      if (this._composer) this._composer.render();
      else this.renderer.render(this.scene, this.camera);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this._composer) this._composer.resize(w, h);
  }

  /**
   * Full teardown. Walks the scene graph, disposes every geometry, material,
   * and texture exactly once, then the composer, renderer, and listeners.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.stop();
    window.removeEventListener('resize', this._onResize);

    const seenGeo = new Set();
    const seenMat = new Set();
    const seenTex = new Set();

    const freeTexture = (t) => {
      if (t && !seenTex.has(t)) {
        seenTex.add(t);
        t.dispose();
      }
    };
    const freeMaterial = (m) => {
      if (!m || seenMat.has(m)) return;
      seenMat.add(m);
      for (const key in m) {
        const v = m[key];
        if (v && typeof v === 'object' && v.isTexture) freeTexture(v);
      }
      m.dispose();
    };

    this.scene.traverse((obj) => {
      if (obj.geometry && !seenGeo.has(obj.geometry)) {
        seenGeo.add(obj.geometry);
        obj.geometry.dispose();
      }
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const m of mats) freeMaterial(m);
    });
    // Scene-level resources (background color is not a texture; fog is plain).
    if (this.scene.background && this.scene.background.isTexture) freeTexture(this.scene.background);

    if (this._composer) {
      this._composer.dispose();
      this._composer = null;
    }
    this._cbs.length = 0;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
