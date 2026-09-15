/**
 * HitStop — global timescale dilation (frame-freeze) manager.
 * A heavy impact drops the world's timescale toward `strength` for `ms`,
 * then eases back to 1.0. Heavier impacts take precedence: a new freeze
 * only overrides the current one if it is stronger, and remaining time is
 * always the max of both so nothing cuts a bigger hit short.
 */
import { clamp } from '../math/MathUtils.js';

export class HitStop {
  constructor() {
    this.timescale = 1;      // consumed by Engine each frame
    this._target = 1;        // where timescale is easing toward
    this._remaining = 0;     // seconds of freeze left at current strength
    this._strength = 1;      // strongest active freeze (for precedence)
    this._easeRate = 9;      // how fast we return to normal time
  }

  /**
   * Freeze the world.
   * @param {number} ms       duration of the heavy hit in milliseconds
   * @param {number} strength timescale floor, e.g. 0.12 for a hard stop
   */
  freeze(ms, strength = 0.15) {
    const s = clamp(strength, 0, 1);
    if (s >= this._strength || this._remaining <= 0) {
      this._strength = Math.max(s, this._strength * 0 + s); // new strongest wins
      this._strength = s;
    } else {
      return; // a stronger freeze is already running — keep it
    }
    this._target = s;
    this._remaining = Math.max(this._remaining, ms / 1000);
  }

  update(dt) {
    if (this._remaining > 0) {
      this._remaining -= dt;
      // Ease toward the frozen state quickly so the hit lands instantly.
      this.timescale += (this._target - this.timescale) * Math.min(1, 30 * dt);
      if (this._remaining <= 0) {
        this._remaining = 0;
        this._strength = 1;
        this._target = 1;
      }
    } else if (this.timescale < 1) {
      // Ease back to full speed.
      this.timescale += (1 - this.timescale) * Math.min(1, this._easeRate * dt);
      if (1 - this.timescale < 0.002) this.timescale = 1;
    } else {
      this.timescale = 1;
    }
  }

  get active() {
    return this._remaining > 0 || this.timescale < 0.999;
  }
}
