/**
 * Shockwave - Expanding emissive ring VFX on impacts/deaths.
 */

class Shockwave {
  constructor() {
    this.activeShocks = []; // Array of shockwave instances
    this._nextId = 0;
  }

  /**
   * Create a new shockwave at the given position.
   */
  create(x, y, z, radius = 10, duration = 1.0) {
    const shock = {
      x: x,
      y: y,
      z: z,
      radius: radius,
      maxRadius: radius + 30, // Expand to this maximum
      duration: duration,
      elapsed: 0,
      active: true,
      id: this._nextId++
    };

    this.activeShocks.push(shock);
    return shock;
  }

  /**
   * Update all active shockwaves for one frame.
   */
  update(deltaTime) {
    const now = performance.now();

    for (let i = this.activeShocks.length - 1; i >= 0; i--) {
      const shock = this.activeShocks[i];
      if (!shock || !shock.active) continue;

      // Advance elapsed time
      shock.elapsed += deltaTime;

      // Expand radius over duration
      const progress = Math.min(shock.elapsed / shock.duration, 1);
      shock.radius = shock.maxRadius * progress;

      // Remove when animation completes
      if (progress >= 1) {
        this.release(shock);
        this.activeShocks.splice(i, 1);
      }
    }
  }

  /**
   * Release a shockwave back to the pool.
   */
  release(shock) {
    if (shock && typeof shock.dispose === 'function') {
      shock.dispose();
    }
  }

  /**
   * Get all active shockwaves for rendering.
   */
  getActiveShocks() {
    return this.activeShocks.filter(s => s && s.active);
  }

  /**
   * Clear all shockwaves immediately.
   */
  clear() {
    for (const shock of this.activeShocks) {
      this.release(shock);
    }
    this.activeShocks = [];
  }

  /**
   * Get count of active shockwaves.
   */
  get size() {
    return this.activeShocks.length;
  }
}

export default Shockwave;