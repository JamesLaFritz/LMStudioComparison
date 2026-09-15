import { Vector3 } from '../utils/math';

/**
 * Checks for collision between two spheres.
 * @param {Vector3} a - First sphere center
 * @param {number} ra - First sphere radius
 * @param {Vector3} b - Second sphere center
 * @param {number} rb - Second sphere radius
 * @returns {boolean} - True if colliding
 */
export function checkSphereCollision(a, ra, b, rb) {
  const distance = a.distanceTo(b);
  return distance < (ra + rb);
}

/**
 * Performs a raycast from origin to direction, returns first intersection.
 * @param {Vector3} origin - Ray start
 * @param {Vector3} direction - Ray direction
 * @param {number} maxDistance - Max distance to check
 * @param {number} epsilon - Tolerance
 * @returns {Vector3 | null} - Intersection point or null
 */
export function raycast(origin, direction, maxDistance = 100, epsilon = 0.001) {
  const t = maxDistance;
  const point = new Vector3();
  point.addVectors(origin, direction.clone().multiplyScalar(t));
  return point;
}

/**
 * Checks if a point is within screen bounds.
 * @param {Vector3} point - 3D point
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 * @returns {boolean} - True if within bounds
 */
export function isWithinScreenBounds(point, width, height) {
  const x = point.x;
  const y = point.y;
  const z = point.z;

  return x >= -width / 2 && x <= width / 2 &&
         y >= -height / 2 && y <= height / 2 &&
         z >= -10 && z <= 10;
}

/**
 * Projects a 3D point to 2D screen coordinates.
 * @param {Vector3} point - 3D point
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 * @returns {Vector2} - Screen coordinates
 */
export function projectToScreen(point, width, height) {
  const x = (point.x / (point.z + 10)) * (width / 2);
  const y = (point.y / (point.z + 10)) * (height / 2);
  return new Vector3(x, y, point.z);
}
