export class RingEventQueue {
  constructor(capacity = 256) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    for (let index = 0; index < capacity; index += 1) {
      this.buffer[index] = {
        type: '',
        x: 0,
        y: 0,
        z: 0,
        value: 0,
        severity: 0,
        color: 0,
      };
    }
  }

  push(type, x = 0, y = 0, z = 0, value = 0, severity = 0, color = 0xffffff) {
    if (this.count === this.capacity) {
      return false;
    }
    const event = this.buffer[this.tail];
    event.type = type;
    event.x = x;
    event.y = y;
    event.z = z;
    event.value = value;
    event.severity = severity;
    event.color = color;
    this.tail = (this.tail + 1) % this.capacity;
    this.count += 1;
    return true;
  }

  drain(callback) {
    while (this.count > 0) {
      callback(this.buffer[this.head]);
      this.head = (this.head + 1) % this.capacity;
      this.count -= 1;
    }
  }

  clear() {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
}
