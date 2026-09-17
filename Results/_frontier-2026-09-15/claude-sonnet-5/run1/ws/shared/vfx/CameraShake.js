import { clamp } from '../utils/MathUtils.js';

const TRAUMA_DECAY_PER_SEC = 1.6;
const MAX_OFFSET = 0.6;
const MAX_ROLL = 0.04;
const NOISE_FREQUENCY = 18;

/**
 * Trauma-based camera shake: trauma accumulates on impact, decays over time,
 * and offset/rotation are driven by trauma^2 so small hits barely register
 * while heavy impacts feel violent.
 */
export class CameraShake {
  constructor(camera) {
    this._camera = camera;
    this._basePosition = camera.position.clone();
    this._trauma = 0;
    this._seedX = Math.random() * 1000;
    this._seedY = Math.random() * 1000;
    this._seedRoll = Math.random() * 1000;
    this._elapsed = 0;
  }

  setBasePosition(x, y, z) {
    this._basePosition.set(x, y, z);
  }

  /** amount in [0,1], typically impactSpeed / maxExpectedSpeed */
  addTrauma(amount) {
    this._trauma = clamp(this._trauma + clamp(amount, 0, 1), 0, 1);
  }

  update(dt) {
    this._elapsed += dt;
    if (this._trauma > 0) {
      this._trauma = clamp(this._trauma - TRAUMA_DECAY_PER_SEC * dt, 0, 1);
    }

    const shake = this._trauma * this._trauma;
    const offsetX = MAX_OFFSET * shake * pseudoNoise(this._elapsed * NOISE_FREQUENCY + this._seedX);
    const offsetY = MAX_OFFSET * shake * pseudoNoise(this._elapsed * NOISE_FREQUENCY + this._seedY);
    const roll = MAX_ROLL * shake * pseudoNoise(this._elapsed * NOISE_FREQUENCY + this._seedRoll);

    this._camera.position.set(
      this._basePosition.x + offsetX,
      this._basePosition.y + offsetY,
      this._basePosition.z
    );
    this._camera.rotation.z = roll;
  }

  get currentTrauma() {
    return this._trauma;
  }
}

function pseudoNoise(t) {
  return Math.sin(t) * 0.6 + Math.sin(t * 2.13 + 1.7) * 0.3 + Math.sin(t * 4.7 + 3.1) * 0.1;
}
