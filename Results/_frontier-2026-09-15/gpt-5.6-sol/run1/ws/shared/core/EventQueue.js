const createRecord = () => ({
  type: '',
  x: 0,
  y: 0,
  z: 0,
  nx: 0,
  ny: 1,
  speed: 0,
  value: 0,
  priority: 0,
  source: -1,
  target: -1,
  variant: 0,
  text: '',
  cause: '',
});

export class EventQueue {
  constructor(capacity = 256) {
    this.capacity = capacity;
    this.records = Array.from({ length: capacity }, createRecord);
    this.readIndex = 0;
    this.writeIndex = 0;
    this.count = 0;
    this.dropped = 0;
  }

  push(type) {
    if (this.count >= this.capacity) {
      this.dropped += 1;
      return null;
    }

    const record = this.records[this.writeIndex];
    record.type = type;
    record.x = 0;
    record.y = 0;
    record.z = 0;
    record.nx = 0;
    record.ny = 1;
    record.speed = 0;
    record.value = 0;
    record.priority = 0;
    record.source = -1;
    record.target = -1;
    record.variant = 0;
    record.text = '';
    record.cause = '';

    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.count += 1;
    return record;
  }

  drain(handler) {
    while (this.count > 0) {
      const record = this.records[this.readIndex];
      handler(record);
      this.readIndex = (this.readIndex + 1) % this.capacity;
      this.count -= 1;
    }
    this.writeIndex = this.readIndex;
  }

  clear() {
    this.readIndex = 0;
    this.writeIndex = 0;
    this.count = 0;
    this.dropped = 0;
  }
}
