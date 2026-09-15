/**
 * MotionTrail - Trail buffer for fast-moving objects.
 * Maintains a history of positions to render motion trails.
 */

class MotionTrail {
  constructor(maxLength = 10) {
    this.maxLength = maxLength;
    this.positions = []; // Array of {x, y, z, alpha}
    this._nextId = 0;
  }

  /**
   * Record a new position for the trail.
   */
  add(x, y, z) {
    const position = { x, y, z, id: this._nextId++ };
    this.positions.push(position);

    // Trim to max length if exceeded
    while (this.positions.length > this.maxLength) {
      this.positions.shift();
    }
  }

  /**
   * Get all trail positions for rendering.
   */
  getPositions() {
    return [...this.positions];
  }

  /**
   * Clear the trail buffer.
   */
  clear() {
    this.positions = [];
  }

  /**
   * Get current trail length.
   */
  get size() {
    return this.positions.length;
  }

  /**
   * Reset trail with a new ID counter.
   */
  reset() {
    this.clear();
    this._nextId = 0;
  }
}

export default MotionTrail;