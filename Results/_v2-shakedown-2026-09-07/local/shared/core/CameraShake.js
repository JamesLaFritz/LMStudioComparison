import * as THREE from 'three';
import { noise2 } from '../utils/Noise.js';

/**
 * Trauma-based camera shake.
 *
 * `add(k)` raises trauma toward 1 (k scales with impact severity).
 * Trauma decays exponentially (half-life ~0.45 s). Offset magnitude is
 * trauma^2 so the shake eases in and out instead of popping.
 *
 * The camera's base position/quaternion are captured at construction;
 * `update()` writes base + noise offset every frame. Call `resetBase()`
 * if the camera's home position changes (e.g. parallax re-anchoring).
 */
export class CameraShake {
  constructor(camera, { maxOffset = 0.35, maxRoll = 0.02, halfLife = 0.45 } = {}) {
    this.camera = camera;
    this.maxOffset = maxOffset;
    this.maxRoll = maxRoll;
    this.decay = Math.LN2 / halfLife;
    this.trauma = 0;
    this.time = 0;
    this._basePos = camera.position.clone();
    this._baseQuat = camera.quaternion.clone();
    this._offset = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._axis = new THREE.Vector3();
  }

  /** Re-capture the camera's current transform as the shake baseline. */
  resetBase() {
    this._basePos.copy(this.camera.position);
    this._baseQuat.copy(this.camera.quaternion);
  }

  /** Add impact energy. k is typically 0.05 (tick) .. 1.0 (player death). */
  add(k) {
    this.trauma = Math.min(1, this.trauma + k);
  }

  /** Decay on real time (not game time) so hit-stop doesn't freeze the shake. */
  update(dt, t) {
    this.time += dt;
    if (this.trauma > 0) {
      this.trauma *= Math.exp(-this.decay * dt);
      if (this.trauma < 0.001) this.trauma = 0;
    }
    const cam = this.camera;
    if (this.trauma <= 0) {
      cam.position.copy(this._basePos);
      cam.quaternion.copy(this._baseQuat);
      return;
    }
    const m = this.trauma * this.trauma;
    const tt = this.time;
    this._offset.set(
      noise2(tt * 1.7, 0.0) * this.maxOffset * m,
      noise2(tt * 1.7, 100.0) * this.maxOffset * m * 0.7,
      noise2(tt * 1.3, 200.0) * this.maxOffset * m * 0.35
    );
    cam.position.copy(this._basePos).add(this._offset);
    const roll = noise2(tt * 1.1, 300.0) * this.maxRoll * m;
    this._axis.set(0, 0, 1);
    this._quat.setFromAxisAngle(this._axis, roll);
    cam.quaternion.copy(this._baseQuat).multiply(this._quat);
  }

  dispose() {
    this._offset = null;
    this._quat = null;
    this._axis = null;
    this._basePos = null;
    this._baseQuat = null;
  }
}
