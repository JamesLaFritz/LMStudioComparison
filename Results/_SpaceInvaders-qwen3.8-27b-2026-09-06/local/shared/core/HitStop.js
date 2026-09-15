/**
 * HitStop — global timescale dilation (frame-freeze) on heavy impacts.
 *
 * While active, the engine loop multiplies dt by `timescale` (e.g. 0.15),
 * so the whole world slows for `duration` seconds of *real* time.
 *
 * Usage:
 *   const hitStop = new HitStop();
 *   hitStop.trigger(0.06, 0.15);   // 60ms of real time at 15% speed
 *   const dt = hitStop.scale(rawDt); // pass through the engine loop
 */
export default class HitStop {
  constructor() {
    this.remaining = 0; // real seconds left
    this.timescale = 1;
  }

  trigger(duration, timescale) {
    // Stronger (lower) timescale wins if overlapping.
    if (duration > this.remaining || timescale < this.timescale) {
      this.remaining = Math.max(this.remaining, duration);
      this.timescale = Math.min(this.timescale, timescale);
    }
  }

  get active() {
    return this.remaining > 0;
  }

  /** Returns the effective dt for this frame. */
  scale(rawDt) {
    if (this.remaining <= 0) return rawDt;
    this.remaining -= rawDt;
    if (this.remaining <= 0) {
      this.remaining = 0;
      this.timescale = 1;
      return rawDt;
    }
    return rawDt * this.timescale;
  }
}
