/**
 * TimeScale — global time dilation (hit-stop / slow-mo).
 *
 * The Engine multiplies its delta by `TimeScale.value` every frame.
 * `freeze(value, durationMs)` pins the timescale for a short window, then
 * eases back to 1.0 exponentially. Multiple freezes stack by keeping the
 * strongest (lowest) value until its window expires.
 */
export default class TimeScale {
  constructor() {
    this.value = 1.0;
    this._frozen = 1.0;
    this._frozenUntil = 0; // performance.now() ms
  }

  /** Pin timescale to `value` for `durationMs` (e.g. freeze(0.05, 90)). */
  freeze(value, durationMs) {
    const now = performance.now();
    if (value < this._frozen || now >= this._frozenUntil) {
      this._frozen = value;
      this._frozenUntil = now + durationMs;
    }
    this.value = value;
  }

  /** Set a sustained timescale (slow-mo). Pass 1.0 to clear. */
  set(value) {
    this._frozen = value;
    this._frozenUntil = 0;
    this.value = value;
  }

  update(dt) {
    const now = performance.now();
    if (now < this._frozenUntil) {
      this.value = this._frozen;
    } else if (this.value < 1.0) {
      // Exponential ease back to 1.0 (frame-rate independent).
      this.value += (1.0 - this.value) * (1.0 - Math.exp(-dt * 14.0));
      if (1.0 - this.value < 0.001) this.value = 1.0;
    } else {
      this.value = 1.0;
    }
  }
}
