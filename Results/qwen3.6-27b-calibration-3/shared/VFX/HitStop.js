/**
 * HitStop — Global timescale dilation manager.
 * Freezes or slows time briefly on heavy impacts for dramatic effect.
 */

export class HitStop {
  constructor() {
    this.timescale = 1.0;
    this.active = false;
    this.duration = 0;
    this.elapsed = 0;
    this.targetScale = 0;
    this.startScale = 1.0;
    this._callbacks = [];
  }

  /**
   * Trigger a hit-stop event.
   * @param {number} duration - How long to freeze/slow (seconds).
   * @param {number} [minScale=0] - Minimum timescale (0 = full freeze, 0.2 = slow-mo).
   */
  trigger(duration, minScale = 0) {
    this.active = true;
    this.duration = duration;
    this.elapsed = 0;
    this.startScale = this.timescale;
    this.targetScale = minScale;
    this.timescale = minScale;
  }

  /**
   * Update hit-stop state each frame.
   * @param {number} dt - Raw delta time (unscaled).
   */
  update(dt) {
    if (!this.active) {
      this.timescale = 1.0;
      return 0;
    }

    this.elapsed += dt;

    if (this.elapsed >= this.duration) {
      // Ramp back to normal
      const progress = Math.min((this.elapsed - (this.duration * 0.7)) / (this.duration * 0.3), 1.0);
      this.timescale = this.targetScale + (1.0 - this.targetScale) * this._easeOutCubic(progress);

      if (progress >= 1.0) {
        this.active = false;
        this.timescale = 1.0;
      }
    } else {
      // Stay at target scale during freeze portion
      this.timescale = this.targetScale;
    }

    return this.timescale;
  }

  /**
   * Get the scaled delta time for game logic.
   * @param {number} rawDt - Unscaled delta time.
   * @returns {number} Scaled delta time.
   */
  getScaledDt(rawDt) {
    return rawDt * this.timescale;
  }

  /**
   * Check if currently in hit-stop state.
   * @returns {boolean}
   */
  isActive() {
    return this.active;
  }

  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
}
