export class FixedStepLoop {
  constructor({
    step = 1 / 120,
    maxDelta = 0.1,
    maxSteps = 12,
    onUpdate = () => {},
    onRender = () => {},
    onDrop = () => {},
  } = {}) {
    this.step = step;
    this.maxDelta = maxDelta;
    this.maxSteps = maxSteps;
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.onDrop = onDrop;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.paused = false;
    this.frameHandle = 0;
    this._boundFrame = (time) => this._frame(time);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0;
    this.frameHandle = requestAnimationFrame(this._boundFrame);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    this.lastTime = 0;
    this.accumulator = 0;
  }

  setPaused(paused) {
    if (this.paused === paused) return;
    this.paused = paused;
    this.accumulator = 0;
    this.lastTime = 0;
  }

  _frame(nowMs) {
    if (!this.running) return;

    const now = nowMs * 0.001;
    const rawDelta = this.lastTime === 0 ? 0 : now - this.lastTime;
    const frameDelta = Math.min(Math.max(rawDelta, 0), this.maxDelta);
    this.lastTime = now;

    let steps = 0;
    if (!this.paused) {
      this.accumulator += frameDelta;
      while (this.accumulator >= this.step && steps < this.maxSteps) {
        this.onUpdate(this.step);
        this.accumulator -= this.step;
        steps += 1;
      }

      if (this.accumulator >= this.step) {
        const dropped = this.accumulator - (this.accumulator % this.step);
        this.accumulator %= this.step;
        this.onDrop(dropped);
      }
    }

    const alpha = this.paused ? 0 : this.accumulator / this.step;
    this.onRender(alpha, frameDelta, now);
    this.frameHandle = requestAnimationFrame(this._boundFrame);
  }

  dispose() {
    this.stop();
    this.onUpdate = () => {};
    this.onRender = () => {};
    this.onDrop = () => {};
  }
}
