/**
 * GameLoop — Delta-time game loop with hit-stop time scaling and pause state
 */
export class GameLoop {
  constructor() {
    this.timeScale = 1.0;
    this.hitStopRemaining = 0;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulatedTime = 0;
    this.fixedDeltaTime = 1 / 60; // 60Hz fixed update rate
    this.onUpdate = null;
    this.onRender = null;
    this.isRunning = false;
  }

  triggerHitStop(frames) {
    // Convert frames to seconds at 60fps
    this.hitStopRemaining = frames / 60;
    this.timeScale = 0;
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (!this.isPaused) {
      this.lastTime = performance.now();
    }
  }

  isHitStopActive() {
    return this.hitStopRemaining > 0;
  }

  getEffectiveDeltaTime(rawDelta) {
    if (this.isPaused || this.hitStopRemaining > 0) {
      return 0;
    }
    return rawDelta * this.timeScale;
  }

  updateHitStop(deltaTime) {
    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining -= deltaTime;
      if (this.hitStopRemaining <= 0) {
        this.timeScale = 1.0;
        return true; // Hit stop ended
      }
      return false; // Still in hit-stop
    }
    return true;
  }

  start(onUpdate, onRender) {
    if (this.isRunning) return;
    
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.isRunning = true;
    this.lastTime = performance.now();
    
    this.loop();
  }

  stop() {
    this.isRunning = false;
    this.onUpdate = null;
    this.onRender = null;
  }

  loop() {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    let rawDelta = (currentTime - this.lastTime) / 1000; // Convert to seconds
    
    // Cap delta time to prevent spiral of death
    rawDelta = Math.min(rawDelta, 0.25);
    
    this.lastTime = currentTime;

    // Update hit-stop state
    const hitStopEnded = this.updateHitStop(rawDelta);

    if (hitStopEnded) {
      // Process fixed timestep updates
      this.accumulatedTime += rawDelta;
      
      while (this.accumulatedTime >= this.fixedDeltaTime) {
        if (this.onUpdate && !this.isPaused) {
          this.onUpdate(this.fixedDeltaTime);
        }
        this.accumulatedTime -= this.fixedDeltaTime;
      }
    }

    // Render every frame (even during hit-stop for visual freeze effect)
    const effectiveDelta = this.getEffectiveDeltaTime(rawDelta);
    if (this.onRender) {
      this.onRender(effectiveDelta, rawDelta);
    }

    requestAnimationFrame(() => this.loop());
  }
}
