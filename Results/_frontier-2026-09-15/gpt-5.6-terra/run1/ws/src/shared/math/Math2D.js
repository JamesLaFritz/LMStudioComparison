export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function moveToward(current, target, maxDelta) {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }
  return Math.max(current - maxDelta, target);
}

export function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

export function smoothstep(min, max, value) {
  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

export function hashNoise(value) {
  const result = Math.sin(value * 12.9898 + 78.233) * 43758.5453123;
  return result - Math.floor(result);
}
