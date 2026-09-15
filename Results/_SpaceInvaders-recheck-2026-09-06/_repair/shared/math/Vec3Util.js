import * as THREE from 'three';   // [REPAIR 2026-09-06 - not model output]
/**
 * Vec3Util — Lightweight vector mathematics helpers for Three.js games.
 * All methods are static; no class instantiation required.
 */

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

export default {
  /**
   * Linear interpolation between two vectors.
   */
  lerp(a, b, t) {
    return a.clone().lerp(b, t);
  },

  /**
   * Clamp a value between min and max.
   */
  clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  },

  /**
   * Dot product of two vectors.
   */
  dot(a, b) {
    return a.dot(b);
  },

  /**
   * Cross product — returns new vector.
   */
  cross(a, b) {
    return _v3.crossVectors(a, b);
  },

  /**
   * Distance squared between two vectors (avoids sqrt for comparisons).
   */
  distSq(a, b) {
    return a.distanceToSquared(b);
  },

  /**
   * Euclidean distance between two vectors.
   */
  dist(a, b) {
    return a.distanceTo(b);
  },

  /**
   * Normalize a vector — returns new normalized vector.
   */
  normalize(v) {
    return v.clone().normalize();
  },

  /**
   * Scale a vector by a scalar.
   */
  scale(v, s) {
    return _v.copy(v).multiplyScalar(s);
  },

  /**
   * Subtract b from a — returns new vector.
   */
  sub(a, b) {
    return _v2.subVectors(a, b);
  },

  /**
   * Add b to a — returns new vector.
   */
  add(a, b) {
    return _v3.addVectors(a, b);
  },

  /**
   * Reflect a direction vector off a surface normal.
   */
  reflect(direction, normal) {
    const n = new THREE.Vector3().copy(normal).normalize();
    return _v2.copy(direction).sub(n.multiplyScalar(2 * direction.dot(n)));
  },

  /**
   * Smoothstep interpolation (smooth easing between 0 and 1).
   */
  smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  },

  /**
   * Random float between min and max.
   */
  randomFloat(min, max) {
    return Math.random() * (max - min) + min;
  },

  /**
   * Random integer between min and max (inclusive).
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Convert a world position to screen space (-1 to +1 range).
   */
  worldToScreen(worldPos, camera, renderer) {
    const v = new THREE.Vector3().copy(worldPos);
    v.project(camera);
    return {
      x: (v.x + 1) * 0.5,
      y: -(v.y - 1) * 0.5,
      z: v.z,
    };
  },

  /**
   * Convert screen space (-1 to +1) back to world position at a given depth.
   */
  screenToWorld(screenX, screenY, camera, depth) {
    const v = new THREE.Vector3();
    v.set((screenX * 2 - 1), -(screenY * 2 - 1), depth);
    v.unproject(camera);
    return v;
  },

  /**
   * Angle between two vectors in radians.
   */
  angle(a, b) {
    return Math.acos(THREE.MathUtils.clamp(a.dot(b) / (a.length() * b.length()), -1, 1));
  },

  /**
   * Create a random direction vector on the unit sphere.
   */
  randomDirection() {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi),
    );
  },

  /**
   * Create a random direction vector within a cone (in radians).
   */
  randomDirectionInCone(direction, coneAngle) {
    const perp1 = new THREE.Vector3();
    const perp2 = new THREE.Vector3();

    // Find two perpendicular vectors to the main direction
    if (Math.abs(direction.y) < 0.99) {
      perp1.set(1, 0, 0).cross(direction).normalize();
    } else {
      perp1.set(0, 1, 0).cross(direction).normalize();
    }
    perp2.crossVectors(direction, perp1).normalize();

    const angle = Math.random() * coneAngle;
    const r = Math.sin(angle);
    const h = Math.cos(angle);

    return new THREE.Vector3()
      .addScaledVector(direction, h)
      .addScaledVector(perp1, r * Math.cos(Math.random() * Math.PI * 2))
      .addScaledVector(perp2, r * Math.sin(Math.random() * Math.PI * 2))
      .normalize();
  },
};
