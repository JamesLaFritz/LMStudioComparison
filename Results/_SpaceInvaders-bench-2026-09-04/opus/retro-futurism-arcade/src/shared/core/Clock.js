/**
 * Dual-timeline clock.
 *
 * Every title in this arcade runs two timelines simultaneously:
 *
 *  - **scaled** — dilated by hit-stop. Gameplay, particles and world animation
 *    live here, so a freeze frame actually freezes the world.
 *  - **unscaled** — real wall-clock time. Camera shake, UI, and the performance
 *    governor live here. This split is what makes hit-stop feel violent instead
 *    of broken: during a 60ms freeze the world stops dead while the camera
 *    keeps convulsing.
 *
 * The delta is clamped. Returning from a background tab produces a single
 * multi-second delta; feeding that into an accumulator would run tens of
 * thousands of fixed steps in one frame and lock the tab. The clamp turns a
 * hang into a barely perceptible skip.
 */
export class Clock {
  /**
   * @param {number} maxDelta largest delta in seconds that will ever be reported
   */
  constructor(maxDelta = 0.05) {
    this.maxDelta = maxDelta;
    this.lastTime = 0;
    this.running = false;

    /** Wall-clock seconds since start, ignoring time dilation. */
    this.elapsedUnscaled = 0;
    /** Gameplay seconds since start, including time dilation. */
    this.elapsedScaled = 0;

    this.unscaledDt = 0;
    this.scaledDt = 0;
    this.timeScale = 1;
    /** True on any frame where the raw delta had to be clamped. */
    this.didClamp = false;
  }

  /** Begin (or resume) timing from now. */
  start(now = performance.now()) {
    this.lastTime = now;
    this.running = true;
    this.didClamp = false;
  }

  /** Stop timing. The next `start` will not accrue the paused interval. */
  stop() {
    this.running = false;
  }

  /**
   * Advance the clock.
   * @param {number} now high-resolution timestamp in milliseconds
   * @param {number} timeScale current dilation factor (1 = normal)
   */
  tick(now, timeScale = 1) {
    if (!this.running) {
      this.start(now);
      this.unscaledDt = 0;
      this.scaledDt = 0;
      return this;
    }

    let dt = (now - this.lastTime) * 0.001;
    this.lastTime = now;

    // Guard against a non-monotonic or identical timestamp.
    if (!Number.isFinite(dt) || dt < 0) dt = 0;

    this.didClamp = dt > this.maxDelta;
    if (this.didClamp) dt = this.maxDelta;

    this.timeScale = timeScale;
    this.unscaledDt = dt;
    this.scaledDt = dt * timeScale;
    this.elapsedUnscaled += this.unscaledDt;
    this.elapsedScaled += this.scaledDt;

    return this;
  }

  /** Reset both timelines to zero without changing the running state. */
  reset() {
    this.elapsedUnscaled = 0;
    this.elapsedScaled = 0;
    this.unscaledDt = 0;
    this.scaledDt = 0;
    this.didClamp = false;
  }
}
