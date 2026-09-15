/**
 * ObjectPool — the single pooling primitive for the whole collection.
 *
 * Contract:
 *  - `factory()` creates a fresh object (called only when growing, never in hot paths).
 *  - `reset(obj)` returns an object to its idle state before it re-enters the free list.
 *  - Objects carry their own `active` flag; consumers must not hold references across release.
 */
export class ObjectPool {
  /**
   * @param {object} opts
   * @param {() => object} opts.factory  create a new pooled object
   * @param {(obj: object) => void} [opts.reset]  restore idle state on release
   * @param {number} [opts.capacity=Infinity] hard max of live objects (created + free)
   */
  constructor({ factory, reset = null, capacity = Infinity }) {
    this.factory = factory;
    this.reset = reset;
    this.capacity = capacity;
    /** @type {object[]} created but idle */
    this.freeList = [];
    /** @type {object[]} currently checked out */
    this.activeList = [];
  }

  get activeCount() { return this.activeList.length; }
  get totalCreated() { return this.freeList.length + this.activeList.length; }
  get isFull() { return this.totalCreated >= this.capacity && this.freeList.length === 0; }

  /** Pre-create `n` objects so the first frames never allocate. */
  prewarm(n) {
    for (let i = 0; i < n; i++) {
      if (this.isFull) break;
      const obj = this.factory();
      obj.active = false;
      this.freeList.push(obj);
    }
  }

  /** Check out an object, or null when the pool is exhausted. */
  acquire() {
    let obj = this.freeList.pop();
    if (!obj) {
      if (this.totalCreated >= this.capacity) return null;
      obj = this.factory();
    }
    obj.active = true;
    this.activeList.push(obj);
    return obj;
  }

  /** Return an object to the pool. Safe to call twice on the same object. */
  release(obj) {
    const idx = this.activeList.indexOf(obj);
    if (idx === -1) return; // already released or never acquired
    this.activeList.splice(idx, 1);
    obj.active = false;
    if (this.reset) this.reset(obj);
    this.freeList.push(obj);
  }

  /** Iterate live objects. Do not release inside the callback — collect and release after. */
  forEachActive(fn) {
    for (let i = 0; i < this.activeList.length; i++) fn(this.activeList[i]);
  }

  /** Release every checked-out object back to the free list. */
  releaseAll() {
    for (let i = this.activeList.length - 1; i >= 0; i--) {
      this.release(this.activeList[i]);
    }
  }

  /**
   * Recycle any checked-out objects that have deactivated themselves
   * (active === false). Safe to call once per frame AFTER all iteration is
   * done — it splices activeList, so never call it while looping over the pool.
   */
  sweepInactive() {
    for (let i = this.activeList.length - 1; i >= 0; i--) {
      if (!this.activeList[i].active) this.release(this.activeList[i]);
    }
  }

  /** Discard everything (teardown only). */
  drain() {
    while (this.freeList.length) this.freeList.pop();
    while (this.activeList.length) this.release(this.activeList[this.activeList.length - 1]);
  }
}
