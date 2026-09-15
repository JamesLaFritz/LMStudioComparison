/**
 * Hit-Stop / Frame Freeze System
 * 
 * Implements timescale dilation on heavy impacts for "juice" effect.
 * - Triggers a complete freeze (timescale = 0) for N frames based on impact severity
 * - Ramps back to normal speed over configurable duration
 */

export class HitStop {
  constructor(options = {}) {
    this.framesRemaining = 0;
    this.rampFrame = 0;
    
    // Configuration
    this.baseFramesPerSeverity = options.baseFramesPerSeverity || 3;
    this.maxFreezeFrames = options.maxFreezeFrames || 8;
    this.rampDuration = options.rampDuration || 8;
    
    // State
    this.isFrozen = false;
    this.isRamping = false;
  }

  /**
   * Trigger hit-stop effect based on impact severity.
   * @param {number} severity - Impact magnitude (higher = longer freeze)
   */
  trigger(severity) {
    const baseFrames = Math.floor(severity * this.baseFramesPerSeverity);
    this.framesRemaining = Math.min(baseFrames, this.maxFreezeFrames);
    this.isFrozen = true;
    this.isRamping = false;
    this.rampFrame = 0;
    
    return this.framesRemaining;
  }

  /**
   * Get current time scale multiplier for game loop.
   * Returns 0 during freeze, ramps from 0 to 1 during recovery, returns 1 when normal.
   * @returns {number} Time scale factor (0 to 1)
   */
  getTimeScale() {
    if (this.framesRemaining > 0) {
      this.framesRemaining--;
      
      // Check if we just exited freeze
      if (this.framesRemaining === 0) {
        this.isFrozen = false;
        this.isRamping = true;
        this.rampFrame = 0;
      }
      
      return 0; // Complete freeze
    }

    if (this.isRamping && this.rampFrame < this.rampDuration) {
      this.rampFrame++;
      const progress = this.rampFrame / this.rampDuration;
      
      // Ease out cubic for smooth ramp
      return 1 - Math.pow(1 - progress, 3);
    }

    return 1.0;
  }

  /**
   * Check if currently in frozen state.
   * @returns {boolean} True if time is stopped
   */
  isFrozenNow() {
    return this.isFrozen;
  }

  /**
   * Reset hit-stop system to normal state immediately.
   * Use when transitioning between game states.
   */
  reset() {
    this.framesRemaining = 0;
    this.rampFrame = this.rampDuration; // Skip ramp
    this.isFrozen = false;
    this.isRamping = false;
  }

  /**
   * Get current state for debugging.
   * @returns {object} Current hit-stop state
   */
  getState() {
    return {
      framesRemaining: this.framesRemaining,
      rampFrame: this.rampFrame,
      isFrozen: this.isFrozen,
      isRamping: this.isRamping,
      timeScale: this.getTimeScale()
    };
  }
}

/**
 * HitStopController - Manages hit-stop with visual feedback hooks.
 * Extends HitStop to allow callbacks on state changes.
 */
export class HitStopController extends HitStop {
  constructor(options = {}) {
    super(options);
    
    // Callbacks for external systems
    this.onFreezeStart = options.onFreezeStart || (() => {});
    this.onFreezeEnd = options.onFreezeEnd || (() => {});
    this.onRampComplete = options.onRampComplete || (() => {});
    
    this.lastState = 'normal';
  }

  getTimeScale() {
    const previousFrozen = this.isFrozen;
    const previousRamping = this.isRamping;
    
    const scale = super.getTimeScale();
    
    // State change detection
    if (this.isFrozen && !previousFrozen) {
      this.onFreezeStart(this.framesRemaining);
    }
    
    if (!this.isFrozen && previousFrozen) {
      this.onFreezeEnd();
    }
    
    if (!this.isRamping && previousRamping) {
      this.onRampComplete();
    }
    
    return scale;
  }

  /**
   * Trigger with visual feedback.
   * @param {number} severity - Impact magnitude
   * @param {object} context - Optional context for callbacks
   */
  triggerWithFeedback(severity, context = {}) {
    const frames = this.trigger(severity);
    
    // Allow external systems to react immediately
    if (this.onFreezeStart) {
      this.onFreezeStart(frames, context);
    }
    
    return frames;
  }
}
