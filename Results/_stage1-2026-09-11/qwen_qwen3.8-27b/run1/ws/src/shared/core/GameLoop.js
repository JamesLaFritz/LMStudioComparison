/**
 * GameLoop — fixed-timestep simulation with a global timescale.
 *
 * The simulation advances in fixed 1/120 s steps accumulated from real time,
 * so physics is deterministic and frame-rate independent. `timescale` is the
 * single knob HitStop drives: it dilates *accumulated* time, so every system
 * (physics, particles, trails) slows uniformly while the render loop keeps
 * running — that is what makes hit-stop read as weight rather than stutter.
 */
export class GameLoop {
  constructor({ step = 1 / 120, maxFrame = 0.1 } = {}) {
    this.step = step;
    this.maxFrame = maxFrame;
    this.timescale = 1;
    this.accumulator = 0;
    this.running = false;
    this._raf = 0;
    this._last = 0;
    this._onUpdate = null;
    this._onRender = null;
  }

  start(onUpdate, onRender = null) {
    if (this.running) return;
    this.running = true;
    this._onUpdate = onUpdate;
    this._onRender = onRender;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    this.accumulator = 0;
  }

  setTimescale(t) {
    this.timescale = Math.max(0, Math.min(1, t));
  }

  resetTimescale() {
    this.timescale = 1;
  }

  _tick = (now) => {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);

    let realDt = (now - this._last) / 1000;
    this._last = now;
    if (realDt > this.maxFrame) realDt = this.maxFrame;
    const dt = realDt * this.timescale;

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= this.step && steps < 8) {
      this.accumulator -= this.step;
      if (this._onUpdate) this._onUpdate(this.step);
      steps++;
    }
    // Drop backlog rather than spiral if the tab was backgrounded.
    if (this.accumulator > this.step * 8) this.accumulator = 0;

    // The render callback receives the scaled dt (VFX dilate with hit-stop).
    // Systems that must run in wall-clock time (hit-stop countdown, shake)
    // compute real time themselves from performance.now().
    if (this._onRender) this._onRender(dt);
  };
}
