/**
 * Axis-Aligned Bounding Box — pure math, no Three.js coupling.
 */
export class AABB {
  min: [number, number, number];
  max: [number, number, number];

  constructor(
    minX = -0.5, minY = -0.5, minZ = -0.5,
    maxX = 0.5, maxY = 0.5, maxZ = 0.5
  ) {
    this.min = [minX, minY, minZ];
    this.max = [maxX, maxY, maxZ];
  }

  set(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): void {
    this.min[0] = minX; this.min[1] = minY; this.min[2] = minZ;
    this.max[0] = maxX; this.max[1] = maxY; this.max[2] = maxZ;
  }

  copy(other: AABB): void {
    this.min[0] = other.min[0]; this.min[1] = other.min[1]; this.min[2] = other.min[2];
    this.max[0] = other.max[0]; this.max[1] = other.max[1]; this.max[2] = other.max[2];
  }

  containsPoint(x: number, y: number, z: number): boolean {
    return x >= this.min[0] && x <= this.max[0] &&
           y >= this.min[1] && y <= this.max[1] &&
           z >= this.min[2] && z <= this.max[2];
  }

  intersects(other: AABB): boolean {
    return this.min[0] < other.max[0] && this.max[0] > other.min[0] &&
           this.min[1] < other.max[1] && this.max[1] > other.min[1] &&
           this.min[2] < other.max[2] && this.max[2] > other.min[2];
  }

  /** Returns true if any axis has a gap between the two boxes. */
  static overlap(a: AABB, b: AABB): boolean {
    return a.intersects(b);
  }

  /** Expand by delta on each side. */
  expand(dx: number, dy: number, dz: number): void {
    this.min[0] -= dx; this.min[1] -= dy; this.min[2] -= dz;
    this.max[0] += dx; this.max[1] += dy; this.max[2] += dz;
  }

  /** Merge two AABBs into a new one. */
  static merge(a: AABB, b: AABB): AABB {
    return new AABB(
      Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2]),
      Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])
    );
  }

  /** Centre of the AABB. */
  centre(): [number, number, number] {
    return [(this.min[0] + this.max[0]) / 2, (this.min[1] + this.max[1]) / 2, (this.min[2] + this.max[2]) / 2];
  }

  /** Width/height/depth. */
  size(): [number, number, number] {
    return [this.max[0] - this.min[0], this.max[1] - this.min[1], this.max[2] - this.min[2]];
  }
}
