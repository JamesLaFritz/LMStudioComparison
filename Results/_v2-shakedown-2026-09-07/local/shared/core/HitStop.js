/**
 * Hit-stop / frame-freeze: brief timescale dilation on heavy impacts.
 *
 * Exclusive, not additive: `trigger()` replaces any active stop with the
 * stronger one (lower scale = stronger freeze). `Engine` multiplies the
 * frame dt by `scale` while a stop is active.
 */
export class HitStop {
  constructor() {
    this.scale = 1;
    this._remaining = 0;
    this._activeScale = 1;
  }

  get active() {
    return this._remaining > 0;
  }

  /**
   * @param {number} duration seconds of dilation
   * @param {number} scale    timescale during dilation (0.04..0.3 typical)
   */
  trigger(duration, scale) {
    if (this._remaining <= 0 || scale < this._activeScale) {
      this._remaining = Math.max(this._remaining, duration);
      this._activeScale = scale;
    }
  }

  /** Advance on REAL time. Returns the current timescale to apply to dt. */
  update(realDt) {
    if (this._remaining > 0) {
      this._remaining -= realDt;
      if (this._remaining <= 0) {
        this._remaining = 0;
        this._activeScale = 1;
      }
    }
    this.scale = this._remaining > 0 ? this._activeScale : 1;
    return this.scale;
  }

  dispose() {
    this._remaining = 0;
    this._activeScale = 1;
    this.scale = 1;
  }
}
