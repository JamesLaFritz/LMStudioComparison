import * as THREE from 'three';

/**
 * FloatingText — pooled DOM score/label chips anchored to a 3D world position.
 * Each frame the anchor is projected through the camera; scale and opacity are
 * derived from depth so text reads correctly at any distance. Capped pool:
 * oldest chip is retired when the cap is exceeded.
 */

const MAX_CHIPS = 12;

const CHIP_CSS = `
.ft-chip { position:absolute; left:0; top:0; pointer-events:none; white-space:nowrap;
  font-family:'Segoe UI', system-ui, sans-serif; font-weight:800; letter-spacing:.08em;
  color:#eaffff; text-shadow:0 0 10px var(--ft-color,#7df9ff), 0 0 26px var(--ft-color,#7df9ff);
  will-change:transform,opacity,scale; }
`;

export class FloatingText {
  /** @param {HTMLElement} root container element (positioned over the canvas) */
  constructor(root) {
    this.root = root;
    const style = document.createElement('style');
    style.textContent = CHIP_CSS;
    root.appendChild(style);
    this._styleEl = style;

    /** @type {{el:HTMLElement, world:{x:number,y:number,z:number}, age:number, life:number, vy:number, priority:number}[]} */
    this.chips = [];
    this._v3 = new THREE.Vector3();
    this._lastTime = null;
  }

  get activeCount() { return this.chips.length; }

  /**
   * Show a floating text chip at a world position.
   * @param {string} text
   * @param {{x:number,y:number,z:number}} worldPos
   * @param {object|string} [opts] color string or {color, life, vy, priority}
   * @param {number} [scale=1] size multiplier (also stretches lifetime slightly)
   */
  show(text, worldPos, opts = {}, scale = 1) {
    if (typeof opts === 'string') opts = { color: opts };
    const color = opts.color || '#7df9ff';
    const life = Math.max(0.5, (opts.life ?? 1.0) * (scale >= 1 ? scale : 1));
    const vy = opts.vy ?? 2.2;
    const priority = opts.priority ?? 0;

    // Evict oldest/lowest-priority if at cap.
    while (this.chips.length >= MAX_CHIPS) {
      let idx = 0;
      for (let i = 1; i < this.chips.length; i++) {
        const a = this.chips[i];
        const b = this.chips[idx];
        if ((a.priority - a.age / a.life) < (b.priority - b.age / b.life)) idx = i;
      }
      this._retire(this.chips.splice(idx, 1)[0]);
    }

    const el = document.createElement('div');
    el.className = 'ft-chip';
    el.textContent = text;
    el.style.setProperty('--ft-color', color);
    el.style.fontSize = `${Math.round(15 * scale)}px`;
    this.root.appendChild(el);

    this.chips.push({ el, world: { x: worldPos.x, y: worldPos.y, z: worldPos.z }, age: 0, life, vy, priority });
    return this.chips[this.chips.length - 1];
  }

  /**
   * Project all active chips to screen space.
   * @param {THREE.Camera} camera
   * @param {number} [dt] real (non-dilated) delta seconds; auto-measured when omitted
   */
  update(camera, dt = null) {
    if (dt === null || dt === undefined) {
      const now = performance.now();
      dt = this._lastTime == null ? 0 : Math.min((now - this._lastTime) / 1000, 0.1);
      this._lastTime = now;
    } else {
      this._lastTime = performance.now();
    }

    for (let i = this.chips.length - 1; i >= 0; i--) {
      const c = this.chips[i];
      c.age += dt;
      if (c.age >= c.life) { this._retire(c); this.chips.splice(i, 1); continue; }

      c.world.y += c.vy * dt;
      this._v3.set(c.world.x, c.world.y, c.world.z).project(camera);
      const behind = this._v3.z > 1 || this._v3.z < -1;
      if (behind) { c.el.style.opacity = '0'; continue; }

      // Screen coords from NDC.
      const sx = (this._v3.x * 0.5 + 0.5) * this.root.clientWidth;
      const sy = (-this._v3.y * 0.5 + 0.5) * this.root.clientHeight;
      c.el.style.transform = `translate(-50%,-50%) translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;

      // Depth-based scale: closer (z near -1..1) => bigger.
      const depthScale = 1 / (1 + Math.max(0, this._v3.z) * 2);
      c.el.style.scale = depthScale.toFixed(3);

      // Fade in fast, fade out over the last 40%.
      const t = c.age / c.life;
      const alpha = t < 0.15 ? t / 0.15 : (t > 0.6 ? Math.max(0, (1 - t) / 0.4) : 1);
      c.el.style.opacity = alpha.toFixed(3);
    }
  }

  _retire(chip) { chip.el.remove(); }

  clear() { for (const c of this.chips) this._retire(c); this.chips.length = 0; }

  dispose() {
    this.clear();
    if (this._styleEl && this._styleEl.parentNode) this._styleEl.remove();
  }
}
