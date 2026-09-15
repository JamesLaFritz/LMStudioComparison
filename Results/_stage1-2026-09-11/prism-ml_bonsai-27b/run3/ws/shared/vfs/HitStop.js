/**
 * HitStop - Freezes the game for a brief moment on impact.
 * Creates a satisfying "weight" feel when objects collide.
 */

class HitStop {
  constructor() {
    this.active = false;
    this.duration = 0;
    this.elapsed = 0;
  }

  /**
   * Trigger hit-stop for the given duration in seconds.
   */
  trigger(duration) {
    if (this.duration < duration) {
      this.duration = duration;
      this.active = true;
      this.elapsed = 0;
    }
  }

  /**
   * Update hit-stop state for one frame.
   * Returns true if still active, false when complete.
   */
  update(deltaTime) {
    if (!this.active) return false;

    this.elapsed += deltaTime;

    if (this.elapsed >= this.duration) {
      this.reset();
    }

    return true;
  }

  /**
   * Reset hit-stop to inactive state.
   */
  reset() {
    this.active = false;
    this.duration = 0;
    this.elapsed = 0;
  }
}

export default HitStop;