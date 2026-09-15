/**
 * Math utilities for Space Invaders game.
 * Lightweight vector math, interpolation, clamping, and angle normalization.
 */

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function angleWrap(angle) {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  else if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function vec3Lerp(v1, v2, t) {
  return {
    x: lerp(v1.x, v2.x, t),
    y: lerp(v1.y, v2.y, t),
    z: lerp(v1.z, v2.z, t),
  };
}

export function vec3Distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function dotProduct(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function normalizeVec3(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

/**
 * Interpolate between two hex colors.
 * t=0 returns colorA, t=1 returns colorB.
 */
export function lerpColor(colorA, colorB, t) {
  const a = new THREE.Color(colorA);
  const b = new THREE.Color(colorB);
  return Math.round(
    (a.r + (b.r - a.r) * t) * 255
  ) << 16 |
    (Math.round((a.g + (b.g - a.g) * t) * 255)) << 8 |
    Math.round((a.b + (b.b - a.b) * t) * 255);
}
