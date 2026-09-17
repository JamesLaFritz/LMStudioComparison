export class SeededRandom {
  constructor(seed = 1) {
    this.reset(seed);
  }
  reset(seed) {
    this.state = Number(seed) >>> 0 || 0x6d2b79f5;
  }
  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }
  range(min, max) {
    return min + (max - min) * this.next();
  }
  int(min, maxExclusive) {
    return Math.floor(this.range(min, maxExclusive));
  }
}
