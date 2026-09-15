/**
 * Hit Stop / Frame Freeze System
 * Implements timescale dilation on heavy impacts for dramatic effect.
 */

export class HitStopManager {
  constructor() {
    this.active = false;
    this.duration = 0.0; // seconds remaining
    this.maxDuration = 0.15; // max frame freeze duration
    this.timescaleBuffer = 1.0; // applied to all game updates
  }

  /**
   * Trigger hit-stop effect based on impact severity
   * @param {number} impactSeverity - 0.0 (minor) to 1.0 (major impact)
   */
  triggerImpact(impactSeverity) {
    this.duration = Math.min(impactSeverity, 1.0) * this.maxDuration;
    this.timescaleBuffer = 0.05; // freeze effect (5% speed)
    this.active = true;
  }

  /**
   * Update hit-stop state and return current timescale factor
   * @param {number} deltaTime - Time since last frame in seconds
   * @returns {number} Timescale multiplier (0.05 when active, 1.0 otherwise)
   */
  update(deltaTime) {
    if (this.active) {
      this.duration -= deltaTime;
      if (this.duration <= 0) {
        this.active = false;
        this.timescaleBuffer = 1.0;
      }
      return this.timescaleBuffer;
    }
    return 1.0;
  }

  /**
   * Reset hit-stop state to default
   */
  reset() {
    this.active = false;
    this.duration = 0.0;
    this.timescaleBuffer = 1.0;
  }

  /**
   * Check if hit-stop is currently active
   * @returns {boolean} True if frame freeze is applied
   */
  isActive() {
    return this.active && this.duration > 0;
  }
}