/**
 * Collision2D — 2D collision detection primitives for the game engine
 * All coordinates are in world space (x, y) with optional z ignored
 */

/**
 * AABB structure: { x, y, width, height } or { left, right, top, bottom }
 */

/**
 * Check if two AABB rectangles overlap
 * @param {Object} a - First rectangle { x, y, width, height }
 * @param {Object} b - Second rectangle { x, y, width, height }
 * @returns {boolean} True if overlapping
 */
export function checkAABBCollision(a, b) {
  const aLeft = 'left' in a ? a.left : a.x;
  const aRight = 'right' in a ? a.right : a.x + a.width;
  const aTop = 'top' in a ? a.top : a.y + a.height;
  const aBottom = 'bottom' in a ? a.bottom : a.y;

  const bLeft = 'left' in b ? b.left : b.x;
  const bRight = 'right' in b ? b.right : b.x + b.width;
  const bTop = 'top' in b ? b.top : b.y + b.height;
  const bBottom = 'bottom' in b ? b.bottom : b.y;

  return !(aRight < bLeft || aLeft > bRight || aBottom > bTop || aTop < bBottom);
}

/**
 * Check if two circles overlap
 * @param {Object} a - First circle { x, y, radius }
 * @param {Object} b - Second circle { x, y, radius }
 * @returns {boolean} True if overlapping
 */
export function checkCircleCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distanceSquared = dx * dx + dy * dy;
  const minDistance = a.radius + b.radius;
  return distanceSquared <= minDistance * minDistance;
}

/**
 * Check if a point is inside an AABB rectangle
 * @param {Object} point - Point { x, y }
 * @param {Object} rect - Rectangle { x, y, width, height } or { left, right, top, bottom }
 * @returns {boolean} True if point is inside
 */
export function checkPointInRect(point, rect) {
  const left = 'left' in rect ? rect.left : rect.x;
  const right = 'right' in rect ? rect.right : rect.x + rect.width;
  const top = 'top' in rect ? rect.top : rect.y + rect.height;
  const bottom = 'bottom' in rect ? rect.bottom : rect.y;

  return point.x >= left && point.x <= right && point.y >= bottom && point.y <= top;
}

/**
 * Check if a circle overlaps with an AABB rectangle
 * @param {Object} circle - Circle { x, y, radius }
 * @param {Object} rect - Rectangle { x, y, width, height } or { left, right, top, bottom }
 * @returns {boolean} True if overlapping
 */
export function checkCircleRectCollision(circle, rect) {
  const left = 'left' in rect ? rect.left : rect.x;
  const right = 'right' in rect ? rect.right : rect.x + rect.width;
  const top = 'top' in rect ? rect.top : rect.y + rect.height;
  const bottom = 'bottom' in rect ? rect.bottom : rect.y;

  // Find closest point on rectangle to circle center
  let closestX = Math.max(left, Math.min(circle.x, right));
  let closestY = Math.max(bottom, Math.min(circle.y, top));

  // Calculate distance from circle center to closest point
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;

  return (dx * dx + dy * dy) <= (circle.radius * circle.radius);
}

/**
 * Get the bounding box of a Three.js Mesh
 * @param {THREE.Mesh} mesh - The mesh to get bounds for
 * @returns {Object} Bounding box { x, y, width, height } in world space
 */
export function getMeshBoundingBox(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  return {
    x: box.min.x,
    y: box.min.y,
    z: box.min.z,
    width: box.max.x - box.min.x,
    height: box.max.y - box.min.y,
    depth: box.max.z - box.min.z,
    left: box.min.x,
    right: box.max.x,
    bottom: box.min.y,
    top: box.max.y
  };
}

/**
 * Simple line segment intersection for hit-scan style checks
 * @param {Object} p1 - Line 1 start { x, y }
 * @param {Object} p2 - Line 1 end { x, y }
 * @param {Object} p3 - Line 2 start { x, y }
 * @param {Object} p4 - Line 2 end { x, y }
 * @returns {Object|null} Intersection point or null if no intersection
 */
export function lineSegmentIntersection(p1, p2, p3, p4) {
  const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);

  if (denominator === 0) return null; // Parallel lines

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;

  // Check if intersection is within both line segments
  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: p1.x + ua * (p2.x - p1.x),
      y: p1.y + ua * (p2.y - p1.y)
    };
  }

  return null;
}

/**
 * Calculate distance between two points
 * @param {Object} a - Point A { x, y }
 * @param {Object} b - Point B { x, y }
 * @returns {number} Euclidean distance
 */
export function pointDistance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate squared distance between two points (faster for comparisons)
 * @param {Object} a - Point A { x, y }
 * @param {Object} b - Point B { x, y }
 * @returns {number} Squared Euclidean distance
 */
export function pointDistanceSquared(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}
