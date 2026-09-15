import * as THREE from 'three';
import { easeOutCubic } from '../math/easing.js';

/**
 * Floating dynamic score text — pooled HTML chips projected from 3D to screen.
 *
 * A fixed pool of DOM nodes (no runtime allocation). Each spawn projects the
 * 3D origin to screen space every frame, rises, scales in, and fades out.
 * Glassmorphism styling with neon glow.
 */
export class FloatingTextPool {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container — element to append chips into
   * @param {THREE.Camera} [opts.camera] — set later via setCamera()
   * @param {number} [opts.max=12]
   */
  constructor({ container, max = 12 } = {}) {
    if (!container) throw new Error('FloatingTextPool requires a container element');
    this.container = container;
    this.max = max;
    this.camera = null;
    this.items = [];
    this.cursor = 0;
    this._v = new THREE.Vector3();

    for (let i = 0; i < max; i++) {
      const el = document.createElement('div');
      el.className = 'float-text';
      el.style.display = 'none';
      container.appendChild(el);
      this.items.push({ el, active: false, t: 0, duration: 0.9, pos: { x: 0, y: 0, z: 0 } });
    }
  }

  setCamera(camera) {
    this.camera = camera;
  }

  /**
   * Spawn a floating text.
   * @param {string} text
   * @param {{x:number,y:number,z:number}} origin — world position
   * @param {object} [opts]
   * @param {string} [opts.color='#00f0ff']
   * @param {number} [opts.duration=0.9]
   * @param {number} [opts.rise=1.6] — world units to rise
   */
  spawn(text, origin, { color = '#00f0ff', duration = 0.9, rise = 1.6 } = {}) {
    let item = this.items[this.cursor];
    if (item.active) {
      let oldest = item;
      for (const it of this.items) {
        if (it.active && it.t > oldest.t) oldest = it;
      }
      item = oldest;
    }
    this.cursor = (this.cursor + 1) % this.items.length;

    item.active = true;
    item.t = 0;
    item.duration = duration;
    item.rise = rise;
    item.pos.x = origin.x;
    item.pos.y = origin.y;
    item.pos.z = origin.z;
    item.el.textContent = text;
    item.el.style.display = 'block';
    item.el.style.setProperty('--ft-color', color);
    item.el.style.setProperty('--ft-glow', color);
  }

  update(dt, camera) {
    if (camera) this.camera = camera;
    const cam = this.camera;
    if (!cam) return;

    for (const item of this.items) {
      if (!item.active) continue;
      item.t += dt;
      const k = Math.min(1, item.t / item.duration);
      if (k >= 1) {
        item.active = false;
        item.el.style.display = 'none';
        continue;
      }

      const e = easeOutCubic(k);
      this._v.x = item.pos.x;
      this._v.y = item.pos.y + e * item.rise;
      this._v.z = item.pos.z;
      this._v.project(cam);

      const x = (this._v.x * 0.5 + 0.5) * this.container.clientWidth;
      const y = (-this._v.y * 0.5 + 0.5) * this.container.clientHeight;
      const scale = 0.7 + 0.5 * Math.min(1, k * 4);
      const opacity = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45);

      item.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      item.el.style.opacity = opacity.toFixed(3);
    }
  }

  dispose() {
    for (const item of this.items) {
      item.el.remove();
    }
    this.items.length = 0;
  }
}
