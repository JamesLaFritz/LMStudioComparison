import { AABB } from './AABB.js';
import { Sphere } from './Sphere.js';
import * as THREE from 'three';

export class CollisionSystem {
  private static readonly MIN_OVERLAP = 0.01;

  /** Check two AABBs for overlap */
  static aabbVsAabb(a: AABB, b: AABB): boolean {
    return (
      a.min.x <= b.max.x + this.MIN_OVERLAP &&
      a.max.x >= b.min.x - this.MIN_OVERLAP &&
      a.min.y <= b.max.y + this.MIN_OVERLAP &&
      a.max.y >= b.min.y - this.MIN_OVERLAP &&
      a.min.z <= b.max.z + this.MIN_OVERLAP &&
      a.max.z >= b.min.z - this.MIN_OVERLAP
    );
  }

  /** Check sphere vs AABB */
  static sphereVsAabb(sphere: Sphere, aabb: AABB): boolean {
    const closest = new THREE.Vector3(
      Math.max(aabb.min.x, Math.min(sphere.center.x, aabb.max.x)),
      Math.max(aabb.min.y, Math.min(sphere.center.y, aabb.max.y)),
      Math.max(aabb.min.z, Math.min(sphere.center.z, aabb.max.z))
    );
    const diff = sphere.center.clone().sub(closest);
    return diff.lengthSq() <= sphere.radius * sphere.radius;
  }

  /** Check point vs AABB (for bullet-cell collisions) */
  static pointVsAabb(point: THREE.Vector3, aabb: AABB): boolean {
    return (
      point.x >= aabb.min.x && point.x <= aabb.max.x &&
      point.y >= aabb.min.y && point.y <= aabb.max.y &&
      point.z >= aabb.min.z && point.z <= aabb.max.z
    );
  }

  /** Check sphere vs sphere */
  static sphereVsSphere(a: Sphere, b: Sphere): boolean {
    const dist = a.center.distanceTo(b.center);
    return dist <= (a.radius + b.radius);
  }

  /** Get AABB from any Mesh with an optional bounding sphere fallback */
  static getAABBFromMesh(mesh: THREE.Object3D, halfExtents?: THREE.Vector3): AABB {
    const size = halfExtents || new THREE.Vector3(0.5, 0.5, 0.5);
    const center = new THREE.Vector3();
    if (mesh.isMesh && mesh.geometry) {
      const box = new THREE.Box3().setFromObject(mesh);
      box.getCenter(center);
      return AABB.fromCenter(center, size);
    }
    mesh.getWorldPosition(center);
    return AABB.fromCenter(center, size);
  }

  /** Get sphere from any Mesh */
  static getSphereFromMesh(mesh: THREE.Object3D, radius?: number): Sphere {
    const r = radius || 0.5;
    const center = new THREE.Vector3();
    if (mesh.isMesh && mesh.geometry) {
      const box = new THREE.Box3().setFromObject(mesh);
      box.getCenter(center);
    } else {
      mesh.getWorldPosition(center);
    }
    return new Sphere(center, r);
  }

  /** Resolve collision by separating two objects along the overlap axis */
  static resolveAABB(a: AABB, b: AABB): THREE.Vector3 {
    const overlapX = Math.min(a.max.x - b.min.x, b.max.x - a.min.x);
    const overlapY = Math.min(a.max.y - b.min.y, b.max.y - a.min.y);
    const overlapZ = Math.min(a.max.z - b.min.z, b.max.z - a.min.z);

    const minOverlap = Math.min(overlapX, overlapY, overlapZ);

    if (minOverlap === overlapX) {
      return new THREE.Vector3(minOverlap, 0, 0);
    } else if (minOverlap === overlapY) {
      return new THREE.Vector3(0, minOverlap, 0);
    }
    return new THREE.Vector3(0, 0, minOverlap);
  }
}
