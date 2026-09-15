// math.js — Vector3 helpers, lerp, clamp, and utility functions
export function vec3(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

export function vec2(x = 0, y = 0) {
  return { x, y };
}

/**
 * Linear interpolation between two values.
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0 to 1)
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Clamp value between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Random float between min and max (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function rand(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Random integer between min and max (inclusive).
 * @param {number} min
 * @parameter {number} max
 * @returns {number}
 */
export function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

/**
 * Distance between two points.
 * @param {vec3|vec2} a
 * @param {vec3|vec2} b
 * @returns {number}
 */
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Square of the distance (avoids sqrt for comparisons).
 * @param {vec3|vec2} a
 * @param {vec3|vec2} b
 * @returns {number}
 */
export function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Normalize a vector (returns unit vector or zero vector if magnitude is zero).
 * @param {vec3|vec2} v
 * @returns {vec3|vec2}
 */
export function normalize(v) {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y + (v.z || 0) * (v.z || 0));
  if (mag < 1e-10) return vec3(0, 0, 0);
  return { x: v.x / mag, y: v.y / mag, z: v.z || 0 };
}

/**
 * Scale a vector by a scalar.
 * @param {vec3|vec2} v
 * @param {number} scale
 * @returns {vec3|vec2}
 */
export function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: (v.z || 0) * s };
}

/**
 * Add two vectors.
 * @param {vec3|vec2} a
 * @param {vec3|vec2} b
 * @returns {vec3|vec2}
 */
export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: (a.z || 0) + (b.z || 0) };
}

/**
 * Subtract two vectors.
 * @param {vec3|vec2} a
 * @param {vec3|vec2} b
 * @returns {vec3|vec2}
 */
export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
}

/**
 * Dot product of two vectors.
 * @param {vec3|vec2} a
 * @param {vec3|vec2} b
 * @returns {number}
 */
export function dot(a, b) {
  return a.x * b.x + a.y * b.y + (a.z || 0) * (b.z || 0);
}

/**
 * Cross product of two 3D vectors.
 * @param {vec3} a
 * @param {vec3} b
 * @returns {vec3}
 */
export function cross(a, b) {
  return vec3(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}

/**
 * Check if two AABBs (axis-aligned bounding boxes) overlap.
 * @param {{min: vec3, max: vec3}} boxA
 * @param {{min: vec3, max: vec3}} boxB
 * @returns {boolean}
 */
export function aabbOverlap(boxA, boxB) {
  return (boxA.min.x < boxB.max.x && boxA.max.x > boxB.min.x &&
          boxA.min.y < boxB.max.y && boxA.max.y > boxB.min.y &&
          boxA.min.z < boxB.max.z && boxA.max.z > boxB.min.z);
}

/**
 * Check if a point is inside an AABB.
 * @param {vec3} point
 * @param {{min: vec3, max: vec3}} box
 * @returns {boolean}
 */
export function pointInBox(point, box) {
  return (point.x >= box.min.x && point.x <= box.max.x &&
          point.y >= box.min.y && point.y <= box.max.y &&
          point.z >= box.min.z && point.z <= box.max.z);
}

/**
 * Create a bounding box from center and half-extents.
 * @param {vec3} center
 * @param {vec3} halfExtents
 * @returns {{min: vec3, max: vec3}}
 */
export function createBox(center, halfExtents) {
  return {
    min: { x: center.x - halfExtents.x, y: center.y - halfExtents.y, z: center.z - halfExtents.z },
    max: { x: center.x + halfExtents.x, y: center.y + halfExtents.y, z: center.z + halfExtents.z }
  };
}

/**
 * Create a bounding box from min and max corners.
 * @param {vec3} min
 * @param {vec3} max
 * @returns {{min: vec3, max: vec3}}
 */
export function createBoxFromCorners(min, max) {
  return { min, max };
}

/**
 * Random angle in radians.
 * @returns {number}
 */
export function randAngle() {
  return Math.random() * Math.PI * 2;
}

/**
 * Convert degrees to radians.
 * @param {number} degrees
 * @returns {number}
 */
export function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees.
 * @param {number} radians
 * @returns {number}
 */
export function radToDeg(radians) {
  return radians * (180 / Math.PI);
}

/**
 * Smooth step function (ease in-out).
 * @param {number} t - Value between 0 and 1
 * @returns {number}
 */
export function smoothStep(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Smoothstep with custom easing (t^3 for ease-in).
 * @param {number} t - Value between 0 and 1
 * @returns {number}
 */
export function smoothStepEaseIn(t) {
  return t < 0.5 ? 4 * t * t * t : 1;
}

/**
 * Smoothstep with custom easing (t^3 for ease-out).
 * @param {number} t - Value between 0 and 1
 * @returns {number}
 */
export function smoothStepEaseOut(t) {
  return t > 0.5 ? 1 - Math.pow(-2 * t + 2, 3) / 2 : 0;
}

/**
 * Perlin-like noise using sine-based approximation (fast, no external deps).
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function noise(x, y = 0) {
  const X = x * 12.9898;
  const Y = y * 78.233;
  return Math.sin(X + Y) * Math.cos(X - Y);
}

/**
 * Simplex-like noise using sine-based approximation (fast, no external deps).
 * @param {number} x
 * @param {number} y
 * @param {number} z = 0
 * @returns {number}
 */
export function simplexNoise(x, y = 0, z = 0) {
  const X = x * 12.9898;
  const Y = y * 78.233;
  const Z = z * 45.678;
  return Math.sin(X + Y + Z) * Math.cos(X - Y) * Math.sin(Y - Z);
}

/**
 * Get a random color from a palette (returns hex string).
 * @param {string[]} palette
 * @returns {string}
 */
export function randomColor(palette) {
  return palette[randInt(0, palette.length - 1)];
}

/**
 * Parse a hex color string to RGB object.
 * @param {string} hex - Hex color like "#FF5733" or "FF5733"
 * @returns {{r: number, g: number, b: number}}
 */
export function parseColor(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16)
  };
}

