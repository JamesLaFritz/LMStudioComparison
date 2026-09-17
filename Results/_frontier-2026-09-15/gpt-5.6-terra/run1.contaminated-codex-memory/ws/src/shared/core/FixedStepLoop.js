const DEFAULT_FIXED_DELTA = 1 / 120;

/**
 * Keeps deterministic simulation cadence separate from variable-rate rendering.
 * Step receives fixedDelta; render receives interpolation alpha and real frame
 * delta. Game code may call advance() in tests without a browser.
 */
export class FixedStepLoop {
  constructor({
    step,
    render = () => {},
    fixedDelta = DEFAULT_FIXED_DELTA,
    maxFrameDelta = 0.25,
    maxSteps = 8,
    onSpiral = () => {},
  }) {
    if (typeof step !== 'function') throw new TypeError('FixedStepLoop requires a step callback.');
    this.step = step;
    this.render = render;
    this.fixedDelta = fixedDelta;
    this.maxFrameDelta = maxFrameDelta;
    this.maxSteps = maxSteps;
    this.onSpiral = onSpiral;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.paused = false;
    this.frameHandle = 0;
    this.fixedSteps = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = nowSeconds();
    this.frameHandle = requestFrame(this._tick);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    cancelFrame(this.frameHandle);
    this.frameHandle = 0;
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
  }

  reset() {
    this.accumulator = 0;
    this.lastTime = nowSeconds();
    this.fixedSteps = 0;
  }

  advance(realDelta) {
    const frameDelta = Math.min(Math.max(0, Number(realDelta) || 0), this.maxFrameDelta);
    if (!this.paused) this.accumulator += frameDelta;

    let steps = 0;
    while (!this.paused && this.accumulator >= this.fixedDelta && steps < this.maxSteps) {
      this.step(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
      this.fixedSteps += 1;
      steps += 1;
    }

    if (this.accumulator >= this.fixedDelta) {
      // Discard stale time rather than causing an unrecoverable simulation spiral.
      this.accumulator %= this.fixedDelta;
      this.onSpiral({ frameDelta, maxSteps: this.maxSteps });
    }

    const alpha = this.paused ? 0 : this.accumulator / this.fixedDelta;
    this.render(alpha, frameDelta);
    return { alpha, frameDelta, steps };
  }

  _tick(timestampMilliseconds) {
    if (!this.running) return;
    const current = timestampMilliseconds / 1000;
    const frameDelta = Math.min(Math.max(0, current - this.lastTime), this.maxFrameDelta);
    this.lastTime = current;
    this.advance(frameDelta);
    this.frameHandle = requestFrame(this._tick);
  }
}

function nowSeconds() {
  return typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000;
}

function requestFrame(callback) {
  return typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(callback)
    : globalThis.setTimeout(() => callback(Date.now()), 16);
}

function cancelFrame(handle) {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
  else globalThis.clearTimeout(handle);
}

export const FIXED_DELTA = DEFAULT_FIXED_DELTA;
