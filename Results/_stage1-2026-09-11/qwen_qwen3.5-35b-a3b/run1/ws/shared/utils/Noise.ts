// Simplex Noise Implementation for Procedural Generation
// Optimized 2D simplex noise with seeded random support

export class SimplexNoise {
  private perm: Uint8Array;
  private p: Uint8Array;

  constructor(seed?: number) {
    this.perm = new Uint8Array(512);
    this.p = new Uint8Array(512);
    
    const s = seed || Math.random() * 0xffffffff;
    const q = this.seededRandom(s);
    
    for (let i = 0; i < 256; i++) {
      this.p[i] = i;
    }
    
    // Fisher-Yates shuffle with seeded random
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(q() * (i + 1));
      [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
    }
    
    // Duplicate permutation table for overflow handling
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
    }
  }

  private seededRandom(seed: number): () => number {
    let state = seed;
    return function() {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : 0);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  public noise2D(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    // Skew input space to determine simplex cell
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    // Unskew back to get relative coordinates in the cell
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determine which simplex we're in
    let i1, j1;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    // Hash coordinates of the three corners
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]];
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]];

    // Calculate contributions from the three corners
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) {
      return 0.0;
    }
    t0 *= t0;
    const n0 = t0 * t0 * this.grad(gi0, x0, y0);

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) {
      return 0.0;
    }
    t1 *= t1;
    const n1 = t1 * t1 * this.grad(gi1, x1, y1);

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) {
      return 0.0;
    }
    t2 *= t2;
    const n2 = t2 * t2 * this.grad(gi2, x2, y2);

    // Scale to [-1, 1] range
    return 70.0 * (n0 + n1 + n2);
  }

  public octaveNoise2D(x: number, y: number, octaves: number = 4, lacunarity: number = 2.0, persistence: number = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}

// Singleton instance for shared usage
export const simplexNoise = new SimplexNoise();
