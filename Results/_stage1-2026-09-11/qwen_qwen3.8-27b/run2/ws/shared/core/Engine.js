import * as THREE from 'three';

/**
 * Engine — renderer, scene, camera, clock, clamped-delta loop, resize,
 * and a full recursive dispose() that walks the scene graph and releases
 * every geometry, material, and texture.
 *
 * The game supplies an `update(dt)` callback (dt already scaled by
 * TimeScale and clamped) and an optional `render()` hook.
 */
export class Engine {
  constructor({ canvas, width, height, background = 0x050510, exposure = 1.1, anisotropy = 4, timescale = null } = {}) {
    this.width = width;
    this.height = height;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = exposure;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);
    this.scene.fog = new THREE.FogExp2(background, 0.012);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    this.camera.position.set(0, 0, 26);
    this.camera.lookAt(0, 0, 0);

    this.clock = new THREE.Clock();
    this.timescale = timescale; // TimeScale instance; dt is scaled by its .value
    this.running = false;
    this._raf = 0;
    this._update = null;
    this._renderHook = null;
    this._maxDelta = 1 / 30;
    this._disposed = false;
    this.anisotropy = anisotropy;
    /** Objects with a dispose() the engine should call on teardown (e.g. Composer). */
    this.disposables = [];
  }

  /** Register an object to dispose when the engine disposes. */
  addDisposable(obj) { this.disposables.push(obj); return obj; }

  /** Register the per-frame update callback: update(dt) where dt is scaled+clamped. */
  onUpdate(fn) { this._update = fn; }
  /** Optional hook called after update, before render (e.g. composer setup). */
  onRender(fn) { this._renderHook = fn; }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this._raf = requestAnimationFrame(loop);
      const raw = Math.min(this.clock.getDelta(), this._maxDelta);
      if (this.timescale) this.timescale.update(raw);
      const dt = raw * (this.timescale ? this.timescale.value : 1);
      if (this._update) this._update(dt, raw);
      // A render hook (e.g. EffectComposer) takes over presentation;
      // otherwise fall back to a plain render.
      if (this._renderHook) this._renderHook();
      else this.renderer.render(this.scene, this.camera);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Dispose everything: renderer, scene graph (geometries, materials,
   * textures), and stop the loop. Safe to call multiple times.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.stop();
    this._walkAndDispose(this.scene);
    for (const d of this.disposables) { try { d.dispose(); } catch (e) { /* already disposed */ } }
    this.disposables.length = 0;
    this.scene.background = null;
    this.scene.fog = null;
    this.renderer.dispose();
  }

  _walkAndDispose(root) {
    const queue = [root];
    const seenMaterials = new Set();
    const seenGeometries = new Set();
    const seenTextures = new Set();
    while (queue.length) {
      const obj = queue.shift();
      if (obj.children) for (const c of obj.children) queue.push(c);
      if (obj.geometry && !seenGeometries.has(obj.geometry)) {
        seenGeometries.add(obj.geometry);
        obj.geometry.dispose();
      }
      const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      for (const m of mats) {
        if (!m || seenMaterials.has(m)) continue;
        seenMaterials.add(m);
        for (const key of Object.keys(m)) {
          const v = m[key];
          if (v && v.isTexture && !seenTextures.has(v)) {
            seenTextures.add(v);
            v.dispose();
          }
        }
        m.dispose();
      }
    }
  }
}
