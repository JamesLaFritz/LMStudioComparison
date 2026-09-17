import { clamp } from "./math.js";
export class GameLoop {
  constructor(options) {
    Object.assign(this, options);
    this.fixedDt ??= 1 / 120;
    this.maxSteps ??= 8;
    this.running = false;
    this.last = null;
    this.accumulator = 0;
    this.raf = 0;
    this.stats = { frames: 0, steps: 0, droppedTime: 0, frameMs: 16.67 };
    this.tick = this.tick.bind(this);
  }
  start() {
    if (!this.running) {
      this.running = true;
      this.last = null;
      this.raf = requestAnimationFrame(this.tick);
    }
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.resetTime();
  }
  resetTime() {
    this.accumulator = 0;
    this.last = null;
  }
  tick(now) {
    if (!this.running) return;
    const dt = this.last === null ? 0 : clamp((now - this.last) / 1000, 0, 0.1);
    this.last = now;
    this.beforeFrame(dt);
    this.accumulator += this.getSimulationDelta(dt);
    let steps = 0,
      simulated = 0,
      frozen = false;
    while (this.accumulator + 1e-10 >= this.fixedDt && steps < this.maxSteps) {
      this.fixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
      simulated += this.fixedDt;
      if (this.shouldHaltSteps()) {
        this.accumulator = 0;
        frozen = true;
        break;
      }
    }
    if (this.accumulator >= this.fixedDt) {
      const debt = this.accumulator - (this.accumulator % this.fixedDt);
      this.stats.droppedTime += debt;
      this.accumulator %= this.fixedDt;
    }
    this.stats.frames++;
    this.stats.steps += steps;
    if (dt) this.stats.frameMs += (dt * 1000 - this.stats.frameMs) * 0.03;
    this.render(
      frozen || this.shouldHaltSteps()
        ? 1
        : clamp(this.accumulator / this.fixedDt, 0, 1),
      dt,
      simulated,
    );
    this.raf = requestAnimationFrame(this.tick);
  }
  dispose() {
    this.stop();
  }
}