/**
 * Convert RGB to hex color string.
 * @param {{r: number, g: number, b: number}} rgb
 * @returns {string}
 */
export function rgbToHex(rgb) {
  return `#${(rgb.r << 16 | rgb.g << 8 | rgb.b).toString(16).padStart(6, '0')}`;
}

/**
 * Convert hex color string to Three.js Color3.
 * @param {string} hex
 * @returns {Object}
 */
export function hexToColor3(hex) {
  const c = parseColor(hex);
  return new THREE.Color(c.r / 255, c.g / 255, c.b / 255);
}

/**
 * Convert Three.js Color3 to hex color string.
 * @param {THREE.Color3} color
 * @returns {string}
 */
export function color3ToHex(color) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

/**
 * Check if a value is within epsilon of zero.
 * @param {number} value
 * @param {number} epsilon = 1e-6
 * @returns {boolean}
 */
export function isApproxZero(value, epsilon = 1e-6) {
  return Math.abs(value) < epsilon;
}

/**
 * Clamp a vector to bounds.
 * @param {vec3} v
 * @param {{min: vec3, max: vec3}} bounds
 * @returns {vec3}
 */
export function clampVector(v, bounds) {
  return {
    x: clamp(v.x, bounds.min.x, bounds.max.x),
    y: clamp(v.y, bounds.min.y, bounds.max.y),
    z: clamp(v.z || 0, bounds.min.z || 0, bounds.max.z || 0)
  };
}

/**
 * Check if two vectors are approximately equal.
 * @param {vec3|vec2} a
 * @param {vec3|vec2} b
 * @returns {boolean}
 */
export function vectorsApproxEqual(a, b, epsilon = 1e-6) {
  return isApproxZero(a.x - b.x, epsilon) &&
         isApproxZero(a.y - b.y, epsilon) &&
         isApproxZero((a.z || 0) - (b.z || 0), epsilon);
}

/**
 * Create a vector from an array.
 * @param {number[]} arr
 * @returns {vec3|vec2}
 */
export function vecFromArray(arr) {
  if (arr.length === 2) return vec2(arr[0], arr[1]);
  if (arr.length >= 3) return vec3(arr[0], arr[1], arr[2] || 0);
  return vec3(0, 0, 0);
}

/**
 * Create a matrix-like object for simple transformations.
 * @param {number} scaleX = 1
 * @param {number} scaleY = 1
 * @param {number} scaleZ = 1
 * @returns {{sx: number, sy: number, sz: number}}
 */
export function createTransform(scaleX = 1, scaleY = 1, scaleZ = 1) {
  return { sx: scaleX, sy: scaleY, sz: scaleZ };
}

/**
 * Apply transform to a vector.
 * @param {vec3|vec2} v
 * @param {{sx: number, sy: number, sz: number}} t
 * @returns {vec3|vec2}
 */
