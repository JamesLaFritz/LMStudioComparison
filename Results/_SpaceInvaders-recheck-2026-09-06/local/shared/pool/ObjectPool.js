/**
 * Generic Object Pool — zero GC pressure via pre-warmed capacity.
 * T[] reset on release; acquire() returns ready-to-use instances.
 */
export class ObjectPool {
  /**
   * @param {Function} factory - Creates a new instance: () => T
   * @param {Function} resetter - Resets an instance for reuse: (obj: T) => void
   * @param {number} initialCapacity - Pre-warm count
   */
  constructor(factory, resetter, initialCapacity = 32) {
    this._factory = factory;
    this._resetter = resetter;
    this._pool = [];
    this._active = new Set();

    for (let i = 0; i < initialCapacity; i++) {
      const obj = factory();
      this._pool.push(obj);
    }
  }

  /** Acquire an object from the pool. */
  acquire() {
    let obj;
    if (this._pool.length > 0) {
      obj = this._pool.pop();
    } else {
      obj = this._factory();
    }
    this._active.add(obj);
    return obj;
  }

  /** Release an object back to the pool. */
  release(obj) {
    if (!this._active.has(obj)) return;
    this._active.delete(obj);
    this._resetter(obj);
    this._pool.push(obj);
  }

  /** Release all active objects (e.g., on level transition). */
  releaseAll() {
    for (const obj of this._active) {
      this._resetter(obj);
      this._pool.push(obj);
    }
    this._active.clear();
  }

  get size() { return this._active.size; }
  get capacity() { return this._pool.length + this._active.size; }
}
