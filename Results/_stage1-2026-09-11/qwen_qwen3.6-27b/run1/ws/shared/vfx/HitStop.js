/**
 * HitStop — frame-freeze / timescale dilation.
 * trigger(ms) sets timescale to 0 for N frames.
 * Concurrent calls extend, never reset.
 */
export class HitStop {
  constructor() {
    this._remainingFrames = 0;
    this._maxFrames = 0;
    this._frameDuration = 1 / 60; // assume 60fps fixed timestep
  }

  /**
   * Trigger a hit-stop for the given duration in milliseconds.
   * Converts ms → frames using the fixed timestep.
   */
  trigger(durationMs) {
    const frames = Math.max(1, Math.ceil(durationMs / (this._frameDuration * 1000)));
    // Extend, never reset
    this._remainingFrames = Math.max(this._remainingFrames, frames);
    this._maxFrames = Math.max(this._maxFrames, frames);
  }

  /**
   * Call once per fixed-timestep update.
   * Returns 0 while frozen, 1 when clear.
   */
  getTimescale() {
    if (this._remainingFrames > 0) {
      this._remainingFrames--;
      return 0;
    }
    return 1;
  }

  get isFrozen() {
    return this._remainingFrames > 0;
  }

  /** Reset state (e.g. on game restart) */
  reset() {
    this._remainingFrames = 0;
    this._maxFrames = 0;
  }
}
