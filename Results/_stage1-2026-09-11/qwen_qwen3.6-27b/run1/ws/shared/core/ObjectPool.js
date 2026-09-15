/**
 * Generic object pool. Acquire returns a fresh (reset) instance;
 * release returns it to the pool for reuse. No GC pressure during gameplay.
 */
export class ObjectPool {
  /**
   * @param {Function} factoryFn  Creates a new object instance.
   * @param {Function} resetFn    Resets an object to its initial state.
   * @param {number}   capacity   Maximum pooled instances.
   */
  constructor(factoryFn, resetFn, capacity = 256) {
    this._factory = factoryFn;
    this._reset = resetFn;
    this._capacity = capacity;
    this._pool = [];
    this._active = new Set();

    // Pre-warm the pool
    for (let i = 0; i < capacity; i++) {
      this._pool.push(this._factory());
    }
  }

  /**
   * Acquire an object from the pool. If the pool is empty, creates a new one
   * (over-capacity) but warns. The object is reset before returning.
   * @returns {*} A ready-to-use object instance.
   */
  acquire() {
    let obj;
    if (this._pool.length > 0) {
      obj = this._pool.pop();
    } else {
      // Over-capacity: create new. In production this should never happen
      // if pool sizes are tuned correctly.
      obj = this._factory();
    }
    this._reset(obj);
    this._active.add(obj);
    return obj;
  }

  /**
   * Release an object back to the pool. It will be zeroed and available
   * for the next acquire().
   * @param {*} obj The object to release.
   */
  release(obj) {
    if (this._active.has(obj)) {
      this._active.delete(obj);
      this._reset(obj);
      if (this._pool.length < this._capacity) {
        this._pool.push(obj);
      }
      // If pool is at capacity and we release, we drop the object.
      // It will be GC'd eventually — this is fine for over-capacity objects.
    }
  }

  /**
   * Release all active objects back to the pool.
   */
  releaseAll() {
    const toRelease = [...this._active];
    for (const obj of toRelease) {
      this.release(obj);
    }
  }

  /**
   * Number of currently active (checked-out) objects.
   */
  get activeCount() {
    return this._active.size;
  }

  /**
   * Number of available objects in the pool.
   */
  get availableCount() {
    return this._pool.length;
  }

  /**
   * Total capacity of the pool.
   */
  get capacity() {
    return this._capacity;
  }
}
