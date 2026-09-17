const NOOP = () => {};

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
  return value;
}

function requirePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return value;
}

/**
 * requestAnimationFrame-style scheduler backed fixed-step loop.
 *
 * Callback signatures are deliberately allocation-free:
 * - onFrameStart(realDeltaSeconds, timestampSeconds)
 * - onFixedStep(fixedDeltaSeconds)
 * - onRender(alpha, realDeltaSeconds, fixedSteps)
 * - onDroppedTime(droppedSeconds)
 */
export class FixedStepLoop {
  constructor({
    fixedDelta = 1 / 120,
    maxFrameDelta = 0.25,
    maxSubSteps = 30,
    setAnimationLoop,
    onFrameStart = NOOP,
    onFixedStep = NOOP,
    onRender = NOOP,
    onDroppedTime = NOOP,
  } = {}) {
    if (typeof setAnimationLoop !== 'function') {
      throw new TypeError('setAnimationLoop must be a bound scheduler function');
    }
    for (const [callback, name] of [
      [onFrameStart, 'onFrameStart'],
      [onFixedStep, 'onFixedStep'],
      [onRender, 'onRender'],
      [onDroppedTime, 'onDroppedTime'],
    ]) {
      if (typeof callback !== 'function') {
        throw new TypeError(`${name} must be a function`);
      }
    }

    this.fixedDelta = requirePositiveFinite(fixedDelta, 'fixedDelta');
    this.maxFrameDelta = requirePositiveFinite(maxFrameDelta, 'maxFrameDelta');
    this.maxSubSteps = requirePositiveInteger(maxSubSteps, 'maxSubSteps');

    this._setAnimationLoop = setAnimationLoop;
    this._onFrameStart = onFrameStart;
    this._onFixedStep = onFixedStep;
    this._onRender = onRender;
    this._onDroppedTime = onDroppedTime;

    this._accumulator = 0;
    this._lastTimestampMs = null;
    this._running = false;
    this._suspended = false;
    this._disposed = false;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this._disposed) {
      throw new Error('Cannot start a disposed FixedStepLoop');
    }
    if (this._running) return false;
    this._running = true;
    this.resetClock();
    this._setAnimationLoop(this._tick);
    return true;
  }

  stop() {
    if (!this._running) return false;
    this._running = false;
    this._setAnimationLoop(null);
    this.resetClock();
    return true;
  }

  resetClock() {
    this._lastTimestampMs = null;
    this._accumulator = 0;
  }

  setSuspended(value) {
    const next = Boolean(value);
    if (next === this._suspended) return false;
    this._suspended = next;
    this.resetClock();
    return true;
  }

  dispose() {
    if (this._disposed) return;
    this.stop();
    this._disposed = true;
    this._onFrameStart = NOOP;
    this._onFixedStep = NOOP;
    this._onRender = NOOP;
    this._onDroppedTime = NOOP;
    this._setAnimationLoop = NOOP;
  }

  _tick(timestampMs) {
    if (!this._running || this._disposed) return;

    const safeTimestampMs = Number.isFinite(timestampMs)
      ? timestampMs
      : (this._lastTimestampMs ?? 0);

    if (this._suspended) {
      this._lastTimestampMs = safeTimestampMs;
      this._accumulator = 0;
      return;
    }

    if (this._lastTimestampMs === null) {
      this._lastTimestampMs = safeTimestampMs;
      this._onFrameStart(0, safeTimestampMs / 1000);
      if (!this._running || this._disposed || this._suspended) return;
      this._onRender(0, 0, 0);
      return;
    }

    let rawDelta = (safeTimestampMs - this._lastTimestampMs) / 1000;
    this._lastTimestampMs = safeTimestampMs;
    if (!Number.isFinite(rawDelta) || rawDelta < 0) rawDelta = 0;

    const frameDelta = Math.min(rawDelta, this.maxFrameDelta);
    let dropped = Math.max(0, rawDelta - frameDelta);
    this._onFrameStart(frameDelta, safeTimestampMs / 1000);
    if (!this._running || this._disposed || this._suspended) return;

    this._accumulator += frameDelta;
    let steps = 0;
    const epsilon = this.fixedDelta * 1e-9;
    while (this._accumulator + epsilon >= this.fixedDelta && steps < this.maxSubSteps) {
      this._accumulator -= this.fixedDelta;
      if (this._accumulator < 0 && this._accumulator > -epsilon) this._accumulator = 0;
      steps += 1;
      this._onFixedStep(this.fixedDelta);
      if (!this._running || this._disposed || this._suspended) return;
    }

    if (this._accumulator + epsilon >= this.fixedDelta) {
      const wholeSteps = Math.floor((this._accumulator + epsilon) / this.fixedDelta);
      const saturatedDrop = wholeSteps * this.fixedDelta;
      this._accumulator -= saturatedDrop;
      dropped += saturatedDrop;
    }

    if (dropped > 0) this._onDroppedTime(dropped);
    const alpha = Math.max(0, Math.min(1, this._accumulator / this.fixedDelta));
    this._onRender(alpha, frameDelta, steps);
  }
}
