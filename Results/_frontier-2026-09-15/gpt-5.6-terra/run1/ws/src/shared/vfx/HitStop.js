import { clamp } from '@shared/math/Math2D.js';

export class HitStop {
  constructor() {
    this.remaining = 0;
  }

  request(duration) {
    this.remaining = Math.max(this.remaining, clamp(duration, 0, 0.15));
  }

  update(realDelta) {
    this.remaining = Math.max(0, this.remaining - realDelta);
  }

  get timeScale() {
    return this.remaining > 0 ? 0 : 1;
  }
}
