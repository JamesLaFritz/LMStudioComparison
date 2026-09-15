/**
 * CameraShake — trauma-based camera shake.
 * Impacts add trauma in [0..1]; it decays exponentially and the applied
 * offset scales with trauma^2 (soft start, hard hits), so small ticks never
 * jitter the frame while big impacts punch through.
 */
import { clamp, randRange } from '../math/MathUtils.js';

export class CameraShake {
  constructor({ maxOffset = 0.55, decayRate = 3.2 } = {}) {
    this.maxOffset = maxOffset;
    this.decayRate = decayRate;
    this.trauma = 0;
    // Per-frame jitter direction (re-rolled each update so motion is organic)
    this._jx = 0;
    this._jy = 0;
    this._offsetX = 0;
    this._offsetY = 0;
  }

  /** Add impact trauma. `v` typically scales with impact velocity * mass. */
  addTrauma(v) {
    this.trauma = clamp(this.trauma + v, 0, 1);
  }

  update(dt) {
    if (this.trauma <= 0) return;
    this.trauma *= Math.exp(-this.decayRate * dt);
    if (this.trauma < 0.002) this.trauma = 0;
    const a = randRange(0, Math.PI * 2);
    this._jx = Math.cos(a);
    this._jy = Math.sin(a);
  }

  /** Apply the current shake offset to a camera (call after all world updates). */
  apply(camera) {
    const m = this.trauma * this.trauma * this.maxOffset;
    this._offsetX = this._jx * m + randRange(-1, 1) * m * 0.35;
    this._offsetY = this._jy * m + randRange(-1, 1) * m * 0.35;
    camera.position.x += this._offsetX;
    camera.position.y += this._offsetY;
  }

  /** Restore the base position (call before apply each frame). */
  reset(camera, baseX, baseY) {
    camera.position.x = baseX;
    camera.position.y = baseY;
  }
}
