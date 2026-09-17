const MIN_PRIORITY = 0;
const MAX_PRIORITY = 4;

function assertCapacity(capacity) {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new RangeError('FixedEventQueue capacity must be a positive integer');
  }
}

/** Fixed-capacity P4-to-P0 FIFO event queue backed entirely by preallocated storage. */
export class FixedEventQueue {
  constructor(capacity) {
    assertCapacity(capacity);
    this._capacity = capacity;
    this._size = 0;
    this._overflowCount = 0;

    this._types = new Array(capacity).fill(null);
    this._priorities = new Uint8Array(capacity);
    this._ids = new Float64Array(capacity);
    this._x = new Float64Array(capacity);
    this._y = new Float64Array(capacity);
    this._nx = new Float64Array(capacity);
    this._ny = new Float64Array(capacity);
    this._speed = new Float64Array(capacity);
    this._magnitude = new Float64Array(capacity);
    this._value = new Float64Array(capacity);
    this._next = new Int32Array(capacity);
    this._heads = new Int32Array(MAX_PRIORITY + 1);
    this._tails = new Int32Array(MAX_PRIORITY + 1);
    this._free = new Int32Array(capacity);
    this._defaultScratch = {
      type: null,
      priority: 0,
      id: 0,
      entityId: 0,
      x: 0,
      y: 0,
      nx: 0,
      ny: 0,
      normalX: 0,
      normalY: 0,
      speed: 0,
      relativeSpeed: 0,
      magnitude: 0,
      value: 0,
      score: 0,
    };
    this._heads.fill(-1);
    this._tails.fill(-1);
    this._next.fill(-1);
    this._freeCount = capacity;
    for (let slot = 0; slot < capacity; slot += 1) {
      this._free[capacity - 1 - slot] = slot;
    }
  }

  get size() {
    return this._size;
  }

  get overflowCount() {
    return this._overflowCount;
  }

  push(type, priority, id = 0, x = 0, y = 0, nx = 0, ny = 0, speed = 0, magnitude = 0, value = 0) {
    if (!Number.isInteger(priority) || priority < MIN_PRIORITY || priority > MAX_PRIORITY) {
      throw new RangeError(`Event priority must be an integer from ${MIN_PRIORITY} through ${MAX_PRIORITY}`);
    }
    if (this._freeCount === 0) {
      this._overflowCount += 1;
      return false;
    }

    const slot = this._free[--this._freeCount];
    this._types[slot] = type;
    this._priorities[slot] = priority;
    this._ids[slot] = id;
    this._x[slot] = x;
    this._y[slot] = y;
    this._nx[slot] = nx;
    this._ny[slot] = ny;
    this._speed[slot] = speed;
    this._magnitude[slot] = magnitude;
    this._value[slot] = value;
    this._next[slot] = -1;

    const tail = this._tails[priority];
    if (tail === -1) {
      this._heads[priority] = slot;
    } else {
      this._next[tail] = slot;
    }
    this._tails[priority] = slot;
    this._size += 1;
    return true;
  }

  drain(visitor, scratch = this._defaultScratch) {
    if (typeof visitor !== 'function') throw new TypeError('visitor must be a function');
    if (scratch === null || typeof scratch !== 'object') {
      throw new TypeError('scratch must be an object');
    }

    let drained = 0;
    for (let priority = MAX_PRIORITY; priority >= MIN_PRIORITY; priority -= 1) {
      while (this._heads[priority] !== -1) {
        const slot = this._heads[priority];
        const next = this._next[slot];
        this._heads[priority] = next;
        if (next === -1) this._tails[priority] = -1;
        this._size -= 1;

        scratch.type = this._types[slot];
        scratch.priority = priority;
        scratch.id = this._ids[slot];
        scratch.entityId = this._ids[slot];
        scratch.x = this._x[slot];
        scratch.y = this._y[slot];
        scratch.nx = this._nx[slot];
        scratch.ny = this._ny[slot];
        scratch.normalX = this._nx[slot];
        scratch.normalY = this._ny[slot];
        scratch.speed = this._speed[slot];
        scratch.relativeSpeed = this._speed[slot];
        scratch.magnitude = this._magnitude[slot];
        scratch.value = this._value[slot];
        scratch.score = this._value[slot];

        this._types[slot] = null;
        this._next[slot] = -1;
        this._free[this._freeCount++] = slot;
        drained += 1;
        visitor(scratch);
      }
    }
    return drained;
  }

  clear() {
    this._types.fill(null);
    this._heads.fill(-1);
    this._tails.fill(-1);
    this._next.fill(-1);
    this._size = 0;
    this._freeCount = this._capacity;
    for (let slot = 0; slot < this._capacity; slot += 1) {
      this._free[this._capacity - 1 - slot] = slot;
    }
  }
}
