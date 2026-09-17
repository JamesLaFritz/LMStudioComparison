function assertCapacity(capacity) {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new RangeError('FixedPool capacity must be a positive integer');
  }
}

function setPoolFields(item, slot, generation, active) {
  try {
    item.poolIndex = slot;
    item._poolIndex = slot;
    item.generation = generation;
    item._generation = generation;
    item.active = active;
  } catch (error) {
    throw new TypeError(`FixedPool item ${slot} must expose writable pool metadata fields`, {
      cause: error,
    });
  }
}

/** Fixed-capacity object pool. It never constructs objects after initialization. */
export class FixedPool {
  constructor({ capacity, create, reset = () => {} } = {}) {
    assertCapacity(capacity);
    if (typeof create !== 'function') throw new TypeError('FixedPool create must be a function');
    if (typeof reset !== 'function') throw new TypeError('FixedPool reset must be a function');

    this._capacity = capacity;
    this._reset = reset;
    this._items = new Array(capacity);
    this._slotByItem = new WeakMap();
    this._freeSlots = new Int32Array(capacity);
    this._activeSlots = new Int32Array(capacity);
    this._activePosition = new Int32Array(capacity);
    this._generations = new Uint32Array(capacity);
    this._integrityMarks = new Uint8Array(capacity);
    this._freeCount = capacity;
    this._activeCount = 0;
    this._activePosition.fill(-1);

    for (let slot = 0; slot < capacity; slot += 1) {
      const item = create(slot);
      if ((typeof item !== 'object' && typeof item !== 'function') || item === null) {
        throw new TypeError(`FixedPool create(${slot}) must return an object`);
      }
      if (this._slotByItem.has(item)) {
        throw new Error('FixedPool create must return a unique object for every slot');
      }
      setPoolFields(item, slot, 0, false);
      this._items[slot] = item;
      this._slotByItem.set(item, slot);
      // Pop slot zero first while retaining deterministic ascending slot assignment.
      this._freeSlots[capacity - 1 - slot] = slot;
    }
  }

  get capacity() {
    return this._capacity;
  }

  get activeCount() {
    return this._activeCount;
  }

  acquire() {
    if (this._freeCount === 0) return null;
    const slot = this._freeSlots[--this._freeCount];
    let generation = (this._generations[slot] + 1) >>> 0;
    if (generation === 0) generation = 1;
    this._generations[slot] = generation;

    const item = this._items[slot];
    setPoolFields(item, slot, generation, true);
    this._activePosition[slot] = this._activeCount;
    this._activeSlots[this._activeCount++] = slot;
    return item;
  }

  release(item) {
    const slot = this._slotByItem.get(item);
    if (slot === undefined) throw new TypeError('Cannot release an item owned by another pool');
    const position = this._activePosition[slot];
    if (position < 0 || !item.active) {
      throw new Error(`FixedPool item ${slot} is not active`);
    }

    const lastPosition = this._activeCount - 1;
    const lastSlot = this._activeSlots[lastPosition];
    if (position !== lastPosition) {
      this._activeSlots[position] = lastSlot;
      this._activePosition[lastSlot] = position;
    }
    this._activeCount = lastPosition;
    this._activePosition[slot] = -1;

    this._reset(item, slot);
    setPoolFields(item, slot, this._generations[slot], false);
    this._freeSlots[this._freeCount++] = slot;
    return true;
  }

  forEachActive(visitor) {
    if (typeof visitor !== 'function') throw new TypeError('visitor must be a function');
    let position = 0;
    while (position < this._activeCount) {
      const slot = this._activeSlots[position];
      const item = this._items[slot];
      visitor(item, slot, position);
      // If visitor released this item, a swapped item now occupies this position.
      if (position < this._activeCount && this._activeSlots[position] === slot) position += 1;
    }
  }

  clear() {
    while (this._activeCount > 0) {
      const slot = this._activeSlots[this._activeCount - 1];
      this.release(this._items[slot]);
    }
  }

  assertIntegrity() {
    if (this._activeCount + this._freeCount !== this._capacity) {
      throw new Error('FixedPool active and free counts do not match capacity');
    }
    const marks = this._integrityMarks;
    marks.fill(0);

    for (let position = 0; position < this._activeCount; position += 1) {
      const slot = this._activeSlots[position];
      if (slot < 0 || slot >= this._capacity || marks[slot] !== 0) {
        throw new Error('FixedPool active slot list is corrupt');
      }
      marks[slot] = 1;
      const item = this._items[slot];
      if (!item.active || this._activePosition[slot] !== position) {
        throw new Error(`FixedPool active metadata is corrupt at slot ${slot}`);
      }
      if (
        item.poolIndex !== slot || item._poolIndex !== slot ||
        item.generation !== this._generations[slot] ||
        item._generation !== this._generations[slot]
      ) {
        throw new Error(`FixedPool public metadata is corrupt at slot ${slot}`);
      }
    }

    for (let position = 0; position < this._freeCount; position += 1) {
      const slot = this._freeSlots[position];
      if (slot < 0 || slot >= this._capacity || marks[slot] !== 0) {
        throw new Error('FixedPool free slot list is corrupt');
      }
      marks[slot] = 2;
      if (this._activePosition[slot] !== -1 || this._items[slot].active) {
        throw new Error(`FixedPool free metadata is corrupt at slot ${slot}`);
      }
    }
    return true;
  }
}
