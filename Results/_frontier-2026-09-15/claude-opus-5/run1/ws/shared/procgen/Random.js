// Seeded PRNG (mulberry32). Deterministic given a seed, so a run can be reproduced.

export class Random {
  constructor(seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  reseed(seed) {
    this.seed = seed >>> 0;
    this.state = this.seed;
    return this;
  }

  /** Uniform float in [0, 1). */
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min, max) {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }

  chance(probability) {
    return this.next() < probability;
  }

  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }

  /** Standard normal via Box–Muller. */
  gaussian(mean = 0, stdDev = 1) {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Weighted choice: `weights[i]` is the relative weight of `items[i]`. */
  weighted(items, weights) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** In-place Fisher–Yates shuffle. */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }
}
