// Hit-stop / frame-freeze: dilates the engine's time-scale for a short window.
// Requests carry a priority; a stronger impact overrides a weaker one, a weaker one never
// interrupts a stronger one. The final 30 % of the window eases back to 1.0 so there is no snap.
import { Easing } from '../math/Easing.js';

export class HitStop {
  constructor() {
    this.timeScale = 1;
    this.duration = 0;
    this.remaining = 0;
    this.scale = 1;
    this.priority = -1;
    this.easeFraction = 0.3;
  }

  get active() {
    return this.remaining > 0;
  }

  /**
   * @param {number} duration seconds of real time
   * @param {number} scale    time-scale during the freeze (0.02 = near-total stop)
   * @param {number} priority higher wins
   * @returns {boolean} whether the request was accepted
   */
  request(duration, scale = 0.05, priority = 0) {
    if (this.active) {
      if (priority < this.priority) return false;
      if (priority === this.priority && this.remaining >= duration) return false;
    }
    this.duration = duration;
    this.remaining = duration;
    this.scale = scale;
    this.priority = priority;
    this.timeScale = scale;
    return true;
  }

  /** Advance by real (unscaled) seconds and return the time-scale to apply this frame. */
  update(realDt) {
    if (this.remaining <= 0) {
      this.timeScale = 1;
      this.priority = -1;
      return 1;
    }
    this.remaining -= realDt;
    if (this.remaining <= 0) {
      this.remaining = 0;
      this.timeScale = 1;
      this.priority = -1;
      return 1;
    }
    const easeWindow = this.duration * this.easeFraction;
    if (this.remaining < easeWindow) {
      const t = 1 - this.remaining / easeWindow;
      this.timeScale = this.scale + (1 - this.scale) * Easing.easeOutQuad(t);
    } else {
      this.timeScale = this.scale;
    }
    return this.timeScale;
  }

  clear() {
    this.remaining = 0;
    this.timeScale = 1;
    this.priority = -1;
  }
}
