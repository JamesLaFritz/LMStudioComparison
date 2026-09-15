// shared/vfx/CameraShake.js
// Trauma-based camera shake. Impulses accumulate into trauma ∈ [0,1];
// decay is fast at high trauma with a long tail (quadratic-ish bleed).
// Offset amplitude ∝ trauma², roll ∝ trauma² — driven by smooth sines at
// irrational frequency ratios so the motion never visibly loops.

const TWO_PI = Math.PI * 2;

export class CameraShake {
  constructor() {
    this.trauma = 0;
    // Base camera pose captured once per frame by update(); shake is an offset on top.
    this._basePos = { x: 0, y: 0, z: 0 };
    this._baseQuat = { x: 0, y: 0, z: 0, w: 1 };
    // Smooth-noise frequencies (irrational ratios → no visible period).
    this._f1 = 1.7;
    this._f2 = 2.9;
    this._f3 = 4.3;
    this._t = 0;
  }

  add(impulse) {
    if (impulse <= 0) return;
    const room = 1 - this.trauma;
    this.trauma = Math.min(1, this.trauma + (impulse < room ? impulse : room));
  }

  get active() {
    return this.trauma > 0.0005;
  }

  /**
   * @param {number} dt real (unscaled) seconds — shake must not freeze during hit-stop,
   *                    it is a camera effect, not world time.
   * @param {import('three').PerspectiveCamera} camera
   */
  update(dt, camera) {
    this._t += dt;

    // Decay: fast initial bleed, long tail.
    if (this.trauma > 0) {
      const d = dt * (0.9 + 1.6 * this.trauma);
      this.trauma = Math.max(0, this.trauma - d);
    }

    // Capture base pose (caller sets camera position each frame before shake).
    this._basePos.x = camera.position.x;
    this._basePos.y = camera.position.y;
    this._basePos.z = camera.position.z;
    const q = camera.quaternion;
    this._baseQuat.x = q.x; this._baseQuat.y = q.y;
    this._baseQuat.z = q.z; this._baseQuat.w = q.w;

    if (this.trauma <= 0.0005) return; // leave camera untouched when calm

    const t2 = this.trauma * this.trauma;
    const amp = t2 * 0.55;
    const rollAmp = t2 * 0.02;
    const t = this._t;

    // Smooth pseudo-random offsets: sums of sines at irrational frequency ratios.
    const ox = (Math.sin(t * this._f1) + Math.sin(t * this._f2 * 1.31)) * 0.5 * amp;
    const oy = (Math.cos(t * this._f2) + Math.sin(t * this._f3 * 0.87)) * 0.5 * amp;
    const roll = (Math.sin(t * this._f3) + Math.cos(t * this._f1 * 1.49)) * 0.5 * rollAmp;

    camera.position.x += ox;
    camera.position.y += oy;

    // Roll around the view axis: rotate quaternion by a small z-rotation in camera space.
    const sinH = Math.sin(roll * 0.5);
    const cosH = Math.cos(roll * 0.5);
    const qx = this._baseQuat.x, qy = this._baseQuat.y, qz = this._baseQuat.z, qw = this._baseQuat.w;
    // Multiply base quat by (sinH·ẑ + cosH) — camera-space roll.
    camera.quaternion.set(
      qx * cosH + qy * sinH,   // x = px*c + py*s
      qx * sinH - qy * cosH,   // y = px*s − py*c
      qz * cosH + qw * sinH,   // z = pz*c + pw*s
      qw * cosH - qz * sinH    // w = pw*c − pz*s
    );
  }

  reset() {
    this.trauma = 0;
  }
}
