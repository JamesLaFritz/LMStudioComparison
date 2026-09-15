/**
 * Generic typed object pool to avoid GC pressure.
 * Pre-allocates `initialSize` objects via factory, recycles on release.
 */
export class ObjectPool {
  /**
   * @param {Function} factory - Creates a new instance of the pooled type.
   * @param {Function} resetFn - Resets an object to its initial state before reuse.
   * @param {number} initialSize - Number of objects to pre-allocate.
   */
  constructor(factory, resetFn, initialSize) {
    this._factory = factory;
    this._resetFn = resetFn;
    this._pool = [];
    this._activeCount = 0;

    for (let i = 0; i < initialSize; i++) {
      const obj = factory();
      if (obj) {
        this._pool.push(obj);
      }
    }
  }

  /**
   * Acquire an object from the pool. Creates a new one if none available.
   * @returns {*} The pooled object, ready for use.
   */
  acquire() {
    let obj;
    if (this._pool.length > 0) {
      obj = this._pool.pop();
    } else {
      obj = this._factory();
    }

    if (obj && this._resetFn) {
      this._resetFn(obj);
    }

    this._activeCount++;
    return obj;
  }

  /**
   * Release an object back to the pool for reuse.
   * @param {*} obj - The pooled object to release.
   */
  release(obj) {
    if (obj) {
      this._pool.push(obj);
      this._activeCount--;
    }
  }

  /**
   * Clear all objects from the pool and reset active count.
   * Note: Does not call dispose on objects — caller is responsible.
   */
  clear() {
    this._pool.length = 0;
    this._activeCount = 0;
  }

  /** Number of currently active (in-use) pooled objects. */
  get size() {
    return this._activeCount;
  }

  /** Total number of allocated pool entries (active + idle). */
  get capacity() {
    return this._activeCount + this._pool.length;
  }
}
