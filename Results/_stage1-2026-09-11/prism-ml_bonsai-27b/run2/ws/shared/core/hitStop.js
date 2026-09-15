/**
 * HitStop — Frame-dilation system for impact effects.
 * When triggered, the game loop runs at a reduced timescale (freeze)
 * then smoothly returns to normal speed over the duration.
 */

class HitStop {
  constructor() {
    this.active = false;
    this.remainingTime = 0; // seconds remaining in freeze
    this.timescale = 1.0;   // current rendering timescale (0-1)
    this.targetTimescale = 1.0;
  }

  /**
   * Trigger a hit-stop effect.
   * @param {number} durationMs - Duration of the freeze in milliseconds
   */
  trigger(durationMs) {
    if (this.active) return; // Already active, ignore overlapping triggers
    this.active = true;
    this.remainingTime = durationMs / 1000.0;
    this.timescale = 0.05; // Freeze at 5% speed for dramatic effect
    this.targetTimescale = 1.0;
  }

  /**
   * Update hit-stop state and return current timescale.
   * @param {number} dt - Delta time in seconds
   * @returns {number} Current timescale (0-1)
   */
  update(dt) {
    if (!this.active) {
      this.timescale = 1.0;
      return this.timescale;
    }

    // Reduce remaining time based on current timescale
    const effectiveDt = dt * this.timescale;
    this.remainingTime -= effectiveDt;

    if (this.remainingTime <= 0) {
      // Freeze complete — restore normal speed
      this.active = false;
      this.timescale = 1.0;
    } else {
      // Smoothly ramp out of freeze
      const progress = 1.0 - (this.remainingTime / (this.remainingTime + 0.2)); // Ease out over 0.2s extra
      this.timescale = 0.05 + progress * 0.95;
    }

    return this.timescale;
  }

  /**
   * Get current freeze state for UI display (e.g., overlay).
   */
  getFreezeProgress() {
    if (!this.active) return 0;
    const totalDuration = this.remainingTime + 0.2; // Include ramp-out time
    return Math.max(0, (totalDuration - this.remainingTime) / totalDuration);
  }

  /**
   * Reset hit-stop state.
   */
  reset() {
    this.active = false;
    this.remainingTime = 0;
    this.timescale = 1.0;
    this.targetTimescale = 1.0;
  }
}

export default HitStop;