// Floating score / status text: pooled HTML labels projected from world space each frame.
// Runs on real time so score pops stay readable during hit-stop.
import { Vector3 } from 'three';
import { ObjectPool } from '../core/ObjectPool.js';
import { Easing } from '../math/Easing.js';

const _v = new Vector3();

export class FloatingText {
  constructor(container, camera, { capacity = 32 } = {}) {
    this.camera = camera;
    this.width = Math.max(1, container.clientWidth);
    this.height = Math.max(1, container.clientHeight);

    this.layer = document.createElement('div');
    this.layer.className = 'float-layer';
    container.appendChild(this.layer);

    this.pool = new ObjectPool({
      capacity,
      create: () => {
        const el = document.createElement('div');
        el.className = 'float-text md';
        el.style.opacity = '0';
        this.layer.appendChild(el);
        return {
          el,
          position: new Vector3(),
          age: 0,
          duration: 0.9,
          rise: 1.6,
          driftX: 0,
          scale: 1,
        };
      },
      onRelease: (item) => {
        item.el.style.opacity = '0';
        item.el.style.transform = 'translate(-9999px, -9999px)';
      },
    });
  }

  /**
   * @param {object} o
   * @param {{x:number,y:number,z:number}} o.position world position
   * @param {string} o.text
   * @param {string} [o.color] CSS colour
   * @param {'sm'|'md'|'lg'|'xl'} [o.size]
   * @param {number} [o.duration]
   * @param {number} [o.rise] world units to drift upward over the lifetime
   * @param {number} [o.driftX] world units to drift sideways
   * @param {string} [o.className] extra class names
   */
  spawn({ position, text, color = '#19f0ff', size = 'md', duration = 0.9, rise = 1.6, driftX = 0, className = '' }) {
    const item = this.pool.acquire();
    if (!item) return null;
    item.position.set(position.x, position.y, position.z);
    item.age = 0;
    item.duration = Math.max(0.05, duration);
    item.rise = rise;
    item.driftX = driftX;
    const el = item.el;
    el.textContent = text;
    el.className = `float-text ${size}${className ? ' ' + className : ''}`;
    el.style.color = color;
    el.style.opacity = '1';
    this._place(item, 0);
    return item;
  }

  _place(item, t) {
    const x = item.position.x + item.driftX * t;
    const y = item.position.y + item.rise * Easing.easeOutCubic(t);
    _v.set(x, y, item.position.z).project(this.camera);
    const sx = (_v.x * 0.5 + 0.5) * this.width;
    const sy = (-_v.y * 0.5 + 0.5) * this.height;
    const pop = Easing.easeOutBack(Math.min(1, t * 4));
    const scale = 0.4 + 0.6 * pop;
    item.el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${scale.toFixed(3)})`;
  }

  update(realDt) {
    this.pool.forEach((item) => {
      item.age += realDt;
      const t = item.age / item.duration;
      if (t >= 1) {
        this.pool.release(item);
        return;
      }
      this._place(item, t);
      const alpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
      item.el.style.opacity = alpha.toFixed(3);
    });
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  releaseAll() {
    this.pool.releaseAll();
  }

  dispose() {
    this.pool.dispose((item) => item.el.remove());
    this.layer.remove();
  }
}
