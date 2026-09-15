/**
 * ObjectPool — generic preallocated pool. Zero per-frame allocation: items are
 * created once at construction and recycled forever. Used by every dynamic
 * system (bullets, particles, rings, trails, text, power-ups).
 */
export class ObjectPool {
  /**
   * @param {number} capacity — number of slots to preallocate
   * @param {() => object} factory — called once per slot at construction
   */
  constructor(capacity, factory) {
    this.capacity = Math.max(1, capacity | 0);
    this.items = new Array(this.capacity);
    for (let i = 0; i < this.capacity; i++) {
      const item = factory();
      item.active = false;
      this.items[i] = item;
    }
    this._activeCount = 0;
  }

  get activeCount() { return this._activeCount; }

  /** @returns {object|null} next inactive slot, or null when saturated */
  acquire() {
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      if (!items[i].active) {
        items[i].active = true;
        this._activeCount++;
        return items[i];
      }
    }
    return null;
  }

  /** @param {object} item — must be a slot from this pool */
  release(item) {
    if (item.active) {
      item.active = false;
      this._activeCount--;
    }
  }

  /** Deactivate every slot. Used on level restart / teardown. */
  reset() {
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].active) {
        items[i].active = false;
        this._activeCount--;
      }
    }
  }

  /** Iterate active slots only. `fn(item, index)` — no allocation in fn. */
  forEachActive(fn) {
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].active) fn(items[i], i);
    }
  }
}
