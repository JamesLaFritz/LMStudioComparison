export class EventBuffer {
  constructor(capacity, factory) {
    this.capacity = capacity;
    this.count = 0;
    this.records = Array.from({ length: capacity }, factory);
  }
  acquire() {
    return this.count < this.capacity ? this.records[this.count++] : null;
  }
  drain(visitor) {
    const count = this.count;
    for (let i = 0; i < count; i++) visitor(this.records[i]);
    this.count = 0;
  }
  clear() {
    this.count = 0;
  }
}
