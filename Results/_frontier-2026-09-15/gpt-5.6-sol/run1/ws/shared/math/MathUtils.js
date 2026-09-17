export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inverseLerp = (a, b, value) => (a === b ? 0 : (value - a) / (b - a));

export function smoothstep(min, max, value) {
  const t = clamp(inverseLerp(min, max, value), 0, 1);
  return t * t * (3 - 2 * t);
}

export const easeOutCubic = (t) => 1 - (1 - clamp(t, 0, 1)) ** 3;

export function approach(value, target, maxDelta) {
  if (value < target) return Math.min(value + maxDelta, target);
  if (value > target) return Math.max(value - maxDelta, target);
  return target;
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function weightedIndex(weights, count, randomValue) {
  let total = 0;
  for (let i = 0; i < count; i += 1) total += Math.max(0, weights[i]);
  if (total <= 0) return -1;
  let cursor = clamp(randomValue, 0, 0.999999999) * total;
  for (let i = 0; i < count; i += 1) {
    cursor -= Math.max(0, weights[i]);
    if (cursor < 0) return i;
  }
  return count - 1;
}
