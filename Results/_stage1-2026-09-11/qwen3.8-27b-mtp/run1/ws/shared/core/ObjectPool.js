/**
 * ObjectPool — generic acquire/release pool for hot-path objects
 * (bullets, rings, UFOs). Preallocates `size` instances; release() resets an
 * object via its `reset()` method and returns it to the free stack. Zero
 * allocation in steady state: the free list is a fixed Int32Array-backed array.
 */

export default class ObjectPool {
  /**
   * @param {Function} factory  () => object (must expose .reset())
   * @param {number}   size     number of instances to preallocate
   */
  constructor(factory, size) {
    this.factory = factory;
    this.items = new Array(size);
    this.free = [];
    for (let i = 0; i < size; i++) {
      const item = factory();
      item.active = false;
      this.items[i] = item;
      this.free.push(i);
    }
  }

  /** @returns {object|null} a free instance with .active === true, or null if exhausted. */
  acquire() {
    const idx = this.free.pop();
    if (idx === undefined) return null;
    const item = this.items[idx];
    item.active = true;
    return item;
  }

  /** @param {object} item an instance previously acquired from this pool. */
  release(item) {
    if (!item || !item.active) return;
    item.active = false;
    if (typeof item.reset === 'function') item.reset();
    const idx = this.items.indexOf(item);
    if (idx !== -1) this.free.push(idx);
  }

  /** Release every active instance. */
  releaseAll() {
    for (const item of this.items) {
      if (item.active) this.release(item);
    }
  }

  get size() { return this.items.length; }
  get freeCount() { return this.free.length; }
}
