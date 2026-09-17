import { EVENT_PRIORITY } from './Enums.js';

/**
 * Fixed event records prevent gameplay/VFX bursts from allocating. Lower-priority
 * cosmetic events surrender capacity to terminal events when the queue is full.
 */
export class EventQueue {
  constructor(capacity, criticalReserve = 0) {
    this.capacity = capacity;
    this.criticalReserve = Math.min(capacity, Math.max(0, criticalReserve));
    this.length = 0;
    this.dropped = 0;
    this.records = new Array(capacity);
    for (let index = 0; index < capacity; index += 1) {
      this.records[index] = {
        type: '', x: 0, y: 0, power: 0, score: 0, wave: 0, slot: -1,
        owner: '', kind: '', count: 0, reason: '', priority: 0, life: 0,
        direction: 0, alive: 0,
      };
    }
  }

  clear() {
    this.length = 0;
  }

  push(type, x = 0, y = 0, power = 0, score = 0, wave = 0, slot = -1,
    owner = '', kind = '', count = 0, reason = '', life = 0, direction = 0, alive = 0) {
    const priority = EVENT_PRIORITY[type] ?? 40;
    const critical = priority >= 80;
    const normalLimit = this.capacity - this.criticalReserve;
    let index = this.length;

    if (this.length >= (critical ? this.capacity : normalLimit)) {
      if (!critical) {
        this.dropped += 1;
        return false;
      }
      if (this.length < this.capacity) {
        index = this.length;
        this.length += 1;
      } else {
        let weakest = 0;
        for (let cursor = 1; cursor < this.length; cursor += 1) {
          if (this.records[cursor].priority < this.records[weakest].priority) weakest = cursor;
        }
        if (this.records[weakest].priority >= priority) {
          this.dropped += 1;
          return false;
        }
        index = weakest;
      }
    } else {
      this.length += 1;
    }

    const record = this.records[index];
    record.type = type;
    record.x = x;
    record.y = y;
    record.power = power;
    record.score = score;
    record.wave = wave;
    record.slot = slot;
    record.owner = owner;
    record.kind = kind;
    record.count = count;
    record.reason = reason;
    record.priority = priority;
    record.life = life;
    record.direction = direction;
    record.alive = alive;
    return true;
  }

  drain(visitor) {
    for (let index = 0; index < this.length; index += 1) visitor(this.records[index]);
    this.length = 0;
  }
}
