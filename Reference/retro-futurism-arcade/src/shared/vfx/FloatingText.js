import * as THREE from 'three';
import { easeOutCubic } from '../util/MathUtils.js';

/**
 * MANDATORY SHARED VFX #6 — floating dynamic score text.
 *
 * World-anchored score popups rendered as **DOM elements**, projected each
 * frame from a 3D position into screen space.
 *
 * ### Why DOM rather than 3D text
 *
 * Three options exist and only one of them is right here:
 *
 *  - *Extruded `TextGeometry`* needs a font file. Disallowed outright — this
 *    project ships no external assets — and it is heavy for text that lives for
 *    850ms.
 *  - *Canvas-texture sprites* work and stay procedural, but they are raster:
 *    they blur when they scale up, they cost a texture upload per distinct
 *    string, and — decisively — they sit inside the bloom pass, so a score popup
 *    over a bright explosion gets blown out into an unreadable smear at exactly
 *    the moment it matters.
 *  - *DOM overlay* is vector-sharp at any scale and any DPI, costs zero draw
 *    calls and zero GPU memory, renders **above** the composited frame so bloom
 *    can never destroy its legibility, and gets CSS transitions, text shadows
 *    and font features for free.
 *
 * The one thing DOM cannot do is occlude behind geometry. In a planar shooter
 * nothing is ever in front of the play plane, so that costs nothing.
 *
 * ### Pooling
 *
 * DOM node creation and removal forces style recalculation and is one of the
 * more expensive things you can do per frame. The pool creates every element
 * once, then only mutates `transform` and `opacity` — both compositor-only
 * properties that never trigger layout or paint.
 */

/** How far above the anchor the label drifts, in CSS pixels. */
const DEFAULT_RISE = 44;

export class FloatingTextSystem {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container overlay root; must be position:relative
   * @param {number} [opts.capacity]
   * @param {string} [opts.className] base class applied to every label
   */
  constructor({ container, capacity = 14, className = 'floating-text' }) {
    this.container = container;
    this.capacity = capacity;
    this.className = className;

    /** @type {HTMLElement[]} */
    this.elements = [];

    // Struct-of-arrays state, matching the rest of the VFX layer.
    this.wx = new Float32Array(capacity);
    this.wy = new Float32Array(capacity);
    this.wz = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.rise = new Float32Array(capacity);
    this.scaleFrom = new Float32Array(capacity);
    this.scaleTo = new Float32Array(capacity);
    this.drift = new Float32Array(capacity);
    this.alive = new Uint8Array(capacity);
    this.liveCount = 0;

    const layer = document.createElement('div');
    layer.className = 'floating-text-layer';
    layer.setAttribute('aria-hidden', 'true');
    this.layer = layer;
    container.appendChild(layer);

    for (let i = 0; i < capacity; i++) {
      const el = document.createElement('div');
      el.className = className;
      el.style.opacity = '0';
      // `visibility` rather than `display` so the element keeps its box and the
      // browser never has to re-lay-it-out when it is reused.
      el.style.visibility = 'hidden';
      layer.appendChild(el);
      this.elements.push(el);
    }

    this._projected = new THREE.Vector3();
    this._width = 1;
    this._height = 1;
  }

  /** Update the projection viewport. Called on resize. */
  setViewport(width, height) {
    this._width = Math.max(1, width);
    this._height = Math.max(1, height);
  }

