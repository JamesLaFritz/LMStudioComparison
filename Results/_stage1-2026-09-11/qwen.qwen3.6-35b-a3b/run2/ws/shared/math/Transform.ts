import * as THREE from 'three';

export function worldToLocal(worldPos: THREE.Vector3, camera: THREE.Camera): THREE.Vector3 {
  const local = worldPos.clone();
  local.applyMatrix4(camera.matrixWorldInverse);
  return local;
}

export function localToWorld(localPos: THREE.Vector3, camera: THREE.Camera): THREE.Vector3 {
  const world = localPos.clone();
  world.applyMatrix4(camera.matrixWorld);
  return world;
}

export function clampToBox(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function angleBetween(v1: THREE.Vector3, v2: THREE.Vector3): number {
  const dot = v1.dot(v2);
  const mag = v1.length() * v2.length();
  return Math.acos(Math.max(-1, Math.min(1, dot / mag)));
}

export function normalizeSafe(v: THREE.Vector3, fallback: THREE.Vector3 = new THREE.Vector3(1, 0, 0)): THREE.Vector3 {
  const len = v.length();
  if (len < 1e-8) return fallback.clone();
  return v.clone().normalize();
}
