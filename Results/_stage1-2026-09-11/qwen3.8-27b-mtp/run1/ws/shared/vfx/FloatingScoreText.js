import { clamp } from '../utils/math.js';

/**
 * FloatingScoreText — pooled DOM score popups (glassmorphism chips) that track a
 * 3D anchor point, rise, and fade. One shared pool; no per-spawn allocation after warmup.
 */
export class FloatingScoreText {
  constructor(container, camera, { max = 14 } = {}) {
    this.container = container;
    this.camera = camera;
    this.max = max;

    // Preallocate the chip pool (DOM nodes are cheap to create once).
    this.chips = [];
    for (let i = 0; i < max; i++) {
      const el = document.createElement('div');
      el.className = 'score-chip';
      container.appendChild(el);
      this.chips.push({
        el, active: false, age: 0, life: 0.95,
        ax: 0, ay: 0, az: 0, // anchor in world space (fixed at spawn)
        rise: 0, opacity: 0, color: '#66ffff',
      });
    }

    this._v = { x: 0, y: 0, z: 0 }; // scratch for projection math below
  }

  /** Spawn a popup at world position. Returns the chip slot or null when pool exhausted. */
  spawn(x, y, z, text, color = '#66ffff') {
    let slot = this.chips.find((c) => !c.active);
    if (!slot) { // steal oldest active chip when exhausted
      let bestAge = -1;
      for (const c of this.chips) if (c.age > bestAge) { bestAge = c.age; slot = c; }
    }

    slot.active = true;
    slot.age = 0;
    slot.life = 0.95;
    slot.ax = x; slot.ay = y; slot.az = z;
    slot.rise = 0;
    slot.opacity = 1;
    slot.color = color;
    slot.el.textContent = text;
    slot.el.style.borderColor = color;
    slot.el.style.boxShadow = `0 0 18px ${color}55, inset 0 0 12px ${color}22`;
    slot.el.classList.remove('hidden');
    return slot;
  }

  update(dt) {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    for (const c of this.chips) {
      if (!c.active) continue;
      c.age += dt;
      const t = clamp(c.age / c.life, 0, 1);

      // Rise + fade-out.
      c.rise = 46 * (1 - Math.pow(1 - t, 2));
      c.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;

      // Project world anchor → screen space.
      const v = this._v;
      v.x = c.ax; v.y = c.ay + c.rise * 0.02; v.z = c.az;
      const cam = this.camera.matrixWorldInverse.elements;
      // Manual projection (avoids importing THREE here): p' = P · V · w
      const inv = cam;
      const x1 = inv[0]*v.x + inv[4]*v.y + inv[8]*v.z + inv[12];
      const y1 = inv[1]*v.x + inv[5]*v.y + inv[9]*v.z + inv[13];
      const z1 = inv[2]*v.x + inv[6]*v.y + inv[10]*v.z + inv[14];
      if (z1 >= 0 || z1 <= -1e-6) { c.el.classList.add('hidden'); continue; } // behind camera
      const proj = this.camera.projectionMatrix.elements;
      const cx = (proj[0]*x1 + proj[4]*y1 + proj[8]*z1 + proj[12]) / -z1;
      const cy = (proj[1]*x1 + proj[5]*y1 + proj[9]*z1 + proj[13]) / -z1;
      if (!isFinite(cx) || !isFinite(cy)) { c.el.classList.add('hidden'); continue; }

      const sx = (cx * 0.5 + 0.5) * w;
      const sy = (-cy * 0.5 + 0.5) * h;
      c.el.style.transform = `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      c.el.style.opacity = c.opacity.toFixed(3);

      if (t >= 1) {
        c.active = false;
        c.el.classList.add('hidden');
      }
    }
  }

  clear() { for (const c of this.chips) { c.active = false; c.el.classList.add('hidden'); } }

  dispose() {
    for (const c of this.chips) c.el.remove();
    this.chips.length = 0;
  }
}
