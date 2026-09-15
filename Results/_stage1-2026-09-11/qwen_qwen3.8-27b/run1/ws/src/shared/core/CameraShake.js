import * as THREE from 'three';

/**
 * Trauma-based camera shake.
 *
 *  - addTrauma(amount) accumulates into [0,1].
 *  - trauma decays exponentially: trauma *= e^(-decay * dt).
 *  - offset magnitude = trauma^2 * amplitude (quadratic → soft start, hard hits).
 *  - direction is a smooth pseudo-noise (sum of sines) so it reads as a
 *    physical jolt, not white-noise jitter.
 *
 * apply(camera) sets camera.position = base + offset. Callers must have set
 * basePosition first (or use setBase).
 */
export class CameraShake {
  constructor({ amplitude = 0.55, decay = 3.2 } = {}) {
    this.amplitude = amplitude;
    this.decay = decay;
    this.trauma = 0;
    this._t = 0;
    this._base = new THREE.Vector3();
    this._offset = new THREE.Vector3();
  }

  setBase(x, y, z) { this._base.set(x, y, z); }
  getBase(out) { return out.copy(this._base); }

  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  get intensity() { return this.trauma; }

  update(dt) {
    if (this.trauma <= 0.0001) { this.trauma = 0; return; }
    this.trauma *= Math.exp(-this.decay * dt);
    if (this.trauma < 0.0001) this.trauma = 0;
    this._t += dt;
  }

  /** Compute current offset into `out`. */
  getOffset(out) {
    if (this.trauma <= 0) return out.set(0, 0, 0);
    const t = this._t;
    const m = this.trauma * this.trauma * this.amplitude;
    const nx = Math.sin(t * 47.0) * 0.6 + Math.sin(t * 91.0 + 1.7) * 0.4;
    const ny = Math.sin(t * 53.0 + 2.1) * 0.6 + Math.sin(t * 97.0 + 0.4) * 0.4;
    const nz = Math.sin(t * 43.0 + 4.2) * 0.6 + Math.sin(t * 83.0 + 2.9) * 0.4;
    return out.set(nx * m, ny * m * 0.7, nz * m * 0.5);
  }

  /** Apply shake to camera: camera.position = base + offset. */
  apply(camera) {
    const o = this.getOffset(this._offset);
    camera.position.set(
      this._base.x + o.x,
      this._base.y + o.y,
      this._base.z + o.z
    );
  }

  reset() { this.trauma = 0; }
}
