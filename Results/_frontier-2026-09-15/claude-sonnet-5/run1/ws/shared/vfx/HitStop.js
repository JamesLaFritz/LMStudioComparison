/**
 * Brief timescale dilation on heavy impacts. Call update(rawDt) once per frame
 * at the very top of the loop and use the returned scaled dt for everything else
 * (gameplay, camera shake, particles) so a freeze reads as a unified freeze frame.
 */
export class HitStop {
  constructor() {
    this._remaining = 0;
    this._duration = 0;
    this._timescale = 1;
  }

  /** duration in seconds of real time; timescale in [0,1], 0 = full freeze. */
  trigger(duration, timescale = 0.05) {
    if (duration <= this._remaining) return;
    this._remaining = duration;
    this._duration = duration;
    this._timescale = timescale;
  }

  update(rawDt) {
    if (this._remaining <= 0) {
      return rawDt;
    }
    this._remaining -= rawDt;
    if (this._remaining < 0) {
      const overshoot = -this._remaining;
      this._remaining = 0;
      return overshoot;
    }
    return rawDt * this._timescale;
  }

  get isActive() {
    return this._remaining > 0;
  }

  get progress() {
    if (this._duration <= 0) return 1;
    return 1 - this._remaining / this._duration;
  }
}
