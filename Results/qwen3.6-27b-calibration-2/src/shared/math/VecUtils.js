/**
 * VecUtils — Vector math helpers for game logic.
 * Pure functions, no allocations where possible.
 */

import * as THREE from 'three';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

/**
 * Clamp a vector's magnitude to a maximum value.
 * Mutates `vec` in place.
 */
export function clampMagnitude(vec, maxMag) {
  const len = vec.length();
  if (len > maxMag && len > 0) {
    vec.multiplyScalar(maxMag / len);
  }
  return vec;
}

/**
 * Random direction on a unit sphere.
 */
export function randomSphereDirection() {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi)
  );
}

/**
 * Random direction in XY plane (2D unit circle).
 */
export function randomCircleDirection() {
  const theta = Math.random() * Math.PI * 2;
  return new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
}

/**
 * Lerp between two vectors. Mutates `out` or creates new.
 */
export function lerpVector(out, a, b, t) {
  return out.lerpVectors(a, b, t);
}

/**
 * Smooth step interpolation.
 */
export function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Quadratic bezier point at parameter t.
 */
export function bezierQuadratic(p0, p1, p2, t, out) {
  _v.subVectors(p1, p0);
  _v2.subVectors(p2, p1);
  _v.multiplyScalar(t);
  _v2.multiplyScalar(1 - t);
  return out.copy(p0).add(_v).add(_v2);
}

/**
 * Cubic bezier point at parameter t.
 */
export function bezierCubic(p0, p1, p2, p3, t, out) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  _v.copy(p0).multiplyScalar(mt3);
  _v2.copy(p1).multiplyScalar(3 * mt2 * t);
  _v.add(_v2);
  _v.add(p2.clone().multiplyScalar(3 * mt * t2));
  _v.add(p3.clone().multiplyScalar(t3));
  return out.copy(_v);
}

/**
 * Angle between two 2D vectors (radians, signed).
 */
export function angle2D(a, b) {
  return Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
}

/**
 * Rotate a 2D vector by angle (radians) around origin.
 */
export function rotate2D(vec, angle, out) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = vec.x * cos - vec.y * sin;
  const y = vec.x * sin + vec.y * cos;
  return out.set(x, y, vec.z);
}

/**
 * Random float in [min, max].
 */
export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Random integer in [min, max] inclusive.
 */
export function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/**
 * Map value from [inMin, inMax] to [outMin, outMax].
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/**
 * Clamp value to [min, max].
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
