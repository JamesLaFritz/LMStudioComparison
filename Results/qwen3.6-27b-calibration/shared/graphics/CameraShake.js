/**
 * CameraShake — Trauma-based camera shake system with decaying intensity.
 * Shared across all games.
 */
import * as THREE from 'three';

const _vec = new THREE.Vector3();

export class CameraShake {
  constructor(camera) {
    this.camera = camera;
    this.intensity = 0;
    this.decayRate = 0;
    this.frequency = 10;
    this.duration = 0;
    this.elapsed = 0;
    this.active = false;
    this.originPosition = new THREE.Vector3();
    this.originQuaternion = new THREE.Quaternion();
  }

  /**
   * Trigger a shake event.
   * @param {number} amplitude - Peak shake amplitude in world units.
   * @param {number} frequency - Oscillation frequency in Hz.
   * @param {number} duration - How long the shake lasts in seconds.
   */
  trigger(amplitude, frequency, duration) {
    this.intensity = amplitude;
    this.decayRate = amplitude / duration;
    this.frequency = frequency || 10;
    this.duration = duration || 0.5;
    this.elapsed = 0;
    this.active = true;

    // Store original camera transform
    this.originPosition.copy(this.camera.position);
    this.originQuaternion.copy(this.camera.quaternion);
  }

  /**
   * Update shake each frame. Call from render loop.
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    if (!this.active) return;

    this.elapsed += dt;

    if (this.elapsed >= this.duration) {
      this.active = false;
      this.intensity = 0;
      // Restore camera position
      this.camera.position.copy(this.originPosition);
      this.camera.quaternion.copy(this.originQuaternion);
      return;
    }

    // Exponential decay
    const t = this.elapsed / this.duration;
    const decay = Math.pow(1 - t, 2);
    const currentIntensity = this.intensity * decay;

    // Generate pseudo-random shake using sine waves at prime frequencies
    const time = this.elapsed * this.frequency;
    const offsetX = (Math.sin(time * 1.0) * 0.5 + Math.sin(time * 2.7) * 0.3 + Math.sin(time * 5.1) * 0.2) * currentIntensity;
    const offsetY = (Math.sin(time * 1.3) * 0.5 + Math.sin(time * 3.1) * 0.3 + Math.sin(time * 4.7) * 0.2) * currentIntensity;
    const offsetZ = (Math.sin(time * 0.7) * 0.5 + Math.sin(time * 2.3) * 0.3 + Math.sin(time * 5.9) * 0.2) * currentIntensity;

    _vec.set(offsetX, offsetY, offsetZ);
    this.camera.position.copy(this.originPosition).add(_vec);
  }

  /**
   * Immediately stop all shaking.
   */
  stop() {
    this.active = false;
    this.intensity = 0;
    this.camera.position.copy(this.originPosition);
    this.camera.quaternion.copy(this.originQuaternion);
  }
}
