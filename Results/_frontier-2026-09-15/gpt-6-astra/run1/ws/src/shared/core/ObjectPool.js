export class ObjectPool {
  constructor(capacity, factory, resetItem = null) {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new RangeError("Invalid pool capacity");
    this.capacity = capacity;
    this.items = Array.from({ length: capacity }, (_, i) => factory(i));
    this.activeIds = new Int32Array(capacity);
    this.reverse = new Int32Array(capacity).fill(-1);
    this.free = new Int32Array(capacity);
    this.generations = new Uint32Array(capacity);
    this.resetItem = resetItem;
    this.activeCount = 0;
    this.freeCount = capacity;
    for (let i = 0; i < capacity; i++) this.free[i] = capacity - 1 - i;
  }
  acquire() {
    if (!this.freeCount) return -1;
    const id = this.free[--this.freeCount];
    this.generations[id]++;
    this.reverse[id] = this.activeCount;
    this.activeIds[this.activeCount++] = id;
    if (this.resetItem) this.resetItem(this.items[id], id);
    return id;
  }
  isActive(id, generation = this.generations[id]) {
    return (
      id >= 0 &&
      id < this.capacity &&
      this.reverse[id] >= 0 &&
      this.generations[id] === generation
    );
  }
  release(id, generation = this.generations[id]) {
    if (!this.isActive(id, generation)) return false;
    const index = this.reverse[id];
    const last = this.activeIds[--this.activeCount];
    this.activeIds[index] = last;
    this.reverse[last] = index;
    this.reverse[id] = -1;
    this.free[this.freeCount++] = id;
    return true;
  }
  clear() {
    this.activeCount = 0;
    this.freeCount = this.capacity;
    this.reverse.fill(-1);
    for (let i = 0; i < this.capacity; i++) {
      this.free[i] = this.capacity - 1 - i;
      this.generations[i]++;
    }
  }
}
