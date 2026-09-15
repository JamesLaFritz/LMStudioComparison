import { Vector3 } from 'three';

export class Sphere {
  position: Vector3;
  radius: number;

  constructor(x: number = 0, y: number = 0, z: number = 0, radius: number = 1) {
    this.position = new Vector3(x, y, z);
    this.radius = radius;
  }

  set(position: Vector3 | null, radius?: number): void {
    if (position) this.position.copy(position);
    if (radius !== undefined) this.radius = radius;
  }

  intersectsSphere(other: Sphere): boolean {
    const dx = this.position.x - other.position.x;
    const dy = this.position.y - other.position.y;
    const dz = this.position.z - other.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const radiusSum = this.radius + other.radius;
    return distSq <= radiusSum * radiusSum;
  }

  intersectsAABB(aabb: { minX: number; maxX: number; minY: number; maxY: number }): boolean {
    const closestX = Math.max(aabb.minX, Math.min(this.position.x, aabb.maxX));
    const closestY = Math.max(aabb.minY, Math.min(this.position.y, aabb.maxY));
    const dx = this.position.x - closestX;
    const dy = this.position.y - closestY;
    return (dx * dx + dy * dy) <= this.radius * this.radius;
  }

  containsPoint(x: number, y: number): boolean {
    const dx = this.position.x - x;
    const dy = this.position.y - y;
    return (dx * dx + dy * dy) <= this.radius * this.radius;
  }

  dispose(): void {
    // No disposable resources in Sphere
  }
}
