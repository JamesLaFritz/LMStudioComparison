const NON_ZERO_SEED = 0x6d2b79f5;

function normalizeSeed(seed) {
  let normalized;
  if (typeof seed === 'string') {
    normalized = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      normalized ^= seed.charCodeAt(index);
      normalized = Math.imul(normalized, 16777619);
    }
  } else {
    normalized = Number(seed) >>> 0;
  }
  return normalized === 0 ? NON_ZERO_SEED : normalized >>> 0;
}

function mixSalt(state, salt) {
  let mixed = (state ^ 2166136261) >>> 0;
  const text = typeof salt === 'string' ? salt : String(Number(salt) >>> 0);
  for (let index = 0; index < text.length; index += 1) {
    mixed ^= text.charCodeAt(index);
    mixed = Math.imul(mixed, 16777619) >>> 0;
  }
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d) >>> 0;
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b) >>> 0;
  mixed ^= mixed >>> 16;
  return mixed === 0 ? NON_ZERO_SEED : mixed >>> 0;
}

/** Small deterministic xorshift32 generator with independent derived streams. */
export class SeededRng {
  constructor(seed = NON_ZERO_SEED) {
    this._state = normalizeSeed(seed);
  }

  get state() {
    return this._state >>> 0;
  }

  reset(seed = NON_ZERO_SEED) {
    this._state = normalizeSeed(seed);
    return this;
  }

  nextUint32() {
    let value = this._state >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this._state = value >>> 0;
    return this._state;
  }

  nextFloat() {
    return this.nextUint32() / 0x100000000;
  }

  range(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      throw new RangeError('range requires finite bounds with max >= min');
    }
    if (max === min) return min;
    return min + (max - min) * this.nextFloat();
  }

  fork(salt) {
    return new SeededRng(mixSalt(this._state, salt));
  }
}
