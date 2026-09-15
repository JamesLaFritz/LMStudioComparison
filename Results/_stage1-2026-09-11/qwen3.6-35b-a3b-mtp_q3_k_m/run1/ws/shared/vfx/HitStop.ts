/**
 * Hit-Stop / Frame-Freeze system for dramatic impact moments.
 * Freezes the game loop's delta time, then smoothly ramps back to normal.
 */
export class HitStop {
  private freezeDuration: number = 0;
  private remainingTime: number = 0;
  private ramping: boolean = false;
  private rampStart: number = 0;
  private rampDuration: number = 0;

  /** Trigger a hit-stop freeze. Returns the current effective timescale (0 during freeze). */
  trigger(duration: number): number {
    this.freezeDuration = duration;
    this.remainingTime = duration;
    this.ramping = false;
    return 0;
  }

  /** Update hit-stop state each frame. Returns the current timescale multiplier (0-1). */
  update(dt: number): number {
    if (this.freezeDuration > 0) {
      // During freeze, dt is effectively zero — don't consume time from it
      this.freezeDuration -= dt;
      if (this.freezeDuration <= 0) {
        this.freezeDuration = 0;
        // Start ramping back to normal timescale
        this.ramping = true;
        this.rampStart = 0;
        this.rampDuration = 0.2; // Ramp over 200ms
      }
      return 0;
    }

    if (this.ramping) {
      this.rampStart += dt;
      const t = Math.min(this.rampStart / this.rampDuration, 1);
      // Smooth ease-out ramp
      const timescale = t * t * (3 - 2 * t); // smoothstep
      if (t >= 1) {
        this.ramping = false;
      }
      return timescale;
    }

    return 1;
  }

  /** Get the current effective delta time considering hit-stop. */
  getEffectiveDt(dt: number): number {
    const timescale = this.update(dt);
    return dt * timescale;
  }

  /** Check if hit-stop is currently active (frozen). */
  get isActive(): boolean {
    return this.freezeDuration > 0 || this.ramping;
  }

  /** Reset to idle state. */
  reset(): void {
    this.freezeDuration = 0;
    this.remainingTime = 0;
    this.ramping = false;
  }
}
