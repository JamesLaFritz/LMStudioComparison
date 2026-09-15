/**
 * CameraShake — trauma-based camera shake.
 *
 * trauma ∈ [0, 1]. Amplitude scales with trauma² (quadratic falloff reads as
 * "impact weight"). Direction is a smooth pseudo-noise (sum of incommensurate
 * sines) so the shake never looks like a pure jitter.
 *
 * Usage:
 *   const shake = new CameraShake({ maxOffset: 0.35, decay: 1.6 });
 *   shake.addTrauma(0.3);            // on impact
 *   shake.update(dt);                // each frame
 *   shake.apply(camera);             // after update, before render
 */
export default class CameraShake {
  constructor({ maxOffset = 0.35, decay = 1.6 } = {}) {
    this.maxOffset = maxOffset;
    this.decay = decay;
    this.trauma = 0;
    this.time = 0;
    this._basePos = new Float32Array(3);
    this._baseQuat = new Float32Array(4);
  }

  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  get active() {
    return this.trauma > 0.0005;
  }

  update(dt) {
    if (this.trauma <= 0) return;
    this.time += dt;
    // Linear-ish decay with a soft knee so the tail settles naturally.
    this.trauma = Math.max(0, this.trauma - this.decay * dt * (0.4 + 0.6 * this.trauma));
  }

  /**
   * Apply the shake offset to the camera. Call once per frame after update().
   * The camera's base transform is captured on first apply (or after reset()),
   * so the shake is always relative to where the game put the camera.
   */
  apply(camera) {
    if (!this.active) {
      // Ensure a clean state if we just settled.
      if (this._applied) {
        camera.position.fromArray(this._basePos);
        camera.quaternion.fromArray(this._baseQuat);
        this._applied = false;
      }
      return;
    }
    if (!this._applied) {
      this._basePos.set([camera.position.x, camera.position.y, camera.position.z]);
      this._baseQuat.set([camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w]);
      this._applied = true;
    }
    const t = this.time;
    const amp = this.maxOffset * this.trauma * this.trauma;
    // Smooth pseudo-noise: three incommensurate frequencies per axis.
    const nx = Math.sin(t * 31.7) * 0.6 + Math.sin(t * 17.3 + 1.7) * 0.4;
    const ny = Math.sin(t * 27.1 + 0.9) * 0.6 + Math.sin(t * 13.9 + 4.2) * 0.4;
    const nz = Math.sin(t * 23.3 + 2.1) * 0.5 + Math.sin(t * 11.1 + 3.3) * 0.5;
    camera.position.set(
      this._basePos[0] + nx * amp,
      this._basePos[1] + ny * amp,
      this._basePos[2] + nz * amp * 0.5
    );
    // Tiny rotational wobble for weight.
    const r = amp * 0.05;
    camera.quaternion.set(
      this._baseQuat[0] + Math.sin(t * 19.7) * r,
      this._baseQuat[1] + Math.sin(t * 21.3 + 1.1) * r,
      this._baseQuat[2] + Math.sin(t * 15.9 + 2.3) * r,
      this._baseQuat[3]
    );
  }

  reset() {
    this.trauma = 0;
    this.time = 0;
    this._applied = false;
  }
}
