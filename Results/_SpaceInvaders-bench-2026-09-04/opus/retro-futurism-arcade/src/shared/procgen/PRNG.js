/**
 * Seedable pseudo-random number generators.
 *
 * `Math.random()` is unseedable, which makes procedural content impossible to
 * reproduce. Every generated asset in this project — nebula, starfield, bunker
 * erosion jitter — draws from a seeded stream so that a given wave looks
 * identical on every machine and across reloads. That is not aesthetic
 * pedantry: it makes visual bugs reproducible.
 */

/**
 * Mulberry32. 32 bits of state, excellent statistical quality for its size,
 * and roughly as fast as `Math.random`.
 */
export class PRNG {
  /** @param {number|string} seed */
  constructor(seed = 1) {
    this.seed(seed);
  }

  /** (Re)seed the stream. Strings are hashed so callers can use readable seeds. */
  seed(seed) {
    this.state = (typeof seed === 'string' ? hashString(seed) : seed | 0) >>> 0;
    // A zero state is a fixed point for some generators; nudge it off zero.
    if (this.state === 0) this.state = 0x9e3779b9;
    this.initialState = this.state;
    return this;
  }

  /** Restart the stream from its original seed. */
  reset() {
    this.state = this.initialState;
    return this;
  }

  /** Uniform float in [0, 1). */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability `p`. */
  chance(p) {
    return this.next() < p;
  }

  /** Uniform float in [-1, 1). */
  signed() {
    return this.next() * 2 - 1;
  }

  /** Random element of an array. */
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /**
   * Approximately normal deviate via the Box-Muller transform. Used for
   * particle speed spreads, where a uniform distribution reads as artificial
   * and a Gaussian reads as an explosion.
   */
  gaussian(mean = 0, stdDev = 1) {
    // Guard against log(0).
    let u = this.next();
    if (u < 1e-9) u = 1e-9;
    const v = this.next();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /**
   * A point uniformly distributed inside the unit disc. The sqrt is required:
   * without it points cluster heavily toward the centre, which makes radial
   * particle bursts look like they are imploding.
   */
  insideUnitCircle(out = { x: 0, y: 0 }) {
    const r = Math.sqrt(this.next());
    const theta = this.next() * Math.PI * 2;
    out.x = Math.cos(theta) * r;
    out.y = Math.sin(theta) * r;
    return out;
  }

  /** A direction uniformly distributed on the unit sphere. */
  onUnitSphere(out = { x: 0, y: 0, z: 0 }) {
    const z = this.signed();
    const theta = this.next() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    out.x = Math.cos(theta) * r;
    out.y = Math.sin(theta) * r;
    out.z = z;
    return out;
  }

  /** In-place Fisher-Yates shuffle using this stream. */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
}

/** FNV-1a string hash, used to turn readable seeds into 32-bit integers. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Shared default stream for callers that genuinely do not care about the seed. */
export const defaultPRNG = new PRNG(0xc0ffee);
