import { clamp, hashNoise } from '@shared/math/Math2D.js';

export class CameraShake {
  constructor() {
    this.trauma = 0;
    this.time = 0;
  }

  addImpact(severity, relativeSpeed = 12) {
    const impulse = clamp(severity * relativeSpeed / 20, 0, severity);
    this.trauma = clamp(this.trauma + impulse, 0, 1);
  }

  update(delta, cameraRig) {
    this.time += delta;
    this.trauma = Math.max(0, this.trauma - 1.85 * delta);
    const amplitude = this.trauma * this.trauma;
    const x = (hashNoise(this.time * 61.1) * 2 - 1) * amplitude * 0.23;
    const y = (hashNoise(this.time * 83.7 + 4.2) * 2 - 1) * amplitude * 0.18;
    const roll = (hashNoise(this.time * 47.2 + 8.1) * 2 - 1) * amplitude * 0.018;
    cameraRig.applyShake(x, y, roll);
  }
}
