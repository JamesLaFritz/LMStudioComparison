export class ObjectPool {
  constructor(capacity, factory, reset) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError('ObjectPool capacity must be a positive integer.');
    }
    this.capacity = capacity;
    this._reset = reset || (() => {});
    this._items = new Array(capacity);
    this._active = new Uint8Array(capacity);
    this._free = new Int32Array(capacity);
    this._freeCount = capacity;

    for (let index = 0; index < capacity; index += 1) {
      const item = factory(index);
      if (!item || typeof item !== 'object') {
        throw new TypeError('ObjectPool factory must return an object.');
      }
      item.__poolIndex = index;
      item.__poolActive = false;
      this._items[index] = item;
      this._free[index] = capacity - index - 1;
    }
  }

  acquire() {
    if (this._freeCount === 0) {
      return null;
    }
    const index = this._free[--this._freeCount];
    const item = this._items[index];
    this._active[index] = 1;
    item.__poolActive = true;
    return item;
  }

  release(item) {
    if (!item || !item.__poolActive) {
      return false;
    }
    const index = item.__poolIndex;
    if (this._items[index] !== item || this._active[index] === 0) {
      return false;
    }
    this._reset(item);
    this._active[index] = 0;
    item.__poolActive = false;
    this._free[this._freeCount++] = index;
    return true;
  }

  forEachActive(callback) {
    for (let index = 0; index < this.capacity; index += 1) {
      if (this._active[index] === 1) {
        callback(this._items[index], index);
      }
    }
  }

  itemAt(index) {
    return this._items[index];
  }

  isActive(index) {
    return this._active[index] === 1;
  }

  clear() {
    this._freeCount = this.capacity;
    for (let index = 0; index < this.capacity; index += 1) {
      const item = this._items[index];
      if (this._active[index] === 1) {
        this._reset(item);
      }
      this._active[index] = 0;
      item.__poolActive = false;
      this._free[index] = this.capacity - index - 1;
    }
  }

  get activeCount() {
    return this.capacity - this._freeCount;
  }
}
