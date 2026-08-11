import * as THREE from 'three';

/**
 * AABB vs AABB (axis-aligned bounding boxes defined by min/max vectors)
 */
export function boxBox(aMin, aMax, bMin, bMax) {
  return (
    aMin.x <= bMax.x && aMax.x >= bMin.x &&
    aMin.y <= bMax.y && aMax.y >= bMin.y &&
    aMin.z <= bMax.z && aMax.z >= bMin.z
  );
}

/**
 * Sphere vs AABB
 */
export function sphereBox(center, radius, boxMin, boxMax) {
  const closest = new THREE.Vector3(
    Math.max(boxMin.x, Math.min(center.x, boxMax.x)),
    Math.max(boxMin.y, Math.min(center.y, boxMax.y)),
    Math.max(boxMin.z, Math.min(center.z, boxMax.z))
  );
  const diff = new THREE.Vector3().subVectors(center, closest);
  return diff.lengthSq() <= radius * radius;
}

/**
 * Sphere vs Sphere
 */
export function sphereSphere(a, aRadius, b, bRadius) {
  const distSq = a.distanceToSquared(b);
  return distSq <= (aRadius + bRadius) * (aRadius + bRadius);
}

/**
 * Get AABB from a Three.js Object3D (uses bounding box or manual extents)
 */
export function getObjectAABB(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  return { min: box.min.clone(), max: box.max.clone() };
}

/**
 * Ray vs AABB (slab method). Returns true if ray intersects box.
 * @param {THREE.Vector3} rayOrigin
 * @param {THREE.Vector3} rayDir  (must be normalized)
 * @param {THREE.Vector3} boxMin
 * @param {THREE.Vector3} boxMax
 * @returns {{ hit: boolean, tMin: number, tMax: number }}
 */
export function rayBox(rayOrigin, rayDir, boxMin, boxMax) {
  let tMin = 0;
  let tMax = Infinity;

  for (let i = 0; i < 3; i++) {
    const axis = ['x', 'y', 'z'][i];
    const dir = rayDir[axis];
    if (Math.abs(dir) < 1e-8) {
      if (rayOrigin[axis] < boxMin[axis] || rayOrigin[axis] > boxMax[axis]) {
        return { hit: false, tMin, tMax };
      }
    } else {
      let t1 = (boxMin[axis] - rayOrigin[axis]) / dir;
      let t2 = (boxMax[axis] - rayOrigin[axis]) / dir;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return { hit: false, tMin, tMax };
    }
  }
  return { hit: true, tMin, tMax };
}

/**
 * Line segment vs AABB
 */
export function lineBox(start, end, boxMin, boxMax) {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  if (len < 1e-8) return false;
  dir.normalize();
  const { hit, tMin, tMax } = rayBox(start, dir, boxMin, boxMax);
  if (!hit) return false;
  return tMax >= 0 && tMin <= len;
}

/**
 * Clamp a point inside an AABB
 */
export function clampToBox(point, boxMin, boxMax) {
  return new THREE.Vector3(
    Math.max(boxMin.x, Math.min(point.x, boxMax.x)),
    Math.max(boxMin.y, Math.min(point.y, boxMax.y)),
    Math.max(boxMin.z, Math.min(point.z, boxMax.z))
  );
}

/**
 * Lerp between two AABBs
 */
export function lerpBox(a, b, t) {
  return {
    min: new THREE.Vector3().lerpVectors(a.min, b.min, t),
    max: new THREE.Vector3().lerpVectors(a.max, b.max, t),
  };
}
