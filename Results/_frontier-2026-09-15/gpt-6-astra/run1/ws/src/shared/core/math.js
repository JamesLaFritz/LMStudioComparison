export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const moveTowards = (v, target, delta) =>
  v + clamp(target - v, -delta, delta);
export const damp = (v, target, lambda, dt) =>
  lerp(v, target, 1 - Math.exp(-lambda * dt));
