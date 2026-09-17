import { clamp } from '../math/MathUtils.js';

export class CameraShake {
  constructor(seed = 1) {
    this.trauma = 0;
    this.time = 0;
    this.seed = seed * 0.0137;
    this.reducedMotion = false;
    this.sample = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
  }

  addTrauma(amount) {
    this.trauma = clamp(this.trauma + Math.max(0, amount), 0, 1);
  }

  addImpact(speed, base = 0.06, scale = 0.24) {
    const velocityFactor = clamp((speed - 4) / 18, 0, 1);
    this.addTrauma(base + velocityFactor * scale);
  }

  setReducedMotion(enabled) {
    this.reducedMotion = Boolean(enabled);
  }

  update(dt) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - 1.8 * dt);
    const amplitude = this.trauma * this.trauma;
    const translationScale = this.reducedMotion ? 0.25 : 1;
    const rotationScale = this.reducedMotion ? 0 : 1;
    const t = this.time * 31.7 + this.seed;
    const n1 = Math.sin(t * 1.07 + Math.sin(t * 0.37));
    const n2 = Math.sin(t * 1.31 + 2.1 + Math.sin(t * 0.43));
    const n3 = Math.sin(t * 0.89 + 4.7 + Math.sin(t * 0.29));
    this.sample.x = n1 * 0.3 * amplitude * translationScale;
    this.sample.y = n2 * 0.22 * amplitude * translationScale;
    this.sample.z = n3 * 0.08 * amplitude * translationScale;
    this.sample.pitch = n2 * 0.012 * amplitude * rotationScale;
    this.sample.yaw = n1 * 0.008 * amplitude * rotationScale;
    this.sample.roll = n3 * 0.018 * amplitude * rotationScale;
    return this.sample;
  }

  reset() {
    this.trauma = 0;
    this.time = 0;
    Object.keys(this.sample).forEach((key) => { this.sample[key] = 0; });
  }
}
