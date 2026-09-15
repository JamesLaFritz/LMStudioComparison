/**
 * Object Pool Pattern - Generic template for pooling reusable objects
 * Prevents garbage collection spikes by reusing instances instead of creating/destroying
 */

export class ObjectPool {
  /**
   * @param {Function} factory - Function that creates new instances (no args)
   * @param {number} initialSize - Number of pre-created items in pool
   * @param {number} maxSize - Maximum pool size (0 = unlimited growth)
   */
  constructor(factory, initialSize = 10, maxSize = Infinity) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.pool = [];
    
    // Pre-create initial items
    for (let i = 0; i < initialSize; i++) {
      const item = factory();
      if (item.reset) item.reset();
      this.pool.push(item);
    }
  }

  /**
   * Acquire an object from the pool
   * @returns {*} Pooled object ready for use
   */
  acquire() {
    let item;
    
    if (this.pool.length > 0) {
      item = this.pool.pop();
    } else {
      // Create new if under maxSize, or return null if at limit
      if (this.maxSize === Infinity || this._activeCount < this.maxSize) {
        item = this.factory();
      } else {
        return null; // Pool exhausted
      }
    }
    
    this._activeCount++;
    
    // Call init if available, passing any args
    if (item.init && arguments.length > 0) {
      item.init(...arguments);
    }
    
    return item;
  }

  /**
   * Return an object to the pool for reuse
   * @param {*} item - Object to release back to pool
   */
  release(item) {
    if (!item) return;
    
    this._activeCount--;
    
    // Reset state if available
    if (item.reset) {
      item.reset();
    }
    
    this.pool.push(item);
  }

  /**
   * Clear all active items and return to pool
   */
  clear() {
    while (this.pool.length > 0) {
      const item = this.pool.pop();
      if (item.dispose) {
        item.dispose();
      }
    }
    this._activeCount = 0;
  }

  /**
   * Get current pool statistics
   */
  getStats() {
    return {
      pooled: this.pool.length,
      active: this._activeCount,
      total: this.pool.length + this._activeCount
    };
  }
}

// Track active count for maxSize enforcement
ObjectPool.prototype._activeCount = 0;
