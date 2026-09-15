/**
 * Core game loop with fixed timestep, delta time management, and hit-stop integration.
 */
export class GameEngine {
  constructor(options = {}) {
    this._fixedDt = options.fixedDt || (1 / 60);
    this._accumulator = 0;
    this._lastTime = 0;
    this._hitStop = null;
    this._running = false;
    this._rafId = null;

    // Callbacks
    this._onUpdate = options.onUpdate || (() => {});
    this._onRender = options.onRender || (() => {});
    this._onDispose = options.onDispose || (() => {});
  }

  setHitStop(hitStop) {
    this._hitStop = hitStop;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._accumulator = 0;
    this._loop(this._lastTime);
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _loop(timestamp) {
    if (!this._running) return;

    const frameDt = Math.min((timestamp - this._lastTime) / 1000, 0.25);
    this._lastTime = timestamp;

    // Apply hit-stop timescale dilation
    let effectiveDt = frameDt;
    if (this._hitStop && this._hitStop.isActive()) {
      const scale = this._hitStop.getTimescale();
      effectiveDt = frameDt * scale;
    }

    this._accumulator += effectiveDt;

    // Fixed timestep updates
    let steps = 0;
    while (this._accumulator >= this._fixedDt && steps < 5) {
      const dt = this._fixedDt;
      this._onUpdate(dt);
      this._accumulator -= this._fixedDt;
      steps++;

      // Advance hit-stop timer
      if (this._hitStop) {
        this._hitStop.update(dt);
      }
    }

    // Prevent spiral of death
    if (this._accumulator > this._fixedDt * 5) {
      this._accumulator = 0;
    }

    // Render with interpolation factor
    const renderDt = effectiveDt;
    const alpha = this._accumulator / this._fixedDt;
    this._onRender(alpha, renderDt);

    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }

  dispose() {
    this.stop();
    this._onDispose();
  }
}
