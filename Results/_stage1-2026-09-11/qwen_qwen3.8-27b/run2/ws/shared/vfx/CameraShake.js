/**
 * CameraShake — trauma-based camera shake (shared VFX 1/6).
 *
 * A single scalar `trauma` in [0, 1] drives everything:
 *   - offset magnitude ∝ trauma²  (quadratic falloff: small shakes stay subtle)
 *   - frequency rises with trauma (violent shakes jitter faster)
 *   - trauma decays linearly; `add()` clamps to 1
 *
 * Impact velocity scaling: callers pass `impact = clamp(relativeSpeed / refSpeed)`,
 * so a 20 m/s collision shakes twice as hard as a 10 m/s one.
 *
 * Usage:
 *   const shake = new CameraShake(engine.camera, { maxOffset: 0.4, decay: 1.6 });
 *   shake.add(0.8);                       // on player hit
 *   shake.update(dt);                     // every frame, BEFORE render
 */
import { clamp, layeredSine } from '../utils/Math.js';

export default class CameraShake {
  /**
   * @param {import('three').Camera} camera
   * @param {{maxOffset?: number, decay?: number, roll?: number}} [opts]
   *   maxOffset — peak camera displacement in world units (default 0.4)
   *   decay     — trauma units lost per second (default 1.6)
   *   roll      — max roll angle in radians (default 0.02)
   */
  constructor(camera, opts = {}) {
    this.camera = camera;
    this.maxOffset = opts.maxOffset ?? 0.4;
    this.decay = opts.decay ?? 1.6;
    this.maxRoll = opts.roll ?? 0.02;
    this.trauma = 0;
    this._t = 0;
    this._basePos = new camera.position.constructor();
    this._baseQuat = new camera.quaternion.constructor();
    this._captured = false;
  }

  /** Add trauma from an impact. `impact` in [0,1] — scale by relative velocity. */
  add(impact) {
    this.trauma = clamp(this.trauma + clamp(impact, 0, 1), 0, 1);
  }

  /** Instantly zero out (e.g. on respawn / state change). */
  reset() {
    this.trauma = 0;
  }

  /**
   * Advance and apply. Call once per frame with the *unscaled* dt so shake
   * timing stays real-time even during hit-stop.
   */
  update(dt) {
    this._t += dt;
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.decay * dt);
    }

    if (!this._captured) {
      this._basePos.copy(this.camera.position);
      this._baseQuat.copy(this.camera.quaternion);
      this._captured = true;
    }

    const t = this.trauma;
    if (t <= 0.0001) {
      this.camera.position.copy(this._basePos);
      this.camera.quaternion.copy(this._baseQuat);
      return;
    }

    const mag = t * t * this.maxOffset;
    const freq = 11 + t * 9;
    const s1 = layeredSine(this._t * freq * 1.0, 0.0);
    const s2 = layeredSine(this._t * freq * 1.31 + 1.7, 0.0);
    const s3 = layeredSine(this._t * freq * 0.73 + 4.2, 0.0);

    this.camera.position.set(
      this._basePos.x + s1 * mag,
      this._basePos.y + s2 * mag,
      this._basePos.z + s3 * mag * 0.5
    );
    this.camera.quaternion.copy(this._baseQuat);
    if (this.maxRoll > 0) {
      this.camera.rotateZ(s3 * this.maxRoll * t);
    }
  }

  /** Re-capture the base transform (call after moving the camera deliberately). */
  recapture() {
    this._basePos.copy(this.camera.position);
    this._baseQuat.copy(this.camera.quaternion);
    this._captured = true;
  }
}
