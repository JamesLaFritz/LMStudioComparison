// shared/core.js — engine-agnostic foundation: math, time control, pooling,
// lifecycle, and the Game base class every title extends.
//
// Design rules:
//   * No DOM UI here (see ui.js), no audio (see audio.js), no VFX (see vfx.js).
//   * Every Game subclass owns exactly one renderer, one scene, one composer.
//   * Time control (hit-stop / slow-mo) lives here so every game gets the same
//     feel: `dt` is already scaled, `rawDt` is the unscaled frame delta.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------------------
// Math helpers (plain numbers / vectors — zero allocation in hot paths)
// ---------------------------------------------------------------------------

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, clamp(invLerp(a, b, v), 0, 1));
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** Frame-rate independent exponential approach: a -> b over ~time seconds. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Deterministic PRNG (mulberry32). Returns a function in [0,1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1-D value noise: smooth interpolation over a seeded hash lattice. */
export function makeNoise1D(seed) {
  const rand = mulberry32(seed);
  const lattice = new Float32Array(1024);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand() * 2 - 1;
  const fade = (t) => t * t * (3 - 2 * t);
  return (x) => {
    const i = Math.floor(x) & 1023;
    const f = x - Math.floor(x);
    return lerp(lattice[i], lattice[(i + 1) & 1023], fade(f));
  };
}

/** 2-D value noise over a seeded hash lattice (for terrain / water). */
export function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const lattice = new Float32Array(1024 * 1024);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand() * 2 - 1;
  const fade = (t) => t * t * (3 - 2 * t);
  const at = (x, y) => lattice[(y & 1023) * 1024 + (x & 1023)];
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = fade(x - ix), fy = fade(y - iy);
    return lerp(
      lerp(at(ix, iy), at(ix + 1, iy), fx),
      lerp(at(ix, iy + 1), at(ix + 1, iy + 1), fx),
      fy,
    );
  };
}

/**
 * Framerate-independent smoothstep with optional velocity tracking, used for
 * jump curves and any "ease toward target" motion.
 */
export function makeSmoothDamp() {
  let velocity = 0;
  return (current, target, time, dt) => {
    const omega = 2 / Math.max(time, 1e-4);
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = current - target;
    const temp = (velocity + omega * change) * dt;
    velocity = (velocity - omega * temp) * exp;
    return target + (change + temp) * exp;
  };
}

// ---------------------------------------------------------------------------
// Time control — hit-stop / slow-motion
// ---------------------------------------------------------------------------

/**
 * Timescale manager. Games call `hitStop(duration, minScale)` on heavy
 * impacts and `slowMo(duration, scale)` for dramatic beats. `dt` handed to
 * game logic is already multiplied by the current scale.
 */
export class Timescale {
  constructor() {
    this.scale = 1;
    this._freeze = 0;      // hard freeze remaining (seconds of real time)
    this._slow = 0;        // slow-mo remaining
    this._slowScale = 1;
  }

  hitStop(duration = 0.09, minScale = 0.05) {
    this._freeze = Math.max(this._freeze, duration);
    this._slowScale = Math.min(this._slowScale, minScale);
  }

  slowMo(duration = 0.6, scale = 0.35) {
    this._slow = Math.max(this._slow, duration);
    this._slowScale = Math.min(this._slowScale, scale);
  }

  /** Advance with REAL delta time; returns the scale for this frame. */
  update(rawDt) {
    if (this._freeze > 0) {
      this._freeze -= rawDt;
      return 0;
    }
    if (this._slow > 0) {
      this._slow -= rawDt;
      if (this._slow <= 0) this._slowScale = 1;
    } else {
      this._slowScale = 1;
    }
    return this._slowScale;
  }

  get frozen() { return this._freeze > 0; }
  reset() { this._freeze = 0; this._slow = 0; this._slowScale = 1; this.scale = 1; }
}

// ---------------------------------------------------------------------------
// Object pooling
// ---------------------------------------------------------------------------

/**
 * Generic pool. `factory` creates an item, `reset(item)` re-arms it.
 * Items are plain objects or THREE objects; the pool never inspects them.
 */
