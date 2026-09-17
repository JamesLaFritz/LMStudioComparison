// Small, allocation-free numeric helpers shared by every game.

export const TAU = Math.PI * 2;
export const HALF_PI = Math.PI * 0.5;

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function inverseLerp(a, b, v) {
  return a === b ? 0 : (v - a) / (b - a);
}

export function remap(v, inMin, inMax, outMin, outMax) {
  return lerp(outMin, outMax, clamp01(inverseLerp(inMin, inMax, v)));
}

/** Frame-rate independent exponential smoothing toward `b`. `lambda` ≈ responsiveness (1/s). */
export function damp(a, b, lambda, dt) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

/** Move `current` toward `target` by at most `maxDelta`. */
export function approach(current, target, maxDelta) {
  const delta = target - current;
  if (delta > maxDelta) return current + maxDelta;
  if (delta < -maxDelta) return current - maxDelta;
  return target;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Wrap `v` into [min, max). */
export function wrap(v, min, max) {
  const range = max - min;
  if (range <= 0) return min;
  return min + (((v - min) % range) + range) % range;
}

export function sign(v) {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

/** Ping-pong `t` between 0 and 1. */
export function pingPong(t) {
  const m = ((t % 2) + 2) % 2;
  return m > 1 ? 2 - m : m;
}

/** Triangle pulse: 0 → 1 → 0 over t ∈ [0, 1]. */
export function pulse(t) {
  return Math.sin(clamp01(t) * Math.PI);
}