  /**
   * Spawn a label at a world position.
   *
   * When every slot is busy the oldest is recycled. Score feedback is
   * time-critical — a popup that never appears because fourteen older ones are
   * still fading is a worse failure than one that gets cut short.
   *
   * @param {object} opts
   * @param {number} opts.x @param {number} opts.y @param {number} [opts.z]
   * @param {string} opts.text
   * @param {string} [opts.variant] appended to the base class, e.g. 'combo'
   * @param {number} [opts.life] seconds
   * @param {number} [opts.rise] CSS pixels travelled upward
   * @param {number} [opts.drift] horizontal drift in CSS pixels
   * @param {number} [opts.scaleFrom] @param {number} [opts.scaleTo]
   */
  spawn({
    x = 0,
    y = 0,
    z = 0,
    text = '',
    variant = '',
    life = 0.85,
    rise = DEFAULT_RISE,
    drift = 0,
    scaleFrom = 1.35,
    scaleTo = 1.0
  }) {
    let slot = -1;

    for (let i = 0; i < this.capacity; i++) {
      if (!this.alive[i]) {
        slot = i;
        break;
      }
    }

    if (slot === -1) {
      let bestT = -1;
      for (let i = 0; i < this.capacity; i++) {
        const t = this.life[i] > 0 ? this.age[i] / this.life[i] : 1;
        if (t > bestT) {
          bestT = t;
          slot = i;
        }
      }
    } else {
      this.liveCount++;
    }

    this.wx[slot] = x;
    this.wy[slot] = y;
    this.wz[slot] = z;
    this.age[slot] = 0;
    this.life[slot] = Math.max(0.05, life);
    this.rise[slot] = rise;
    this.drift[slot] = drift;
    this.scaleFrom[slot] = scaleFrom;
    this.scaleTo[slot] = scaleTo;
    this.alive[slot] = 1;

    const el = this.elements[slot];
    el.textContent = text;
    el.className = variant ? `${this.className} ${this.className}--${variant}` : this.className;
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    // Tagged on spawn and untagged on release, never at construction. The
    // elements are a pool, so a permanent tag would leave the acceptance gate
    // finding every slot at all times and unable to tell a popup that appeared
    // from one that was never used.
    el.dataset.gate = 'floating-score';

    return slot;
  }

  /**
   * Project and animate every live label.
   *
   * Runs on the **unscaled** clock. UI feedback must not be caught in a hit-stop
   * freeze — a score popup that stalls mid-flight reads as the interface having
   * hung, not as a dramatic pause.
   *
   * @param {number} unscaledDt
   * @param {THREE.Camera} camera
   */
  update(unscaledDt, camera) {
    if (this.liveCount === 0) return;

    const halfW = this._width * 0.5;
    const halfH = this._height * 0.5;

    for (let i = 0; i < this.capacity; i++) {
      if (!this.alive[i]) continue;

      this.age[i] += unscaledDt;
      const t = this.age[i] / this.life[i];

      const el = this.elements[i];

      if (t >= 1) {
        this.alive[i] = 0;
        this.liveCount = Math.max(0, this.liveCount - 1);
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
        el.textContent = '';
        delete el.dataset.gate;
        continue;
      }

      // World -> NDC -> CSS pixels.
      this._projected.set(this.wx[i], this.wy[i], this.wz[i]);
      this._projected.project(camera);

      // Behind the camera: NDC z leaves [-1,1] and x/y invert. Hide rather
      // than render a label mirrored on the wrong side of the screen.
      if (this._projected.z > 1) {
        el.style.opacity = '0';
        continue;
      }

      const screenX = this._projected.x * halfW + halfW;
      const screenY = -this._projected.y * halfH + halfH;

      const eased = easeOutCubic(t);
      const offsetY = -this.rise[i] * eased;
      const offsetX = this.drift[i] * eased;
      const scale = this.scaleFrom[i] + (this.scaleTo[i] - this.scaleFrom[i]) * eased;

      // Hold full opacity for the first 55% of life, then fade. A label that
      // starts fading immediately is hard to read at exactly the moment the
      // player is trying to read it.
      const opacity = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;

      // translate3d and scale only: both are compositor-only properties, so
      // this never triggers layout or paint.
      el.style.transform =
        `translate3d(${(screenX + offsetX).toFixed(1)}px, ` +
        `${(screenY + offsetY).toFixed(1)}px, 0) ` +
        `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      el.style.opacity = opacity.toFixed(3);
    }
  }

  /** Hide every label immediately. */
  clear() {
    for (let i = 0; i < this.capacity; i++) {
      this.alive[i] = 0;
      const el = this.elements[i];
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
    }
    this.liveCount = 0;
  }

  /** Remove every DOM node. */
  dispose() {
    this.clear();
    if (this.layer.parentNode) this.layer.parentNode.removeChild(this.layer);
    this.elements.length = 0;
  }
}