export class Pool {
  constructor(factory, reset = () => {}, initialSize = 0) {
    this.factory = factory;
    this.resetFn = reset;
    this.free = [];
    for (let i = 0; i < initialSize; i++) this.free.push(factory());
  }

  get size() { return this.free.length; }

  acquire() {
    const item = this.free.pop() ?? this.factory();
    this.resetFn(item);
    return item;
  }

  release(item) {
    // Guard against double-release: only push if not already pooled.
    if (this.free.includes(item)) return;
    this.free.push(item);
  }

  releaseAll() {
    for (const item of this.free) this.resetFn(item);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export const State = {
  BOOT: 'boot',
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameover',
};

/**
 * Base Game. Subclasses implement:
 *   buildScene()   — scene, camera, lights, composer, HUD
 *   update(dt)     — gameplay (dt already timescaled)
 *   onState(s)     — optional state hook
 * and may override:
 *   onResize(), onKey(code, down), onPad(button, down), onAxis(x, y)
 */
export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.state = State.BOOT;
    this.timescale = new Timescale();
    this.elapsed = 0;          // game time (timescaled)
    this.realElapsed = 0;      // wall time
    this.paused = false;
    this._raf = 0;
    this._last = 0;
    this._running = false;
    this._disposables = [];   // geometries/materials/textures to dispose
    this._listeners = [];

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
    this.composer = null;
    this.bloom = null;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this._track(this._onResize, window, 'resize');
  }

  // -- tracking helpers -----------------------------------------------------

  _track(fn, target, type) { this._listeners.push({ fn, target, type }); }

  /** Track a geometry/material/texture for disposal on destroy(). */
  track(...items) {
    for (const it of items) if (it && it.dispose) this._disposables.push(it);
    return items.length === 1 ? items[0] : items;
  }

  // -- composer -------------------------------------------------------------

  setupComposer({ bloomStrength = 1.2, bloomRadius = 0.6, bloomThreshold = 0.55 } = {}) {
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(size, bloomStrength, bloomRadius, bloomThreshold);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    return this.composer;
  }

  // -- state ----------------------------------------------------------------

  setState(s) {
    this.state = s;
    if (this.onState) this.onState(s);
  }

  // -- input plumbing (subclasses override) ---------------------------------

  onKey(_code, _down) {}
  onPad(_button, _down) {}
  onAxis(_x, _y) {}

  // -- main loop ------------------------------------------------------------

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    const loop = (now) => {
      this._raf = requestAnimationFrame(loop);
      const rawDt = Math.min((now - this._last) / 1000, 0.1); // clamp tab-away spikes
      this._last = now;
      this.realElapsed += rawDt;

      const scale = this.timescale.update(rawDt);
      const dt = rawDt * scale;
      this.elapsed += dt;

      if (!this.paused && this.state !== State.MENU) {
        this.update(dt);
      }
      this.render(rawDt);
    };
    this._raf = requestAnimationFrame(loop);
  }

  render(rawDt) {
    if (this.composer) this.composer.render(rawDt);
    else this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
    if (this.onResize) this.onResize();
  }

  // -- teardown (strict memory management) ----------------------------------

  destroy() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    for (const { fn, target, type } of this._listeners) target.removeEventListener(type, fn);
    this._listeners.length = 0;

    // Dispose everything tracked, plus a scene sweep for anything missed.
    const seen = new Set();
    const disposeObject = (obj) => {
      if (seen.has(obj)) return;
      seen.add(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          for (const key in m) {
            const v = m[key];
            if (v && v.isTexture) v.dispose();
          }
          m.dispose();
        }
      }
      for (const child of obj.children) disposeObject(child);
    };
    disposeObject(this.scene);
    for (const d of this._disposables) d.dispose();
    this._disposables.length = 0;

    if (this.composer) {
      for (const pass of this.composer.passes) if (pass.dispose) pass.dispose();
      this.composer.dispose?.();
    }
    this.renderer.dispose();
  }
}
