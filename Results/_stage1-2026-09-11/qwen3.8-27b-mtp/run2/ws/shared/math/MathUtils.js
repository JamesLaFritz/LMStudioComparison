/**
 * MathUtils — small numeric helpers shared by every game in the collection.
 * Pure functions, no dependencies.
 */

export const TAU = Math.PI * 2;

export function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Framerate-independent exponential damping toward a target. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Random float in [min, max). */
export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

/** Random integer in [min, max] inclusive. */
export function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Wrap an angle into (-PI, PI]. */
export function angleWrap(a) {
  a = a % TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

/** Smoothstep edge function. */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** True when a point is inside an axis-aligned box. */
export function pointInRect(px, py, cx, cy, halfW, halfH) {
  return Math.abs(px - cx) <= halfW && Math.abs(py - cy) <= halfH;
}
