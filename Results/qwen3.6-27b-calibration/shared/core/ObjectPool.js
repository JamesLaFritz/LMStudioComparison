/**
 * ObjectPool — Generic object pooling system.
 * Pre-allocates entities to avoid GC pressure.
 * Shared across all games.
 */

export class ObjectPool {
  /**
   * @param {Function} factory - Function that creates a new object instance.
   * @param {number} initialSize - Number of objects to pre-allocate.
   * @param {Function} [onReset] - Optional callback called when an object is returned to pool.
   */
  constructor(factory, initialSize = 50, onReset = null) {
    this.factory = factory;
    this.onReset = onReset;
    this.pool = [];
    this.active = [];

    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      const obj = factory();
      obj._active = false;
      this.pool.push(obj);
    }
  }

  /**
   * Acquire an object from the pool. Creates new if pool exhausted.
   */
  acquire() {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      obj = this.factory();
    }
    obj._active = true;
    this.active.push(obj);
    return obj;
  }

  /**
   * Return an object to the pool.
   */
  release(obj) {
    if (!obj._active) return;
    obj._active = false;
    const idx = this.active.indexOf(obj);
    if (idx !== -1) {
      this.active.splice(idx, 1);
    }
    if (this.onReset) {
      this.onReset(obj);
    }
    this.pool.push(obj);
  }

  /**
   * Release all active objects back to the pool.
   */
  releaseAll() {
    for (let i = this.active.length - 1; i >= 0; i--) {
      this.release(this.active[i]);
    }
  }

  /**
   * Get the count of currently active objects.
   */
  get activeCount() {
    return this.active.length;
  }

  /**
   * Get the total capacity (active + pooled).
   */
  get totalSize() {
    return this.active.length + this.pool.length;
  }

  /**
   * Iterate over all active objects.
   */
  forEachActive(callback) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      callback(this.active[i], i);
    }
  }
}
