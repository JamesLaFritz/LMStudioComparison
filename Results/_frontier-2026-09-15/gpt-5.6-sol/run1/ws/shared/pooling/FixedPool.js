export class FixedPool {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError('FixedPool capacity must be a positive integer.');
    }
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.free = new Int32Array(capacity);
    this.freeCount = capacity;
    for (let i = 0; i < capacity; i += 1) this.free[i] = capacity - 1 - i;
  }

  acquire() {
    if (this.freeCount === 0) return -1;
    const index = this.free[--this.freeCount];
    this.active[index] = 1;
    return index;
  }

  release(index) {
    if (index < 0 || index >= this.capacity || this.active[index] === 0) return false;
    this.active[index] = 0;
    this.free[this.freeCount++] = index;
    return true;
  }

  isActive(index) {
    return index >= 0 && index < this.capacity && this.active[index] === 1;
  }

  get activeCount() {
    return this.capacity - this.freeCount;
  }

  reset() {
    this.active.fill(0);
    this.freeCount = this.capacity;
    for (let i = 0; i < this.capacity; i += 1) this.free[i] = this.capacity - 1 - i;
  }

  forEachActive(visitor) {
    for (let i = 0; i < this.capacity; i += 1) {
      if (this.active[i] === 1) visitor(i);
    }
  }
}
