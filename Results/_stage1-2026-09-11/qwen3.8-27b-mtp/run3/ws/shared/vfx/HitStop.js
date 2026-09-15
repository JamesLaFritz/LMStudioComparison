// shared/vfx/HitStop.js
// Global timescale manager — the single owner of time dilation.
// Timeline: instant drop to target → hold `duration` → smoothstep recovery over 250 ms.
// Arbitration: only one active at a time; a new request wins if it is stronger
// (lower target) or longer than the current pending one.

const RECOVER_TIME = 0.25;

export class HitStop {
  constructor() {
    this.timescale = 1;
    this._target = 1;
    this._hold = 0;          // seconds of hold remaining at target timescale
    this._recoverT = 0;      // recovery progress (seconds) once hold ends
    this._active = false;
  }

  get active() {
    return this._active;
  }

  /**
   * @param {number} targetTimescale e.g. 0.12 for a heavy impact
   * @param {number} duration seconds to hold at the target timescale
   */
  begin(targetTimescale, duration) {
    const strength = -targetTimescale; // more negative = stronger
    if (this._active && this._strength > strength) return; // current one is stronger — keep it
    this._strength = strength;
    this._target = Math.max(0.02, targetTimescale);
    this._hold = Math.max(0, duration);
    this._recoverT = 0;
    this._active = true;
    this.timescale = this._target;
  }

  /** @param {number} dt real (unscaled) seconds */
  update(dt) {
    if (!this._active) { this.timescale = 1; return; }

    if (this._hold > 0) {
      this._hold -= dt;
      this.timescale = this._target;
      if (this._hold <= 0) this._recoverT = 0;
      return;
    }

    // Smoothstep recovery back to 1.
    this._recoverT += dt;
    const t = Math.min(1, this._recoverT / RECOVER_TIME);
    const s = t * t * (3 - 2 * t);
    this.timescale = this._target + (1 - this._target) * s;
    if (t >= 1) {
      this._active = false;
      this.timescale = 1;
    }
  }

  reset() {
    this._active = false;
    this._hold = 0;
    this._recoverT = 0;
    this._target = 1;
    this.timescale = 1;
  }
}
