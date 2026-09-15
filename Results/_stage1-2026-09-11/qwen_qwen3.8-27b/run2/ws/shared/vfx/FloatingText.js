import * as THREE from 'three';

/**
 * FloatingText — pooled DOM score popups projected from world space.
 *
 * Six required VFX, #6. Each popup is a div in a fixed overlay layer;
 * its screen position is computed per frame with Vector3.project(camera)
 * while it is alive, then a CSS animation carries the rise + fade.
 * Pool of 12 — no DOM churn in the hot path.
 */
export default class FloatingText {
  constructor({ layer, max = 12 } = {}) {
    if (!layer) throw new Error('FloatingText: `layer` element required');
    this.layer = layer;
    this.max = max;
    this.items = [];
    this._v = new THREE.Vector3();

    for (let i = 0; i < max; i++) {
      const el = document.createElement('div');
      el.className = 'float-text';
      el.style.display = 'none';
      layer.appendChild(el);
      this.items.push({ el, active: false, pos: { x: 0, y: 0, z: 0 }, life: 0, maxLife: 0 });
    }
    this._cursor = 0;
  }

  /**
   * Spawn a popup at a world position.
   * @param {number} wx @param {number} wy @param {number} wz
   * @param {string} text
   * @param {object} [opts] { color, size, life }
   */
  spawn(wx, wy, wz, text, opts = {}) {
    const it = this.items[this._cursor];
    this._cursor = (this._cursor + 1) % this.max;
    it.active = true;
    it.pos.x = wx; it.pos.y = wy; it.pos.z = wz;
    it.life = 0;
    it.maxLife = opts.life ?? 0.9;
    it.el.textContent = text;
    it.el.style.color = opts.color || '#7df9ff';
    it.el.style.fontSize = `${opts.size ?? 15}px`;
    it.el.style.display = 'block';
    it.el.style.opacity = '1';
    it.el.style.transform = 'translate(-50%, -50%) scale(0.6)';
    // force reflow so the transition restarts on reused elements
    void it.el.offsetWidth;
    it.el.style.transition = `transform ${it.maxLife}s cubic-bezier(.2,.7,.3,1), opacity ${it.maxLife}s ease-out`;
    it.el.style.transform = 'translate(-50%, -160%) scale(1.15)';
    it.el.style.opacity = '0';
    return it;
  }

  /** Per-frame: project live popups to screen space. */
  update(dt, camera, width, height) {
    const v = this._v;
    for (const it of this.items) {
      if (!it.active) continue;
      it.life += dt;
      if (it.life >= it.maxLife) {
        it.active = false;
        it.el.style.display = 'none';
        continue;
      }
      v.x = it.pos.x; v.y = it.pos.y; v.z = it.pos.z;
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      it.el.style.left = `${x}px`;
      it.el.style.top = `${y}px`;
    }
  }

  clear() {
    for (const it of this.items) {
      it.active = false;
      it.el.style.display = 'none';
    }
  }

  dispose() {
    for (const it of this.items) it.el.remove();
  }
}
