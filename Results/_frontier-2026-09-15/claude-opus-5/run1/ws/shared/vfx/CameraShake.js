// Trauma-based camera shake. Trauma accumulates additively (clamped to 1), decays linearly, and
// the applied intensity is trauma² so small hits barely register while big ones are violent.
// Offsets are sampled from simplex noise for smooth, non-repeating motion.
import { SimplexNoise } from '../procgen/SimplexNoise.js';
import { clamp, degToRad } from '../math/MathUtils.js';

export class CameraShake {
  /**
   * @param {import('../render/CameraRig.js').CameraRig} rig
   */
  constructor(rig, { maxOffset = 0.55, maxRoll = degToRad(2.2), frequency = 18, decay = 1.4, seed = 7 } = {}) {
    this.rig = rig;
    this.maxOffset = maxOffset;
    this.maxRoll = maxRoll;
    this.frequency = frequency;
    this.decay = decay;
    this.trauma = 0;
    this.time = 0;
    this.noise = new SimplexNoise(seed);
  }

  addTrauma(amount) {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  /** Trauma proportional to impact speed. */
  addImpulse(velocity, scale = 0.02) {
    this.addTrauma(clamp(Math.abs(velocity) * scale, 0, 1));
  }

  /** Uses real (unscaled) time so the shake keeps moving during hit-stop. */
  update(realDt) {
    const rig = this.rig;
    if (this.trauma <= 0) {
      rig.shakeOffset.set(0, 0, 0);
      rig.shakeRoll = 0;
      return;
    }
    this.time += realDt;
    const intensity = this.trauma * this.trauma;
    const t = this.time * this.frequency;
    const n = this.noise;
    rig.shakeOffset.set(
      this.maxOffset * intensity * n.noise2D(t, 1.7),
      this.maxOffset * intensity * n.noise2D(3.1, t),
      this.maxOffset * 0.35 * intensity * n.noise2D(t * 0.6, 8.3),
    );
    rig.shakeRoll = this.maxRoll * intensity * n.noise2D(t * 0.9, t * 0.7 + 9.2);
    this.trauma = Math.max(0, this.trauma - this.decay * realDt);
  }

  reset() {
    this.trauma = 0;
    this.rig.shakeOffset.set(0, 0, 0);
    this.rig.shakeRoll = 0;
  }
}
