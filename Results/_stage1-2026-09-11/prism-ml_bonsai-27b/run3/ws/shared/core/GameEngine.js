/**
 * GameEngine - Core game loop and state management.
 */

class GameEngine {
  constructor() {
    this.gameState = 'menu'; // menu | playing | paused | gameOver
    this.running = false;
    this.paused = false;
    this.lastTime = 0;
    this.updateCallbacks = [];
    this.renderCallback = null;
    this.inputs = {};
  }

  /**
   * Start the game loop.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  /**
   * Main game loop.
   */
  _loop(timestamp) {
    if (!this.running) return;

    const deltaTime = Math.min((timestamp - this.lastTime) / 1000, 0.1); // Cap at 100ms
    this.lastTime = timestamp;

    // Update game state
    if (this.gameState === 'playing' && !this.paused) {
      for (const callback of this.updateCallbacks) {
        try {
          callback(deltaTime);
        } catch (e) {
          console.error('Update error:', e);
        }
      }
    }

    // Render if callback is registered
    if (this.renderCallback && this.running) {
      try {
        this.renderCallback();
      } catch (e) {
        console.error('Render error:', e);
      }
    }

    requestAnimationFrame((t) => this._loop(t));
  }

  /**
   * Register an update callback.
   */
  registerUpdate(callback) {
    if (!this.updateCallbacks.includes(callback)) {
      this.updateCallbacks.push(callback);
    }
  }

  /**
   * Register a render callback.
   */
  setRenderCallback(callback) {
    this.renderCallback = callback;
  }

  /**
   * Set the game state.
   */
  setState(newState) {
    if (newState !== this.gameState) {
      console.log(`Game state: ${this.gameState} -> ${newState}`);
      this.gameState = newState;
    }
  }

  /**
   * Pause the game loop.
   */
  pause() {
    this.paused = true;
  }

  /**
   * Resume the game loop.
   */
  resume() {
    this.paused = false;
  }

  /**
   * Stop the game loop.
   */
  stop() {
    this.running = false;
  }

  /**
   * Get current game state.
   */
  getState() {
    return this.gameState;
  }
}

export default GameEngine;