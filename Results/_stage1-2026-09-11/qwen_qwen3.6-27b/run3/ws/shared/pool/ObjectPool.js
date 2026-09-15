export class ObjectPool {
  constructor(factory, size) {
    this._pool = [];
    this._active = new Set();
    for (let i = 0; i < size; i++) {
      this._pool.push(factory());
    }
  }

  acquire() {
    if (this._pool.length === 0) return null;
    const obj = this._pool.pop();
    this._active.add(obj);
    if (typeof obj.reset === 'function') obj.reset();
    return obj;
  }

  release(obj) {
    if (this._active.has(obj)) {
      this._active.delete(obj);
      this._pool.push(obj);
    }
  }

  get activeCount() {
    return this._active.size;
  }

  get availableCount() {
    return this._pool.length;
  }

  releaseAll() {
    for (const obj of this._active) {
      this._pool.push(obj);
    }
    this._active.clear();
  }
}
