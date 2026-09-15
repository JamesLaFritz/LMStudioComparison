/**
 * ObjectPool — generic acquire/release pool for transient objects
 * (projectiles, particles, rings, trails, floating text).
 *
 * - `factory` creates a new object on demand (only called when the pool is empty).
 * - `resetFn` prepares a recycled object for reuse (called on acquire).
 * - `initialSize` pre-fills the pool so the first frame never allocates.
 *
 * Recycled objects are kept in a stack; `releaseAll()` returns every live
 * object before teardown.
 */
export default class ObjectPool {
  /**
   * @param {() => object} factory
   * @param {(obj: object) => void} [resetFn]
   * @param {number} [initialSize=0]
   */
  constructor(factory, resetFn = null, initialSize = 0) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.free = [];
    this.active = new Set();
    for (let i = 0; i < initialSize; i++) this.free.push(factory());
  }

  /** Acquire an object (recycled or freshly created). */
  acquire() {
    let obj = this.free.pop();
    if (obj === undefined) obj = this.factory();
    if (this.resetFn) this.resetFn(obj);
    this.active.add(obj);
    return obj;
  }

  /** Return an object to the pool. Safe to call twice. */
  release(obj) {
    if (!this.active.delete(obj)) return;
    this.free.push(obj);
  }

  /** Release every active object (teardown). Safe to call repeatedly. */
  releaseAll() {
    for (const obj of this.active) {
      this.active.delete(obj);
      this.free.push(obj);
    }
  }

  get activeCount() {
    return this.active.size;
  }

  get freeCount() {
    return this.free.length;
  }
}
