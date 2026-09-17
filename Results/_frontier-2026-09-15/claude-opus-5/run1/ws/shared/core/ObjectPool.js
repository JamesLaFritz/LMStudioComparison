// Fixed-capacity object pool with O(1) acquire/release (swap-remove). Items are created once
// up front; nothing is allocated after construction. Live items occupy items[0..liveCount).

export class ObjectPool {
  /**
   * @param {object} opts
   * @param {(index:number)=>any} opts.create   factory, called `capacity` times at construction
   * @param {number} opts.capacity
   * @param {(item:any)=>void} [opts.onAcquire] called when an item goes live
   * @param {(item:any)=>void} [opts.onRelease] called when an item is returned
   */
  constructor({ create, capacity = 32, onAcquire = null, onRelease = null }) {
    this.capacity = capacity;
    this.items = new Array(capacity);
    this.liveCount = 0;
    this._onAcquire = onAcquire;
    this._onRelease = onRelease;
    for (let i = 0; i < capacity; i++) {
      const item = create(i);
      item._poolIndex = i;
      this.items[i] = item;
    }
  }

  get freeCount() {
    return this.capacity - this.liveCount;
  }

  /** Returns a live item, or null when the pool is exhausted. */
  acquire() {
    if (this.liveCount >= this.capacity) return null;
    const item = this.items[this.liveCount];
    item._poolIndex = this.liveCount;
    this.liveCount++;
    if (this._onAcquire) this._onAcquire(item);
    return item;
  }

  release(item) {
    const idx = item._poolIndex;
    if (idx === undefined || idx < 0 || idx >= this.liveCount || this.items[idx] !== item) return false;
    if (this._onRelease) this._onRelease(item);
    const last = this.liveCount - 1;
    const other = this.items[last];
    this.items[idx] = other;
    other._poolIndex = idx;
    this.items[last] = item;
    item._poolIndex = last;
    this.liveCount--;
    return true;
  }

  releaseAll() {
    for (let i = this.liveCount - 1; i >= 0; i--) this.release(this.items[i]);
  }

  isLive(item) {
    const idx = item._poolIndex;
    return idx >= 0 && idx < this.liveCount && this.items[idx] === item;
  }

  /** Iterate live items back-to-front so `release()` inside the callback is safe. */
  forEach(fn) {
    for (let i = this.liveCount - 1; i >= 0; i--) fn(this.items[i], i);
  }

  /** Call `fn` on every item (live or not) and drop the references. */
  dispose(fn = null) {
    if (fn) for (let i = 0; i < this.items.length; i++) fn(this.items[i]);
    this.items.length = 0;
    this.liveCount = 0;
    this.capacity = 0;
  }
}
