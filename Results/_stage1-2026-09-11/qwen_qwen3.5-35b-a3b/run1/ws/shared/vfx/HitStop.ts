/**
 * HitStop System - Frame freeze on heavy impacts
 * Part of AAA Retro-Futurism VFX suite for Space Invaders
 */

export class HitStop {
  private active: boolean = false;
  private duration: number = 0; // Remaining time in seconds
  private maxDuration: number = 0.2; // Maximum freeze duration (200ms)
  private accumulatedTime: number = 0;

  /**
   * Activate hit-stop with specified duration
   * @param duration Duration of freeze in seconds (0.1-0.3 recommended)
   */
  activate(duration: number = 0.15): void {
    this.duration = Math.min(Math.max(duration, 0.05), this.maxDuration);
    this.active = true;
    this.accumulatedTime = 0;
  }

  /**
   * Deactivate hit-stop immediately
   */
  deactivate(): void {
    this.active = false;
    this.duration = 0;
    this.accumulatedTime = 0;
  }

  /**
   * Check if hit-stop is currently active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Update hit-stop timer and calculate timescale factor
   * @param delta Delta time in seconds since last frame
   * @returns Timescale multiplier (0.0 during freeze, 1.0 otherwise)
   */
  update(delta: number): number {
    if (!this.active) {
      return 1.0;
    }

    this.accumulatedTime += delta;

    if (this.accumulatedTime >= this.duration) {
      this.deactivate();
      return 1.0;
    }

    // During hit-stop, timescale is effectively 0
    // But we return a small value to allow minimal updates for UI
    const progress = this.accumulatedTime / this.duration;
    const remaining = 1.0 - progress;
    
    // Exponential decay: freeze harder at start, ease out
    return Math.pow(remaining, 3);
  }

  /**
   * Get current timescale value for game loop integration
   */
  getTimescale(): number {
    if (!this.active) return 1.0;
    
    const progress = this.accumulatedTime / this.duration;
    return Math.pow(1.0 - progress, 3);
  }

  /**
   * Reset all state (useful for cleanup or restart)
   */
  reset(): void {
    this.deactivate();
  }
}

// Singleton instance for global access
export const hitStopSystem = new HitStop();