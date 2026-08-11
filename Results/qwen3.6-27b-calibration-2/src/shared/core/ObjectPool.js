/**
 * Generic Object Pool — pre-allocates N items, .acquire() / .release(), zero GC pressure.
 */
export class ObjectPool {
  /**
   * @param {Function} createFn — factory that returns a new object
   * @param {number} size — pool capacity
   */
  constructor(createFn, size) {
    this.pool = [];
    this.available = [];
    for (let i = 0; i < size; i++) {
      const obj = createFn();
      this.pool.push(obj);
      this.available.push(obj);
    }
  }

  acquire() {
    if (this.available.length === 0) return null;
    return this.available.pop();
  }

  release(obj) {
    if (this.available.includes(obj)) return;
    this.available.push(obj);
  }

  get size() {
    return this.pool.length;
  }

  get availableCount() {
    return this.available.length;
  }
}