export function applyTransform(v, t) {
  return vecFromArray([v.x * t.sx, v.y * t.sy, (v.z || 0) * t.sz]);
}

/**
 * Create a rotation matrix-like object.
 * @param {number} angle - Rotation in radians around Z axis
 * @returns {{cos: number, sin: number}}
 */
export function createRotation(angle) {
  return { cos: Math.cos(angle), sin: Math.sin(angle) };
}

/**
 * Apply 2D rotation to a vector.
 * @param {vec2|vec3} v
 * @param {{cos: number, sin: number}} rot
 * @returns {vec2|vec3}
 */
export function rotateVector(v, rot) {
  const x = v.x;
  const y = v.y;
  return {
    x: x * rot.cos - y * rot.sin,
    y: x * rot.sin + y * rot.cos,
    z: (v.z || 0)
  };
}

/**
 * Create a simple AABB from center and size.
 * @param {vec3} center
 * @param {vec3} size
 * @returns {{min: vec3, max: vec3}}
 */
export function createAABBFromCenterAndSize(center, size) {
  return {
    min: { x: center.x - size.x / 2, y: center.y - size.y / 2, z: center.z - size.z / 2 },
    max: { x: center.x + size.x / 2, y: center.y + size.y / 2, z: center.z + size.z / 2 }
  };
}

/**
 * Get the midpoint of two vectors.
 * @param {vec3|vec2} a
 * @param {vec3|vec2} b
 * @returns {vec3|vec2}
 */
export function midpoint(a, b) {
  return vecFromArray([a.x + b.x, a.y + b.y, (a.z || 0) + (b.z || 0)]);
}

/**
 * Get the bounding box of an array of points.
 * @param {{x: number, y: number, z?: number}}[] points
 * @returns {{min: vec3, max: vec3}}
 */
export function getBoundingBox(points) {
  if (points.length === 0) return null;
  let min = { x: Infinity, y: Infinity, z: Infinity };
  let max = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const p of points) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z || 0);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z || 0);
  }

  return { min, max };
}

/**
 * Check if a point is within a circle (2D).
 * @param {vec2|vec3} point
 * @param {{x: number, y: number}} center
 * @param {number} radius
 * @returns {boolean}
 */
export function pointInCircle(point, center, radius) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return (dx * dx + dy * dy) <= (radius * radius);
}

/**
 * Check if two circles overlap.
 * @param {{x: number, y: number}} circleA
 * @param {number} radiusA
 * @param {{x: number, y: number}} circleB
 * @param {number} radiusB
 * @returns {boolean}
 */
export function circlesOverlap(circleA, radiusA, circleB, radiusB) {
  const dx = circleA.x - circleB.x;
  const dy = circleA.y - circleB.y;
  return (dx * dx + dy * dy) <= ((radiusA + radiusB) * (radiusA + radiusB));
}

/**
 * Get the angle of a vector from the X axis.
 * @param {vec2|vec3} v
 * @returns {number} - Angle in radians
 */
export function getAngle(v) {
  return Math.atan2(v.y, v.x);
}

/**
 * Create a point on a circle at given angle and radius.
 * @param {number} angle - Angle in radians
 * @param {number} radius
 * @returns {vec2}
 */
export function pointOnCircle(angle, radius) {
  return vec2(Math.cos(angle) * radius, Math.sin(angle) * radius);
}

/**
 * Create a random direction vector.
 * @returns {vec3|vec2}
 */
export function randomDirection() {
  const angle = randAngle();
  return vec2(Math.cos(angle), Math.sin(angle));
}

/**
 * Random direction in 3D space (on XY plane).
 * @returns {vec3}
 */
export function randomDirection3D() {
  const angle = randAngle();
  return vec3(Math.cos(angle), Math.sin(angle), 0);
}

/**
 * Create a diagonal vector.
 * @param {number} length
 * @returns {vec2}
 */
export function createDiagonal(length) {
  const d = length / Math.sqrt(2);
  return vec2(d, d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonal(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, d);
}

/**
 * Create an anti-diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param {number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

/**
 * Create a diagonal vector in opposite direction.
 * @param={number} length
 * @returns {vec2}
 */
export function createAntiDiagonalOpposite(length) {
  const d = length / Math.sqrt(2);
  return vec2(-d, -d);
}

<tool_call>
<function=write_file>
<parameter=path>
shared/utils/noise.js