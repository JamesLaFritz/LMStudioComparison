/**
 * Fixed-capacity dense/free index pool. It does not allocate while acquiring
 * or releasing slots, and is suitable for simulation or render-side entities.
 */
export class FreeList {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a positive integer');
    this.capacity = capacity;
    this._free = new Int32Array(capacity);
    this._active = new Int32Array(capacity);
    this._denseIndex = new Int32Array(capacity);
    this._allocated = new Uint8Array(capacity);
    this._freeCount = capacity;
    this.activeCount = 0;
    for (let index = 0; index < capacity; index += 1) {
      this._free[index] = capacity - index - 1;
      this._denseIndex[index] = -1;
    }
  }

  acquire() {
    if (this._freeCount === 0) return -1;
    const slot = this._free[--this._freeCount];
    this._allocated[slot] = 1;
    this._denseIndex[slot] = this.activeCount;
    this._active[this.activeCount++] = slot;
    return slot;
  }

  release(slot) {
    if (!this.isAllocated(slot)) return false;
    const denseIndex = this._denseIndex[slot];
    const finalSlot = this._active[this.activeCount - 1];
    this._active[denseIndex] = finalSlot;
    this._denseIndex[finalSlot] = denseIndex;
    this.activeCount -= 1;
    this._allocated[slot] = 0;
    this._denseIndex[slot] = -1;
    this._free[this._freeCount++] = slot;
    return true;
  }

  isAllocated(slot) {
    return Number.isInteger(slot) && slot >= 0 && slot < this.capacity && this._allocated[slot] === 1;
  }

  activeAt(index) {
    return index >= 0 && index < this.activeCount ? this._active[index] : -1;
  }

  clear() {
    this._freeCount = this.capacity;
    this.activeCount = 0;
    this._allocated.fill(0);
    this._denseIndex.fill(-1);
    for (let index = 0; index < this.capacity; index += 1) {
      this._free[index] = this.capacity - index - 1;
    }
  }
}
