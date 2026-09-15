import { clamp } from '../utils/math.js';

/**
 * HitStop — timescale dilation for heavy impacts (VFX #3).
 *
 * The world dilates; feedback systems (particles, shake, audio) keep running at
 * full rate because they are updated with real dt by the Engine. Overlapping
 * requests resolve per plan §4.3: strongest scale wins, longest duration retained.
 */
export class HitStop {
  constructor(engine) {
    this._engine = engine;
    this._scale = 1;
    this._remaining = 0; // real-time seconds left at current scale
  }

  /**
   * @param {number} durationMs — how long the dilation lasts (real time).
   * @param {number} scale      — timescale during it (0.12 heavy … 0.3 light).
   */
  trigger(durationMs, scale) {
    const dur = Math.max(0, durationMs / 1000);
    if (dur <= 0) return;

    // A stronger dilation already live? Keep it, just extend its window.
    if (this._remaining > 0 && this._scale < scale) {
      this._remaining = Math.max(this._remaining, dur);
      return;
    }

    this._scale = clamp(scale, 0.05, 1);
    this._engine.timescale = this._scale;
    this._remaining = Math.max(this._remaining, dur);
  }

  /** Call with REAL dt every frame (Engine does this). */
  update(dt) {
    if (this._remaining <= 0) return;
    this._remaining -= dt;
    if (this._remaining <= 0) {
      this._remaining = 0;
      this._scale = 1;
      this._engine.timescale = 1;
    }
  }

  get active() {
    return this._remaining > 0;
  }
}
