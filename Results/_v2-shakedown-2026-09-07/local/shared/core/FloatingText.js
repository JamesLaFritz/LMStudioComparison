import * as THREE from 'three';

/**
 * FloatingText — pooled DOM score popups projected from world space to screen.
 *
 * Nodes are pre-allocated (no per-spawn DOM churn) and recycled. Each popup
 * rises and fades over its lifetime; projection uses a single shared
 * Vector3 so the hot path allocates nothing.
 */
export class FloatingText {
  constructor({ container, camera, max = 12 } = {}) {
    if (!container) throw new Error('FloatingText: container required');
    if (!camera) throw new Error('FloatingText: camera required');
    this.container = container;
    this.camera = camera;
    this.max = max;
    this.items = [];
    this._v = new THREE.Vector3();
    this._w = 1;
    this._h = 1;

    for (let i = 0; i < max; i++) {
      const el = document.createElement('div');
      el.className = 'float-text';
      el.style.display = 'none';
      container.appendChild(el);
      this.items.push({
        el,
        active: false,
        pos: new THREE.Vector3(),
        age: 0,
        life: 0.9,
        rise: 0.8,
        size: 16,
      });
    }
  }

  /**
   * Spawn a popup at a world position.
   * @param {object} o
   * @param {THREE.Vector3} o.position world-space anchor
   * @param {string} o.text
   * @param {string} [o.color] CSS color
   * @param {number} [o.size] font size in px
   * @param {number} [o.life] seconds
   */
  spawn({ position, text, color = '#eaffff', size = 16, life = 0.9 }) {
    const item = this.items.find((it) => !it.active) || this.items[0];
    item.active = true;
    item.pos.copy(position);
    item.age = 0;
    item.life = life;
    item.size = size;
    item.el.textContent = text;
    item.el.style.color = color;
    item.el.style.fontSize = `${size}px`;
    item.el.style.textShadow = `0 0 8px ${color}, 0 0 18px ${color}`;
    item.el.style.display = 'block';
    this._place(item, 1);
  }

  update(dt) {
    const w = this._vw();
    const h = this._vh();
    for (const item of this.items) {
      if (!item.active) continue;
      item.age += dt;
      const t = item.age / item.life;
      if (t >= 1) {
        item.active = false;
        item.el.style.display = 'none';
        continue;
      }
      this._place(item, 1 - t * t);
    }
  }

  _place(item, alpha) {
    const v = this._v.copy(item.pos);
    v.y += item.rise * (item.age / item.life);
    v.project(this.camera);
    const x = (v.x * 0.5 + 0.5) * this._w;
    const y = (-v.y * 0.5 + 0.5) * this._h;
    item.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    item.el.style.opacity = alpha.toFixed(3);
  }

  _vw() {
    if (this._w !== this.container.clientWidth) this._w = this.container.clientWidth || window.innerWidth;
    return this._w;
  }

  _vh() {
    if (this._h !== this.container.clientHeight) this._h = this.container.clientHeight || window.innerHeight;
    return this._h;
  }

  dispose() {
    for (const item of this.items) item.el.remove();
    this.items.length = 0;
    this.container = null;
    this.camera = null;
  }
}
