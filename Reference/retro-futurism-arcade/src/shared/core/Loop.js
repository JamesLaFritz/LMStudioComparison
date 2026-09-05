import { Clock } from './Clock.js';

/**
 * Fixed-timestep simulation loop with interpolated rendering.
 *
 * The simulation runs at an exact, unvarying 120Hz. The renderer runs as fast
 * as the display allows and interpolates between the last two simulation
 * states using `alpha`. This is not a stylistic preference — it is a
 * correctness requirement for this project:
 *
 *  - Swept collision assumes a known, constant step length.
 *  - The Space Invaders march accumulator produces identical tempo on a 60Hz
 *    laptop and a 240Hz desktop only if the step is fixed.
 *  - Variable-dt integration of the player's damped velocity would make the
 *    ship's handling subtly different on every machine.
 *
 * The spiral-of-death guard is essential: if a frame's delta implies more
 * fixed steps than `maxStepsPerFrame`, the surplus is *discarded* rather than
 * queued. Queuing it means the next frame is even later, which queues more
 * steps, and the tab locks. Dropping simulation time is the only stable
 * response to a machine that genuinely cannot keep up.
 */
export class Loop {
  /**
   * @param {object} opts
   * @param {number}  [opts.fixedDt]           simulation step in seconds
   * @param {number}  [opts.maxDelta]          frame-time clamp in seconds
   * @param {number}  [opts.maxStepsPerFrame]  spiral-of-death guard
   * @param {() => number} [opts.timeScale]    supplies the current dilation
   * @param {(dt:number) => void} opts.fixedUpdate
   * @param {(unscaledDt:number, scaledDt:number, alpha:number) => void} opts.update
   * @param {() => void} [opts.onStall]        invoked when steps are discarded
   */
  constructor({
    fixedDt = 1 / 120,
    maxDelta = 0.05,
    maxStepsPerFrame = 8,
    timeScale = () => 1,
    fixedUpdate,
    update,
    onStall = null
  }) {
    if (typeof fixedUpdate !== 'function' || typeof update !== 'function') {
      throw new TypeError('Loop requires both fixedUpdate and update callbacks.');
    }

    this.fixedDt = fixedDt;
    this.maxStepsPerFrame = maxStepsPerFrame;
    this.timeScaleFn = timeScale;
    this.fixedUpdate = fixedUpdate;
    this.update = update;
    this.onStall = onStall;

    this.clock = new Clock(maxDelta);
    this.accumulator = 0;
    this.rafId = 0;
    this.running = false;
    this.paused = false;

    /** Total fixed steps executed. Useful for deterministic replays and tests. */
    this.stepCount = 0;
    /** Fixed steps executed in the most recent frame. Shown in the debug panel. */
    this.stepsLastFrame = 0;

    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.accumulator = 0;
    this.clock.start();
    this.rafId = requestAnimationFrame(this._frame);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.clock.stop();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  /**
   * Pause the simulation while keeping the render loop alive, so pause menus
   * still animate and the scene stays composited. The accumulator is cleared on
   * resume so no simulation time is owed for the paused interval.
   */
  setPaused(paused) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (!paused) {
      this.accumulator = 0;
      this.clock.start();
    }
  }

  _frame(now) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._frame);

    const scale = this.paused ? 0 : this.timeScaleFn();
    this.clock.tick(now, scale);

    const { unscaledDt, scaledDt } = this.clock;

    this.accumulator += scaledDt;
    this.stepsLastFrame = 0;

    while (this.accumulator >= this.fixedDt) {
      if (this.stepsLastFrame >= this.maxStepsPerFrame) {
        // Discard the backlog. See class comment.
        this.accumulator = 0;
        if (this.onStall) this.onStall(this.stepsLastFrame);
        break;
      }
      this.fixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
      this.stepsLastFrame++;
      this.stepCount++;
    }

    const alpha = this.fixedDt > 0 ? this.accumulator / this.fixedDt : 0;
    this.update(unscaledDt, scaledDt, alpha);
  }
}
