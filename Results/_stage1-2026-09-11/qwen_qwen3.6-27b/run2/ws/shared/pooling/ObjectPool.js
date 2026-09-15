export class ObjectPool {
  constructor(factory, size, resetFn) {
    this._pool = [];
    this._active = [];
    this._factory = factory;
    this._resetFn = resetFn || null;
    for (let i = 0; i < size; i++) {
      this._pool.push(factory());
    }
  }

  get availableCount() {
    return this._pool.length;
  }

  get activeCount() {
    return this._active.length;
  }

  acquire() {
    if (this._pool.length === 0) return null;
    const obj = this._pool.pop();
    this._active.push(obj);
    return obj;
  }

  release(obj) {
    const idx = this._active.indexOf(obj);
    if (idx === -1) return;
    this._active.splice(idx, 1);
    if (this._resetFn) this._resetFn(obj);
    this._pool.push(obj);
  }

  releaseAll() {
    while (this._active.length > 0) {
      this.release(this._active[0]);
    }
  }
}
