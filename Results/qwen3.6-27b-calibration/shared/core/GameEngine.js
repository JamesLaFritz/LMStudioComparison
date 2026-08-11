/**
 * GameEngine — Main loop, delta time, hit-stop, pause state.
 * Shared across all games.
 */

export class GameEngine {
  constructor() {
    this.running = false;
    this.paused = false;
    this.timescale = 1.0;
    this.hitStopTimer = 0;
    this.hitStopDuration = 0;
    this.lastTime = 0;
    this.accumulator = 0;
    this.fixedDt = 1 / 60;
    this.dt = 0;
    this.realDt = 0;
    this.frameCount = 0;
    this.onUpdate = null;
    this.onFixedUpdate = null;
    this.onRender = null;
  }

  /**
   * Trigger a hit-stop (frame freeze) for the given duration in seconds.
   */
  hitStop(duration) {
    this.hitStopDuration = duration;
    this.hitStopTimer = duration;
    this.timescale = 0;
  }

  /**
   * Start the game loop.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this._loop();
  }

  /**
   * Stop the game loop.
   */
  stop() {
    this.running = false;
  }

  /**
   * Toggle pause.
   */
  togglePause() {
    this.paused = !this.paused;
  }

  _loop() {
    if (!this.running) return;

    const now = performance.now();
    this.realDt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // Hit-stop logic
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= this.realDt;
      this.timescale = 0;
      if (this.hitStopTimer <= 0) {
        this.hitStopTimer = 0;
        this.timescale = 1.0;
      }
      // Still render during hit-stop but don't update game logic
      if (this.onRender) this.onRender(this.realDt);
      requestAnimationFrame(() => this._loop());
      return;
    }

    if (this.paused) {
      if (this.onRender) this.onRender(this.realDt);
      requestAnimationFrame(() => this._loop());
      return;
    }

    this.dt = this.realDt * this.timescale;
    this.accumulator += this.dt;
    this.frameCount++;

    // Fixed timestep updates
    while (this.accumulator >= this.fixedDt) {
      if (this.onFixedUpdate) this.onFixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    // Variable timestep updates
    if (this.onUpdate) this.onUpdate(this.dt);

    // Render
    if (this.onRender) this.onRender(this.realDt);

    requestAnimationFrame(() => this._loop());
  }
}
