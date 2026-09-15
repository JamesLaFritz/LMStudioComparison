/**
 * Hit-stop / frame-freeze via global timescale dilation.
 *
 * Drives a GameLoop (or any object with setTimescale/resetTimescale).
 * On trigger, timescale drops to `timescale` for `duration` ms of REAL time,
 * then eases back to 1. Because it scales the fixed-timestep accumulator,
 * physics, particles, and trails all dilate uniformly — reads as weight,
 * never stutter.
 */
export class HitStop {
  constructor(loop) {
    this.loop = loop;
    this._remaining = 0;   // real seconds left in the freeze
    this._timescale = 1;
    this._active = false;
  }

  /**
   * @param {number} durationMs real-time duration of the freeze
   * @param {number} timescale  target timescale during freeze (0 = full freeze)
   */
  trigger(durationMs, timescale = 0.05) {
    this._remaining = Math.max(this._remaining, durationMs / 1000);
    this._timescale = Math.min(this._timescale, timescale);
    this._active = true;
    this.loop.setTimescale(timescale);
  }

  get active() { return this._active; }

  /** Call with REAL dt (unscaled). */
  update(realDt) {
    if (!this._active) return;
    this._remaining -= realDt;
    if (this._remaining <= 0) {
      this._active = false;
      this._remaining = 0;
      this._timescale = 1;
      this.loop.resetTimescale();
    }
  }

  reset() {
    this._active = false;
    this._remaining = 0;
    this._timescale = 1;
    this.loop.resetTimescale();
  }
}
