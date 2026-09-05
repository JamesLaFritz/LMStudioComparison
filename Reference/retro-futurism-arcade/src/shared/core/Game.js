import * as THREE from 'three';
import { Disposer } from './Disposer.js';

/**
 * @typedef {object} GameContext
 * @property {THREE.WebGLRenderer} renderer  session-wide renderer, never owned by a game
 * @property {HTMLElement}         viewport  element the canvas lives in
 * @property {HTMLElement}         overlay   DOM root for all HUD and menus
 * @property {import('../input/InputManager.js').InputManager} input
 * @property {import('../audio/AudioEngine.js').AudioEngine}   audio
 * @property {import('./EventBus.js').EventBus}                events
 * @property {import('../util/Perf.js').Perf}                  perf
 * @property {boolean}             reducedMotion
 */

/**
 * Base class every title extends.
 *
 * The contract is deliberately narrow. A game owns its scene, camera,
 * composer, entities and UI; it does **not** own the renderer, the input
 * manager, the audio context, or the animation loop. Those are session-scoped
 * and survive across mounts, which is what allows switching cabinets without
 * a WebGL context teardown.
 *
 * Subclasses must implement `init`, `fixedUpdate`, `update` and `render`.
 * `dispose` should call `super.dispose()` last.
 */
export class Game {
  /** @param {GameContext} ctx */
  constructor(ctx) {
    if (new.target === Game) {
      throw new TypeError('Game is abstract; extend it.');
    }

    /** @type {GameContext} */
    this.ctx = ctx;
    this.renderer = ctx.renderer;

    /** Every GPU and DOM allocation this game makes is recorded here. */
    this.disposer = new Disposer(new.target.name);

    this.scene = new THREE.Scene();
    /** @type {THREE.PerspectiveCamera|null} assigned by the subclass */
    this.camera = null;
    /** @type {import('../render/PostFX.js').PostFX|null} */
    this.postfx = null;

    this.width = 1;
    this.height = 1;
    this.paused = false;
    this.disposed = false;
    this.initialised = false;
  }

  /**
   * Build the world. Called exactly once, before the first frame.
   * @returns {void|Promise<void>}
   * @abstract
   */
  init() {
    throw new Error(`${this.constructor.name} must implement init().`);
  }

  /**
   * Fixed-rate simulation step. Always receives exactly the same `dt`.
   * @param {number} dt
   * @abstract
   */
  // eslint-disable-next-line no-unused-vars
  fixedUpdate(dt) {
    throw new Error(`${this.constructor.name} must implement fixedUpdate().`);
  }

  /**
   * Variable-rate presentation step: interpolation, VFX, camera, HUD.
   * @param {number} unscaledDt real seconds since the last frame
   * @param {number} scaledDt   dilated seconds since the last frame
   * @param {number} alpha      0..1 position between the last two fixed steps
   * @abstract
   */
  // eslint-disable-next-line no-unused-vars
  update(unscaledDt, scaledDt, alpha) {
    throw new Error(`${this.constructor.name} must implement update().`);
  }

  /**
   * Draw one frame. Default implementation renders through the composer when
   * one exists and falls back to a direct render otherwise, which is what
   * keeps the game alive if post-processing had to be torn down after a
   * context loss.
   */
  render() {
    if (this.postfx) {
      this.postfx.render();
    } else if (this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Viewport changed. Subclasses that override this should call `super` so the
   * camera aspect and composer targets stay correct.
   */
  onResize(width, height) {
    this.width = width;
    this.height = height;
    if (this.camera && this.camera.isPerspectiveCamera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    if (this.postfx) this.postfx.setSize(width, height);
  }

  /**
   * Pause state changed. Games should suspend gameplay audio here; the loop
   * itself is halted by the shell.
   */
  onPause(paused) {
    this.paused = paused;
  }

  /** Quality tier changed. Games forward this to their composer and VFX. */
  // eslint-disable-next-line no-unused-vars
  onQualityChange(tier) {
    /* optional */
  }

  /**
   * The WebGL context was lost and then restored. Because simulation state is
   * never stored inside Three.js objects, the correct response is to rebuild
   * every GPU-side resource and carry on from the existing state. Subclasses
   * that allocate procedural textures must re-upload them here.
   */
  onContextRestored() {
    /* optional */
  }

  /**
   * Release everything. Subclasses override, do their own teardown, then call
   * `super.dispose()` which drains the ledger and clears the scene.
   */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    if (this.postfx) {
      this.postfx.dispose();
      this.postfx = null;
    }

    this.disposer.disposeAll();

    this.scene.clear();
    this.camera = null;
  }
}
