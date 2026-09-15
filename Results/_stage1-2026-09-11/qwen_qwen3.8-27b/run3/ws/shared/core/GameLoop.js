/**
 * GameLoop — fixed-timestep update loop with a global timescale (hit-stop).
 *
 * - Fixed step of 1/60 s; the accumulator is clamped so a background tab
 *   returning to the foreground cannot produce a spiral of death.
 * - `timescale` multiplies the simulated delta: 1 = normal, 0 = frozen.
 *   Hit-stop is implemented as a timed timescale dip (see setTimescale).
 * - `update(dt)` receives the *simulated* delta (already scaled).
 */
export default class GameLoop {
  constructor({ step = 1 / 60, maxSubSteps = 5, update = null } = {}) {
    this.step = step;
    this.maxSubSteps = maxSubSteps;
    this.update = update;

    this.running = false;
    this.paused = false;
    this.timescale = 1;

    this._accumulator = 0;
    this._lastTime = 0;
    this._rafId = 0;
    this._restoreAt = 0; // performance.now() timestamp when hit-stop ends
    this._restoreScale = 1;

    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this._accumulator = 0;
    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this._accumulator = 0;
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this._lastTime = performance.now();
    this._accumulator = 0;
  }

  /**
   * Dip the timescale for `durationMs` (hit-stop / frame-freeze).
   * A stronger (lower) timescale preempts an active one; the strongest
   * active dip is always the one honored.
   */
  setTimescale(scale, durationMs) {
    if (durationMs <= 0) {
      this.timescale = 1;
      this._restoreAt = 0;
      return;
    }
    const now = performance.now();
    const active = now < this._restoreAt;
    if (!active || scale < this.timescale) {
      this.timescale = scale;
      this._restoreAt = now + durationMs;
      this._restoreScale = 1;
    }
  }

  get isHitStopped() {
    return performance.now() < this._restoreAt;
  }

  _tick(now) {
    if (!this.running) return;
    this._rafId = requestAnimationFrame(this._tick);

    if (this.paused) {
      this._lastTime = now;
      return;
    }

    // Resolve any expired hit-stop.
    if (this._restoreAt && now >= this._restoreAt) {
      this.timescale = this._restoreScale;
      this._restoreAt = 0;
    }

    let frameDt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    if (frameDt > 0.25) frameDt = 0.25; // tab was hidden — clamp

    this._accumulator += frameDt * this.timescale;

    let steps = 0;
    while (this._accumulator >= this.step && steps < this.maxSubSteps) {
      if (this.update) this.update(this.step);
      this._accumulator -= this.step;
      steps++;
    }
    if (steps === this.maxSubSteps) this._accumulator = 0; // drop the backlog
  }
}
