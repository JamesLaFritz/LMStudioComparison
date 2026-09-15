/**
 * Shared Math Utilities
 * Vector operations, interpolation, collision helpers
 */

// Linear interpolation
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

// Clamp value between min and max
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Random float in range [min, max]
export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

// Random integer in range [min, max] inclusive
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Wrap value within range (for circular behavior)
export function wrap(value, min, max) {
  const range = max - min;
  return ((value - min) % range + range) % range + min;
}

// Smoothstep interpolation (0 to 1 with ease-in-out)
export function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

// Ease out cubic
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Ease in-out quad
export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Simplex Noise Implementation (2D)
 * Compact implementation for procedural generation
 */
class SimplexNoise {
  constructor(seed = Math.random()) {
    this.p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      this.p[i] = i;
    }
    
    // Shuffle based on seed
    let s = seed * 12345.6789;
    for (let i = 255; i > 0; i--) {
      s -= Math.floor(s);
      const j = Math.floor(s * (i + 1));
      [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
    }
    
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
    }
    
    this.grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];
    
    this.grad2 = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  }
  
  dot2(g, x, y) {
    return g[0] * x + g[1] * y;
  }
  
  noise2D(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    
    let s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }
    
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    
    const ii = i & 255;
    const jj = j & 255;
    
    let n0, n1, n2;
    
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) {
      n0 = 0.0;
    } else {
      const gi0 = this.perm[ii + this.perm[jj]] % 12;
      t0 *= t0;
      n0 = t0 * t0 * this.dot2(this.grad2[gi0], x0, y0);
    }
    
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) {
      n1 = 0.0;
    } else {
      const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
      t1 *= t1;
      n1 = t1 * t1 * this.dot2(this.grad2[gi1], x1, y1);
    }
    
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) {
      n2 = 0.0;
    } else {
      const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
      t2 *= t2;
      n2 = t2 * t2 * this.dot2(this.grad2[gi2], x2, y2);
    }
    
    return 70.0 * (n0 + n1 + n2);
  }
}

// Singleton instance for shared noise
let simplexInstance = null;
export function getSimplexNoise() {
  if (!simplexInstance) {
    simplexInstance = new SimplexNoise();
  }
  return simplexInstance;
}

/**
 * AABB Collision Detection
 */
export function aabbCollision(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

/**
 * Circle-AABB Collision
 */
export function circleAABBCollision(circle, aabb) {
  const closestX = clamp(circle.x, aabb.x, aabb.x + aabb.width);
  const closestY = clamp(circle.y, aabb.y, aabb.y + aabb.height);
  
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  
  return (dx * dx + dy * dy) <= (circle.radius * circle.radius);
}

/**
 * Point in AABB
 */
export function pointInAABB(point, aabb) {
  return (
    point.x >= aabb.x &&
    point.x <= aabb.x + aabb.width &&
    point.y >= aabb.y &&
    point.y <= aabb.y + aabb.height
  );
}

/**
 * Distance squared (avoid sqrt for performance)
 */
export function distanceSquared(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/**
 * Normalize angle to [-PI, PI]
 */
export function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/**
 * Rotate point around center
 */
export function rotatePoint(x, y, centerX, centerY, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - centerX;
  const dy = y - centerY;
  return {
    x: centerX + dx * cos - dy * sin,
    y: centerY + dx * sin + dy * cos
  };
}

/**
 * Check if value is within range (inclusive)
 */
export function inRange(value, min, max) {
  return value >= min && value <= max;
}

/**
 * Map value from one range to another
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  const normalized = (value - inMin) / (inMax - inMin);
  return outMin + normalized * (outMax - outMin);
}

/**
 * Linear interpolation for vectors (simple 2D/3D)
 */
export function lerpVector(v1, v2, t) {
  const result = {};
  for (const key in v1) {
    if (v2.hasOwnProperty(key)) {
      result[key] = lerp(v1[key], v2[key], t);
    }
  }
  return result;
}

/**
 * Vector magnitude
 */
export function vectorMagnitude(x, y, z = 0) {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Normalize vector (returns normalized components)
 */
export function normalizeVector(x, y, z = 0) {
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return { x: x / mag, y: y / mag, z: z / mag };
}

/**
 * Dot product of two vectors
 */
export function dotProduct(x1, y1, z1 = 0, x2, y2, z2 = 0) {
  return x1 * x2 + y1 * y2 + z1 * z2;
}

/**
 * Cross product (returns new vector)
 */
export function crossProduct(x1, y1, z1, x2, y2, z2) {
  return {
    x: y1 * z2 - z1 * y2,
    y: z1 * x2 - x1 * z2,
    z: x1 * y2 - y1 * x2
  };
}

/**
 * Check if two rectangles overlap with margin
 */
export function aabbCollisionWithMargin(rect1, rect2, margin = 0) {
  return (
    rect1.x - margin < rect2.x + rect2.width + margin &&
    rect1.x + rect1.width + margin > rect2.x - margin &&
    rect1.y - margin < rect2.y + rect2.height + margin &&
    rect1.y + rect1.height + margin > rect2.y - margin
  );
}

/**
 * Check AABB collision (alias for aabbCollision)
 */
export function checkAABB2D(rect1, rect2) {
  return aabbCollision(rect1, rect2);
}

/**
 * Check sphere collision against another sphere or point
 */
export function checkSphereCollision(sphere1, sphere2) {
  const dx = sphere1.x - sphere2.x;
  const dy = sphere1.y - sphere2.y;
  const dz = (sphere1.z || 0) - (sphere2.z || 0);
  const distanceSq = dx * dx + dy * dy + dz * dz;
  const radiusSum = (sphere1.radius || sphere1.r) + (sphere2.radius || sphere2.r);
  return distanceSq <= radiusSum * radiusSum;
}

/**
 * Sphere vs AABB collision check
 */
export function sphereAABB(sphereCenter, radius, aabb) {
  // Find closest point on AABB to sphere center
  const closestX = clamp(sphereCenter.x, aabb.x, aabb.x + aabb.width);
  const closestY = clamp(sphereCenter.y, aabb.y, aabb.y + aabb.height);
  const closestZ = clamp(sphereCenter.z || 0, aabb.z || 0, (aabb.z || 0) + (aabb.depth || 0));
  
  // Check distance
  const dx = sphereCenter.x - closestX;
  const dy = sphereCenter.y - closestY;
  const dz = (sphereCenter.z || 0) - closestZ;
  
  return (dx * dx + dy * dy + dz * dz) <= radius * radius;
}
