/**
 * ObjectPool — pre-allocated, zero-allocation acquire/release.
 *
 * Usage:
 *   const pool = new ObjectPool(() => new Bullet(), 8);
 *   const b = pool.acquire();      // null when exhausted
 *   ...
 *   pool.release(b);               // idempotent
 *   pool.forEachActive(fn);        // fn(item) over live items
 *   pool.releaseAll();
 *
 * Contract: `release` is safe to call twice on the same item.
 */
export default class ObjectPool {
  constructor(factory, size) {
    this.factory = factory;
    this.items = [];
    this.active = [];
    for (let i = 0; i < size; i++) this.items.push(factory());
  }

  get freeCount() { return this.items.length; }
  get activeCount() { return this.active.length; }

  acquire() {
    if (this.items.length === 0) return null;
    const item = this.items.pop();
    this.active.push(item);
    return item;
  }

  release(item) {
    const i = this.active.indexOf(item);
    if (i === -1) return; // already released
    this.active.splice(i, 1);
    this.items.push(item);
  }

  releaseAll() {
    while (this.active.length > 0) this.items.push(this.active.pop());
  }

  forEachActive(fn) {
    for (let i = 0; i < this.active.length; i++) fn(this.active[i]);
  }

  /** Remove items for which predicate(item) === true (caller keeps ownership). */
  removeWhere(predicate) {
    const removed = [];
    for (let i = this.active.length - 1; i >= 0; i--) {
      if (predicate(this.active[i])) {
        removed.push(this.active.splice(i, 1)[0]);
        this.items.push(removed[removed.length - 1]);
      }
    }
    return removed;
  }
}
