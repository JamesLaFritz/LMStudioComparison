/**
 * ObjectPool — generic pre-allocated pool. Zero runtime allocation in the hot
 * path: `factory` runs only at construction, `acquire`/`release` are O(1).
 *
 * Usage:
 *   const pool = new ObjectPool(() => makeBullet(), (b) => b.reset(), 24);
 *   const b = pool.acquire();            // undefined when exhausted
 *   pool.release(b);
 *   pool.forEachActive((b) => b.update(dt));
 */
export class ObjectPool {
  /**
   * @param {Function} factory  creates a fresh item (called `capacity` times)
   * @param {Function} reset    called on an item when it is released
   * @param {number}   capacity maximum live items
   */
  constructor(factory, reset, capacity) {
    this.factory = factory;
    this.reset = reset;
    this.capacity = capacity;
    /** @type {Array} all items, live and dead */
    this.items = [];
    /** @type {Array} indices of free items (stack) */
    this.free = [];
    for (let i = 0; i < capacity; i++) {
      const item = factory();
      item._poolIndex = i;
      item._active = false;
      this.items.push(item);
      this.free.push(i);
    }
  }

  /** @returns {number} number of items currently active */
  get count() {
    return this.items.length - this.free.length;
  }

  /**
   * Take an item from the pool.
   * @returns {Object|undefined} the item, or undefined if the pool is exhausted
   */
  acquire() {
    if (this.free.length === 0) return undefined;
    const i = this.free.pop();
    const item = this.items[i];
    item._active = true;
    return item;
  }

  /** Return an item to the pool. Safe to call twice. */
  release(item) {
    if (!item || !item._active) return;
    item._active = false;
    this.reset(item);
    this.free.push(item._poolIndex);
  }

  /** Call `fn(item)` for every active item. */
  forEachActive(fn) {
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i]._active) fn(items[i]);
    }
  }

  /** Release every active item. */
  releaseAll() {
    while (this.free.length < this.items.length) {
      const i = this.free.length;
      // find the next active item
      let found = -1;
      for (let k = 0; k < this.items.length; k++) {
        if (this.items[k]._active) { found = k; break; }
      }
      if (found === -1) break;
      this.release(this.items[found]);
    }
  }

  /** Dispose every item (call `item.dispose()` if present). */
  dispose() {
    for (const item of this.items) {
      if (typeof item.dispose === 'function') item.dispose();
    }
    this.items.length = 0;
    this.free.length = 0;
  }
}
