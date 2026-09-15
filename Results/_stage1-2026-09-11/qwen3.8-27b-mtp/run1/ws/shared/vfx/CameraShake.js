/**
 * CameraShake — trauma-based camera shake (required VFX #1).
 *
 * Model: trauma ∈ [0, 1] accumulates from impact events and decays exponentially.
 * Per-frame offset = trauma² · maxAmp · (two incommensurate sine triads) → quiet at
 * low trauma, violent only on real impacts. An optional FOV kick adds punch to
 * heavy hits without moving the camera center.
 */

const TAU = Math.PI * 2;

export class CameraShake {
  constructor(camera, { maxAmp = 1.35, decayTau = 0.9, fovKick = 4 } = {}) {
    this.camera = camera;
    this.maxAmp = maxAmp;
    this.decayTau = decayTau;
    this.fovKick = fovKick;

    this.trauma = 0;
    this._t = Math.random() * 100;
    this._baseFov = camera.fov;
    this._ox = 0;
    this._oy = 0;
    this._oz = 0;
  }

  /** Add trauma from an impact. `amount` is already scaled by the caller's event table. */
  add(amount) {
    if (amount <= 0) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  get active() {
    return this.trauma > 0.002;
  }

  /** Real-time update — shake runs at full rate even during hit-stop (feedback must stay crisp). */
  update(dt) {
    if (this.trauma <= 0.002) {
      // Cheap path: confirm the offset is clean, skip work.
      if (this._ox !== 0 || this._oy !== 0 || this._oz !== 0) this._ox = this._oy = this._oz = 0;
      return;
    }

    this.trauma *= Math.exp(-dt / this.decayTau);
    if (this.trauma < 0.002) {
      this.trauma = 0;
      this._ox = this._oy = this._oz = 0;
      if (Math.abs(this.camera.fov - this._baseFov) > 1e-4) {
        this.camera.fov = this._baseFov;
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    // Incommensurate frequencies avoid visible looping in the shake pattern.
    this._t += dt * (14 + this.trauma * 26);
    const a = this.trauma * this.trauma * this.maxAmp;
    const t = this._t;
    this._ox = Math.sin(t * 1.0) * a + Math.sin(t * 2.731) * a * 0.45;
    this._oy = Math.cos(t * 1.31) * a * 0.8 + Math.sin(t * 3.917) * a * 0.3;
    this._oz = Math.sin(t * 0.83) * a * 0.55;

    const fov = this._baseFov + this.fovKick * this.trauma * this.trauma;
    if (Math.abs(this.camera.fov - fov) > 1e-4) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Copy current shake offset into out (Vector3). Caller applies it to the camera. */
  getOffset(out) {
    return out.set(this._ox, this._oy, this._oz);
  }

  reset() {
    this.trauma = 0;
    this._ox = this._oy = this._oz = 0;
    if (this.camera.fov !== this._baseFov) {
      this.camera.fov = this._baseFov;
      this.camera.updateProjectionMatrix();
    }
  }
}
