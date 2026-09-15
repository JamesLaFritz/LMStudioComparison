import * as THREE from 'three';
import { Noise } from '../math/Noise.js';
import { clamp, damp, lerp } from '../math/Utils.js';

/**
 * CameraRig — trauma-based camera shake with impact kicks and smooth follow.
 *
 * Model:
 *   amplitude = trauma^2 * maxAmplitude        (quadratic: small hits barely move,
 *                                                big hits hit hard)
 *   direction = 2D simplex noise over time     (organic, non-repeating)
 *   trauma decays exponentially                (half-life ~0.5s at decay 1.4)
 *   kick adds a decaying impulse offset        (impact-velocity scaling)
 */
export class CameraRig {
  constructor(camera, { maxAmplitude = 0.6, decay = 1.4, kickDecay = 6.0 } = {}) {
    this.camera = camera;
    this.maxAmplitude = maxAmplitude;
    this.decay = decay;
    this.kickDecay = kickDecay;

    this.trauma = 0;
    this.kickX = 0;
    this.kickY = 0;
    this.kickZ = 0;

    this.basePosition = new THREE.Vector3();
    this.baseTarget = new THREE.Vector3();
    this.followTarget = null;
    this.followOffset = new THREE.Vector3();
    this.followDamping = 8;
    this.enabled = true;

    this._noise = new Noise();
    this._t = 0;
    this._shake = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._desiredTarget = new THREE.Vector3();
  }

  /** Set the neutral camera pose (position + look-at). */
  setBase(position, target) {
    this.basePosition.copy(position);
    this.baseTarget.copy(target);
    this._desired.copy(position);
    this._desiredTarget.copy(target);
  }

  /** Add trauma in [0, 1]; multiple sources accumulate (clamped). */
  addTrauma(amount) {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  /**
   * Impact kick — impulse along a direction, scaled by impact velocity.
   * @param {THREE.Vector3} direction normalized impact direction
   * @param {number} velocity impact speed (world units/s)
   */
  kick(direction, velocity) {
    const strength = clamp(velocity * 0.0012, 0, 0.35);
    this.kickX += direction.x * strength;
    this.kickY += direction.y * strength;
    this.kickZ += direction.z * strength * 0.5;
  }

  /** Smoothly follow a world-space target with an offset. */
  follow(target, offset, damping = 8) {
    this.followTarget = target;
    this.followOffset.copy(offset);
    this.followDamping = damping;
  }

  clearFollow() {
    this.followTarget = null;
  }

  reset() {
    this.trauma = 0;
    this.kickX = this.kickY = this.kickZ = 0;
  }

  update(dt, time) {
    this._t = time;

    // Decay trauma and kick.
    this.trauma *= Math.exp(-this.decay * dt);
    if (this.trauma < 0.0005) this.trauma = 0;
    const kickFalloff = Math.exp(-this.kickDecay * dt);
    this.kickX *= kickFalloff;
    this.kickY *= kickFalloff;
    this.kickZ *= kickFalloff;

    // Follow target (if any) drives the desired pose.
    if (this.followTarget) {
      this._desired.copy(this.followTarget.position).add(this.followOffset);
      this._desiredTarget.copy(this.followTarget.position);
      const k = 1 - Math.exp(-this.followDamping * dt);
      this.camera.position.lerp(this._desired, k);
      this.camera.lookAt(this._desiredTarget);
    } else {
      this._desired.copy(this.basePosition);
      this._desiredTarget.copy(this.baseTarget);
    }

    if (!this.enabled) return;

    // Trauma shake: quadratic amplitude, noise-driven direction.
    const amp = this.trauma * this.trauma * this.maxAmplitude;
    if (amp > 0.0001) {
      const n1 = this._noise.noise2(this._t * 2.7, 13.7);
      const n2 = this._noise.noise2(41.3, this._t * 2.7);
      const n3 = this._noise.noise2(this._t * 2.1, 97.1);
      this._shake.set(n1 * amp, n2 * amp * 0.7, n3 * amp * 0.3);
    } else {
      this._shake.set(0, 0, 0);
    }

    // Apply shake + kick on top of the base pose.
    this.camera.position.set(
      this._desired.x + this._shake.x + this.kickX,
      this._desired.y + this._shake.y + this.kickY,
      this._desired.z + this._shake.z + this.kickZ
    );
    this.camera.lookAt(
      this._desiredTarget.x - this._shake.x * 0.5,
      this._desiredTarget.y - this._shake.y * 0.5,
      this._desiredTarget.z
    );
  }
}
