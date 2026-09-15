// shared/math/Utils.js — scalar math helpers used across the collection.
// Pure functions, no dependencies.

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Frame-rate independent exponential damping toward a target.
// rate: higher = snappier. Returns the new value.
export function damp(current, target, rate, dt) {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

export function rand(min = 0, max = 1) {
  return min + Math.random() * (max - min);
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInCubic(t) {
  return t * t * t;
}

// Wrap an angle difference into [-PI, PI].
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Interpolate between two angles along the shortest arc.
export function angleLerp(a, b, t) {
  return a + wrapAngle(b - a) * t;
}

export function sign(v) {
  return v < 0 ? -1 : v > 0 ? 1 : 0;
}

// Deterministic PRNG (mulberry32) for reproducible procedural generation.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
