/**
 * Generic Object Pool for reusable objects.
 * @template T
 */
export class ObjectPool {
  constructor(createFn, resetFn = null) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.available = [];
    this.inUse = [];
  }

  /**
   * Get an object from the pool. Creates a new one if none available.
   * @returns {T}
   */
  get() {
    if (this.available.length > 0) {
      const obj = this.available.pop();
      this.inUse.push(obj);
      return obj;
    }
    const obj = this.createFn();
    this.inUse.push(obj);
    return obj;
  }

  /**
   * Return an object to the pool.
   * @param {T} obj
   */
  release(obj) {
    const index = this.inUse.indexOf(obj);
    if (index === -1) return;
    this.inUse.splice(index, 1);
    if (this.resetFn) this.resetFn(obj);
    this.available.push(obj);
  }

  /**
   * Get the number of available objects.
   * @returns {number}
   */
  getAvailableCount() {
    return this.available.length;
  }

  /**
   * Get the number of in-use objects.
   * @returns {number}
   */
  getInUseCount() {
    return this.inUse.length;
  }

  /**
   * Get the total capacity (available + in-use).
   * @returns {number}
   */
  getTotalCount() {
    return this.available.length + this.inUse.length;
  }
}

// Export for use in other modules
export default ObjectPool;