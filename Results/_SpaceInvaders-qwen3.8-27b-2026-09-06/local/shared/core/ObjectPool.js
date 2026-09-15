// shared/core/ObjectPool.js
// Generic pre-allocated pool. Zero allocation in steady state.

export class ObjectPool {
  /**
   * @param {Function} factory  () => object
   * @param {number} size       initial pool size
   * @param {Function} [reset]  (obj) => void, called on acquire (optional)
   */
  constructor(factory, size, reset = null) {
    this._factory = factory;
    this._reset = reset;
    this._free = [];
    this._active = [];
    for (let i = 0; i < size; i++) this._free.push(factory());
  }

  get activeCount() { return this._active.length; }
  get freeCount() { return this._free.length; }

  acquire() {
    const obj = this._free.pop();
    if (obj === undefined) return null; // pool exhausted — caller must handle
    if (this._reset) this._reset(obj);
    this._active.push(obj);
    return obj;
  }

  release(obj) {
    const i = this._active.indexOf(obj);
    if (i !== -1) {
      this._active.splice(i, 1);
      this._free.push(obj);
    }
  }

  releaseAll() {
    while (this._active.length) this._free.push(this._active.pop());
  }

  forEachActive(fn) {
    // iterate over a copy so release() during iteration is safe
    const snapshot = this._active.slice();
    for (const obj of snapshot) fn(obj);
  }

  dispose() {
    this._free.length = 0;
    this._active.length = 0;
  }
}
