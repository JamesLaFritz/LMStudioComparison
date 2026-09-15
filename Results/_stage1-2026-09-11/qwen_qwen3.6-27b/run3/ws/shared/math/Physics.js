/**
 * Pure AABB / sphere collision helpers. No engine.
 */

/**
 * Test AABB overlap.
 * @param {{x:number, y:number, w:number, h:number}} a
 * @param {{x:number, y:number, w:number, h:number}} b
 * @returns {boolean}
 */
export function aabbTest(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Test sphere vs AABB.
 * @param {{x:number, y:number, r:number}} sphere
 * @param {{x:number, y:number, w:number, h:number}} box
 * @returns {boolean}
 */
export function sphereAABBTest(sphere, box) {
  const closestX = Math.max(box.x, Math.min(sphere.x, box.x + box.w));
  const closestY = Math.max(box.y, Math.min(sphere.y, box.y + box.h));
  const dx = sphere.x - closestX;
  const dy = sphere.y - closestY;
  return dx * dx + dy * dy <= sphere.r * sphere.r;
}

/**
 * Resolve 1D overlap with restitution bounce.
 * Returns the velocity after collision response.
 * @param {number} v - current velocity
 * @param {number} restitution - bounciness (0..1)
 * @returns {number}
 */
export function resolveCollision(v, restitution = 0.6) {
  return -v * restitution;
}

/**
 * Linear interpolation between two scalar values.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Clamp a value to [min, max].
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Random float in [min, max).
 */
export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Random integer in [min, max] (inclusive).
 */
export function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
