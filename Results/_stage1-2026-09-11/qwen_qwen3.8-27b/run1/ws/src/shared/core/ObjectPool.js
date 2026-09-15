/**
 * ObjectPool — pre-allocated pool of reusable objects.
 *
 * Objects are created once at construction and only ever deactivated /
 * reactivated, never freed — zero runtime allocation pressure. `acquire()`
 * returns the next inactive object (or null if exhausted); `release()`
 * reactivates the free list.
 */
export class ObjectPool {
  /**
   * @param {() => object} factory  Builds one object. Called `capacity` times.
   * @param {number} capacity       Pool size.
   */
  constructor(factory, capacity) {
    this.items = [];
    this.capacity = capacity;
    for (let i = 0; i < capacity; i++) {
      const obj = factory();
      obj.active = false;
      this.items.push(obj);
    }
  }

  acquire() {
    for (let i = 0; i < this.items.length; i++) {
      if (!this.items[i].active) {
        this.items[i].active = true;
        return this.items[i];
      }
    }
    return null;
  }

  release(obj) {
    obj.active = false;
  }

  releaseAll() {
    for (const o of this.items) o.active = false;
  }

  forEachActive(fn) {
    for (const o of this.items) if (o.active) fn(o);
  }

  get activeCount() {
    let n = 0;
    for (const o of this.items) if (o.active) n++;
    return n;
  }

  dispose() {
    for (const o of this.items) if (o.dispose) o.dispose();
    this.items.length = 0;
  }
}
