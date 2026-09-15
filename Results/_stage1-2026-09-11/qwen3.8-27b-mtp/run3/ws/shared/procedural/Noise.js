// shared/procedural/Noise.js — deterministic PRNG + value noise (pure JS, no deps).
// mulberry32 is used for every seeded draw in the game so runs are reproducible.

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Alias — several game modules import the PRNG factory under this name.
export const mulberry32 = rng;

// Hash an integer pair into [0,1). Deterministic across runs.
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// 1D value noise in [0,1).
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash2(i, seed);
  const b = hash2(i + 1, seed);
  return a + (b - a) * smooth(f);
}

// 2D value noise in [0,1).
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash2(ix, iy + seed * 131);
  const b = hash2(ix + 1, iy + seed * 131);
  const c = hash2(ix, iy + 1 + seed * 131);
  const d = hash2(ix + 1, iy + 1 + seed * 131);
  const u = smooth(fx);
  const v = smooth(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Fractal Brownian motion, octaves of value noise. Returns [0,1).
export function fbm(x, y, seed = 0, octaves = 4) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq, y * freq, seed + i * 97) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.13;
  }
  return sum / norm;
}
