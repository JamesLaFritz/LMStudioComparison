export class SeededRng {
  constructor(seed = 0x1a2b3c4d) {
    this.state = (seed >>> 0) || 0x1a2b3c4d;
  }

  nextUint() {
    let state = this.state;
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    this.state = state >>> 0;
    return this.state;
  }

  next() {
    return this.nextUint() / 0x100000000;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(min, maxInclusive) {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }

  chance(probability) {
    return this.next() < probability;
  }
}
