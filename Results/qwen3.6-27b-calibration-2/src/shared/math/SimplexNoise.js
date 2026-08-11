/**
 * Simplex Noise — 2D and 3D procedural noise generator.
 * Used for geometry displacement, terrain, and organic variation.
 * Ported from the classic Stefan Gustavson implementation.
 */

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;

// Permutation table (1-255, duplicated to 512 for overflow safety)
const perm = new Uint8Array(512);
const permMod12 = new Uint8Array(512);

/**
 * Seed the noise generator.
 * @param {number} seed
 */
export function simplexSeed(seed) {
  // Simple LCG-based shuffle
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
}

// Default seed
simplexSeed(42);

// Gradient vectors for 2D
const grad2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [1, 0], [-1, 0],
  [0, 1], [0, -1], [0, 1], [0, -1]
];

// Gradient vectors for 3D
const grad3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
];

/**
 * 2D Simplex noise in range [-1, 1].
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function simplex2(xin, yin) {
  let n0, n1, n2;
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1.0 + 2.0 * G2;
  const y2 = y0 - 1.0 + 2.0 * G2;
  const ii = i & 255;
  const jj = j & 255;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 < 0) n0 = 0;
  else {
    t0 *= t0;
    n0 = t0 * t0 * grad2[permMod12[ii + perm[jj]]][0] * x0 + grad2[permMod12[ii + perm[jj]]][1] * y0;
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 < 0) n1 = 0;
  else {
    t1 *= t1;
    n1 = t1 * t1 * grad2[permMod12[ii + i1 + perm[jj + j1]]][0] * x1 + grad2[permMod12[ii + i1 + perm[jj + j1]]][1] * y1;
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 < 0) n2 = 0;
  else {
    t2 *= t2;
    n2 = t2 * t2 * grad2[permMod12[ii + 1 + perm[jj + 1]]][0] * x2 + grad2[permMod12[ii + 1 + perm[jj + 1]]][1] * y2;
  }

  return 70.0 * (n0 + n1 + n2);
}

/**
 * 3D Simplex noise in range [-1, 1].
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {number}
 */
export function simplex3(xin, yin, zin) {
  let n0, n1, n2, n3;
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  const z0 = zin - (k - t);

  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0)      { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else               { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0)       { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0)  { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else               { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0 * G3;
  const y2 = y0 - j2 + 2.0 * G3;
  const z2 = z0 - k2 + 2.0 * G3;
  const x3 = x0 - 1.0 + 3.0 * G3;
  const y3 = y0 - 1.0 + 3.0 * G3;
  const z3 = z0 - 1.0 + 3.0 * G3;

  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;

  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 < 0) n0 = 0;
  else {
    t0 *= t0;
    n0 = t0 * t0 * (grad3[permMod12[ii + perm[jj + perm[kk]]]][0] * x0 +
                        grad3[permMod12[ii + perm[jj + perm[kk]]]][1] * y0 +
                        grad3[permMod12[ii + perm[jj + perm[kk]]]][2] * z0);
  }

  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 < 0) n1 = 0;
  else {
    t1 *= t1;
    n1 = t1 * t1 * (grad3[permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]][0] * x1 +
                        grad3[permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]][1] * y1 +
                        grad3[permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]][2] * z1);
  }

  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 < 0) n2 = 0;
  else {
    t2 *= t2;
    n2 = t2 * t2 * (grad3[permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]][0] * x2 +
                        grad3[permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]][1] * y2 +
                        grad3[permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]][2] * z2);
  }

  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 < 0) n3 = 0;
  else {
    t3 *= t3;
    n3 = t3 * t3 * (grad3[permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]][0] * x3 +
                        grad3[permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]][1] * y3 +
                        grad3[permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]][2] * z3);
  }

  return 32.0 * (n0 + n1 + n2 + n3);
}

/**
 * Fractal Brownian Motion — layered noise for organic detail.
 * @param {number} x
 * @param {number} y
 * @param {number} octaves - number of layers (default 4)
 * @param {number} persistence - amplitude falloff per octave (default 0.5)
 * @returns {number}
 */
export function fbm2(x, y, octaves = 4, persistence = 0.5) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * simplex2(x * frequency, y * frequency);
    maxVal += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return value / maxVal;
}

/**
 * Fractal Brownian Motion — 3D version.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} octaves
 * @param {number} persistence
 * @returns {number}
 */
export function fbm3(x, y, z, octaves = 4, persistence = 0.5) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * simplex3(x * frequency, y * frequency, z * frequency);
    maxVal += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return value / maxVal;
}
