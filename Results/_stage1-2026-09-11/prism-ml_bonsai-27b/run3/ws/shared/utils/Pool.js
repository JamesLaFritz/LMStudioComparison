/**
 * Pool - Object pooling utility for efficient resource management.
 * Reuses pre-allocated objects instead of creating/destroying them,
 * preventing memory leaks in long-running games.
 */

class Pool {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.items = []; // Array of available pooled items
    this.inUse = new Map(); // Maps item to its current user
  }

  /**
   * Acquire an item from the pool. If none available, creates a new one.
   * @param {Function} factory - Function that creates a new item
   * @returns {Object|undefined} The acquired item or null if pool is exhausted
   */
  acquire(factory) {
    // Try to get an unused item from the pool
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (!this.inUse.has(item)) {
        this.items.splice(i, 1);
        return item;
      }
    }

    // Create a new item if pool is exhausted
    if (this.items.length < this.maxSize) {
      const item = factory();
      this.items.push(item);
      return item;
    }

    return null;
  }

  /**
   * Return an item to the pool for reuse.
   * @param {Object} item - The item to release back to the pool
   */
  release(item) {
    if (item && typeof item.dispose === 'function') {
      item.dispose();
    }
    this.inUse.delete(item);
    this.items.push(item);
  }

  /**
   * Get count of available items in the pool.
   */
  get size() {
    return this.items.length;
  }

  /**
   * Clear all items from the pool.
   */
  clear() {
    for (const item of this.items) {
      if (typeof item.dispose === 'function') {
        item.dispose();
      }
    }
    this.items = [];
    this.inUse.clear();
  }

  /**
   * Get count of currently in-use items.
   */
  get inUseCount() {
    return this.inUse.size;
  }

  /**
   * Get all available (unused) items.
   */
  getAvailableItems() {
    const result = [];
    for (const item of this.items) {
      if (!this.inUse.has(item)) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Mark an item as in-use.
   */
  markInUse(item, user) {
    this.inUse.set(item, user);
  }

  /**
   * Unmark an item from use.
   */
  unmarkItem(item) {
    this.inUse.delete(item);
  }
}

export default Pool;