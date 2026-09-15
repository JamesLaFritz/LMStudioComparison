// ============================================================
// core/gameLoop.js — Main game loop orchestration
// ============================================================
import { useEffect, useState } from 'react'; // Not used here, this is vanilla JS

/**
 * Game Loop Manager
 * Orchestrates the main update → render cycle with proper delta-time handling.
 * Supports hit-stop timescale manipulation and camera shake integration.
 */

class GameLoop {
  constructor() {
    this.running = false;
    this.lastTime = 0;
    this.gameTime = 0;
    this.timescale = 1.0; // For hit-stop / frame-dilation
    this.shake = null;     // Camera shake reference
    this.onUpdate = null;  // Callback for game logic updates
    this.onRender = null; // Callback for rendering (Three.js scene)
    this.animationId = null;
  }

  /**
   * Start the game loop.
   */
  start() {
    if (this.running) return;
    this.lastTime = performance.now();
    this.gameTime = 0;
    this.timescale = 1.0;
    this.running = true;
    this._loop(this.lastTime);
  }

  /**
   * Stop the game loop and clean up.
   */
  stop() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.running = false;
    this.gameTime = 0;
    this.timescale = 1.0;
    this.onUpdate = null;
    this.onRender = null;
  }

  /**
   * Main loop function called every frame.
   */
  _loop(timestamp) {
    if (!this.running) return;

    // Calculate delta time in seconds
    const deltaTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Clamp delta to prevent huge jumps (e.g., tab switch)
    const safeDt = Math.min(deltaTime, 0.05);

    // Apply hit-stop timescale
    const effectiveDt = safeDt * this.timescale;

    // Accumulate game time
    this.gameTime += effectiveDt;

    // Update camera shake if active
    let shakeOffset = { x: 0, y: 0 };
    if (this.shake) {
      shakeOffset = this.shake.update(effectiveDt);
    }

    // Call game logic update
    if (typeof this.onUpdate === 'function') {
      this.onUpdate(effectiveDt, shakeOffset);
    }

    // Call render callback with camera offset for shake
    if (typeof this.onRender === 'function') {
      this.onRender(shakeOffset);
    }

    // Schedule next frame
    this.animationId = requestAnimationFrame((ts) => this._loop(ts));
  }

  /**
   * Set the hit-stop timescale (for frame-dilation effects).
   * @param {number} timescale - The desired timescale (0.1 for freeze, 1.0 for normal)
   */
  setTimescale(timescale) {
    this.timescale = Math.max(0.05, timescale);
  }

  /**
   * Reset the hit-stop timescale to normal.
   */
  resetTimescale() {
    this.timescale = 1.0;
  }

  /**
   * Get current effective delta time (for external use).
   */
  getEffectiveDt() {
    return this.timescale;
  }
}

export default GameLoop;
