/**
 * AABB collision detection between two axis-aligned bounding boxes.
 * Each box is defined by { minX, maxX, minY, maxY } in world space.
 */
export function aabbOverlap(a, b) {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY
  );
}

/**
 * Check if point is within AABB.
 */
export function pointInAABB(point, box) {
  return (
    point.x >= box.minX &&
    point.x <= box.maxX &&
    point.y >= box.minY &&
    point.y <= box.maxY
  );
}

/**
 * Compute AABB from a THREE.Object3D with known half-width and half-height.
 */
export function getAABBFromObject(obj, halfW, halfH) {
  const pos = obj.position;
  return {
    minX: pos.x - halfW,
    maxX: pos.x + halfW,
    minY: pos.y - halfH,
    maxY: pos.y + halfH,
  };
}
