const GRAD3 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1]
];

/**
 * Hand-written 2D simplex noise (Gustavson-style), seeded permutation table.
 * No external noise library — required for procedural-only asset generation.
 */
export class NoiseField {
  constructor(seed = 1337) {
    this._perm = new Uint8Array(512);
    this._permMod8 = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    let s = seed >>> 0;
    const nextRand = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967295;
    };

    for (let i = 255; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }

    for (let i = 0; i < 512; i++) {
      this._perm[i] = p[i & 255];
      this._permMod8[i] = this._perm[i] % 8;
    }
  }

  noise2D(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) {
      i1 = 1; j1 = 0;
    } else {
      i1 = 0; j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    const gi0 = this._permMod8[ii + this._perm[jj]];
    const gi1 = this._permMod8[ii + i1 + this._perm[jj + j1]];
    const gi2 = this._permMod8[ii + 1 + this._perm[jj + 1]];

    const n0 = this._corner(x0, y0, gi0);
    const n1 = this._corner(x1, y1, gi1);
    const n2 = this._corner(x2, y2, gi2);

    return 70 * (n0 + n1 + n2);
  }

  _corner(x, y, gi) {
    let t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    t *= t;
    const grad = GRAD3[gi];
    return t * t * (grad[0] * x + grad[1] * y);
  }

  /** Fractal Brownian Motion — layered octaves for richer procedural surfaces. */
  fbm2D(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let maxAmplitude = 0;
    for (let o = 0; o < octaves; o++) {
      sum += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return sum / maxAmplitude;
  }
}
