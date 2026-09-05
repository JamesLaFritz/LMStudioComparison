/**
 * Frame-rate independent math helpers shared by every title.
 *
 * The single most important function in this file is `damp`. Naive smoothing of
 * the form `v += (target - v) * k * dt` is frame-rate dependent: at 30fps it
 * converges at a visibly different rate than at 144fps, and at large dt it
 * overshoots and oscillates. The exponential form used here is exact for any dt.
 */

export const TAU = Math.PI * 2;
export const HALF_PI = Math.PI * 0.5;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const EPSILON = 1e-6;

/** @returns {number} `v` restricted to [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** @returns {number} `v` restricted to [0, 1]. */
export function saturate(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Linear interpolation. `t` is not clamped. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Inverse of `lerp`: where does `v` sit between a and b, as 0..1 (clamped)? */
export function inverseLerp(a, b, v) {
  if (Math.abs(b - a) < EPSILON) return 0;
  return saturate((v - a) / (b - a));
}

/** Remap `v` from range [aIn,bIn] to [aOut,bOut], clamped at both ends. */
export function remap(v, aIn, bIn, aOut, bOut) {
  return lerp(aOut, bOut, inverseLerp(aIn, bIn, v));
}

/**
 * Frame-rate independent exponential smoothing toward a target.
 *
 * `lambda` is the decay rate: the value covers `1 - 1/e` (~63%) of the
 * remaining distance every `1/lambda` seconds, regardless of how that time is
 * subdivided into frames.
 */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Angular variant of `damp` that takes the short way around the circle. */
export function dampAngle(current, target, lambda, dt) {
  const delta = wrapAngle(target - current);
  return current + delta * (1 - Math.exp(-lambda * dt));
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a) {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
}

/** Positive modulo: `mod(-1, 5) === 4`. */
export function mod(n, m) {
  return ((n % m) + m) % m;
}

/** Classic Hermite smoothstep between two edges. */
export function smoothstep(edge0, edge1, x) {
  const t = saturate((x - edge0) / (edge1 - edge0 || EPSILON));
  return t * t * (3 - 2 * t);
}

/** Ken Perlin's smoother variant: zero first *and* second derivative at the edges. */
export function smootherstep(edge0, edge1, x) {
  const t = saturate((x - edge0) / (edge1 - edge0 || EPSILON));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/* ------------------------------------------------------------------ *
 * Easing curves. All take and return normalised 0..1.
 * ------------------------------------------------------------------ */

export function easeInQuad(t) {
  return t * t;
}

export function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutCubic(t) {
  const u = 1 - t;
  return 1 - u * u * u;
}

export function easeInCubic(t) {
  return t * t * t;
}

export function easeOutQuart(t) {
  const u = 1 - t;
  return 1 - u * u * u * u;
}

export function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Overshooting ease used for the wave warp-in. `overshoot` of 1.70158 gives the
 * canonical ~10% overshoot; larger values snap harder.
 */
export function easeOutBack(t, overshoot = 1.70158) {
  const c3 = overshoot + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + overshoot * u * u;
}

/** Decaying elastic ring-out, used for UI pops. */
export function easeOutElastic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c4 = TAU / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/**
 * A critically damped spring step. Unlike `damp` this preserves velocity, so it
 * is the right tool when the target itself is moving and you want the follower
 * to lead into the motion rather than lag behind it.
 *
 * @param {{value:number, velocity:number}} state mutated in place
 */
export function springStep(state, target, stiffness, dt) {
  const damping = 2 * Math.sqrt(stiffness);
  const accel = (target - state.value) * stiffness - state.velocity * damping;
  state.velocity += accel * dt;
  state.value += state.velocity * dt;
  return state.value;
}

/* ------------------------------------------------------------------ *
 * Cheap deterministic hashing. Used where a seeded PRNG object would be
 * overkill — e.g. per-voxel jitter during bunker erosion, where we want the
 * same cell to erode the same way every time without storing anything.
 * ------------------------------------------------------------------ */

/** Deterministic 0..1 hash of two integers plus a seed. */
export function hash01(x, y, seed = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 2147483647;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Deterministic 0..1 hash of a single integer. */
export function hash1(x) {
  let h = (x | 0) * 2654435761;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Sign that returns 0 for 0, matching GLSL semantics. */
export function sign(v) {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Move `current` toward `target` by at most `maxDelta`. */
export function moveTowards(current, target, maxDelta) {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

/** True when two floats are within `tolerance`. */
export function approxEqual(a, b, tolerance = 1e-4) {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Applies a radial deadzone then a response curve to an analog axis.
 * Below `deadzone` the result is exactly 0, and the remaining range is
 * rescaled to a full 0..1 so the stick still reaches its limits.
 */
export function applyDeadzone(value, deadzone = 0.18, exponent = 2) {
  const a = Math.abs(value);
  if (a <= deadzone) return 0;
  const t = (a - deadzone) / (1 - deadzone);
  return Math.sign(value) * Math.pow(t, exponent);
}
