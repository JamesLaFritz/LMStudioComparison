import * as THREE from 'three';
import { PostPipeline } from '../postfx/PostPipeline.js';

/**
 * Engine — renderer, scene, camera, fixed-timestep simulation loop.
 *
 * Contract:
 *  - `start()` begins the RAF loop; `teardown()` stops it and disposes everything
 *    in reverse construction order (idempotent).
 *  - Simulation runs at a fixed 120 Hz via an accumulator; render interpolates.
 *  - `timescale` (set by HitStop) dilates sim time only — VFX registered with
 *    `registerRealtimeUpdater` keep running at full rate during hit-stop.
 *  - The Engine is input-agnostic: it exposes nothing about keys or gamepads.
 */
export class Engine {
  constructor(container, opts = {}) {
    this.container = container;

    // --- renderer -----------------------------------------------------------
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = opts.exposure ?? 1.05;
    container.appendChild(this.renderer.domElement);

    // --- scene & camera -----------------------------------------------------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(opts.bgColor ?? 0x05060f);
    if (opts.fog !== undefined) {
      this.scene.fog = new THREE.FogExp2(opts.fog.color, opts.fog.density);
    }

    const aspect = w / h;
    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 50, aspect, 0.1, 300);
    if (opts.cameraPos) this.camera.position.set(...opts.cameraPos);
    if (opts.lookAt) {
      this._baseLookAt = new THREE.Vector3(...opts.lookAt);
      this.camera.lookAt(this._baseLookAt);
    } else {
      this._baseLookAt = null;
    }

    // --- post pipeline ------------------------------------------------------
    this.post = new PostPipeline(this.renderer, this.scene, this.camera, opts.bloom ?? {});

    // --- loop state ---------------------------------------------------------
    this.simHz = 120;
    this.stepDt = 1 / this.simHz;
    this.timescale = 1.0;               // HitStop writes here
    this._accumulator = 0;
    this._lastTime = -1;
    this._running = false;
    this._rafId = 0;

    /** @type {Array<(dt:number)=>void>} sim-rate updaters (dilated by timescale) */
    this._simUpdaters = [];
    /** @type {Array<(dt:number)=>void>} real-time updaters (VFX, shake — never dilated) */
    this._realtimeUpdaters = [];
    /** @type {Array<()=>void>} per-frame hooks run before the fixed-step loop (input polling) */
    this._frameHooks = [];

    /** Disposal registry: called in reverse order on teardown. */
    this._disposers = [];
    this.registerDisposer(this.post.dispose.bind(this.post));
    this._disposedGeo = new Set();
    this.registerDisposer(() => {
      const s = this.scene;
      for (const child of [...s.children]) {
        if (child.isMesh || child.isInstancedMesh) {
          // Shared geometries are disposed exactly once across the whole scene.
          if (child.geometry && !this._disposedGeo.has(child.geometry)) {
            this._disposedGeo.add(child.geometry);
            child.geometry.dispose();
          }
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const m of mats) m.dispose(); // Material.dispose is idempotent in three
          }
        }
      }
    });
    this.registerDisposer(() => this.renderer.dispose());

    // --- resize -------------------------------------------------------------
    this._onResize = () => {
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      this.camera.aspect = cw / ch;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(cw, ch);
      this.post.setSize(cw, ch);
    };
    window.addEventListener('resize', this._onResize);
  }

  registerDisposer(fn) { this._disposers.push(fn); }
  addSimUpdater(fn)     { this._simUpdaters.push(fn); }
  addRealtimeUpdater(fn){ this._realtimeUpdaters.push(fn); }

  /** Called once per RAF frame, before the fixed-step loop — for input polling. */
  onFrame(fn) { this._frameHooks.push(fn); }

  start() {
    if (this._running) return;
    this._running = true;
    const loop = (tMs) => {
      if (!this._running) return;
      this._rafId = requestAnimationFrame(loop);
      const t = tMs / 1000;
      if (this._lastTime < 0) { this._lastTime = t; return; }

      // Clamp frame time: a hidden tab or GC stall must never explode the sim.
      let frameDt = Math.min(t - this._lastTime, 0.1);
      this._lastTime = t;

      // Frame hooks run first (input polling) so edges raised this frame are
      // visible to every sim step that follows it.
      for (const fn of this._frameHooks) fn(frameDt);

      if (frameDt <= 0) { this.render(); return; }

      // Fixed-step simulation at dilated timescale.
      const scaledDt = frameDt * this.timescale;
      this._accumulator += scaledDt;
      let steps = 0;
      while (this._accumulator >= this.stepDt && steps < 8) {
        for (const fn of this._simUpdaters) fn(this.stepDt);
        this._accumulator -= this.stepDt;
        steps++;
      }
      if (steps === 8) this._accumulator = 0; // shed load rather than spiral

      // Real-time feedback systems run at full rate even during hit-stop.
      for (const fn of this._realtimeUpdaters) fn(frameDt);

      this.render();
    };
    this._rafId = requestAnimationFrame(loop);
  }

  render() {
    this.post.render();
  }

  /** Restore timescale after a hit-stop window expires. */
  restoreTimescale() { this.timescale = 1.0; }

  teardown() {
    if (this._tornDown) return; // idempotent — safe to call from HMR / beforeunload / manual
    this._tornDown = true;
    this._running = false;
    cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this._onResize);
    for (let i = this._disposers.length - 1; i >= 0; i--) {
      try { this._disposers[i](); } catch { /* idempotent teardown */ }
    }
    this._disposers.length = 0;
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
