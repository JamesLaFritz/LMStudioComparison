// shared/utils/Math.js — small, allocation-free math helpers used across the collection.

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Frame-rate independent exponential approach toward a target.
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function sign(v) {
  return v < 0 ? -1 : v > 0 ? 1 : 0;
}

export function squaredDistance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// Cheap organic 1D noise from layered sines (camera shake, drift, wobble).
export function layeredSine(x, t = 0) {
  return (
    Math.sin(x * 1.3 + t) * 0.5 +
    Math.sin(x * 2.7 + t * 1.3 + 1.7) * 0.3 +
    Math.sin(x * 4.1 + t * 0.7 + 4.2) * 0.2
  );
}

// Pick a random element from a non-empty array.
export function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}
