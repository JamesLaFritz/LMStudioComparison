export class ObjectPool {
  constructor(factory, reset, initialSize = 0) {
    this._factory = factory;
    this._reset = reset;
    this._free = [];
    this._active = new Set();
    for (let i = 0; i < initialSize; i++) {
      this._free.push(factory());
    }
  }

  acquire() {
    const item = this._free.length > 0 ? this._free.pop() : this._factory();
    this._active.add(item);
    return item;
  }

  release(item) {
    if (!this._active.has(item)) return;
    this._active.delete(item);
    this._reset(item);
    this._free.push(item);
  }

  releaseAll() {
    for (const item of this._active) {
      this._reset(item);
      this._free.push(item);
    }
    this._active.clear();
  }

  forEachActive(callback) {
    for (const item of this._active) callback(item);
  }

  get activeCount() {
    return this._active.size;
  }

  get pooledCount() {
    return this._free.length + this._active.size;
  }
}
